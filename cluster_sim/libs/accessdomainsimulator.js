/**
 * accessdomainsimulator.js – Access Domain Simulator (ClusterSim side)
 * 
 * Manages connectors and (helper) MasterBots on the ClusterSim side.
 * Works in parallel with existing MasterBot code (read-only initially).
 * 
 * See specification: config_mb.xml in the ClusterSim root
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const Logger = require('../logger');

class AccessDomainSimulator {

    // ADS-Logging (toggle via adsLogEnabled)
    static adsLogEnabled = true;
    static adsLogFilePath = path.join(__dirname, '..', 'logs', 'ads.log');

    static adsLog(msg) {
        if (!AccessDomainSimulator.adsLogEnabled) return;
        try {
            const timestamp = Logger.formatTimestamp(new Date());
            const entry = "[ADS] " + timestamp + " - " + msg + "\n";
            fs.appendFileSync(AccessDomainSimulator.adsLogFilePath, entry);
        } catch (e) {
            // silently ignore
        }
    }

    static adsLogClear() {
        try {
            fs.writeFileSync(AccessDomainSimulator.adsLogFilePath, '');
        } catch (e) {}
    }

    constructor(masterbot) {
        this.masterbot = masterbot;
        this.connectors = {};
        this.masterbots = {};
        this.config_loaded = false;
        this.connectorServers = {};   // net.Server per unique port
        this.connectorClients = {};   // connected TCP sockets per connector
    }

    loadConfig(filepath) {
        if (!filepath) {
            filepath = path.join(__dirname, '..', 'config_mb.xml');
        }

        if (!fs.existsSync(filepath)) {
            Logger.log("[ADS] config_mb.xml not found at " + filepath);
            return;
        }

        try {
            const xmlContent = fs.readFileSync(filepath, 'utf8');
            const xml2js = require('xml2js');
            xml2js.parseString(xmlContent, (err, result) => {
                if (err) {
                    Logger.log("[ADS] XML parse error: " + err.message);
                    return;
                }

                const root = result.xml;
                if (!root) {
                    Logger.log("[ADS] No <xml> root found in config_mb.xml");
                    return;
                }

                // Connectors parsen
                if (root.connector) {
                    for (let c of root.connector) {
                        let id = c.id?.[0]?.trim() ?? "?";
                        this.connectors[id] = {
                            id: id,
                            host: c.host?.[0]?.trim() ?? "localhost",
                            port: parseInt(c.port?.[0]?.trim() ?? "3001"),
                            channel: parseInt(c.channel?.[0]?.trim() ?? "0")
                        };
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

                        this.masterbots[id] = {
                            id: id,
                            role: m.role?.[0]?.trim() ?? "helper",
                            connector_id: m.connector?.[0]?.trim() ?? "",
                            pos: { x: pos[0] || 0, y: pos[1] || 0, z: pos[2] || 0 },
                            orientation: { x: ori[0] || 1, y: ori[1] || 0, z: ori[2] || 0 },
                            slots: m.slots?.[0]?.trim() ?? "F"
                        };
                    }
                }

                // Prüfen: primary MB muss auf (0,0,0) stehen
                for (let mid in this.masterbots) {
                    let m = this.masterbots[mid];
                    if (m.role === "primary") {
                        if (m.pos.x !== 0 || m.pos.y !== 0 || m.pos.z !== 0) {
                            console.warn(
                                "[ADS] WARNING: Primary masterbot \"" + mid + "\" is positioned at (" +
                                m.pos.x + "," + m.pos.y + "," + m.pos.z + "), not at (0,0,0).\n" +
                                "    This will cause inconsistent behaviour – the morph algorithm and\n" +
                                "    wouldSplitCluster rely on MASTER_BOT_POSITION = (0,0,0).\n" +
                                "    Set the primary MB position to (0,0,0) in config_mb.xml."
                            );
                        }
                    }
                }

                this.config_loaded = true;

                // Debug-Ausgabe
                Logger.log("[ADS] Config loaded from " + path.basename(filepath));
                Logger.log("[ADS] Connectors: " + Object.keys(this.connectors).join(", "));
                for (let cid in this.connectors) {
                    let c = this.connectors[cid];
                    Logger.log("[ADS]   " + cid + " -> " + c.host + ":" + c.port + " ch=" + c.channel);
                }
                Logger.log("[ADS] MasterBots: " + Object.keys(this.masterbots).join(", "));
                for (let mid in this.masterbots) {
                    let m = this.masterbots[mid];
                    Logger.log("[ADS]   " + mid + " (" + m.role + ") @" + m.pos.x + "," + m.pos.y + "," + m.pos.z + " ori=" + m.orientation.x + "," + m.orientation.y + "," + m.orientation.z + " slots=" + m.slots + " connector=" + m.connector_id);
                }
                Logger.log("[ADS] Ready.");

                // Start connectors (after successful config load)
                this.ads_startConnectors();
            });
        } catch (e) {
            Logger.log("[ADS] Error loading config: " + e.message);
        }
    }

    getConnector(id) {
        return this.connectors[id] || null;
    }

    getMasterbotInfo(id) {
        return this.masterbots[id] || null;
    }

    getStatus() {
        return {
            config_loaded: this.config_loaded,
            connector_count: Object.keys(this.connectors).length,
            mb_count: Object.keys(this.masterbots).length,
            server_ports: Object.keys(this.connectorServers).map(Number)
        };
    }

    //
    // ads_startConnectors()
    // Starts TCP servers for all unique ports from config_mb.xml.
    // Connectors sharing a port (e.g. C0 + C1 on port 3002)
    // are differentiated by channel.
    //
    ads_startConnectors() {
        if (!this.config_loaded) {
            Logger.log("[ADS] Config not loaded, cannot start connectors");
            return;
        }

        // Start fresh ADS log
        AccessDomainSimulator.adsLogClear();
        AccessDomainSimulator.adsLog("=== ADS Connector Log Started ===");

        // Collect unique ports
        const uniquePorts = new Set();
        for (let cid in this.connectors) {
            uniquePorts.add(this.connectors[cid].port);
        }

        for (let port of uniquePorts) {
            const server = net.createServer((socket) => {
                AccessDomainSimulator.adsLog("Client connected on port " + port);
                Logger.log("[ADS] Client connected on port " + port);

                socket.on('data', (data) => {
                    const rawData = data.toString();
                    AccessDomainSimulator.adsLog("RAW on port " + port + ": " + rawData.trim());
                    const messages = rawData.split("\n").filter(Boolean);
                    for (let msg of messages) {
                        try {
                            const decoded = JSON.parse(msg.trim());
                            this._ads_handleMessage(port, decoded, socket);
                        } catch (e) {
                            AccessDomainSimulator.adsLog("PARSE ERROR on port " + port + ": " + e.message + " data=" + msg.trim());
                            Logger.log("[ADS] Error parsing message on port " + port + ": " + e.message);
                        }
                    }
                });

                socket.on('end', () => {
                    AccessDomainSimulator.adsLog("Client disconnected from port " + port);
                    Logger.log("[ADS] Client disconnected from port " + port);
                });

                socket.on('error', (err) => {
                    AccessDomainSimulator.adsLog("Socket error on port " + port + ": " + err.code);
                    Logger.log("[ADS] Socket error on port " + port + ": " + err.code);
                });
            });

            server.listen(port, () => {
                Logger.log("[ADS] TCP server listening on port " + port);
            });

            server.on('error', (err) => {
                Logger.log("[ADS] Server error on port " + port + ": " + err.message);
            });

            this.connectorServers[port] = server;
        }

        Logger.log("[ADS] Started " + Object.keys(this.connectorServers).length + " connector server(s)");
    }

    //
    // ads_handleMessage()
    // Processes incoming messages on a connector port.
    // Extracts the optional channel prefix and routes the message.
    //
    _ads_handleMessage(port, decoded, socket) {
        const cmd = decoded.cmd;

        if (cmd === 'push') {
            let param = decoded.param || "";
            let channel = 0;
            let opcode = param;

            // Parse channel prefix: "[channel:X]OPCODE"
            const channelMatch = param.match(/^\[channel:(\d+)\](.*)/);
            if (channelMatch) {
                channel = parseInt(channelMatch[1]);
                opcode = channelMatch[2];
            }

            // Resolve connector by port + channel
            let connectorId = null;
            for (let cid in this.connectors) {
                let c = this.connectors[cid];
                if (c.port === port && c.channel === channel) {
                    connectorId = cid;
                    break;
                }
            }

            // Determine target MB
            let targetMbId = "legacy_masterbot";
            let targetMbPos = "(0,0,0)";
            if (connectorId && this.masterbots) {
                for (let mid in this.masterbots) {
                    let mb = this.masterbots[mid];
                    if (mb.connector_id === connectorId) {
                        targetMbId = mid;
                        targetMbPos = "(" + mb.pos.x + "," + mb.pos.y + "," + mb.pos.z + ")";
                        break;
                    }
                }
            }

            AccessDomainSimulator.adsLog("push connector=" + connectorId + " port=" + port + " ch=" + channel
                + " targetMB=" + targetMbId + " @" + targetMbPos
                + " opcode=" + opcode);

            if (connectorId) {
                Logger.log("[ADS] push via " + connectorId + " (port=" + port + " ch=" + channel + "): " + opcode);
            } else {
                Logger.log("[ADS] push on port " + port + " ch=" + channel + " (no connector match): " + opcode);
            }

            // Find target bot object in masterbot and push directly to its msgqueue
            // This ensures the opcode is processed from the target hMB's position
            let targetBot = null;
            if (targetMbId && this.masterbot && this.masterbot.bots) {
                for (let i = 0; i < this.masterbot.bots.length; i++) {
                    if (this.masterbot.bots[i].id === targetMbId) {
                        targetBot = this.masterbot.bots[i];
                        break;
                    }
                }
            }

            if (targetBot) {
                AccessDomainSimulator.adsLog("  -> push to bot '" + targetMbId + "' msgqueue @" + targetMbPos);
                targetBot.push_msg(opcode);
            } else {
                // Fallback: legacy masterbot queue
                AccessDomainSimulator.adsLog("  -> push to shared masterbot queue (target=" + targetMbId + ")");
                this.masterbot.push_msg(opcode);
            }

        } else if (cmd === 'pop') {
            let param = decoded.param || "";
            let channel = 0;

            const channelMatch = param.match(/^\[channel:(\d+)\]/);
            if (channelMatch) {
                channel = parseInt(channelMatch[1]);
            }

            let connectorId = null;
            for (let cid in this.connectors) {
                let c = this.connectors[cid];
                if (c.port === port && c.channel === channel) {
                    connectorId = cid;
                    break;
                }
            }

            if (connectorId) {
                // Pop-Logging aus dem Hauptlog ausgeblendet (flutet sonst alle 100ms)
                // Logger.log("[ADS] pop via " + connectorId + " (port=" + port + " ch=" + channel + ")");
            }
            AccessDomainSimulator.adsLog("pop connector=" + connectorId + " port=" + port + " ch=" + channel);

            // Query hMB-specific queue
            let jsondata = "";
            let targetBot = null;

            // Determine target hMB by connector
            let targetMbId = null;
            let targetMbPos = "(0,0,0)";
            if (connectorId && this.masterbots) {
                for (let mid in this.masterbots) {
                    if (this.masterbots[mid].connector_id === connectorId) {
                        targetMbId = mid;
                        let mb = this.masterbots[mid];
                        targetMbPos = "(" + mb.pos.x + "," + mb.pos.y + "," + mb.pos.z + ")";
                        break;
                    }
                }
            }

            // Find bot object in masterbot
            if (targetMbId && this.masterbot && this.masterbot.bots) {
                for (let i = 0; i < this.masterbot.bots.length; i++) {
                    if (this.masterbot.bots[i].id === targetMbId) {
                        targetBot = this.masterbot.bots[i];
                        break;
                    }
                }
            }

            if (targetBot) {
                // hMB-specific queue
                jsondata = targetBot.pop_botcontroller_queue();
                AccessDomainSimulator.adsLog("  -> pop from hMB '" + targetMbId + "' @" + targetMbPos + " queue (" + jsondata.length + " chars)");
            } else {
                // Fallback: legacy masterbot queue
                jsondata = this.masterbot.pop_botcontroller_queue();
                AccessDomainSimulator.adsLog("  -> pop from legacy masterbot queue (" + jsondata.length + " chars)");
            }

            let answer = '{ "cmd": "submitqueue", "jsondata": ' + jsondata + ' }\n';
            socket.write(answer);

        } else if (cmd === 'status') {
            let answer = '{ "cmd": "submitstatus", "masterbot_name": "' + (this.masterbot.MASTERBOT_NAME || "ADS-Connector") + '" }\n';
            socket.write(answer);

        } else {
            Logger.log("[ADS] Unknown command on port " + port + ": " + cmd);
        }
    }

    //
    // ads_stopConnectors()
    // Stops all connector TCP servers for a clean shutdown.
    //
    ads_stopConnectors() {
        for (let port in this.connectorServers) {
            this.connectorServers[port].close();
            Logger.log("[ADS] Stopped server on port " + port);
        }
        this.connectorServers = {};
        this.connectorClients = {};
    }
}

module.exports = AccessDomainSimulator;
