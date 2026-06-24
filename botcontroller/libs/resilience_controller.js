/**
 * resilience_controller.js – Central event collector for unusual bot behaviour.
 *
 * Lightweight register/report facility. No built-in reactions.
 * Decisions (auto-repair, ignore, escalate) are delegated to the caller
 * or a future configuration layer.
 */

const fs = require('fs');
const path = require('path');
const { parse_config_file } = require('../../common/config_parser');

class ResilienceController {
    constructor(controller) {
        this.controller = controller;
        this.config = {};
        this.duplicate_ids_detected = false;
        this.duplicate_ids_list = [];
        this._loaded = false;
        this._mb_timer = null;
        this._last_action = "";
        this._last_action_ts = "";
        this._logPath = path.join(__dirname, '..', 'logs', 'resilience.log');
        this._initLogFile();
        // Config laden
        let cfgPath = path.join(__dirname, '..', 'resilience.cfg');
        try {
            if (fs.existsSync(cfgPath)) {
                this.config = parse_config_file(cfgPath);
                this._loaded = true;
            }
        } catch (e) { /* silent */ }
        if (this.config.mb_auto_check === true || String(this.config.mb_auto_check ?? "false").trim() === "true") {
            this._start_mb_check_timer();
        }
    }

    _initLogFile() {
        try {
            const dir = path.dirname(this._logPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const startTz = String(this.controller?.config?.timezone ?? "").trim() || "UTC";
            const startTs = new Date().toLocaleString('sv-SE', { timeZone: startTz, hour12: false });
            fs.writeFileSync(this._logPath, "# resilience.log\n# started: " + startTs + " " + startTz + "\n", 'utf8');
        } catch (e) { /* silent */ }
    }

    _log(msg) {
        try {
            const tz = String(this.controller?.config?.timezone ?? "").trim() || "UTC";
            const ts = new Date().toLocaleString('sv-SE', { timeZone: tz, hour12: false });
            const line = "[" + ts + "] " + msg + "\n";
            fs.appendFileSync(this._logPath, line, 'utf8');
        } catch (e) { /* silent */ }
    }

    _start_mb_check_timer() {
        let interval = parseInt(this.config.mb_auto_check_interval_sec ?? 15, 10);
        if (!interval || interval < 5) interval = 15;
        this._mb_timer = setInterval(() => { this._mb_check_cycle(); }, interval * 1000);
        this._log("MB auto-check started (interval=" + interval + "s, action=" + (this.config.mb_auto_check_action || "warning") + ")");
    }

    _stop_mb_check_timer() {
        if (this._mb_timer) {
            clearInterval(this._mb_timer);
            this._mb_timer = null;
            this._log("MB auto-check stopped");
        }
    }

    async _mb_check_cycle() {
        // Erster Ping-Durchlauf
        let result = await this.check_mbs();
        if (!result || !result.mbs) return;
        let confirm = null;
        let offline = [];
        for (let mid in result.mbs) {
            let mb = result.mbs[mid];
            if (!mb.online) offline.push(mid);
        }
        if (offline.length > 0) {
            let msg = offline.length + " MB(s) not reachable (first check): " + offline.join(", ");
            this._log("[CHECK] " + msg);

            // Zweistufige Prüfung: 500ms warten und erneut pingen
            this._log("[CHECK] Waiting 500ms for confirm ping...");
            await this._sleep(500);
            confirm = await this.check_mbs();
            let still_offline = [];
            if (confirm && confirm.mbs) {
                for (let mid of offline) {
                    if (confirm.mbs[mid] && !confirm.mbs[mid].online) still_offline.push(mid);
                }
            }

            if (still_offline.length > 0) {
                let confirmMsg = still_offline.length + " MB(s) confirmed unreachable: " + still_offline.join(", ");
                this._log("[WARNING] " + confirmMsg);
                console.log("[RESILIENCE WARNING] " + confirmMsg);
                this._set_last_action(still_offline.length + " MB(s) unreachable: " + still_offline.join(", "));

                let action = String(this.config.mb_auto_check_action ?? "warning").trim().toLowerCase();
                if (action === "repair") {
                    let adc = this.controller.accessDomainController;
                    if (adc && typeof adc.adc_disable_mb === "function") {
                        let any_disabled = false;
                        for (let mid of still_offline) {
                            let mb = adc.helper_masterbots?.[mid];
                            if (mb && mb.active === false) {
                                this._log("[REPAIR] MB " + mid + " already disabled – skipping");
                                this._set_last_action("MB " + mid + " offline (already disabled)");
                            } else {
                                this._log("[REPAIR] Disabling unreachable MB: " + mid);
                                adc.adc_disable_mb(mid);
                                any_disabled = true;
                            }
                        }
                        if (any_disabled) {
                            this._log("[REPAIR] Running adc_assign_proximity after MB disable(s)");
                            if (typeof adc.adc_assign_proximity === "function") {
                                adc.adc_assign_proximity();
                            }
                        } else {
                            this._log("[REPAIR] No newly disabled MBs – skipping assign_proximity");
                        }
                    }
                }
            } else {
                this._log("[CHECK] Confirm ping: all previously unreachable MBs are reachable now – no action taken");
            }
        } else {
            this._log("MB check: all MBs reachable");
        }

        // Stufe 4: Deaktivierte MBs prüfen und bei Erreichbarkeit reaktivieren
        let action = String(this.config.mb_auto_check_action ?? "warning").trim().toLowerCase();
        if (action === "repair") {
            let adc = this.controller.accessDomainController;
            if (adc && adc.helper_masterbots) {
                for (let mid in adc.helper_masterbots) {
                    let mb = adc.helper_masterbots[mid];
                    if (mb.type !== "masterbot" || mb.active !== false) continue;
                    // Prüfen ob der MB jetzt erreichbar ist
                    let is_online = false;
                    if (result && result.mbs && result.mbs[mid] && result.mbs[mid].online) is_online = true;
                    if (!is_online && confirm && confirm.mbs && confirm.mbs[mid] && confirm.mbs[mid].online) is_online = true;
                    if (is_online && typeof adc.adc_enable_mb === "function") {
                        this._log("[REPAIR] MB " + mid + " is reachable again – re-enabling");
                        let enableRet = adc.adc_enable_mb(mid);
                        if (enableRet && enableRet.ok) {
                            this._log("[REPAIR] Re-enabled MB: " + mid + " – running adc_assign_proximity");
                            this._set_last_action("Re-enabled MB " + mid + " (was disabled, now reachable)");
                            if (typeof adc.adc_assign_proximity === "function") {
                                adc.adc_assign_proximity();
                            }
                        }
                    }
                }
            }
        }
    }

    _set_last_action(msg) {
        this._last_action = msg;
        const tz = String(this.controller?.config?.timezone ?? "").trim() || "UTC";
        this._last_action_ts = new Date().toLocaleString('sv-SE', { timeZone: tz, hour12: false });
    }

    //
    // check_if_inactive(x, y, z)
    // Checks if a specific coordinate hosts an inactive bot.
    // Finds a known neighbor bot, sends an RCHECK to it, and looks for
    // a 'b' (blocked/inactive) status at the slot facing (x,y,z).
    // Returns { bot_found, inactive, neighbor_used, slot, status }
    //
    async check_if_inactive(x, y, z) {
        let tx = Number(x), ty = Number(y), tz = Number(z);
        let result = { ok: false, error: "NO_NEIGHBOR_FOUND", x: tx, y: ty, z: tz };

        // Nachbarn im Weltmodell suchen (±1 orthogonal)
        let neighbor_dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        let neighbor_candidates = [];
        for (let d of neighbor_dirs) {
            let nx = tx + d[0], ny = ty + d[1], nz = tz + d[2];
            let idx = null;
            for (let bi = 0; bi < this.controller.bots.length; bi++) {
                if (this.controller.bots[bi] &&
                    Number(this.controller.bots[bi].x) === nx &&
                    Number(this.controller.bots[bi].y) === ny &&
                    Number(this.controller.bots[bi].z) === nz) {
                    idx = bi; break;
                }
            }
            if (idx !== null && idx !== undefined) {
                let bot = this.controller.bots[idx];
                if (bot.masterbot > 0) continue;
                let slot = this.controller.get_cell_slot_byvector(
                    -d[0], -d[1], -d[2],
                    Number(bot.vector_x), Number(bot.vector_y), Number(bot.vector_z)
                );
                if (slot) { neighbor_candidates.push({ bot: bot, slot: slot, dx: d[0], dy: d[1], dz: d[2] }); }
            }
        }

        if (neighbor_candidates.length === 0) return result;

        // Jeden Nachbarn der Reihe nach probieren
        let finalResult = { ok: true, bot_found: false, inactive: false, neighbor_used: "", slot: "", status: "timeout", position: { x: tx, y: ty, z: tz } };

        for (let nc of neighbor_candidates) {
            let nb = nc.bot;
            let nslot = nc.slot;

            // Adresse vom zugewiesenen MB des Nachbarn aus rechnen
            let mbStart = { x: 0, y: 0, z: 0 };
            let adcInst = this.controller.accessDomainController;
            if (adcInst) {
                let connInfo = adcInst.adc_getConnectorForBot(nb.id);
                if (connInfo && adcInst.helper_masterbots[connInfo.hmb_id]) {
                    let mb = adcInst.helper_masterbots[connInfo.hmb_id];
                    mbStart = { x: Number(mb.pos.x), y: Number(mb.pos.y), z: Number(mb.pos.z) };
                }
            }

            // Adresse unter Ausschluss der Zielposition (um inaktive Bots zu umgehen)
            let blockedPos = [];
            for (let bi = 0; bi < this.controller.bots.length; bi++) {
                if (this.controller.bots[bi] &&
                    Number(this.controller.bots[bi].x) === tx &&
                    Number(this.controller.bots[bi].y) === ty &&
                    Number(this.controller.bots[bi].z) === tz) {
                    blockedPos.push(this.controller.bots[bi]); break;
                }
            }
            let adr = this.controller.get_mb_returnaddr(mbStart,
                { x: Number(nb.x), y: Number(nb.y), z: Number(nb.z) },
                this.controller.bots, blockedPos, { routing_mode: "standard", exclude_masterbots: true });
            if (!adr || adr === "") {
                adr = this.controller.get_mb_returnaddr(mbStart,
                    { x: Number(nb.x), y: Number(nb.y), z: Number(nb.z) },
                    this.controller.bots, [], { routing_mode: "standard", exclude_masterbots: true });
                if (!adr || adr === "") continue;
            }

            let firstindex = this.controller.getKey_3d(mbStart.x, mbStart.y, mbStart.z);
            let retaddr = this.controller.get_inverse_address(firstindex, adr);
            if (!retaddr || retaddr === "") continue;

            let cmd = adr + "#CHECK#" + nslot + "#" + retaddr;
            if (typeof this.controller.sign === "function") cmd = this.controller.sign(cmd);

            let connector_id = "C0";
            if (adcInst) {
                let connInfo = adcInst.adc_getConnectorForBot(nb.id);
                if (connInfo) connector_id = connInfo.connector_id;
            }

            let checkId = "CIC_" + Date.now() + "_" + Math.random().toString(36).substr(2, 3);
            if (!this.controller._check_waiting) this.controller._check_waiting = {};
            this.controller._check_waiting[checkId] = { status: null, slot: nslot };

            if (adcInst && typeof adcInst.adc_sendPush === "function") adcInst.adc_sendPush(connector_id, cmd);

            // Warten auf Antwort (max 2s)
            let waited = 0;
            while (waited < 2000) {
                if (adcInst && typeof adcInst.adc_popAll === "function") adcInst.adc_popAll();
            let entry = this.controller._check_waiting[checkId];
            if (entry && entry.status !== null) {
                let isBlocked = (entry.status === 'OFFL' || entry.status === 'b');
                if (isBlocked && typeof this.controller.register_inactive_detected === "function") {
                    this.controller.register_inactive_detected(tx, ty, tz,
                        nb.vector_x, nb.vector_y, nb.vector_z, nb.id, nslot);
                    if (typeof this.controller.notify_frontend === "function") {
                        this.controller.notify_frontend([{ event: "addbot", botid: "INACTIVE_" + tx + "_" + ty + "_" + tz }]);
                    }
                }
                delete this.controller._check_waiting[checkId];
                return {
                    ok: true, bot_found: isBlocked, inactive: isBlocked,
                    neighbor_used: nb.id, slot: nslot, status: entry.status,
                    position: { x: tx, y: ty, z: tz }
                };
            }
            await this._sleep(100);
            waited += 100;
        }

        // Timeout für diesen Nachbarn – nächsten versuchen
        delete this.controller._check_waiting[checkId];
        finalResult.neighbor_used = nb.id;
        finalResult.slot = nslot;
        } // for neighbor_candidates

        return finalResult;
    }

    // Hilfsfunktion: async sleep
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    //
    // check_mbs()
    // Checks all MBs/hMBs by sending a ping to their first configured slot via ADC.
    //
    async check_mbs() {
        let results = {};
        let adc = this.controller.accessDomainController;
        if (!adc || !adc.helper_masterbots) {
            return { ok: false, error: "ADC_NOT_AVAILABLE" };
        }
        if (!this.controller.ping_waiting_info) this.controller.ping_waiting_info = {};
        if (!this.controller.ping_seq) this.controller.ping_seq = 0;

        let pings_sent = 0;

        for (let mid in adc.helper_masterbots) {
            let mb = adc.helper_masterbots[mid];
            if (mb.type !== "masterbot") continue;

            let slotList = String(mb.slots ?? "F").split(",").map(s => s.trim().toUpperCase());
            let firstSlot = slotList[0] || "F";
            let mbBotIdx = this.controller.get_bot_by_id(mid, this.controller.bots);
            if (mbBotIdx === null || mbBotIdx === undefined) {
                results[mid] = { role: mb.role, connector: mb.connector_id || "", active: mb.active !== false, online: false, error: "MB_NOT_IN_WORLDMODEL", position: mb.pos || { x: 0, y: 0, z: 0 } };
                continue;
            }
            let mbBot = this.controller.bots[mbBotIdx];
            let fPos = this.controller.get_next_target_coor(mbBot.x, mbBot.y, mbBot.z, mbBot.vector_x, mbBot.vector_y, mbBot.vector_z, firstSlot);
            if (!fPos) {
                results[mid] = { role: mb.role, connector: mb.connector_id || "", active: mb.active !== false, online: false, error: "F_SLOT_NOT_FOUND", position: mb.pos || { x: 0, y: 0, z: 0 } };
                continue;
            }
            let adr = this.controller.get_mb_returnaddr(
                { x: Number(mb.pos.x), y: Number(mb.pos.y), z: Number(mb.pos.z) },
                { x: Number(fPos.x), y: Number(fPos.y), z: Number(fPos.z) },
                this.controller.bots, [], { routing_mode: "standard", exclude_masterbots: true }
            );
            if (!adr || adr === "") {
                results[mid] = { role: mb.role, connector: mb.connector_id || "", active: mb.active !== false, online: false, error: "NO_ROUTE", position: mb.pos || { x: 0, y: 0, z: 0 } };
                continue;
            }

            this.controller.ping_seq++;
            let tmpid = "MBC" + this.controller.ping_seq;
            let firstindex = this.controller.getKey_3d(Number(mb.pos.x), Number(mb.pos.y), Number(mb.pos.z));
            let retaddr = this.controller.get_inverse_address(firstindex, adr);
            let cmd = adr + "#INFO#" + tmpid + "#" + retaddr;
            cmd = this.controller.sign(cmd);

            this.controller.ping_waiting_info[tmpid] = { x: Number(fPos.x), y: Number(fPos.y), z: Number(fPos.z), addr: adr, status: 0, stl_id: firstindex, timestamp: Date.now() };
            if (adc.adc_sendPush) adc.adc_sendPush(mb.connector_id, cmd);
            results[mid] = { role: mb.role || "helper", connector: mb.connector_id || "", active: mb.active !== false, online: false, ping_sent: true, position: mb.pos || { x: 0, y: 0, z: 0 }, tmpid: tmpid, adr: adr };
            pings_sent++;
        }

        if (pings_sent > 0) {
            let wait_start = Date.now();
            let max_wait = 3000;
            while (Date.now() - wait_start < max_wait) {
                if (typeof this.controller.accessDomainController?.adc_popAll === "function") {
                    this.controller.accessDomainController.adc_popAll();
                }
                let all_done = true;
                for (let mid in results) {
                    let r = results[mid];
                    if (r.ping_sent && !r.online && r.tmpid) {
                        let entry = this.controller.ping_waiting_info[r.tmpid];
                        if (entry && entry.status === 1) { r.online = true; r.ping_ok = true; }
                        else { all_done = false; }
                    }
                }
                if (all_done) break;
                await this._sleep(100);
            }
        }

        for (let mid in results) {
            let r = results[mid];
            if (r.tmpid && this.controller.ping_waiting_info[r.tmpid]) delete this.controller.ping_waiting_info[r.tmpid];
        }
        return { ok: true, mbs: results };
    }

    //
    // diagnose_bot_address(botId)
    // Walks the address path of a bot hop by hop, checks each intermediate position
    // for inactive bots, registers any found, and triggers recalibrate.
    // Returns a diagnostic report.
    //
    async diagnose_bot_address(botId) {
        let report = {
            ok: true,
            bot_id: botId,
            start_pos: null,
            hops: [],
            inactive_found: [],
            recalibrate_triggered: false,
            message: ""
        };

        // Bot im Weltmodell finden
        let botIdx = this.controller.get_bot_by_id(botId, this.controller.bots);
        if (botIdx === null || botIdx === undefined) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }
        let bot = this.controller.bots[botIdx];
        let adr = String(bot.adress ?? "").trim();
        if (!adr) {
            return { ok: false, error: "BOT_HAS_NO_ADDRESS", bot_id: botId };
        }

        // Startposition: zugeordneter MB/hMB oder primary MB
        let startPos = { x: 0, y: 0, z: 0 };
        let adcInst = this.controller.accessDomainController;
        if (adcInst) {
            let connInfo = adcInst.adc_getConnectorForBot(bot.id);
            if (connInfo && adcInst.helper_masterbots[connInfo.hmb_id]) {
                let mb = adcInst.helper_masterbots[connInfo.hmb_id];
                startPos = { x: Number(mb.pos.x), y: Number(mb.pos.y), z: Number(mb.pos.z) };
            }
        }
        report.start_pos = { x: startPos.x, y: startPos.y, z: startPos.z };

        // Slot → relative Richtung (ohne Orientierung)
        let slot_to_delta = {
            F: [1, 0, 0], R: [0, 0, -1], B: [-1, 0, 0],
            L: [0, 0, 1], T: [0, 1, 0], D: [0, -1, 0]
        };

        // Adresse Hop für Hop ablaufen
        let cx = Number(startPos.x), cy = Number(startPos.y), cz = Number(startPos.z);

        for (let s = 0; s < adr.length; s++) {
            let slotChar = adr[s];
            let d = slot_to_delta[slotChar];
            if (!d) {
                report.hops.push({ index: s, slot: slotChar, error: "UNKNOWN_SLOT" });
                continue;
            }

            // Bot an aktueller Position finden (für Orientierung)
            let curIdx = null;
            for (let bi = 0; bi < this.controller.bots.length; bi++) {
                let b = this.controller.bots[bi];
                if (b && Number(b.x) === cx && Number(b.y) === cy && Number(b.z) === cz) {
                    curIdx = bi; break;
                }
            }

            if (curIdx === null) {
                report.hops.push({ index: s, slot: slotChar, from: { x: cx, y: cy, z: cz }, error: "NO_BOT_AT_POSITION" });
                break;
            }

            let curBot = this.controller.bots[curIdx];
            let vx = Number(curBot.vector_x ?? 0);
            let vy = Number(curBot.vector_y ?? 0);
            let vz = Number(curBot.vector_z ?? 0);

            // Relativen Slot-Vektor mit Orientierung transformieren
            // right = cross(F, up) mit up = (0,1,0)
            let rx = -vz, rz = vx;
            let wx = d[0] * vx + d[1] * rx;
            let wy = d[0] * vy + d[1] * 0 + d[2] * 1;
            let wz = d[0] * vz + d[1] * rz;

            let nx = cx + Math.round(wx);
            let ny = cy + Math.round(wy);
            let nz = cz + Math.round(wz);

            // Zwischenposition prüfen
            let hopInfo = {
                index: s,
                slot: slotChar,
                from: { x: cx, y: cy, z: cz, id: curBot.id },
                to: { x: nx, y: ny, z: nz },
                status: "pending"
            };

            // check_if_inactive für diese Position
            let checkResult = await this.check_if_inactive(nx, ny, nz);
            if (checkResult && checkResult.inactive === true) {
                hopInfo.status = "OFFL";
                hopInfo.check_result = checkResult;
                report.inactive_found.push({ x: nx, y: ny, z: nz, neighbor_used: checkResult.neighbor_used, slot: checkResult.slot });
                report.hops.push(hopInfo);
                // Sofort recalibrate_bot_addresses nach jedem Fund
                if (typeof this.controller.apicall_recalibrate_bot_addresses === "function") {
                    this.controller.apicall_recalibrate_bot_addresses("standard");
                    report.recalibrate_triggered = true;
                }
            } else if (checkResult && checkResult.status === "OK") {
                hopInfo.status = "OK";
                report.hops.push(hopInfo);
            } else {
                hopInfo.status = "unknown";
                hopInfo.check_result = checkResult;
                report.hops.push(hopInfo);
            }

            cx = nx; cy = ny; cz = nz;
        }

        if (report.inactive_found.length > 0) {
            report.message = report.inactive_found.length + " inactive bot(s) found on address path of " + botId;
        } else {
            report.message = "All " + adr.length + " hops on address path of " + botId + " are OK";
        }

        return report;
    }

