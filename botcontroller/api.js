#!/usr/bin/env node

"use strict";

const net = require("net");
const path = require("path");
const fs = require("fs");
const { parse_config_file } = require("../common/config_parser");

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
  return parse_config_file(filePath);
} // loadconfig()


function buildRequestFromCli() {
  const cmd = process.argv[2] ?? "describe";

  function parseGoalOrientationFromCli(startIndex) {
    const vxRaw = process.argv[startIndex];
    const vyRaw = process.argv[startIndex + 1];
    const vzRaw = process.argv[startIndex + 2];

    if (vxRaw === undefined && vyRaw === undefined && vzRaw === undefined) {
      return null;
    } // if

    return {
      x: Number(vxRaw ?? 0),
      y: Number(vyRaw ?? 0),
      z: Number(vzRaw ?? 0)
    };
  } // parseGoalOrientationFromCli()

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

  if (cmd == "forbidden_add") {
    return {
      cmd: "forbidden_add",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "forbidden_remove") {
    return {
      cmd: "forbidden_remove",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "forbidden_clear") {
    return { cmd: "forbidden_clear" };
  } // if

  if (cmd == "forbidden_list") {
    return { cmd: "forbidden_list" };
  } // if

  if (cmd == "servicebay_add") {
    return {
      cmd: "servicebay_add",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "servicebay_remove") {
    return {
      cmd: "servicebay_remove",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "servicebay_clear") {
    return { cmd: "servicebay_clear" };
  } // if

  if (cmd == "servicebay_list") {
    return { cmd: "servicebay_list" };
  } // if

  if (cmd == "structurescan") {
    return { cmd: "structurescan" };
  } // if

  if (cmd == "structurescan_lvl2") {
    return { cmd: "structurescan_lvl2" };
  } // if

  if (cmd == "structurescan_radio") {
    return { cmd: "structurescan_radio" };
  } // if

  if (cmd == "search_bot") {
    return {
      cmd: "search_bot",
      bot_id: process.argv[3] ?? "",
      level: Number(process.argv[4] ?? 1)
    };
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

  if (cmd == "headless") {
    return {
      cmd: "headless",
      algo: process.argv[3] ?? "",
      structure: process.argv[4] ?? "",
      output_file: process.argv[5] ?? ""
    };
  } // if

  if (cmd == "morph_check_progress") {
    return { cmd: "morph_check_progress" };
  } // if

  // Alias: get_bot_position → get_bot_by_id (LLM-friendly naming)
  if (cmd == "get_bot_position") {
    return {
      cmd: "get_bot_by_id",
      bot_id: process.argv[3] ?? ""
    };
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

  if (cmd == "get_bots_by_prefix") {
    return {
      cmd: "get_bots_by_prefix",
      prefix: process.argv[3] ?? ""
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

  if (cmd == "get_grab_positions") {
    return {
      cmd: "get_grab_positions",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "get_turn_positions") {
    return {
      cmd: "get_turn_positions",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0),
      radius: Number(process.argv[6] ?? 1)
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

  if (cmd == "batch") {
    return {
      cmd: "batch",
      file: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "move_bot_to") {
    return {
      cmd: "move_bot_to",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      goal_orientation: parseGoalOrientationFromCli(7)
    };
  } // if

  if (cmd == "diagnose_move_bot_to") {
    return {
      cmd: "diagnose_move_bot_to",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      goal_orientation: parseGoalOrientationFromCli(7)
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

  if (cmd == "calc_crater") {
    return {
      cmd: "calc_crater",
      tx: Number(process.argv[3] ?? 0),
      ty: Number(process.argv[4] ?? 0),
      tz: Number(process.argv[5] ?? 0),
      vx: Number(process.argv[6] ?? 0),
      vy: Number(process.argv[7] ?? 0),
      vz: Number(process.argv[8] ?? 0),
      sx: Number(process.argv[9] ?? 0),
      sy: Number(process.argv[10] ?? 0),
      sz: Number(process.argv[11] ?? 0),
      mode: process.argv[12] ?? "plan",
      max_depth: (process.argv[13] !== undefined) ? Number(process.argv[13]) : null
    };
  } // if

  if (cmd == "crater_start") {
    const maybeId = process.argv[3] ?? "";
    const hasCraterId = (maybeId !== "" && Number.isNaN(Number(maybeId)));
    const base = hasCraterId ? 4 : 3;
    return {
      cmd: "crater_start",
      crater_id: hasCraterId ? maybeId : "crater_default",
      tx: Number(process.argv[base] ?? 0),
      ty: Number(process.argv[base + 1] ?? 0),
      tz: Number(process.argv[base + 2] ?? 0),
      vx: Number(process.argv[base + 3] ?? 0),
      vy: Number(process.argv[base + 4] ?? 0),
      vz: Number(process.argv[base + 5] ?? 0),
      sx: Number(process.argv[base + 6] ?? 0),
      sy: Number(process.argv[base + 7] ?? 0),
      sz: Number(process.argv[base + 8] ?? 0),
      max_depth: (process.argv[base + 9] !== undefined) ? Number(process.argv[base + 9]) : null
    };
  } // if

  if (cmd == "crater_check_progress") {
    return {
      cmd: "crater_check_progress",
      crater_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "crater_fill") {
    return {
      cmd: "crater_fill",
      crater_id: process.argv[3] ?? "crater_default",
      mode: process.argv[4] ?? "execute"
    };
  } // if

  if (cmd == "crater_list") {
    return { cmd: "crater_list" };
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
  const general = responseObject.general ?? [];
  if (general.length > 0) {
    output += "General information:\n";
    for (let g = 0; g < general.length; g++) {
      output += "- " + general[g] + "\n";
    } // for
    output += "\n";
  } // if
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

  // CLI-only features (api.js wrapper, not BotController commands)
  output += "\nCLI-only features (api.js wrapper):\n";
  output += "- batch <file>\n";
  output += "  Reads a JSON file with multiple move_bot_to commands and executes them sequentially.\n";
  output += "  Each move opens its own TCP connection (atomic-request mode).\n";
  output += "  params:\n";
  output += "    - file: path to JSON file (array of {id, x, y, z, vx?, vy?, vz?})\n";
  output += "  returns:\n";
  output += "    - answer: api_batch_complete\n";
  output += "    - total: number of moves\n";
  output += "    - results: array of per-move {index, move, response}\n";

  return output.trim();
} // api_interface_description()


function executeBatch(moves) {
  let index = 0;
  const results = [];
  const configPath = path.join(__dirname, "config.cfg");
  const config = loadconfig(configPath);
  const apiPort = parseInt(config.api_port, 10);

  function sendNext() {
    if (index >= moves.length) {
      // Alle Moves verarbeitet – Ergebnis ausgeben
      process.stdout.write(JSON.stringify({
        ok: true,
        answer: "api_batch_complete",
        total: moves.length,
        results: results
      }) + "\n");
      return;
    } // if

    const move = moves[index];
    const client = new net.Socket();

    client.connect(apiPort, "127.0.0.1", () => {
      const request = {
        cmd: "move_bot_to",
        bot_id: move.id,
        x: move.x,
        y: move.y,
        z: move.z,
        goal_orientation: (move.vx !== undefined && move.vy !== undefined && move.vz !== undefined)
          ? { x: move.vx, y: move.vy, z: move.vz }
          : null
      };

      client.write(JSON.stringify(request) + "\n");
    });

    // Buffer für TCP-Chunking: Große Responses können in mehreren
    // data-Events ankommen → erst sammeln, dann parsen.
    let responseBuffer = "";

    client.on("data", (data) => {
      responseBuffer += data.toString();

      // Versuche zu parsen – wenn vollständig, klappt's; wenn nicht,
      // warten wir auf den nächsten Chunk.
      let responseObject;
      try {
        responseObject = JSON.parse(responseBuffer);
      } catch (err) {
        // Noch nicht vollständig – auf nächsten Chunk warten
        return;
      } // try

      // Vollständiges JSON erhalten
      const summary = {
        ok: responseObject.ok,
        executed: responseObject.executed,
        ack_received: responseObject.ack_received,
        final_diagnostic_reason: responseObject.final_diagnostic_reason,
        current_state: responseObject.current_state
      };

      results.push({
        index: index,
        move: moves[index],
        response: summary
      });

      client.end();
    });


    client.on("close", () => {
      index++;
      sendNext();
    });

    client.on("error", (err) => {
      results.push({
        index: index,
        move: moves[index],
        error: err.message
      });
      index++;
      sendNext();
    });
  } // sendNext()

  sendNext();
} // executeBatch()


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

  if (requestObject.cmd === "batch") {
    // Batch-Modus: Datei einlesen und sequentiell ausführen
    // (eigene Verbindungen pro Move in executeBatch())
    const batchFilePath = path.resolve(__dirname, requestObject.file);

    let batchData;
    try {
      const fileContent = fs.readFileSync(batchFilePath, "utf8");
      batchData = JSON.parse(fileContent);
    } catch (err) {
      console.error("Batch file error:", err.message);
      process.exit(1);
    } // try

    if (!Array.isArray(batchData) || batchData.length === 0) {
      console.error("Batch file must contain a non-empty JSON array");
      process.exit(1);
    } // if

    // Keine Verbindung nötig – executeBatch() macht eigene Verbindungen
    client.destroy();
    executeBatch(batchData);
    return;
  } // if

  client.connect(apiPort, "127.0.0.1", () => {
    // Normaler Single-Request (wie bisher)
    client.write(JSON.stringify(requestObject) + "\n");
  });

  // Buffer for TCP chunking - large responses may arrive in multiple chunks
  let responseBuffer = "";

  client.on("data", (data) => {
    responseBuffer += data.toString();

    // Try to parse - if incomplete, wait for next chunk
    let responseObject;
    try {
      responseObject = JSON.parse(responseBuffer);
    } catch (err) {
      // Not complete yet - wait for next chunk
      return;
    } // try

    // Complete JSON received - clear buffer
    responseBuffer = "";

    if (responseObject.answer == "api_description") {
      process.stdout.write(api_interface_description(responseObject) + "\n");
    } else {
      // Compact JSON output: simple {ok, result} for success, {ok, result, reason} for failure
      const ok = responseObject.ok === true;
      const executed = responseObject.executed;
      const ack = responseObject.ack_received === true;
      const reason = responseObject.final_diagnostic_reason || responseObject.reason || "";
      const answer = responseObject.answer || "";

      let result = {};

      // Batch result
      if (answer === "api_batch_complete") {
        const total = responseObject.total ?? 0;
        const success = (responseObject.results ?? []).filter(r => r.response?.ok && r.response?.executed).length;
        result = { ok: true, result: "batch_complete", total: total, succeeded: success };

      // Move/Action commands with executed flag
      } else if (executed !== undefined) {
        if (ok && executed && ack) {
          result = { ok: true, result: "succeeded" };
          if (responseObject.current_state) {
            const s = responseObject.current_state;
            const pos = s.position || s;
            result.position = { x: pos.x, y: pos.y, z: pos.z };
          }
        } else if (ok && executed) {
          result = { ok: true, result: "succeeded", ack: "pending" };
        } else {
          result = { ok: false, result: "failed" };
          if (reason) result.reason = reason;
        }

      // Query commands (describe, get_bot_by_id, get_status, etc.)
      } else if (ok) {
        if (answer === "api_get_bot_by_id" && responseObject.position) {
          const p = responseObject.position;
          result = { ok: true, result: "bot_info", bot_id: responseObject.bot_id, position: { x: p.x, y: p.y, z: p.z } };
          if (responseObject.orientation) {
            result.orientation = { x: responseObject.orientation.x, y: responseObject.orientation.y, z: responseObject.orientation.z };
          }
        } else if (answer === "api_morph_start_headless") {
          result = {
            ok: responseObject.success === true,
            result: responseObject.success === true ? "morph_complete" : "morph_failed",
            algo: responseObject.algo,
            structure: responseObject.structure,
            output_file: responseObject.output_file
          };
          if (responseObject.success === true) {
            result.wave_count = responseObject.wave_count;
            result.move_count = responseObject.move_count;
          }
        } else if (answer === "api_get_status") {
          result = { ok: true, result: "status", status: responseObject.status || "ok" };
        } else if (answer === "api_version") {
          result = { ok: true, result: "version", version: responseObject.version || "?" };
        } else if (answer === "api_find_path_for_bot") {
          // Bewegungsprimitiven (actions) + Zwischenkoordinaten (steps) zurückgeben
          const actions = responseObject.vehicle_path_dry_run?.actions ?? [];
          const rawStates = responseObject.vehicle_path_dry_run?.states ?? responseObject.path ?? [];
          // steps: Koordinaten + Orientierung für jeden Schritt (Start + nach jeder Aktion)
          const steps = rawStates.map(s => ({
            x: s.x, y: s.y, z: s.z,
            vx: s.vx, vy: s.vy, vz: s.vz
          }));
          result = {
            ok: true,
            result: "path_info",
            bot_id: responseObject.bot_id,
            target: responseObject.target,
            path_found: responseObject.path_found === true,
            reason: responseObject.reason ?? "",
            actions: actions,
            steps: steps,
            path_length: actions.length
          };
        } else if (answer === "api_can_reach_position") {
          // Nur Erreichbarkeits-Info, keine internen Details
          result = {
            ok: true,
            result: "reachability_info",
            bot_id: responseObject.bot_id,
            target: responseObject.target,
            reachable: responseObject.reachable === true,
            reason: responseObject.reason ?? "",
            distance: responseObject.distance
          };
        } else {
          result = { ok: true, result: answer };
        }

      } else {
        result = { ok: false, result: "failed" };
        if (reason) result.reason = reason;
        // Include error details from the response for better diagnostics
        if (responseObject.error) result.error = responseObject.error;
        if (responseObject.details) result.details = responseObject.details;
      } // if

      process.stdout.write(JSON.stringify(result) + "\n");
    } // if
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
