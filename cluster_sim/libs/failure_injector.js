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
}

module.exports = FailureInjector;