    //
    // check_duplicate_ids(botId)
    //
    check_duplicate_ids(botId) {
        if (!botId) return;
        if (String(this.config.register_duplicate_ids ?? "false").trim() !== "true") return;
        if (!this.duplicate_ids_list.includes(botId)) {
            this.duplicate_ids_list.push(botId);
            console.log("[RESILIENCE WARNING] Duplicate bot ID detected: " + botId + " – consistent cluster control is not possible.");
        }
        this.duplicate_ids_detected = true;
    }

    reset_duplicate_ids() {
        this.duplicate_ids_detected = false;
        this.duplicate_ids_list = [];
    }

    report_summary() {
        let summary = { status: "NOT_IMPLEMENTED_YET" };
        if (this._loaded) {
            if (this.duplicate_ids_detected) {
                summary = { status: "alerts", duplicate_ids: this.duplicate_ids_list.length };
            } else {
                summary = { status: "active" };
            }
            summary.mb_auto_check = this.config.mb_auto_check === true || String(this.config.mb_auto_check ?? "false").trim() === "true";
            if (this._last_action) {
                summary.last_action = this._last_action;
                summary.last_action_ts = this._last_action_ts;
            }
        }
        return summary;
    }

    report_detailed() {
        let ret = {
            ok: true,
            answer: "api_get_resilience_status",
            status: "NOT_IMPLEMENTED_YET",
            message: "Resilience monitoring has not been activated yet."
        };
        if (this._loaded) {
            ret.config_loaded = true;
            ret.register_duplicate_ids = String(this.config.register_duplicate_ids ?? "false").trim() === "true";
            ret.duplicate_ids_detected = this.duplicate_ids_detected;
            ret.duplicate_ids_list = [...this.duplicate_ids_list];
            ret.mb_auto_check = this.config.mb_auto_check === true || String(this.config.mb_auto_check ?? "false").trim() === "true";
            ret.mb_auto_check_interval_sec = parseInt(this.config.mb_auto_check_interval_sec ?? 15, 10);
            ret.mb_auto_check_action = String(this.config.mb_auto_check_action ?? "warning").trim();
            if (this._last_action) {
                ret.last_action = this._last_action;
                ret.last_action_ts = this._last_action_ts;
            }
            if (this.duplicate_ids_detected) {
                ret.status = "alerts";
                ret.message = "Duplicate bot IDs detected during scan. Duplicate bot IDs cause critical misbehaviour – consistent cluster control is not possible.";
            } else {
                ret.status = "active";
                ret.message = "Resilience monitoring active";
            }
        }
        return ret;
    }
}

module.exports = ResilienceController;
