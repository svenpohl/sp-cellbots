/**
 * nightwatch.js – proaktive Regionen-Überwachung für SP-CellBots
 * Phase 2: Datenstruktur + Verwaltung
 */
const Logger = require('../logger');

class NightWatch {
    constructor(controller) {
        this.controller = controller;
        this.regions = {};
        this.thread_active = false;
        this.id_counter = 0;
        this._intervalId = null;
        this._botIndex = {}; // region-id -> current index for iteration-mode
        this._pendingPings = {}; // tmpid -> {region_id, key, expected, timestamp}
    }

    // Thread starten (pingt zyklisch alle Regionen)
    start() {
        if (this._intervalId) return;
        this.thread_active = true;
        this._intervalId = setInterval(() => this._tick(), 100);
    }

    // Thread stoppen
    stop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        this.thread_active = false;
    }

    // Called every 100ms (checks regions-interval_ms)
    _tick() {
        let now = Date.now();
        // Ausstehende Pings auswerten
        this._checkPendingPings();

        for (let id in this.regions) {
            let reg = this.regions[id];
            if (reg.action !== "active") continue;
            if (reg.bots.length === 0) continue;
            let elapsed = now - (reg._lastPing || 0);
            if (elapsed < reg.interval_ms) continue;
            if (!this._botIndex[id]) this._botIndex[id] = 0;

            let bot;
            if (reg.mode === "random") {
                bot = reg.bots[Math.floor(Math.random() * reg.bots.length)];
            } else {
                bot = reg.bots[this._botIndex[id] % reg.bots.length];
                this._botIndex[id]++;
            }
            if (!bot) continue;
            // Do not ping masterbot position (no route to self)
            let mb = this.controller.mb || {};
            if (Number(bot.x) === Number(mb.x) && Number(bot.y) === Number(mb.y) && Number(bot.z) === Number(mb.z)) continue;
            reg._lastPing = now;
            this._pingBot(bot, reg);
        }
    }

    // Check pending pings (RINFO processed yet?)
    _checkPendingPings() {
        let now = Date.now();
        let ctrl = this.controller;
        if (!ctrl.ping_waiting_info) return;
        let toRemove = [];
        for (let tmpid in this._pendingPings) {
            let pending = this._pendingPings[tmpid];
            let info = ctrl.ping_waiting_info[tmpid];
            if (!info) continue;

            if (info.status === 1) {
                // Bot hat geantwortet
                let reg = this.regions[pending.region_id];
                if (reg) {
                    this._evaluatePingResult(reg, pending.key, info.botid, { x: info.x, y: info.y, z: info.z });
                }
                toRemove.push(tmpid);
            } else if (now - pending.timestamp > 10000) {
                // Timeout nach 10s
                let reg = this.regions[pending.region_id];
                if (reg) {
                    this._evaluatePingResult(reg, pending.key, null, null);
                }
                toRemove.push(tmpid);
            }
        }
        for (let t of toRemove) delete this._pendingPings[t];
    }

    // Pings a coordinate and checks the response
    _pingBot(bot, reg) {
        let ctrl = this.controller;
        let key = `${Number(bot.x)},${Number(bot.y)},${Number(bot.z)}`;
        let result = ctrl.apicall_ping_position(bot.x, bot.y, bot.z);
        if (result && result.accepted && result.tmpid) {
            let tmpid = result.tmpid;
            Logger.log("WatchPing accepted: (" + bot.x + "," + bot.y + "," + bot.z + ") adr=" + (result.adress_used ?? "?") + " tmpid=" + tmpid);
            // Remember pending ping for later evaluation in _tick()
            this._pendingPings[tmpid] = {
                region_id: reg.id,
                key: key,
                expected: reg.reference[key] ?? null,
                timestamp: Date.now()
            };
        } else {
            let reason = result?.error ?? result?.reason ?? "UNKNOWN";
            Logger.log("WatchPing failed: (" + bot.x + "," + bot.y + "," + bot.z + ") reason=" + reason);
            // Also evaluate failures: bot might be missing
            this._evaluatePingResult(reg, key, null, null);
        }
    }

    // Auswertung: vergleicht Ping-Ergebnis mit Referenz (Snapshot)
    _evaluatePingResult(reg, key, respondedBotId, respondedPos) {
        let expected = reg.reference[key] ?? null;
        let changed = false;
        let detail = null;

        if (expected === null || expected === undefined) {
            // Im Snapshot war dieser Platz leer
            if (respondedBotId !== null) {
                changed = true;
                detail = { key, expected: null, found: { id: respondedBotId, pos: respondedPos }, reason: "UNEXPECTED_BOT" };
                Logger.log("WatchChange: (" + key + ") unexpected bot " + respondedBotId + " (expected empty)");
            }
        } else {
            if (respondedBotId === null) {
                // Bot fehlt!
                changed = true;
                detail = { key, expected: { id: expected.id, pos: { x: expected.x, y: expected.y, z: expected.z } }, found: null, reason: "BOT_MISSING" };
                Logger.log("WatchChange: (" + key + ") expected " + expected.id + " but BOT_MISSING");
            } else if (respondedBotId !== expected.id) {
                // Falscher Bot
                changed = true;
                detail = { key, expected: { id: expected.id, pos: { x: expected.x, y: expected.y, z: expected.z } }, found: { id: respondedBotId, pos: respondedPos }, reason: "WRONG_BOT" };
                Logger.log("WatchChange: (" + key + ") expected " + expected.id + " but found " + respondedBotId);
            }
        }

        if (changed) {
            reg.changed = true;
            if (!reg._changes) reg._changes = {};
            reg._changes[key] = detail;
        }
    }

    // Generate next free ID
    _nextId() {
        return "watch_" + (this.id_counter++);
    }

    // Create / modify / delete / snapshot / active / inactive region
    set(id, x1, y1, z1, x2, y2, z2, interval_ms, mode, watch_action) {
        if (!id || String(id).trim() === "") {
            return { ok: false, answer: "api_watch_region", error: "ID_EMPTY" };
        }
        id = String(id).trim();
        let action = String(watch_action ?? "").trim().toLowerCase();

        // Remove
        if (action === "remove") {
            delete this.regions[id];
            return { ok: true, answer: "api_watch_region", info: "removed", region_id: id };
        }

        // Get existing region or create new one
        if (!this.regions[id]) {
            this.regions[id] = {
                id: id, x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 0,
                interval_ms: 5000, mode: "iteration", action: "active",
                wakeup: false, bots: [], reference: {}, changed: false, _lastPing: 0
            };
        }
        let reg = this.regions[id];

        // Parameter aktualisieren (nur angegebene) – VOR Action-Checks!
        if (x1 !== undefined && x1 !== null && (x1 !== 0 || y1 !== 0 || z1 !== 0 || x2 !== 0 || y2 !== 0 || z2 !== 0)) {
            reg.x1 = Number(x1); reg.y1 = Number(y1); reg.z1 = Number(z1);
            reg.x2 = Number(x2); reg.y2 = Number(y2); reg.z2 = Number(z2);
            // Bounding-Box-Bots automatisch generieren + Auto-Snapshot
            reg.bots = [];
            reg.reference = {};
            for (let bx = Math.min(reg.x1, reg.x2); bx <= Math.max(reg.x1, reg.x2); bx++)
                for (let by = Math.min(reg.y1, reg.y2); by <= Math.max(reg.y1, reg.y2); by++)
                    for (let bz = Math.min(reg.z1, reg.z2); bz <= Math.max(reg.z1, reg.z2); bz++) {
                        let key = `${bx},${by},${bz}`;
                        reg.bots.push({ x: bx, y: by, z: bz });
                        let bot = (this.controller.bots || []).find(b => Number(b.x)===bx && Number(b.y)===by && Number(b.z)===bz);
                        reg.reference[key] = bot ? { id: bot.id, x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) } : null;
                    }
        }
        if (interval_ms > 0) reg.interval_ms = Number(interval_ms);
        if (mode && String(mode).trim() !== "") reg.mode = String(mode).trim().toLowerCase();
        // Action-Checks NACH Parameter-Update
        if (action === "inactive") { reg.action = "inactive"; return { ok: true, answer: "api_watch_region", info: "inactive", region_id: id }; }
        if (action === "active")   { reg.action = "active";   return { ok: true, answer: "api_watch_region", info: "active", region_id: id }; }
        if (action === "snapshot") {
            reg.reference = {};
            reg._changes = {};
            reg.changed = false;
            // Nur Bots in der Region referenzieren (nicht alle Controller-Bots)
            for (let b of reg.bots) {
                let key = `${Number(b.x)},${Number(b.y)},${Number(b.z)}`;
                let bot = (this.controller.bots || []).find(bc => Number(bc.x)===Number(b.x) && Number(bc.y)===Number(b.y) && Number(bc.z)===Number(b.z));
                reg.reference[key] = bot ? { id: bot.id, x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) } : null;
            }
            // Clear pending pings for this region
            for (let tmpid in this._pendingPings) {
                if (this._pendingPings[tmpid].region_id === id) delete this._pendingPings[tmpid];
            }
            return { ok: true, answer: "api_watch_region", info: "snapshot taken", region_id: id, bot_count: reg.bots.length };
        }
        if (action === "active" || action === "inactive") reg.action = action;

        return { ok: true, answer: "api_watch_region", info: "ok", region_id: id, bot_count: reg.bots.length };
    }

    // Add single coordinate to region (with auto-snapshot)
    addbot(id, x, y, z) {
        let reg = this.regions[id];
        if (!reg) return { ok: false, answer: "api_watch_region", error: "REGION_NOT_FOUND", region_id: id };
        let key = `${Number(x)},${Number(y)},${Number(z)}`;
        if (!reg.bots.some(b => `${b.x},${b.y},${b.z}` === key))
            reg.bots.push({ x: Number(x), y: Number(y), z: Number(z) });
        // Auto-Snapshot: welcher Bot sitzt aktuell an dieser Koordinate?
        let bot = (this.controller.bots || []).find(b => Number(b.x)===Number(x) && Number(b.y)===Number(y) && Number(b.z)===Number(z));
        reg.reference[key] = bot ? { id: bot.id, x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) } : null;
        return { ok: true, answer: "api_watch_region", info: "bot added", region_id: id, bot_count: reg.bots.length };
    }

    // Remove coordinate from region
    removebot(id, x, y, z) {
        let reg = this.regions[id];
        if (!reg) return { ok: false, answer: "api_watch_region", error: "REGION_NOT_FOUND", region_id: id };
        let key = `${Number(x)},${Number(y)},${Number(z)}`;
        reg.bots = reg.bots.filter(b => `${b.x},${b.y},${b.z}` !== key);
        return { ok: true, answer: "api_watch_region", info: "bot removed", region_id: id, bot_count: reg.bots.length };
    }

    // Alle Infos einer Region
    get(id) {
        let reg = this.regions[id];
        if (!reg) return { ok: false, answer: "api_watch_region", error: "REGION_NOT_FOUND", region_id: id };
        return {
            ok: true, answer: "api_watch_region", region_id: id,
            region: {
                x1: reg.x1, y1: reg.y1, z1: reg.z1, x2: reg.x2, y2: reg.y2, z2: reg.z2,
                interval_ms: reg.interval_ms, mode: reg.mode, action: reg.action,
                wakeup: reg.wakeup, bot_count: reg.bots.length, changed: reg.changed
            }
        };
    }

    // Changes since last poll
    poll(id) {
        if (id && String(id).trim() !== "") {
            let reg = this.regions[String(id).trim()];
            if (!reg) return { ok: false, answer: "api_watch_region", error: "REGION_NOT_FOUND", region_id: id };
            let c = reg.changed;
            let changes = reg._changes ? Object.values(reg._changes) : [];
            reg.changed = false;
            reg._changes = {};
            return { ok: true, answer: "api_watch_region", region_id: id, changed: c, info: c ? "changes detected" : "no changes", changes: changes };
        }
        // Alle Regionen pollen
        let results = {};
        for (let rid in this.regions) {
            results[rid] = this.regions[rid].changed;
            this.regions[rid].changed = false;
            this.regions[rid]._changes = {};
        }
        return { ok: true, answer: "api_watch_region", info: "poll all regions", changes: results };
    }

    // Alle Regionen auflisten
    list() {
        let list = Object.keys(this.regions).map(id => ({
            id, action: this.regions[id].action,
            mode: this.regions[id].mode,
            interval_ms: this.regions[id].interval_ms,
            bot_count: this.regions[id].bots.length,
            changed: this.regions[id].changed
        }));
        return { ok: true, answer: "api_watch_region", count: list.length, regions: list };
    }

    // High-Level: Region mit automatischer ID anlegen
    create(x1, y1, z1, x2, y2, z2, type) {
        let id = this._nextId();
        let t = String(type ?? "box").trim().toLowerCase();
        this.regions[id] = {
            id, x1: Number(x1), y1: Number(y1), z1: Number(z1),
            x2: Number(x2), y2: Number(y2), z2: Number(z2),
            interval_ms: 5000, mode: "iteration", action: "active",
            wakeup: false, bots: [], reference: {}, changed: false, _lastPing: 0
        };
        let reg = this.regions[id];
        // Bots generieren
        for (let bx = Math.min(reg.x1, reg.x2); bx <= Math.max(reg.x1, reg.x2); bx++)
            for (let by = Math.min(reg.y1, reg.y2); by <= Math.max(reg.y1, reg.y2); by++)
                for (let bz = Math.min(reg.z1, reg.z2); bz <= Math.max(reg.z1, reg.z2); bz++) {
                    if (t === "outer_bots") {
                        // Only bots with fewer than 6 orthogonal neighbors (cluster edge)
                        let botExists = (this.controller.bots || []).some(b => Number(b.x)===bx && Number(b.y)===by && Number(b.z)===bz);
                        if (botExists) {
                            let neighborDirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
                            let neighborCount = 0;
                            for (let d of neighborDirs) {
                                if ((this.controller.bots || []).some(b => Number(b.x)===bx+d[0] && Number(b.y)===by+d[1] && Number(b.z)===bz+d[2])) neighborCount++;
                            }
                            if (neighborCount < 6) reg.bots.push({ x: bx, y: by, z: bz });
                        }
                    } else {
                        reg.bots.push({ x: bx, y: by, z: bz });
                    }
                }
        // Auto-snapshot for all generated coordinates
        for (let b of reg.bots) {
            let key = `${Number(b.x)},${Number(b.y)},${Number(b.z)}`;
            let bot = (this.controller.bots || []).find(bc => Number(bc.x)===Number(b.x) && Number(bc.y)===Number(b.y) && Number(bc.z)===Number(b.z));
            reg.reference[key] = bot ? { id: bot.id, x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) } : null;
        }
        return { ok: true, answer: "api_create_watch_region", region_id: id, bot_count: reg.bots.length, type: t };
    }
}

module.exports = NightWatch;
