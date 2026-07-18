/**
 * accessdomaincontroller.js – Access Domain Controller
 * 
 * Manages AccessDomains for distributing mesh network traffic
 * across multiple (helper) MasterBots. Planned for v1.9 / v2.0.
 * 
 * See specification: (TODO – link to specification)
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const Logger = require('../logger');

class AccessDomainController {
    constructor(controller) {
        this.controller = controller;
        this.domains = {};
        this.helper_masterbots = {};
        this.connectors = {};        // connector configs (host, port, channel)
        this.connectorSockets = {};  // net.Socket per unique port
        this.botMap = {};            // bot_id → { hmb_id, connector_id }
        this.active = false;
    }

    // Load config_mb.xml (botcontroller version)
    loadConfig(filepath) {
        if (!filepath) {
            filepath = path.join(__dirname, '..', 'config_mb.xml');
        }

        if (!fs.existsSync(filepath)) {
            Logger.log("[ADC] config_mb.xml not found at " + filepath);
            return;
        }

        try {
            const xmlContent = fs.readFileSync(filepath, 'utf8');
            const xml2js = require('xml2js');
            xml2js.parseString(xmlContent, (err, result) => {
                if (err) {
                    Logger.log("[ADC] XML parse error: " + err.message);
                    return;
                }

                const root = result.xml;
                if (!root) {
                    Logger.log("[ADC] No <xml> root found in config_mb.xml");
                    return;
                }

                // Connectors parsen
                if (root.connector) {
                    for (let c of root.connector) {
                        let id = c.id?.[0]?.trim() ?? "?";
                        let conn = {
                            type: "connector",
                            id: id,
                            host: c.host?.[0]?.trim() ?? "localhost",
                            port: parseInt(c.port?.[0]?.trim() ?? "3001"),
                            channel: parseInt(c.channel?.[0]?.trim() ?? "0")
                        };
                        this.helper_masterbots[id] = conn;
                        this.connectors[id] = conn;
                    }
                }

                // Masterbots parsen
                if (root.mb) {
                    for (let m of root.mb) {
                        let id = m.id?.[0]?.trim() ?? "?";
                        let posStr = m.pos?.[0]?.trim() ?? "0,0,0";
                        let oriStr = m.orientation?.[0]?.trim() ?? "1,0,0";
                        let pos = posStr.split(',').map(Number);
                        let ori = oriStr.split(',').map(Number);

                        this.helper_masterbots[id] = {
                            type: "masterbot",
                            id: id,
                            role: m.role?.[0]?.trim() ?? "helper",
                            connector_id: m.connector?.[0]?.trim() ?? "",
                            pos: { x: pos[0] || 0, y: pos[1] || 0, z: pos[2] || 0 },
                            orientation: { x: ori[0] || 1, y: ori[1] || 0, z: ori[2] || 0 },
                            slots: m.slots?.[0]?.trim() ?? "F",
                            active: true
                        };
                    }
                }

                // Check: primary MB must be at (0,0,0)
                for (let mid in this.helper_masterbots) {
                    let h = this.helper_masterbots[mid];
                    if (h.type === "masterbot" && h.role === "primary") {
                        if (h.pos.x !== 0 || h.pos.y !== 0 || h.pos.z !== 0) {
                            console.warn(
                                "[ADC] WARNING: Primary masterbot \"" + mid + "\" is positioned at (" +
                                h.pos.x + "," + h.pos.y + "," + h.pos.z + "), not at (0,0,0).\n" +
                                "    This will cause inconsistent behaviour – the morph algorithm and\n" +
                                "    wouldSplitCluster rely on MASTER_BOT_POSITION = (0,0,0).\n" +
                                "    Set the primary MB position to (0,0,0) in config_mb.xml."
                            );
                        }
                    }
                }

                this.active = true;

                Logger.log("[ADC] Config loaded from " + path.basename(filepath));
                Logger.log("[ADC] Connectors: " + (root.connector ? root.connector.length : 0));
                Logger.log("[ADC] MasterBots: " + (root.mb ? root.mb.length : 0));
                for (let mid in this.helper_masterbots) {
                    let h = this.helper_masterbots[mid];
                    if (h.type === "masterbot") {
                        Logger.log("[ADC]   " + mid + " (" + h.role + ") @" + h.pos.x + "," + h.pos.y + "," + h.pos.z + " connector=" + h.connector_id);
                    }
                }
                Logger.log("[ADC] Ready.");

                // Build connector connections (after successful config load)
                this.adc_connectConnectors();
            });
        } catch (e) {
            Logger.log("[ADC] Error loading config: " + e.message);
        }
    }

    // Register hMBs from config as bot_class_mini objects in the controller
    registerConfigBots() {
        if (!this.active) {
            Logger.log("[ADC] No config loaded, skipping bot registration");
            return;
        }
        if (!this.controller.bots) {
            Logger.log("[ADC] Controller bots array not ready yet, deferring registration");
            return;
        }
        let count = 0;
        for (let mid in this.helper_masterbots) {
            let h = this.helper_masterbots[mid];
            if (h.type !== "masterbot") continue;
            // Check if a bot with this ID already exists
            let existing = this.controller.get_bot_by_id(h.id, this.controller.bots);
            if (existing !== null && existing !== undefined) {
                Logger.log("[ADC] Bot " + h.id + " already registered, skipping");
                continue;
            }
            const bot_class_mini = require('../bot_class_mini');
            let bot = new bot_class_mini();
            bot.setvalues(h.id, "", h.pos.x, h.pos.y, h.pos.z, h.orientation.x, h.orientation.y, h.orientation.z, "ff8800", "");
            bot.role = h.role; // "primary" or "helper"
            bot.masterbot = (h.role === "primary") ? 1 : 2;
            bot.mobility = false; // hMBs are immobile
            this.controller.register_bot(bot);
            Logger.log("[ADC] Registered bot " + h.id + " at " + h.pos.x + "," + h.pos.y + "," + h.pos.z + " role=" + h.role);
            count++;
        }
        Logger.log("[ADC] Registered " + count + " masterbots from config");
    }

    //
    // adc_assignBot(hmbId, botId)
    // Assigns a bot to a helper MasterBot (hMB).
    // ADC stores the mapping for later routing decisions.
    // Additionally calculates and sets a new mesh address from the hMB's
    // position to the bot's position, so the bot can be addressed via the
    // new MB instead of the legacy MasterBot.
    //
    adc_assignBot(hmbId, botId) {
        let hmb = this.helper_masterbots[hmbId];
        if (!hmb || hmb.type !== "masterbot") {
            Logger.log("[ADC] Cannot assign: '" + hmbId + "' is not a valid hMB");
            return { ok: false, error: "INVALID_HMB", hmb_id: hmbId };
        }

        let connectorId = hmb.connector_id || "";
        let conn = this.connectors[connectorId];
        if (!conn) {
            Logger.log("[ADC] Cannot assign: hMB '" + hmbId + "' has no connector");
            return { ok: false, error: "HMB_NO_CONNECTOR", hmb_id: hmbId, connector: connectorId };
        }

        // Calculate new address from hMB position to bot position
        let addressResult = this._adc_calcAddressForBot(hmbId, botId);
        let newAdress = addressResult.adress_mb || "";
        let oldAdress = addressResult.old_adress || "";

        // Store mapping (including addresses for reference / restore)
        this.botMap[botId] = {
            hmb_id: hmbId,
            connector_id: connectorId,
            host: conn.host,
            port: conn.port,
            channel: conn.channel,
            old_adress: oldAdress,
            adress_mb: newAdress
        };

        Logger.log("[ADC] Assigned bot " + botId + " → hMB " + hmbId + " (connector " + connectorId + ")");
        Logger.log("[ADC]   old address: \"" + oldAdress + "\" → new address: \"" + newAdress + "\"");

        let ret = {
            ok: true,
            hmb_id: hmbId,
            connector_id: connectorId,
            bot_id: botId,
            old_adress: oldAdress,
            adress_mb: newAdress
        };

        if (!newAdress) {
            ret.warning = "Address calculation returned empty path – bot may be unreachable from hMB";
        }

        return ret;
    }

    //
    // _adc_calcAddressForBot(hmbId, botId)
    // Calculates a mesh address from the hMB's position to the bot's position.
    // Sets the new address on the bot object if calculation succeeds.
    // Returns { adress_mb, old_adress }.
    //
    _adc_calcAddressForBot(hmbId, botId) {
        let result = { adress_mb: "", old_adress: "" };

        if (!this.controller || !Array.isArray(this.controller.bots)) {
            Logger.log("[ADC] Cannot calculate address: controller.bots not available");
            return result;
        }

        // Find hMB bot in controller.bots
        let hmbIndex = this.controller.get_bot_by_id(hmbId, this.controller.bots);
        if (hmbIndex === null || hmbIndex === undefined) {
            Logger.log("[ADC] Cannot calculate address: hMB '" + hmbId + "' not found in controller.bots");
            return result;
        }

        // Find target bot in controller.bots
        let botIndex = this.controller.get_bot_by_id(botId, this.controller.bots);
        if (botIndex === null || botIndex === undefined) {
            Logger.log("[ADC] Cannot calculate address: bot '" + botId + "' not found in controller.bots");
            return result;
        }

        let hmbBot = this.controller.bots[hmbIndex];
        let targetBot = this.controller.bots[botIndex];

        // Save old address
        result.old_adress = String(targetBot.adress ?? "");

        // Calculate new address from hMB to target bot
        try {
            let adr = this.controller.get_mb_returnaddr(
                { x: hmbBot.x, y: hmbBot.y, z: hmbBot.z },
                { x: targetBot.x, y: targetBot.y, z: targetBot.z },
                this.controller.bots,
                [],
                { exclude_masterbots: true }
            );

            if (adr && String(adr).trim() !== "") {
                result.adress_mb = String(adr).trim();
                // Set the new address on the bot
                targetBot.adress = result.adress_mb;
                Logger.log("[ADC] Set address for " + botId + " from hMB " + hmbId
                    + " @(" + hmbBot.x + "," + hmbBot.y + "," + hmbBot.z + ")"
                    + " → " + botId + " @(" + targetBot.x + "," + targetBot.y + "," + targetBot.z + ")"
                    + " : \"" + result.adress_mb + "\" (was \"" + result.old_adress + "\")");
            } else {
                Logger.log("[ADC] Address calculation returned empty path for " + botId + " from hMB " + hmbId);
            }
        } catch (e) {
            Logger.log("[ADC] Address calculation error: " + (e?.message ?? e));
        }

        return result;
    }

    //
    // adc_unassignBot(botId)
    // Removes a bot from its hMB assignment.
    // Also restores the bot's previous address (if available).
    //
    adc_unassignBot(botId) {
        if (this.botMap[botId]) {
            let prev = this.botMap[botId];

            // Restore old address if we have one and the bot still exists
            if (prev.old_adress && this.controller) {
                let botIndex = this.controller.get_bot_by_id(botId, this.controller.bots);
                if (botIndex !== null && botIndex !== undefined) {
                    let currentAdress = String(this.controller.bots[botIndex].adress ?? "");
                    this.controller.bots[botIndex].adress = prev.old_adress;
                    Logger.log("[ADC] Restored address for " + botId
                        + ": \"" + currentAdress + "\" → \"" + prev.old_adress + "\"");
                }
            }

            delete this.botMap[botId];
            Logger.log("[ADC] Unassigned bot " + botId + " from hMB " + prev.hmb_id);
            return { ok: true, hmb_id: prev.hmb_id };
        }
        return { ok: false, error: "BOT_NOT_ASSIGNED" };
    }

    //
    // adc_getAssignment(botId)
    // Returns the hMB assignment for a bot, or null if unassigned.
    //
    adc_getAssignment(botId) {
        return this.botMap[botId] || null;
    }

    //
    // adc_getConnectorForBot(botId)
    // Returns the connector info (host, port, channel) for a bot's assigned hMB.
    // Used by raw_cmd and move commands to route through the correct connector.
    //
    adc_getConnectorForBot(botId) {
        let assignment = this.botMap[botId];
        if (!assignment) return null;
        return {
            connector_id: assignment.connector_id,
            host: assignment.host,
            port: assignment.port,
            channel: assignment.channel,
            hmb_id: assignment.hmb_id
        };
    }

    //
    // adc_getPrimaryConnectorId()
    // Returns the connector ID of the primary MB (role == "primary").
    // Used for morph sequence push and other operations that need to send
    // via the primary masterbot.
    //
    adc_getPrimaryConnectorId() {
        for (let mid in this.helper_masterbots) {
            let mb = this.helper_masterbots[mid];
            if (mb.type === "masterbot" && mb.role === "primary" && mb.connector_id) {
                return mb.connector_id;
            }
        }
        // Fallback: first masterbot with a connector_id
        for (let mid in this.helper_masterbots) {
            let mb = this.helper_masterbots[mid];
            if (mb.type === "masterbot" && mb.connector_id) {
                return mb.connector_id;
            }
        }
        return null;
    }

    //
    // adc_assign_proximity()
    // Reassigns all non-MB bots to the nearest MB/hMB based on Manhattan distance.
    // Bots with masterbot != 0 (MBs/hMBs themselves) are skipped.
    // Returns { ok, total_assigned, changed, assignments }.
    //
    adc_assign_proximity() {
        let changed = 0;
        let total = 0;
        let assignments = {};
        let mbs = [];

        // Collect all active MBs/hMBs with positions from helper_masterbots
        for (let mid in this.helper_masterbots) {
            let mb = this.helper_masterbots[mid];
            if (mb.type !== "masterbot" || mb.active === false) continue;
            mbs.push({
                id: mb.id,
                pos: mb.pos || { x: 0, y: 0, z: 0 }
            });
        }

        if (mbs.length === 0) {
            return { ok: false, error: "NO_MASTERBOTS_CONFIGURED" };
        }

        // Calculate nearest MB for each regular bot
        if (!this.controller || !Array.isArray(this.controller.bots)) {
            return { ok: false, error: "BOTS_NOT_AVAILABLE" };
        }

        for (let i = 0; i < this.controller.bots.length; i++) {
            let bot = this.controller.bots[i];
            if (!bot || (bot.masterbot ?? 0) !== 0) continue; // Nur normale Bots

            let bx = Number(bot.x), by = Number(bot.y), bz = Number(bot.z);
            let bestId = null;
            let bestDist = Infinity;

            for (let mb of mbs) {
                let dx = Math.abs(bx - Number(mb.pos.x));
                let dy = Math.abs(by - Number(mb.pos.y));
                let dz = Math.abs(bz - Number(mb.pos.z));
                let dist = dx + dy + dz; // Manhattan
                if (dist < bestDist) {
                    bestDist = dist;
                    bestId = mb.id;
                }
            }

            if (bestId) {
                let current = this.botMap[bot.id];
                if (!current || current.hmb_id !== bestId) {
                    this.adc_assignBot(bestId, bot.id);
                    changed++;
                }
                total++;
                assignments[bot.id] = bestId;
            }
        }

        return {
            ok: true,
            total_assigned: total,
            changed: changed,
            assignments: assignments
        };
    }

    //
    // assign_nearest_mb_to_bot(botId)
    // Reassigns a single bot to the nearest MB/hMB based on Manhattan distance.
    // Skips MBs/hMBs themselves (masterbot != 0).
    // Used by auto-assign on RALIFE when adc_auto_assign_proximity = true.
    //
    assign_nearest_mb_to_bot(botId) {
        let botIndex = this.controller.get_bot_by_id(botId, this.controller.bots);
        if (botIndex === null || botIndex === undefined) {
            return { ok: false, error: "BOT_NOT_FOUND" };
        }
        let bot = this.controller.bots[botIndex];
        if (!bot || (bot.masterbot ?? 0) !== 0) {
            return { ok: false, error: "NOT_A_REGULAR_BOT" };
        }

        let bx = Number(bot.x), by = Number(bot.y), bz = Number(bot.z);
        let bestId = null;
        let bestDist = Infinity;

        for (let mid in this.helper_masterbots) {
            let mb = this.helper_masterbots[mid];
            if (mb.type !== "masterbot" || mb.active === false) continue;
            let dx = Math.abs(bx - Number(mb.pos.x));
            let dy = Math.abs(by - Number(mb.pos.y));
            let dz = Math.abs(bz - Number(mb.pos.z));
            let dist = dx + dy + dz;
            if (dist < bestDist) {
                bestDist = dist;
                bestId = mb.id;
            }
        }

        if (!bestId) {
            return { ok: false, error: "NO_MASTERBOTS" };
        }

        let current = this.botMap[botId];
        if (current && current.hmb_id === bestId) {
            return { ok: true, changed: false, mb_id: bestId };
        }

        this.adc_assignBot(bestId, botId);
        return { ok: true, changed: true, mb_id: bestId };
    }

    //
    // adc_disable_mb(mbId)
    // Deactivates a helper MB. Primary MB cannot be disabled.
    // All bots assigned to this MB are reassigned to remaining active MBs.
    //
    adc_disable_mb(mbId) {
        let mb = this.helper_masterbots[mbId];
        if (!mb || mb.type !== "masterbot") {
            return { ok: false, error: "MB_NOT_FOUND", mb_id: mbId };
        }
        if (mb.role === "primary") {
            return { ok: false, error: "CANNOT_DISABLE_PRIMARY_MB", mb_id: mbId };
        }
        if (mb.active === false) {
            return { ok: false, error: "ALREADY_INACTIVE", mb_id: mbId };
        }
        mb.active = false;
        Logger.log("[ADC] Disabled MB '" + mbId + "' – reassigning bots...");
        let reassignResult = this.adc_assign_proximity();
        return {
            ok: true,
            mb_id: mbId,
            active: false,
            reassigned: reassignResult
        };
    }

    //
    // adc_enable_mb(mbId)
    // Re-activates a helper MB. Bots in range may switch to it.
    //
    adc_enable_mb(mbId) {
        let mb = this.helper_masterbots[mbId];
        if (!mb || mb.type !== "masterbot") {
            return { ok: false, error: "MB_NOT_FOUND", mb_id: mbId };
        }
        if (mb.active === true) {
            return { ok: false, error: "ALREADY_ACTIVE", mb_id: mbId };
        }
        mb.active = true;
        Logger.log("[ADC] Enabled MB '" + mbId + "' – reassigning bots...");
        let reassignResult = this.adc_assign_proximity();
        return {
            ok: true,
            mb_id: mbId,
            active: true,
            reassigned: reassignResult
        };
    }

    // Domain management

    removeDomain(id) {
        // TODO: remove domain, redistribute bots
    }

    addBotToDomain(bot_id, domain_id) {
        // TODO: assign bot to a domain
    }

    removeBotFromDomain(bot_id) {
        // TODO: remove bot from domain
    }

    // hMB management
    registerHelperMasterbot(hmb_id, config) {
        // TODO: register helper masterbot
    }

    unregisterHelperMasterbot(hmb_id) {
        // TODO: remove hMB, rebalance domain
    }

    // Routing
    getRouteForBot(bot_id, target_x, target_y, target_z) {
        // TODO: cross-domain routing
        return null;
    }

    // Status
    getDomainInfo(domain_id) {
        return this.domains[domain_id] || null;
    }

    getStatus() {
        return {
            active: this.active,
            domain_count: Object.keys(this.domains).length,
            hmb_count: Object.keys(this.helper_masterbots).length,
            connected_ports: Object.keys(this.connectorSockets).map(Number),
            assigned_bots: Object.keys(this.botMap).length
        };
    }

    //
    // adc_connectConnectors()
    // Opens TCP connections for all unique ports from config_mb.xml.
    // Connectors sharing a port (e.g. C0 + C1 on port 3002)
    // use the same socket connection – channel distinction is internal.
    //
    adc_connectConnectors() {
        if (!this.active) {
            Logger.log("[ADC] Config not loaded, cannot connect connectors");
            return;
        }

        // Determine unique ports
        const uniquePorts = new Set();
        const connectorByPort = {};
        for (let cid in this.connectors) {
            let c = this.connectors[cid];
            uniquePorts.add(c.port);
            if (!connectorByPort[c.port]) connectorByPort[c.port] = [];
            connectorByPort[c.port].push(c);
        }

        for (let port of uniquePorts) {
            // Host from the first connector for this port
            let host = connectorByPort[port][0].host;

            const socket = new net.Socket();
            socket.setNoDelay(true);

            socket.connect(port, host, () => {
                Logger.log("[ADC] Connected to " + host + ":" + port);
            });

            // Per-port buffer for incomplete JSON chunks
            if (!this._adc_buffers) this._adc_buffers = {};
            this._adc_buffers[port] = "";

            socket.on('data', (data) => {
                // Buffer and parse ClusterSim responses to pop commands
                this._adc_buffers[port] += data.toString();
                const messages = this._adc_buffers[port].split("\n");
                this._adc_buffers[port] = messages.pop() ?? "";

                for (let msg of messages) {
                    const trimmed = msg.toString().trim();
                    if (!trimmed) continue;

                    try {
                        const decoded = JSON.parse(trimmed);
                        if (decoded.cmd === "submitqueue" && this.controller) {
                            this.controller.handle_answer(decoded);
                        } else {
                            Logger.log("[ADC] Data on port " + port + ": " + trimmed);
                        }
                    } catch (e) {
                        Logger.log("[ADC] Parse error on port " + port + ": " + e.message);
                    }
                }
            });

            socket.on('error', (err) => {
                Logger.log("[ADC] Socket error on " + host + ":" + port + " - " + err.code);
            });

            socket.on('close', () => {
                Logger.log("[ADC] Connection closed to " + host + ":" + port);
                delete this.connectorSockets[port];
            });

            this.connectorSockets[port] = { socket, connectors: connectorByPort[port] };
        }

        Logger.log("[ADC] Connected " + Object.keys(this.connectorSockets).length + " connector socket(s)");
    }

    //
    // adc_sendPush(connectorId, opcode)
    // Sends a push command via the specified connector.
    // Adds the channel prefix internally.
    //
    adc_sendPush(connectorId, opcode) {
        let conn = this.connectors[connectorId];
        if (!conn) {
            Logger.log("[ADC] Unknown connector: " + connectorId);
            return false;
        }

        let port = conn.port;
        let channel = conn.channel;
        let socketEntry = this.connectorSockets[port];
        if (!socketEntry) {
            Logger.log("[ADC] No connection for port " + port + " (connector " + connectorId + ")");
            return false;
        }

        // Add channel prefix internally
        let param = "[channel:" + channel + "]" + opcode;
        let cmd = '{ "cmd": "push", "param": "' + param + '" }\n';

        Logger.log("[ADC] push via " + connectorId + " (port=" + port + " ch=" + channel + "): " + opcode);
        socketEntry.socket.write(cmd);
        return true;
    }

    //
    // adc_sendPop(connectorId)
    // Sends a pop command via the specified connector.
    //
    adc_sendPop(connectorId) {
        let conn = this.connectors[connectorId];
        if (!conn) {
            Logger.log("[ADC] Unknown connector: " + connectorId);
            return false;
        }

        let port = conn.port;
        let channel = conn.channel;
        let socketEntry = this.connectorSockets[port];
        if (!socketEntry) {
            Logger.log("[ADC] No connection for port " + port + " (connector " + connectorId + ")");
            return false;
        }

        let param = "[channel:" + channel + "]";
        let cmd = '{ "cmd": "pop", "param": "' + param + '" }\n';

        Logger.log("[ADC] pop via " + connectorId + " (port=" + port + " ch=" + channel + ")");
        socketEntry.socket.write(cmd);
        return true;
    }

    //
    // adc_popAll()
    // Sends a pop command on all active connector sockets (per channel).
    // Called by thread_botcontroller() to fetch responses (RALIFE, RINFO)
    // from the hMBs and process them via handle_answer().
    //
    adc_popAll() {
        if (!this.active) return;

        for (let port in this.connectorSockets) {
            let entry = this.connectorSockets[port];
            for (let conn of entry.connectors) {
                let param = "[channel:" + conn.channel + "]";
                let cmd = '{ "cmd": "pop", "param": "' + param + '" }\n';
                entry.socket.write(cmd);
            }
        }
    }

    //
    // adc_disconnectConnectors()
    // Cleans up all connector connections.
    //
    adc_disconnectConnectors() {
        for (let port in this.connectorSockets) {
            try {
                this.connectorSockets[port].socket.end();
            } catch (e) {}
            Logger.log("[ADC] Disconnected from port " + port);
        }
        this.connectorSockets = {};
    }
}

module.exports = AccessDomainController;
