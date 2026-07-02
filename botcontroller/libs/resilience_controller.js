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

        // ================================================================
        // Bot Resilience Scores (0.0 = critical, 1.0 = perfect)
        // Indexed by bot ID (first known ID is the primary key).
        // Each bot gets its own entry on first interaction.
        //
        // Structure:
        //   botScores[botId] = {
        //     score_id_transmission: {           // ID reliability
        //       value: 1.0,                       // current score 0.0–1.0
        //       total_responses: 0,               // total ping/scan responses counted
        //       unexpected_id_count: 0,           // responses with mismatched ID
        //       last_unexpected_id: null,          // last fake ID seen
        //       last_seen_ts: null                // timestamp of last response
        //     },
        //     score_bot_reachable:     { value: 1.0 },  // future
        //     score_slot_reliability:  { value: 1.0 },  // future
        //     score_movement:          { value: 1.0 },  // future
        //     score_coupling:          { value: 1.0 },  // future
        //     score_position:          { value: 1.0 },  // future
        //     score_orientation:       { value: 1.0 },  // future
        //   };
        // ================================================================
        this.botScores = {};
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
                let isActive = (entry.status === 'OK' || entry.status === 'active');
                if (isBlocked && typeof this.controller.register_inactive_detected === "function") {
                    this.controller.register_inactive_detected(tx, ty, tz,
                        nb.vector_x, nb.vector_y, nb.vector_z, nb.id, nslot);
                    if (typeof this.controller.notify_frontend === "function") {
                        this.controller.notify_frontend([{ event: "addbot", botid: "INACTIVE_" + tx + "_" + ty + "_" + tz }]);
                    }
                } else if (isActive) {
                    // Bot gefunden (aktiv) – Position im Weltmodell aktualisieren
                    for (let bi = 0; bi < this.controller.bots.length; bi++) {
                        let b = this.controller.bots[bi];
                        if (b && Number(b.x) === tx && Number(b.y) === ty && Number(b.z) === tz) {
                            // Bot already at this position – no update needed
                        } else {
                            // Check if this bot is in detected_inactive_bots → remove
                            if (Array.isArray(this.controller.detected_inactive_bots)) {
                                let cKey = this.controller.getKey_3d(tx, ty, tz);
                                this.controller.detected_inactive_bots = this.controller.detected_inactive_bots.filter(d => {
                                    let dKey = this.controller.getKey_3d(Number(d.x), Number(d.y), Number(d.z));
                                    return dKey !== cKey;
                                });
                            }
                        }
                    }
                    if (typeof this.controller.apicall_gui_refresh === "function") {
                        this.controller.apicall_gui_refresh();
                    }
                }
                delete this.controller._check_waiting[checkId];
                return {
                    ok: true, bot_found: isBlocked || isActive, inactive: isBlocked,
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
    // trace_move_path(botId, targetX, targetY, targetZ)
    // Traces the planned movement path of a bot step by step.
    // For each coordinate on the path, calls verify_bot_position to check
    // if the bot is there. Continues through all coordinates – does not stop
    // at the first find.
    // At the end: recalibrate + gui refresh.
    //
    async trace_move_path(botId, targetX, targetY, targetZ) {
        let report = {
            ok: true,
            bot_id: botId,
            target: { x: Number(targetX), y: Number(targetY), z: Number(targetZ) },
            steps: [],
            found_at: null,
            found: false,
            message: ""
        };

        let botIdx = this.controller.get_bot_by_id(botId, this.controller.bots);
        if (botIdx === null || botIdx === undefined) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        // Pfad per find_path_for_bot berechnen
        let pathRet = null;
        try {
            pathRet = this.controller.apicall_find_path_for_bot(botId, targetX, targetY, targetZ);
        } catch(e) {
            return { ok: false, error: "FIND_PATH_FAILED", details: e.message, bot_id: botId };
        }
        if (!pathRet || !pathRet.path_found || !Array.isArray(pathRet.path)) {
            return { ok: false, error: "PATH_NOT_FOUND", bot_id: botId, target: { x: Number(targetX), y: Number(targetY), z: Number(targetZ) } };
        }

        // Eindeutige Koordinaten aus dem Pfad extrahieren
        let uniqueCoords = [];
        let seen = new Set();
        for (let s of pathRet.path) {
            let key = Number(s.x) + "," + Number(s.y) + "," + Number(s.z);
            if (!seen.has(key)) { seen.add(key); uniqueCoords.push({ x: Number(s.x), y: Number(s.y), z: Number(s.z) }); }
        }

        // Alle Koordinaten durchgehen (inklusive Start – verify_bot_position
        // prüft Position UND Orientation und ist harmlos bei Leerstand)
        for (let ci = 0; ci < uniqueCoords.length; ci++) {
            let coord = uniqueCoords[ci];
            let stepInfo = { index: ci, x: coord.x, y: coord.y, z: coord.z, status: "pending" };

            // verify_bot_position für jede Koordinate
            try {
                let vRet = await this.verify_bot_position(botId, coord.x, coord.y, coord.z);
                if (vRet && vRet.bot_found === true) {
                    stepInfo.status = "FOUND";
                    stepInfo.action = vRet.action;
                    report.found_at = { x: coord.x, y: coord.y, z: coord.z };
                    report.found = true;
                } else if (vRet && (vRet.action === "empty" || vRet.action === "marked_inactive")) {
                    stepInfo.status = "EMPTY";
                } else {
                    stepInfo.status = vRet?.action || "unknown";
                }
            } catch(e) {
                stepInfo.status = "verify_failed";
            }

            report.steps.push(stepInfo);
        }

        // Abschliessendes recalibrate + gui refresh
        if (typeof this.controller.apicall_recalibrate_bot_addresses === "function") {
            this.controller.apicall_recalibrate_bot_addresses("standard");
        }
        if (typeof this.controller.apicall_gui_refresh === "function") {
            this.controller.apicall_gui_refresh();
        }

        if (report.found) {
            report.message = "Bot " + botId + " found at (" + report.found_at.x + "," + report.found_at.y + "," + report.found_at.z + ")";
        } else {
            report.message = "Bot " + botId + " not found on any of " + uniqueCoords.length + " path steps";
        }
        return report;
    }

    //
    // verify_bot_position(botId, x, y, z)
    // Checks if a bot is at a specific coordinate.
    // If found: updates bot position in world model + recalibrate.
    // If not found: removes bot from old position, marks as inactive + recalibrate.
    // Explicit, deliberate – no automatic side effects.
    //
    async verify_bot_position(botId, x, y, z) {
        let result = {
            ok: true,
            bot_id: botId,
            check_position: { x: Number(x), y: Number(y), z: Number(z) },
            bot_found: false,
            action: "none",
            message: ""
        };

        // Bot im Weltmodell finden
        let botIdx = this.controller.get_bot_by_id(botId, this.controller.bots);
        if (botIdx === null || botIdx === undefined) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }
        let bot = this.controller.bots[botIdx];
        let oldPos = { x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) };
        result.old_position = oldPos;

        // 1. Check_if_inactive auf die Zielkoordinate
        let checkRet = await this.check_if_inactive(x, y, z);

        if (checkRet && checkRet.bot_found === true && checkRet.status === "OK") {
            // Bot gefunden an der neuen Position
            result.bot_found = true;
            result.action = "position_updated";
            
            // Bot-Position aktualisieren
            bot.x = Number(x);
            bot.y = Number(y);
            bot.z = Number(z);
            
            // Ping auf die neue Position für Orientierung (INFO→RINFO)
            try {
                if (typeof this.controller.apicall_ping_position === "function") {
                    let pingRet = this.controller.apicall_ping_position(x, y, z);
                    if (pingRet && pingRet.accepted === true) {
                        let pingTmpId = String(pingRet.tmpid ?? "");
                        if (pingTmpId) {
                            let pingWaited = 0;
                            while (pingWaited < 1500) {
                                if (this.controller.accessDomainController &&
                                    typeof this.controller.accessDomainController.adc_popAll === "function") {
                                    this.controller.accessDomainController.adc_popAll();
                                }
                                let pEntry = this.controller.ping_waiting_info ? this.controller.ping_waiting_info[pingTmpId] : null;
                                if (pEntry && pEntry.status === 1) {
                                    // Orientierung wurde von handle_answer aktualisiert
                                    if (pEntry.vector_x !== undefined) {
                                        bot.vector_x = Number(pEntry.vector_x);
                                        bot.vector_y = Number(pEntry.vector_y);
                                        bot.vector_z = Number(pEntry.vector_z);
                                    }
                                    if (this.controller.ping_waiting_info) delete this.controller.ping_waiting_info[pingTmpId];
                                    break;
                                }
                                await this._sleep(100);
                                pingWaited += 100;
                            }
                            if (this.controller.ping_waiting_info && this.controller.ping_waiting_info[pingTmpId]) {
                                delete this.controller.ping_waiting_info[pingTmpId];
                            }
                        }
                    }
                }
            } catch(e) { /* orientation ping optional */ }
            
            // Alte Position aus detected_inactive_bots entfernen (falls vorhanden)
            if (Array.isArray(this.controller.detected_inactive_bots)) {
                let oldKey = this.controller.getKey_3d(oldPos.x, oldPos.y, oldPos.z);
                this.controller.detected_inactive_bots = this.controller.detected_inactive_bots.filter(d => {
                    let dKey = this.controller.getKey_3d(Number(d.x), Number(d.y), Number(d.z));
                    return dKey !== oldKey;
                });
            }
            
            // Log BOT_RELOCATED if position actually changed
            if (oldPos.x !== Number(x) || oldPos.y !== Number(y) || oldPos.z !== Number(z)) {
                this.log_bot_event("BOT_RELOCATED", botId, { old_pos: oldPos, new_pos: { x: Number(x), y: Number(y), z: Number(z) } });
            } else {
                // Same position, orientation corrected via ping
                this.log_bot_event("BOT_ORIENTATION_CHANGED", botId, { pos: { x: Number(x), y: Number(y), z: Number(z) } });
            }
            
            if (typeof this.controller.apicall_recalibrate_bot_addresses === "function") {
                this.controller.apicall_recalibrate_bot_addresses("standard");
            }
            if (typeof this.controller.apicall_gui_refresh === "function") {
                this.controller.apicall_gui_refresh();
            }
            
            result.message = "Bot " + botId + " found at (" + x + "," + y + "," + z + ") – position updated";
            return result;
            
        } else if (checkRet && checkRet.status === "EMPT") {
            // Koordinate ist leer
            // Nur als inaktiv markieren, wenn der Bot HIER erwartet wurde
            if (oldPos.x === Number(x) && oldPos.y === Number(y) && oldPos.z === Number(z)) {
                result.action = "marked_inactive";
                this.log_bot_event("BOT_MISSING", botId, { expected_pos: { x: Number(x), y: Number(y), z: Number(z) } });
                if (typeof this.controller.register_inactive_detected === "function") {
                    this.controller.register_inactive_detected(
                        Number(x), Number(y), Number(z),
                        Number(bot.vector_x), Number(bot.vector_y), Number(bot.vector_z),
                        "api", "verify_bot_position"
                    );
                }
                if (typeof this.controller.apicall_gui_refresh === "function") {
                    this.controller.apicall_gui_refresh();
                }
                result.message = "Bot " + botId + " expected at (" + x + "," + y + "," + z + ") but not found – marked as inactive";
            } else {
                result.action = "empty";
                result.message = "Bot " + botId + " not at (" + x + "," + y + "," + z + ") – position empty";
            }
            return result;
        } else {
            // Unbekannter Status
            result.action = "unknown";
            result.check_result = checkRet;
            result.message = "Bot " + botId + " – check returned status: " + (checkRet?.status ?? "unknown");
            return result;
        }
    }

    //
    // integrate_bot(botId)
    // Fully integrates a partially known bot into the world model:
    // assigns nearest MB, recalibrates address, GUI refresh.
    // Logs BOT_INTEGRATED in resilience.log.
    //
    async integrate_bot(botId) {
        let result = { ok: true, bot_id: botId, actions: [], message: "" };

        let botIdx = this.controller.get_bot_by_id(botId, this.controller.bots);
        let bot = null;

        if (botIdx === null || botIdx === undefined) {
            // Bot not in world model (e.g. removed via remove_bot) – ping to find it
            if (typeof this.controller.apicall_ping_position === "function") {
                // Try to find the bot via resilience's trace/ping logic
                let found = false;
                // Check ping_waiting_info for recent ping results
                if (this.controller.ping_waiting_info) {
                    for (let tmpid in this.controller.ping_waiting_info) {
                        let entry = this.controller.ping_waiting_info[tmpid];
                        if (entry && entry.status >= 0 &&
                            (String(entry.response?.bot_id ?? "").trim() === botId || entry.x !== undefined)) {
                            // Found in ping results – create bot entry
                            let pos = entry.response?.position || { x: entry.x, y: entry.y, z: entry.z };
                            let orient = entry.response?.orientation || {};
                            // Wenn die RINFO noch nicht da ist, nutzen wir die Zielkoordinate
                            if (!entry.response) {
                                pos = { x: Number(entry.x ?? 0), y: Number(entry.y ?? 0), z: Number(entry.z ?? 0) };
                            }
                            this.controller.bots.push({
                                id: botId,
                                x: Number(pos.x ?? 0),
                                y: Number(pos.y ?? 0),
                                z: Number(pos.z ?? 0),
                                vector_x: Number(orient.x ?? 0),
                                vector_y: Number(orient.y ?? 0),
                                vector_z: Number(orient.z ?? 0),
                                adress: "",
                                adress_first: "",
                                adress_short: "",
                                adress_detour: "",
                                color: "eeeeee",
                                masterbot: 0,
                                inactive: false,
                                mobility: true
                            });
                            botIdx = this.controller.get_bot_by_id(botId, this.controller.bots);
                            found = true;
                            result.actions.push("recreated_from_ping");
                            break;
                        }
                    }
                }
                if (!found) {
                    // Not found in ping cache – do a live ping
                    return { ok: false, error: "BOT_NOT_FOUND_NO_PING_DATA", bot_id: botId, message: "Ping the bot's position first with ping_position, then retry integrate_bot" };
                }
            } else {
                return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
            }
        }

        // Bot-Objekt VOR adc_assign_proximity sichern (Index könnte sich ändern)
        bot = this.controller.bots[botIdx];

        // 1. ADC proximity assignment
        let adc = this.controller.accessDomainController;
        if (adc && typeof adc.adc_assign_proximity === "function") {
            let assignRet = adc.adc_assign_proximity();
            if (assignRet && assignRet.ok) {
                result.actions.push("adc_assigned");
            }
        }

        // 2. Recalibrate address
        if (typeof this.controller.apicall_recalibrate_bot_addresses === "function") {
            this.controller.apicall_recalibrate_bot_addresses("standard");
            result.actions.push("address_recalibrated");
        }

        // 3. GUI refresh
        if (typeof this.controller.apicall_gui_refresh === "function") {
            this.controller.apicall_gui_refresh();
        }

        // 4. Set standard color (eeeeee) to match regular cluster bots
        if (bot) bot.color = "eeeeee";

        // 5. Log event
        this.log_bot_event("BOT_INTEGRATED", botId, {
            pos: { x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) },
            connector: bot.connector || "assigned"
        });

        result.message = "Bot " + botId + " fully integrated (" + result.actions.join(", ") + ")";
        return result;
    }

    //
    // log_bot_event(eventType, botId, details)
    // Logs a bot-related resilience event to resilience.log.
    // eventType: "BOT_RELOCATED" | "BOT_MISSING" | "BOT_UNKNOWN" | "BOT_INTEGRATED"
    // details: object with position info
    //
    log_bot_event(eventType, botId, details) {
        let msg = "[" + eventType + "] " + botId;
        if (details) {
            if (details.old_pos) msg += " from (" + details.old_pos.x + "," + details.old_pos.y + "," + details.old_pos.z + ")";
            if (details.new_pos) msg += " to (" + details.new_pos.x + "," + details.new_pos.y + "," + details.new_pos.z + ")";
            if (details.pos) msg += " at (" + details.pos.x + "," + details.pos.y + "," + details.pos.z + ")";
            if (details.expected_pos) msg += " expected at (" + details.expected_pos.x + "," + details.expected_pos.y + "," + details.expected_pos.z + ")";
        }
        console.log("[RESILIENCE] " + msg);
        this._log(msg);
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
            ret.register_unexpected_ids = String(this.config.register_unexpected_ids ?? "false").trim() === "true";
            ret.register_duplicate_msg = String(this.config.register_duplicate_msg ?? "false").trim() === "true";
            ret.duplicate_msg_detected = this.duplicate_msg_detected === true;
            ret.duplicate_msg_count = this.duplicate_msg_count || 0;
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

    //
    // record_message(tmpid, msgType)
    // Called on every RINFO/RCHECK to track duplicate messages.
    // Maintains a ring buffer of the last 10 tmpids.
    // When a tmpid appears twice, a duplicate is logged and counted.
    // Only active when register_duplicate_msg = true in resilience.cfg.
    //
    record_message(tmpid, msgType, botId) {
        if (String(this.config.register_duplicate_msg ?? "false").trim() !== "true") return;
        if (!tmpid || String(tmpid).trim() === "") return;
        let id = String(tmpid).trim();
        if (!this._recent_tmpids) this._recent_tmpids = [];
        if (!this._tmpid_to_bot) this._tmpid_to_bot = {};
        if (this.duplicate_msg_count === undefined) this.duplicate_msg_count = 0;

        if (this._recent_tmpids.includes(id)) {
            this.duplicate_msg_count++;
            this.duplicate_msg_detected = true;
            // Look up which bot caused this duplicate (from first occurrence)
            let dupBotId = this._tmpid_to_bot[id] || "unknown";
            this._log("DUPLICATE_MSG type=" + msgType + " tmpid=" + id +
                      " bot=" + dupBotId + " count=" + this.duplicate_msg_count);
            // Per-bot counter
            if (dupBotId && dupBotId !== "unknown") {
                this.get_bot_scores(dupBotId);
                let dc = this.botScores[dupBotId].score_msg_duplication_cnt;
                dc.value = (dc.value || 0) + 1;
            }
        } else {
            this._recent_tmpids.push(id);
            // Store bot ID for this tmpid (first occurrence)
            if (botId && String(botId).trim() !== "") {
                this._tmpid_to_bot[id] = String(botId).trim();
            }
            if (this._recent_tmpids.length > 10) {
                let removed = this._recent_tmpids.shift();
                delete this._tmpid_to_bot[removed];
            }
        }
    }

    //
    // record_id_response(expectedBotId, isMismatch, receivedId)
    // Called on every ping/scan response to track ID transmission reliability.
    // Updates total_responses and, on mismatch, unexpected_id_count.
    // Nur aktiv wenn register_unexpected_ids = true in resilience.cfg.
    //
    record_id_response(expectedBotId, isMismatch, receivedId) {
        if (String(this.config.register_unexpected_ids ?? "false").trim() !== "true") return;
        let id = String(expectedBotId).trim();
        if (!id) return;
        // Ensure entry exists
        this.get_bot_scores(id);
        let score = this.botScores[id].score_id_transmission;
        score.total_responses++;
        if (isMismatch) {
            score.unexpected_id_count++;
            score.last_unexpected_id = String(receivedId).trim();
        }
        score.last_seen_ts = Date.now();
        score.value = Math.round(Math.max(0, 1.0 - (score.unexpected_id_count / score.total_responses)) * 1000) / 1000;
        this._log("SCORE_ID bot=" + id + " received=" + receivedId + " mismatch=" + isMismatch +
                  " total=" + score.total_responses + " unexpected=" + score.unexpected_id_count +
                  " score=" + score.value.toFixed(3));
    }

    //
    // get_bot_scores(botId)
    // Returns resilience scores for one bot.
    // Creates an empty entry if the bot has no scores yet.
    //
    get_bot_scores(botId) {
        if (!botId || String(botId).trim() === "") return {};
        let id = String(botId).trim();
        if (!this.botScores[id]) {
            this.botScores[id] = {
                score_msg_duplication_cnt:  { value: 0 },
                score_id_transmission: {
                    value: 1.0,
                    total_responses: 0,
                    unexpected_id_count: 0,
                    last_unexpected_id: null,
                    last_seen_ts: null
                },
                score_bot_reachable:    { value: 1.0 },
                score_slot_reliability: { value: 1.0 },
                score_movement:         { value: 1.0 },
                score_coupling:         { value: 1.0 },
                score_position:         { value: 1.0 },
                score_orientation:      { value: 1.0 }
            };
        }
        // Return only score values (keep internals private)
        let scores = this.botScores[id];
        return {
            score_msg_duplication_cnt: scores.score_msg_duplication_cnt.value,
            score_id_transmission: scores.score_id_transmission.value
        };
    }
}

module.exports = ResilienceController;
