#!/usr/bin/env node

"use strict";

const fs = require("fs");
const net = require("net");
const path = require("path");

//
// api.js
// First draft for a future LLM / operator API layer for SP-CellBots.
//
// Initial ideas:
// - Separate configurable API port in config.cfg
// - Self-describing interface, e.g. "help", "describe", "list_commands"
// - Read commands:
//   - get_version
//   - get_status
//   - get_cluster_summary
//   - get_bot_position
//   - list_inactive_bots
// - Action commands:
//   - start_scan_level1
//   - start_scan_level2
//   - probe_move_bot
//   - move_bot
// - JSON-oriented request/response structure for LLM-friendly control
//

function loadconfig(filePath) {
  const configData = fs.readFileSync(filePath, "utf-8");
  const config = {};

  configData.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      if (key && value) {
        config[key] = value;
      } // if
    } // if
  }); // forEach

  return config;
} // loadconfig()


function buildRequestFromCli() {
  const cmd = process.argv[2] ?? "describe";

  if (cmd == "describe") {
    return { cmd: "describe" };
  } // if

  if (cmd == "version") {
    return { cmd: "version" };
  } // if

  if (cmd == "get_status") {
    return { cmd: "get_status" };
  } // if

  if (cmd == "get_status_extended") {
    return { cmd: "get_status_extended" };
  } // if

  if (cmd == "get_masterbot") {
    return { cmd: "get_masterbot" };
  } // if

  if (cmd == "get_scan_state") {
    return { cmd: "get_scan_state" };
  } // if

  if (cmd == "gui_set_marker") {
    return {
      cmd: "gui_set_marker",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0),
      size: Number(process.argv[6] ?? 1),
      color: process.argv[7] ?? "red"
    };
  } // if

  if (cmd == "gui_clear_markers") {
    return { cmd: "gui_clear_markers" };
  } // if

  if (cmd == "gui_refresh") {
    return { cmd: "gui_refresh" };
  } // if

  if (cmd == "debug_move") {
    return {
      cmd: "debug_move",
      mode: process.argv[3] ?? "status"
    };
  } // if

  if (cmd == "safe_mode") {
    return {
      cmd: "safe_mode",
      mode: process.argv[3] ?? "status"
    };
  } // if

  if (cmd == "recalibrate_bot_address") {
    return {
      cmd: "recalibrate_bot_address",
      bot_id: process.argv[3] ?? "",
      mode: process.argv[4] ?? "standard"
    };
  } // if

  if (cmd == "recalibrate_bot_addresses") {
    return {
      cmd: "recalibrate_bot_addresses",
      mode: process.argv[3] ?? "standard"
    };
  } // if

  if (cmd == "diagnose_ack_route") {
    return {
      cmd: "diagnose_ack_route",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      vx: process.argv[7] ?? "",
      vy: process.argv[8] ?? "",
      vz: process.argv[9] ?? ""
    };
  } // if

  if (cmd == "structurescan") {
    return { cmd: "structurescan" };
  } // if

  if (cmd == "structurescan_lvl2") {
    return { cmd: "structurescan_lvl2" };
  } // if

  if (cmd == "morph_get_structures") {
    return { cmd: "morph_get_structures" };
  } // if

  if (cmd == "morph_get_algos") {
    return { cmd: "morph_get_algos" };
  } // if

  if (cmd == "morph_start") {
    return {
      cmd: "morph_start",
      algo: process.argv[3] ?? "",
      structure: process.argv[4] ?? ""
    };
  } // if

  if (cmd == "morph_check_progress") {
    return { cmd: "morph_check_progress" };
  } // if

  if (cmd == "get_bot_by_id") {
    return {
      cmd: "get_bot_by_id",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "get_bots") {
    return {
      cmd: "get_bots",
      mode: process.argv[3] ?? "cube",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      radius: Number(process.argv[7] ?? 1)
    };
  } // if

  if (cmd == "get_inactive_bots") {
    return { cmd: "get_inactive_bots" };
  } // if

  if (cmd == "get_neighbors") {
    return {
      cmd: "get_neighbors",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "is_occupied") {
    return {
      cmd: "is_occupied",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "get_slot_status") {
    return {
      cmd: "get_slot_status",
      bot_id: process.argv[3] ?? "",
      slot: process.argv[4] ?? ""
    };
  } // if

  if (cmd == "probe_move_bot") {
    return {
      cmd: "probe_move_bot",
      bot_id: process.argv[3] ?? "",
      move: process.argv[4] ?? ""
    };
  } // if

  if (cmd == "can_reach_position") {
    return {
      cmd: "can_reach_position",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "find_path_for_bot") {
    return {
      cmd: "find_path_for_bot",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      show: ((process.argv[7] ?? "") === "show")
    };
  } // if

  if (cmd == "find_path_for_bot_payload") {
    return {
      cmd: "find_path_for_bot_payload",
      bot_id: process.argv[3] ?? "",
      payload_bot_id: process.argv[4] ?? "",
      x: Number(process.argv[5] ?? 0),
      y: Number(process.argv[6] ?? 0),
      z: Number(process.argv[7] ?? 0),
      show: ((process.argv[8] ?? "") === "show")
    };
  } // if

  if (cmd == "suggest_simple_move") {
    return {
      cmd: "suggest_simple_move",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "move_bot_to") {
    return {
      cmd: "move_bot_to",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "diagnose_move_bot_to") {
    return {
      cmd: "diagnose_move_bot_to",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "would_split_cluster") {
    return {
      cmd: "would_split_cluster",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "rotate_bot") {
    return {
      cmd: "rotate_bot",
      bot_id: process.argv[3] ?? "",
      direction: process.argv[4] ?? ""
    };
  } // if

  if (cmd == "rotate_bot_to") {
    return {
      cmd: "rotate_bot_to",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "grab_bot") {
    return {
      cmd: "grab_bot",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "release_bot") {
    return {
      cmd: "release_bot",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "move_payload_to") {
    return {
      cmd: "move_payload_to",
      carrier_bot_id: process.argv[3] ?? "",
      payload_bot_id: process.argv[4] ?? "",
      x: Number(process.argv[5] ?? 0),
      y: Number(process.argv[6] ?? 0),
      z: Number(process.argv[7] ?? 0),
      release_after: ((process.argv[8] ?? "") === "release")
    };
  } // if

  if (cmd == "move_carrier_to") {
    return {
      cmd: "move_carrier_to",
      carrier_bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      vx: Number(process.argv[7] ?? 0),
      vy: Number(process.argv[8] ?? 0),
      vz: Number(process.argv[9] ?? 0),
      release_after: ((process.argv[10] ?? "") === "release")
    };
  } // if

  if (cmd == "diagnose_move_carrier_to") {
    return {
      cmd: "diagnose_move_carrier_to",
      carrier_bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      vx: Number(process.argv[7] ?? 0),
      vy: Number(process.argv[8] ?? 0),
      vz: Number(process.argv[9] ?? 0),
      release_after: ((process.argv[10] ?? "") === "release")
    };
  } // if

  if (cmd == "get_last_moves") {
    return {
      cmd: "get_last_moves",
      limit: Number(process.argv[3] ?? 10)
    };
  } // if

  if (cmd == "get_bot_history") {
    return {
      cmd: "get_bot_history",
      bot_id: process.argv[3] ?? "",
      limit: Number(process.argv[4] ?? 10)
    };
  } // if

  if (cmd == "get_last_raw_cmds") {
    return {
      cmd: "get_last_raw_cmds",
      limit: Number(process.argv[3] ?? 10)
    };
  } // if

  if (cmd == "raw_cmd") {
    return {
      cmd: "raw_cmd",
      value: process.argv.slice(3).join(" ")
    };
  } // if

  if (cmd == "poll_masterbot_queue") {
    return { cmd: "poll_masterbot_queue" };
  } // if

  if (cmd == "reset_api_message_log") {
    return { cmd: "reset_api_message_log" };
  } // if

  if (cmd == "get_api_messages") {
    return {
      cmd: "get_api_messages",
      cmd_filter: process.argv[3] ?? "",
      limit: Number(process.argv[4] ?? 50)
    };
  } // if

  return { cmd: cmd };
} // buildRequestFromCli()


function api_interface_description(responseObject) {
  let output = "";
  output += "SP-CellBots BotController API\n";
  output += "Version: " + responseObject.version + "\n";
  output += "Transport: " + responseObject.transport + "\n";
  output += "Mode: " + responseObject.mode + "\n";
  output += "\n";
  output += "Available commands:\n";

  const commands = responseObject.commands ?? [];
  for (let i = 0; i < commands.length; i++) {
    const entry = commands[i];
    output += "- " + entry.cmd + "\n";
    output += "  " + entry.description + "\n";

    const params = entry.params ?? {};
    const paramKeys = Object.keys(params);
    if (paramKeys.length > 0) {
      output += "  params:\n";
      for (let p = 0; p < paramKeys.length; p++) {
        const key = paramKeys[p];
        output += "    - " + key + ": " + params[key] + "\n";
      } // for
    } // if

    const returns = entry.returns ?? {};
    const returnKeys = Object.keys(returns);
    if (returnKeys.length > 0) {
      output += "  returns:\n";
      for (let r = 0; r < returnKeys.length; r++) {
        const key = returnKeys[r];
        output += "    - " + key + ": " + returns[key] + "\n";
      } // for
    } // if
  } // for

  return output.trim();
} // api_interface_description()


function main() {
  const configPath = path.join(__dirname, "config.cfg");
  const config = loadconfig(configPath);
  const apiPort = parseInt(config.api_port, 10);
  const requestObject = buildRequestFromCli();
  const client = new net.Socket();

  if (!apiPort || Number.isNaN(apiPort)) {
    console.error("Invalid or missing api_port in config.cfg");
    process.exit(1);
  } // if

  client.connect(apiPort, "127.0.0.1", () => {
    client.write(JSON.stringify(requestObject) + "\n");
  });

  client.on("data", (data) => {
    const responseText = data.toString().trim();

    try {
      const responseObject = JSON.parse(responseText);

      if (responseObject.answer == "api_description") {
        process.stdout.write(api_interface_description(responseObject) + "\n");
      } else {
        process.stdout.write(JSON.stringify(responseObject) + "\n");
      } // if
    } catch (err) {
      process.stdout.write(responseText + "\n");
    } // try
  });

  client.on("close", () => {
    process.exit(0);
  });

  client.on("error", (err) => {
    console.error("API connection error:", err.message);
    process.exit(1);
  });
} // main()

main();
