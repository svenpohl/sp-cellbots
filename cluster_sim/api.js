#!/usr/bin/env node

/**
 * api.js – CLI for the ClusterSim Failure-Injection API (port 3101)
 *
 * Usage:
 *   node api.js disable_bot <bot_id>
 *   node api.js enable_bot  <bot_id>
 */

const net = require('net');
const path = require('path');
const fs = require('fs');

// Config laden
const { parse_config_file } = require('../common/config_parser');
const configPath = path.join(__dirname, 'config.cfg');
const config = parse_config_file(configPath);
const apiPort = parseInt(config.api_port, 10);

if (!apiPort || Number.isNaN(apiPort)) {
    console.error("Invalid or missing api_port in config.cfg");
    process.exit(1);
}

const cmd = process.argv[2] ?? "help";
const botId = process.argv[3] ?? "";

let requestObject = null;

if (cmd === "disable_bot" || cmd === "enable_bot") {
    if (!botId) {
        console.error("Usage: node api.js " + cmd + " <bot_id>");
        process.exit(1);
    }
    requestObject = { cmd: cmd, bot_id: botId };
} else if (cmd === "get_bot_info") {
    if (!botId) {
        console.error("Usage: node api.js get_bot_info <bot_id>");
        process.exit(1);
    }
    requestObject = { cmd: "get_bot_info", bot_id: botId };
} else if (cmd === "set_mobility") {
    let mobile = process.argv[4] ?? "";
    if (!botId || mobile === "") {
        console.error("Usage: node api.js set_mobility <bot_id> <true|false>");
        process.exit(1);
    }
    requestObject = { cmd: "set_mobility", bot_id: botId, mobile: mobile === "true" };
} else if (cmd === "describe") {
    requestObject = { cmd: "describe" };
} else {
    console.log("ClusterSim Failure-Injection API");
    console.log("");
    console.log("Usage:");
    console.log("  node api.js describe                  – Show available commands");
    console.log("  node api.js get_bot_info <bot_id>     – Show bot position, orientation, status");
    console.log("  node api.js disable_bot <bot_id>      – Deactivate a bot (offline)");
    console.log("  node api.js enable_bot  <bot_id>      – Reactivate a bot");
    console.log("  node api.js set_mobility <id> <t/f>   – Set bot mobility (true=move, false=immobile)");
    process.exit(0);
}

const client = new net.Socket();
client.connect(apiPort, "127.0.0.1", () => {
    client.write(JSON.stringify(requestObject) + "\n");
});

let responseBuffer = "";
client.on("data", (data) => {
    responseBuffer += data.toString();
    try {
        const response = JSON.parse(responseBuffer);
        responseBuffer = "";
        if (response.answer === "api_description") {
            process.stdout.write(response.text + "\n");
        } else {
            console.log(JSON.stringify(response, null, 2));
        }
        client.destroy();
    } catch (e) {
        // wait for more chunks
    }
});

client.on("error", (err) => {
    console.error("Connection error:", err.message);
    process.exit(1);
});
