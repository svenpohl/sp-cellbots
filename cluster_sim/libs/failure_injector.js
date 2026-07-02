/**
 * failure_injector.js – Simulated failure injection for resilience testing.
 *
 * Provides an API (TCP port 3101) to inject faults into the cluster simulation
 * at runtime: offline bots, message loss, slot failures, displacement, etc.
 *
 * Planned failure types (v1):
 *   A1 Bot offline       B1 Disable forwarding   C1 Disable MasterBot
 *   A2 Bot stop on move  B2 Delay messages       C2 Add unknown bot
 *   A3 Bot displace      B3 Overflow msg queue   C3 Duplicate ID
 *   A4 Bot swap          B4 Disable slot
 *   A5 Bot remove        B5 Sporadic slot
 *   A6 Obstacle          B6 Corrupt messages
 *                        B7 Duplicate messages
 *                        B8 Fake neighbor ID
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

class FailureInjector {
    constructor(masterbot) {
        this.masterbot = masterbot;
        this.active = false;
    }

    //
    // setBotMobility(botId, mobile)
    // Sets a bot's mobility flag. mobile=true → bot can move, mobile=false → bot is immobile.
    // Triggers a WebGUI refresh after the change.
    //
    setBotMobility(botId, mobile) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();
        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }
        this.masterbot.bots[botIndex].mobility = (mobile === true || mobile === "true");
        // WebGUI-Refresh (direkt via ws, da send_webgui nur bei setlivelogging=true sendet)
        if (this.masterbot.ws && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.ws.send(JSON.stringify(msg));
            }
        }
        return {
            ok: true,
            bot_id: botId,
            mobility: this.masterbot.bots[botIndex].mobility
        };
    }

    //
    // setBotActive(botId, active)
    // Sets a bot's inactive flag. active=true → bot enabled, active=false → bot disabled.
    // Triggers a WebGUI refresh after the change.
    //
    setBotActive(botId, active) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        // Find bot by ID in masterbot.bots[]
        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                botIndex = i;
                break;
            }
        }

        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        let newState = active ? 0 : 1;
        bot.inactive = newState;

        // WebGUI-Refresh auslösen – vollständige Szene neu senden
        if (this.masterbot.send_webgui && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.send_webgui(JSON.stringify(msg));
            }
        }

        return {
            ok: true,
            bot_id: botId,
            active: active,
            inactive: newState
        };
    }

    //
    // removeBot(botId)
    // Completely removes a bot from the cluster simulation.
    // The bot is spliced from masterbot.bots[] and the WebGUI is refreshed.
    // Use add_bot_to to recreate the bot later.
    //
    removeBot(botId) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        // Find bot by ID in masterbot.bots[]
        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                botIndex = i;
                break;
            }
        }

        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        // Bot aus dem Array entfernen
        this.masterbot.bots.splice(botIndex, 1);

        // WebGUI-Refresh auslösen
        if (this.masterbot.send_webgui && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.send_webgui(JSON.stringify(msg));
            }
        }

        return {
            ok: true,
            bot_id: botId,
            removed: true
        };
    }

    //
    // setMoveInterruption(botId, enabled, mode, param)
    // Sets a bot's move interruption behaviour for failure injection.
    // enabled=true → bot will stop during MOVE execution.
    // mode = "half_way" | "random" | "after"
    // param = probability (random) or step count (after)
    //
    setMoveInterruption(botId, enabled, mode, param) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                botIndex = i;
                break;
            }
        }

        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        bot.move_interruption_enabled = (enabled === true || enabled === "true");
        bot.move_interruption_mode    = String(mode || "half_way").trim().toLowerCase();
        bot.move_interruption_param   = Number(param ?? 0);
        bot.move_interruption_counter = 0;

        if (this.masterbot.send_webgui && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.send_webgui(JSON.stringify(msg));
            }
        }

        return {
            ok: true,
            bot_id: botId,
            enabled: bot.move_interruption_enabled,
            mode: bot.move_interruption_mode,
            param: bot.move_interruption_param
        };
    }

    //
    // teleportBot(botId, x, y, z, vx, vy, vz)
    // Teleports a bot to an absolute position without moving it through the mesh.
    // Useful for failure injection (displace, remove, swap scenarios).
    // Triggers a WebGUI refresh.
    //
    teleportBot(botId, x, y, z, vx, vy, vz) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                botIndex = i;
                break;
            }
        }

        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        bot.x = Number(x ?? 0);
        bot.y = Number(y ?? 0);
        bot.z = Number(z ?? 0);
        // Orientation nur überschreiben, wenn explizit angegeben
        if (vx !== undefined) bot.vector_x = Number(vx);
        if (vy !== undefined) bot.vector_y = Number(vy);
        if (vz !== undefined) bot.vector_z = Number(vz);

        // WebGUI-Refresh
        if (this.masterbot.send_webgui && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.send_webgui(JSON.stringify(msg));
            }
        }

        return {
            ok: true,
            bot_id: botId,
            position: { x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) },
            orientation: { x: Number(bot.vector_x), y: Number(bot.vector_y), z: Number(bot.vector_z) }
        };
    }

    //
    // addBot(botId, x, y, z, vx, vy, vz)
    // Creates a new bot in the cluster simulation that the BotController
    // does not know about yet (Fehlertyp 17 - Add unknown bot).
    // Useful for testing BotController scan discovery of new bots.
    //
    addBot(botId, x, y, z, vx, vy, vz) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        // Prüfen ob Bot-ID bereits existiert
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                return { ok: false, error: "BOT_ALREADY_EXISTS", bot_id: botId };
            }
        }

        // Neuen Bot erstellen
        const bot_class = require('../bot_class');
        let bot = new bot_class();
        bot.setvalues(
            botId,                                              // id
            "",                                                 // rid
            Number(x ?? 0), Number(y ?? 0), Number(z ?? 0),     // x, y, z
            Number(vx ?? 1), Number(vy ?? 0), Number(vz ?? 0), // vx, vy, vz (default 1,0,0)
            0,                                                  // inactive
            0,                                                  // servicebay
            "eeeeee",                                           // color
            this.masterbot.config?.physical_bot_move_delay || 300,
            this.masterbot.config?.enable_signing,
            this.masterbot.config?.signature_type,
            this.masterbot.config?.public_key_or_secret
        );

        this.masterbot.bots.push(bot);

        // Bot-Index und Nachbarschafts-Indizes initialisieren
        let newBotIdx = this.masterbot.bots.length - 1;
        let botKey = this.masterbot.getKey_3d(Number(x), Number(y), Number(z));
        if (this.masterbot.botindex) {
            this.masterbot.botindex[botKey] = newBotIdx;
        }
        if (typeof this.masterbot.update_bot_index_neighbors === "function") {
            this.masterbot.update_bot_index_neighbors(newBotIdx);
        }

        // WebGUI-Refresh
        if (this.masterbot.send_webgui && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.send_webgui(JSON.stringify(msg));
            }
        }

        return {
            ok: true,
            bot_id: botId,
            position: { x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) },
            orientation: { x: Number(bot.vector_x), y: Number(bot.vector_y), z: Number(bot.vector_z) },
            total_bots: this.masterbot.bots.length
        };
    }

    //
    // setObstacle(enabled, x, y, z)
    // Adds or removes an obstacle at a specific coordinate.
    // Obstacles are displayed as semi-transparent black cubes in the
    // ClusterSim WebGUI. They are NOT functional (no mesh blocking) yet.
    //
    setObstacle(enabled, x, y, z) {
        let cx = Number(x ?? 0), cy = Number(y ?? 0), cz = Number(z ?? 0);

        if (enabled === true || enabled === "true") {
            // Prüfen ob bereits vorhanden
            let exists = false;
            for (let i = 0; i < this.masterbot.obstacles.length; i++) {
                let o = this.masterbot.obstacles[i];
                if (Number(o.x) === cx && Number(o.y) === cy && Number(o.z) === cz) { exists = true; break; }
            }
            if (!exists) {
                this.masterbot.obstacles.push({ x: cx, y: cy, z: cz });
            }
        } else {
            // Entfernen
            this.masterbot.obstacles = this.masterbot.obstacles.filter(o =>
                !(Number(o.x) === cx && Number(o.y) === cy && Number(o.z) === cz)
            );
        }

        // WebGUI-Refresh
        if (this.masterbot.send_webgui && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            let jsondata = null;
            try { jsondata = JSON.parse(raw); } catch(e) {}
            if (jsondata) {
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.send_webgui(JSON.stringify(msg));
            }
        }

        return {
            ok: true,
            enabled: (enabled === true || enabled === "true"),
            position: { x: cx, y: cy, z: cz },
            obstacles_count: this.masterbot.obstacles.length
        };
    }

    //
    // configSlot(botId, slotConfig)
    // Configures slot reliability for a bot.
    // slotConfig format: "F:1.0;B:0.5" (semicolon-separated, slot:probability)
    // Only slots with probability != 1.0 activate special_slot_configuration.
    //
    configSlot(botId, slotConfig) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id).trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        let configStr = String(slotConfig ?? "").trim();
        if (configStr === "") {
            return { ok: false, error: "EMPTY_CONFIG" };
        }

        // Slot-Namen normalisieren (lowercase)
        let pairs = configStr.split(";");
        let anyNonDefault = false;

        for (let p of pairs) {
            let parts = p.trim().split(":");
            if (parts.length < 2) continue;
            let slot = parts[0].trim().toLowerCase();
            let val = parseFloat(parts[1]);
            if (isNaN(val)) continue;
            if (!["f","r","b","l","t","d"].includes(slot)) continue;

            bot.slot_reliability[slot] = val;
            if (val !== 1.0) anyNonDefault = true;
        }

        // Prüfen ob nach der Operation irgendein Slot != 1.0 ist (auch ältere, nicht erwähnte)
        let allDefault = true;
        for (let s of ["f","r","b","l","t","d"]) {
            let v = bot.slot_reliability[s];
            if (v !== undefined && v !== 1.0) { allDefault = false; break; }
        }
        bot.special_slot_configuration = !allDefault;

        // WebGUI-Refresh
        if (this.masterbot.ws && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            try {
                let jsondata = JSON.parse(raw);
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.ws.send(JSON.stringify(msg));
            } catch(e) {}
        }

        return {
            ok: true,
            bot_id: botId,
            slot_reliability: { ...bot.slot_reliability },
            special_slot_configuration: bot.special_slot_configuration
        };
    }

    //
    // configDuplicateMsg(botId, factor)
    // Configures duplicate message injection for a bot.
    // factor 1 = normal (no duplicates)
    // factor 2 = every message is sent twice
    // factor 3 = every message is sent three times
    // factor 0 or false = reset to normal (1)
    //
    configDuplicateMsg(botId, factor) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id ?? this.masterbot.bots[i].real_id ?? "").trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        let val = parseInt(factor, 10);
        if (isNaN(val) || val <= 0) val = 1;
        bot.duplicate_msg = val;

        return {
            ok: true,
            bot_id: botId,
            duplicate_msg: bot.duplicate_msg
        };
    }

    //
    // configDisableForwarding(botId, disabled)
    // Disables/enables message forwarding for a bot.
    // When disabled: bot still responds to direct INFO/CHECK, but drops
    //   any messages it should forward to other bots (Fehlertyp 08).
    //
    configDisableForwarding(botId, disabled) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id ?? this.masterbot.bots[i].real_id ?? "").trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        bot.forwarding_disabled = (disabled === true || disabled === "true");

        return {
            ok: true,
            bot_id: botId,
            forwarding_disabled: bot.forwarding_disabled
        };
    }

    // configMsgDelay(botId, delayMs)
    // Sets a forwarding delay (in ms) for all messages passing through this bot.
    // delayMs=0 disables the delay (default).
    //
    configMsgDelay(botId, delayMs) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id ?? this.masterbot.bots[i].real_id ?? "").trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        bot.msg_delay = Number(delayMs) || 0;
        console.log("[FAILINJ] msg_delay for " + botId + " = " + bot.msg_delay + "ms");
        return { ok: true, bot_id: botId, msg_delay: bot.msg_delay };
    }

    // configMaxMsgQueue(botId, maxSize)
    // Sets the maximum message queue size for a bot.
    // When the queue is full, new messages are dropped → overflow.
    // Use "default" to reset to the default value (500).
    //
    configMaxMsgQueue(botId, maxSize) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id ?? this.masterbot.bots[i].real_id ?? "").trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        if (String(maxSize).toLowerCase() === "default") {
            bot.max_msgqueue = bot.max_msgqueue_default || 500;
        } else {
            let parsed = Number(maxSize);
            bot.max_msgqueue = (isNaN(parsed) || parsed < 0) ? 500 : Math.max(0, Math.floor(parsed));
        }
        console.log("[FAILINJ] max_msgqueue for " + botId + " = " + bot.max_msgqueue);
        return { ok: true, bot_id: botId, max_msgqueue: bot.max_msgqueue, default: bot.max_msgqueue_default || 500 };
    }

    // configCorruptMsg(botId, probability, pattern, replacement)
    // Corrupts messages passing through this bot by replacing text patterns.
    // probability 0.0-1.0, pattern=search string, replacement=replace string.
    // Use probability=0 or empty pattern to disable.
    //
    configCorruptMsg(botId, probability, pattern, replacement) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();
        let prob = Number(probability) || 0;
        let pat = String(pattern ?? "").trim();
        let repl = String(replacement ?? "").trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id ?? this.masterbot.bots[i].real_id ?? "").trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        if (prob <= 0 || pat === "") {
            bot.corrupt_config = null;
            console.log("[FAILINJ] corrupt_msg for " + botId + " = disabled");
            return { ok: true, bot_id: botId, corrupt_msg: "disabled" };
        }
        bot.corrupt_config = { probability: Math.min(1, prob), pattern: pat, replacement: repl };
        console.log("[FAILINJ] corrupt_msg for " + botId + " = p=" + bot.corrupt_config.probability + " '" + pat + "'→'" + repl + "'");
        return { ok: true, bot_id: botId, corrupt_msg: bot.corrupt_config };
    }

    //
    // configFakeId(botId, fakeIdConfig)
    // Configures fake-ID injection for a bot.
    // fakeIdConfig format: "SB1:1.0" (fakeId:probability)
    //   probability 1.0 = bot permanently believes it's SB1
    //   probability 0.3 = 30% chance per RINFO/RCHECK response
    //   empty string = disable fake ID
    //
    configFakeId(botId, fakeIdConfig) {
        if (!botId || String(botId).trim() === "") {
            return { ok: false, error: "MISSING_BOT_ID" };
        }
        botId = String(botId).trim();

        let botIndex = null;
        for (let i = 0; i < this.masterbot.bots.length; i++) {
            if (this.masterbot.bots[i] && String(this.masterbot.bots[i].id ?? this.masterbot.bots[i].real_id ?? "").trim() === botId) {
                botIndex = i;
                break;
            }
        }
        if (botIndex === null) {
            return { ok: false, error: "BOT_NOT_FOUND", bot_id: botId };
        }

        let bot = this.masterbot.bots[botIndex];
        let configStr = String(fakeIdConfig ?? "").trim();

        if (configStr === "") {
            // Reset: restore original ID and clear config
            if (bot.real_id) {
                bot.id = bot.real_id;
                bot.real_id = null;
            }
            bot.fake_id_config = null;
            return {
                ok: true,
                bot_id: botId,
                fake_id_config: null,
                message: "Fake-ID disabled, original ID restored"
            };
        }

        // Parse "SB1:0.3" format
        let parts = configStr.split(":");
        if (parts.length < 2) {
            return { ok: false, error: "INVALID_FORMAT", expected: "fakeId:probability (e.g. SB1:0.3)" };
        }
        let fakeId = parts[0].trim();
        let prob = parseFloat(parts[1]);
        if (isNaN(prob) || prob < 0 || prob > 1) {
            return { ok: false, error: "INVALID_PROBABILITY", value: parts[1] };
        }

        bot.fake_id_config = { fakeId: fakeId, probability: prob };

        if (prob >= 1.0) {
            // Permanently replace the bot's ID
            if (!bot.real_id) {
                bot.real_id = bot.id;
            }
            bot.id = fakeId;
        }

        // WebGUI-Refresh
        if (this.masterbot.ws && this.masterbot.getclusterdata_json) {
            let raw = this.masterbot.getclusterdata_json();
            try {
                let jsondata = JSON.parse(raw);
                let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                this.masterbot.ws.send(JSON.stringify(msg));
            } catch(e) {}
        }

        return {
            ok: true,
            bot_id: botId,
            fake_id_config: { ...bot.fake_id_config },
            real_id: bot.real_id || null,
            current_id: bot.id
        };
    }
}

module.exports = FailureInjector;
