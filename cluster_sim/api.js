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
} else if (cmd === "remove_bot") {
    if (!botId) {
        console.error("Usage: node api.js remove_bot <bot_id>");
        process.exit(1);
    }
    requestObject = { cmd: "remove_bot", bot_id: botId };
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
} else if (cmd === "set_move_interruption") {
    let botId = process.argv[3] ?? "";
    let enabled = process.argv[4] ?? "true";
    let mode = process.argv[5] ?? "half_way";
    let param = process.argv[6] ?? "0";
    if (!botId) {
        console.error("Usage: node api.js set_move_interruption <bot_id> <true|false> [half_way|random|after] [param]");
        process.exit(1);
    }
    requestObject = { cmd: "set_move_interruption", bot_id: botId, enabled: enabled === "true", mode: mode, param: Number(param) };
} else if (cmd === "config_slot") {
    let botId = process.argv[3] ?? "";
    let slotConfig = process.argv.slice(4).join(" ");
    if (!botId) {
        console.error("Usage: node api.js config_slot <bot_id> \"F:1.0;B:0.5\"");
        process.exit(1);
    }
    requestObject = { cmd: "config_slot", bot_id: botId, slot_config: slotConfig };
} else if (cmd === "config_fakeid") {
    let botId = process.argv[3] ?? "";
    let fakeIdConfig = process.argv.slice(4).join(" ");
    if (!botId) {
        console.error("Usage: node api.js config_fakeid <bot_id> \"<fakeId>:<prob>\"");
        console.error("  Examples:");
        console.error('    node api.js config_fakeid B57 "SB1:1.0"   → Bot glaubt dauerhaft, er sei SB1');
        console.error('    node api.js config_fakeid B57 "SB1:0.3"   → 30% Fake-ID pro Antwort');
        console.error('    node api.js config_fakeid B57 ""           → Fake-ID deaktivieren');
        process.exit(1);
    }
    requestObject = { cmd: "config_fakeid", bot_id: botId, fake_id_config: fakeIdConfig };
} else if (cmd === "config_duplicate_msg") {
    let botId = process.argv[3] ?? "";
    let factor = parseInt(process.argv[4] ?? "1", 10);
    if (!botId) {
        console.error("Usage: node api.js config_duplicate_msg <bot_id> <factor>");
        console.error("  factor 1 = normal, 2 = double, 3 = triple, ...");
        process.exit(1);
    }
    requestObject = { cmd: "config_duplicate_msg", bot_id: botId, factor: factor };
} else if (cmd === "config_disable_forwarding") {
    let botId = process.argv[3] ?? "";
    let disabled = String(process.argv[4] ?? "true").trim().toLowerCase();
    if (!botId) {
        console.error("Usage: node api.js config_disable_forwarding <bot_id> [true|false]");
        process.exit(1);
    }
    requestObject = { cmd: "config_disable_forwarding", bot_id: botId, disabled: disabled };
} else if (cmd === "config_msg_delay") {
    let botId = process.argv[3] ?? "";
    let delayMs = parseInt(process.argv[4]) || 0;
    if (!botId) {
        console.error("Usage: node api.js config_msg_delay <bot_id> <delay_ms>");
        process.exit(1);
    }
    requestObject = { cmd: "config_msg_delay", bot_id: botId, delay_ms: delayMs };
} else if (cmd === "config_max_msgqueue") {
    let botId = process.argv[3] ?? "";
    let maxSize = process.argv[4] ?? "default";
    if (!botId) {
        console.error("Usage: node api.js config_max_msgqueue <bot_id> <size|default>");
        process.exit(1);
    }
    requestObject = { cmd: "config_max_msgqueue", bot_id: botId, max_size: maxSize };
} else if (cmd === "config_corrupt_msg") {
    let botId = process.argv[3] ?? "";
    let prob = parseFloat(process.argv[4]) || 0;
    let pattern = process.argv[5] ?? "";
    let replacement = process.argv[6] ?? "";
    if (!botId) {
        console.error("Usage: node api.js config_corrupt_msg <bot_id> <prob> <pattern> <replacement>");
        process.exit(1);
    }
    requestObject = { cmd: "config_corrupt_msg", bot_id: botId, probability: prob, pattern: pattern, replacement: replacement };
} else if (cmd === "set_obstacle") {
    let flag = process.argv[3] ?? "";
    let x = Number(process.argv[4] ?? 0);
    let y = Number(process.argv[5] ?? 0);
    let z = Number(process.argv[6] ?? 0);
    let enabled = (flag === "true" || flag === "1");
    if (!flag) {
        console.error("Usage: node api.js set_obstacle <true|false> <x> <y> <z>");
        process.exit(1);
    }
    requestObject = { cmd: "set_obstacle", enabled: enabled, x: x, y: y, z: z };
} else if (cmd === "add_bot_to") {
    let botId = process.argv[3] ?? "";
    let x = Number(process.argv[4] ?? 0);
    let y = Number(process.argv[5] ?? 0);
    let z = Number(process.argv[6] ?? 0);
    let vx = process.argv[7] !== undefined ? Number(process.argv[7]) : undefined;
    let vy = process.argv[8] !== undefined ? Number(process.argv[8]) : undefined;
    let vz = process.argv[9] !== undefined ? Number(process.argv[9]) : undefined;
    if (!botId) {
        console.error("Usage: node api.js add_bot_to <bot_id> <x> <y> <z> [vx] [vy] [vz]");
        process.exit(1);
    }
    requestObject = { cmd: "add_bot_to", bot_id: botId, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz };
} else if (cmd === "teleport_bot_to") {
    let botId = process.argv[3] ?? "";
    let x = Number(process.argv[4] ?? 0);
    let y = Number(process.argv[5] ?? 0);
    let z = Number(process.argv[6] ?? 0);
    let vx = process.argv[7] !== undefined ? Number(process.argv[7]) : undefined;
    let vy = process.argv[8] !== undefined ? Number(process.argv[8]) : undefined;
    let vz = process.argv[9] !== undefined ? Number(process.argv[9]) : undefined;
    if (!botId) {
        console.error("Usage: node api.js teleport_bot_to <bot_id> <x> <y> <z> [vx] [vy] [vz]");
        process.exit(1);
    }
    requestObject = { cmd: "teleport_bot_to", bot_id: botId, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz };
} else if (cmd === "get_status") {
    let mode = process.argv[3] ?? "";
    requestObject = { cmd: "get_status" };
    if (mode) requestObject.mode = mode;
} else if (cmd === "save_snapshot") {
    requestObject = { cmd: "save_snapshot" };
} else if (cmd === "load_snapshot") {
    requestObject = { cmd: "load_snapshot" };
} else if (cmd === "describe") {
    requestObject = { cmd: "describe" };
} else {
    console.log("ClusterSim Failure-Injection API");
    console.log("");
    console.log("Usage:");
    console.log("  node api.js get_status [obstacles|bots|all] – Show cluster status (bot count, obstacles)");
    console.log("  node api.js describe                  – Show available commands");
    console.log("  node api.js get_bot_info <bot_id>     – Show bot position, orientation, status");
    console.log("  node api.js disable_bot <bot_id>      – Deactivate a bot (offline)");
    console.log("  node api.js enable_bot  <bot_id>      – Reactivate a bot");
    console.log("  node api.js set_mobility <id> <t/f>       – Set bot mobility (true=move, false=immobile)");
    console.log("  node api.js set_move_interruption <id> <t/f> [half_way|random|after] [param]  – Stop bot mid-move for failure testing");
    console.log("  node api.js config_slot <id> \"<slot:prob>;...\"                     – Configure slot reliability (e.g. \"F:1.0;B:0.5\")");
    console.log("  node api.js config_fakeid <id> \"<fakeId>:<prob>\"                – Configure fake-ID injection (e.g. \"SB1:0.3\")");
    console.log("  node api.js config_duplicate_msg <id> <factor>                 – Duplicate messages (2=double, 3=triple)");
    console.log("  node api.js config_disable_forwarding <id> [true|false]        – Disable/enable message forwarding (Fehlertyp 08)");
    console.log("  node api.js config_msg_delay <id> <ms>                         – Set message forwarding delay in ms (0=no delay)");
    console.log("  node api.js config_max_msgqueue <id> <size|default>           – Set max message queue size (overflow test, default=500)");
    console.log("  node api.js config_corrupt_msg <id> <prob> <pat> <repl>       – Corrupt messages (search & replace, 0=off)");
    console.log("  node api.js set_obstacle <true|false> <x> <y> <z>                 – Add/remove an obstacle (black cube)");
    console.log("  node api.js remove_bot <id>                                       – Completely remove a bot from the simulation");
    console.log("  node api.js add_bot_to <id> <x> <y> <z> [vx] [vy] [vz]             – Add a NEW bot (unknown to BotController)");
    console.log("  node api.js teleport_bot_to <id> <x> <y> <z> [vx] [vy] [vz]            – Teleport bot to position (no mesh movement)");
    console.log("  node api.js save_snapshot                                              – Save current cluster as _snapshot.xml");
    console.log("  node api.js load_snapshot                                              – Load cluster from _snapshot.xml");
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
