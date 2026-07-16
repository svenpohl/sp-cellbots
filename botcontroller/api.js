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
    let mode = process.argv[3] ?? "";
    if (mode === "all" || mode === "full") {
      return { cmd: "describe", mode: "all" };
    }
    return { cmd: "describe", mode: "core" };
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

  if (cmd == "sleep") {
    return {
      cmd: "sleep",
      ms: Number(process.argv[3] ?? 1000)
    };
  } // if

  if (cmd == "batch") {
    return {
      cmd: "batch",
      file: process.argv[3] ?? "test.batch"
    };
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
      mode: process.argv[4] ?? "standard",
      blocked: process.argv[5] ?? ""
    };
  } // if

  if (cmd == "recalibrate_bot_addresses") {
    return {
      cmd: "recalibrate_bot_addresses",
      mode: process.argv[3] ?? "standard"
    };
  } // if

  if (cmd == "switch_bot_address") {
    return {
      cmd: "switch_bot_address",
      bot_id: process.argv[3] ?? "",
      target: process.argv[4] ?? "first"
    };
  } // if

  if (cmd == "set_bot_address") {
    return {
      cmd: "set_bot_address",
      bot_id: process.argv[3] ?? "",
      adress: process.argv[4] ?? ""
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

  // VoxelEdit API
  if (cmd == "ve_new") {
    return { cmd: "ve_new" };
  } // if
  if (cmd == "ve_emptyarea") {
    const val = process.argv[3];
    if (val && val.toLowerCase() === "clear") {
      return { cmd: "ve_emptyarea", x: "clear" };
    }
    return {
      cmd: "ve_emptyarea",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0),
      x2: Number(process.argv[6] ?? 0),
      y2: Number(process.argv[7] ?? 0),
      z2: Number(process.argv[8] ?? 0)
    };
  } // if
  if (cmd == "ve_import") {
    return {
      cmd: "ve_import",
      x1: Number(process.argv[3] ?? 0),
      y1: Number(process.argv[4] ?? 0),
      z1: Number(process.argv[5] ?? 0),
      x2: Number(process.argv[6] ?? 0),
      y2: Number(process.argv[7] ?? 0),
      z2: Number(process.argv[8] ?? 0)
    };
  } // if
  if (cmd == "ve_create_box") {
    return {
      cmd: "ve_create_box",
      setId: Number(process.argv[3] ?? 0),
      x1: Number(process.argv[4] ?? 0),
      y1: Number(process.argv[5] ?? 0),
      z1: Number(process.argv[6] ?? 0),
      x2: Number(process.argv[7] ?? 0),
      y2: Number(process.argv[8] ?? 0),
      z2: Number(process.argv[9] ?? 0)
    };
  } // if
  if (cmd == "ve_get_status") {
    return { cmd: "ve_get_status" };
  } // if
  if (cmd == "ve_set_voxel") {
    return {
      cmd: "ve_set_voxel",
      setId: Number(process.argv[3] ?? 0),
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0),
      vx: process.argv[7] !== undefined ? Number(process.argv[7]) : undefined,
      vy: process.argv[8] !== undefined ? Number(process.argv[8]) : undefined,
      vz: process.argv[9] !== undefined ? Number(process.argv[9]) : undefined
    };
  } // if
  if (cmd == "ve_clear_voxel") {
    return {
      cmd: "ve_clear_voxel",
      setId: Number(process.argv[3] ?? 0),
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if
  if (cmd == "ve_get_voxels") {
    return {
      cmd: "ve_get_voxels",
      setId: process.argv[3] !== undefined ? Number(process.argv[3]) : undefined
    };
  } // if
  if (cmd == "ve_save") {
    return {
      cmd: "ve_save",
      name: process.argv[3] ?? "struct"
    };
  } // if
  if (cmd == "ve_load") {
    return {
      cmd: "ve_load",
      name: process.argv[3] ?? ""
    };
  } // if
  if (cmd == "ve_gravity") {
    return { cmd: "ve_gravity" };
  } // if
  if (cmd == "ve_is_connected") {
    return { cmd: "ve_is_connected" };
  } // if
  if (cmd == "ve_clear_set") {
    return {
      cmd: "ve_clear_set",
      setId: Number(process.argv[3] ?? 0)
    };
  } // if
  if (cmd == "ve_translate") {
    return {
      cmd: "ve_translate",
      setId: Number(process.argv[3] ?? 0),
      dx: Number(process.argv[4] ?? 0),
      dy: Number(process.argv[5] ?? 0),
      dz: Number(process.argv[6] ?? 0)
    };
  } // if
  if (cmd == "ve_duplicate") {
    return {
      cmd: "ve_duplicate",
      srcId: Number(process.argv[3] ?? 0),
      dstId: Number(process.argv[4] ?? 0)
    };
  } // if
  if (cmd == "ve_show") {
    return { cmd: "ve_show" };
  } // if
  if (cmd == "ve_hide") {
    return { cmd: "ve_hide" };
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

  if (cmd == "get_bots_in_region") {
    return {
      cmd: "get_bots_in_region",
      x1: Number(process.argv[3] ?? 0),
      y1: Number(process.argv[4] ?? 0),
      z1: Number(process.argv[5] ?? 0),
      x2: Number(process.argv[6] ?? 0),
      y2: Number(process.argv[7] ?? 0),
      z2: Number(process.argv[8] ?? 0)
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

  if (cmd == "get_bot_info") {
    return {
      cmd: "get_bot_info",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "ping_position") {
    return {
      cmd: "ping_position",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "ping_status") {
    return {
      cmd: "ping_status",
      tmpid: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "watch_region") {
    let action = process.argv[3] ?? "list";
    let obj = { cmd: "watch_region", action: action };
    if (action === "set" || action === "get" || action === "addbot" || action === "removebot") obj.id = process.argv[4] ?? "";
    if (action === "set") {
      // Check if parameters were passed as Key=Value
      let arg5 = process.argv[5] ?? "";
      if (arg5.includes("=") || arg5 === "action" || arg5 === "watch_action" || arg5 === "interval_ms" || arg5 === "mode" || arg5 === "wakeup" || arg5 === "interval") {
        // Key=Value Modus
        for (let i = 5; i < process.argv.length; i++) {
          let pair = process.argv[i].split("=");
          let key = pair[0].trim();
          let val = pair.length > 1 ? pair[1].trim() : (process.argv[i + 1] ?? "");
          if (!pair[0].includes("=")) i++; // only increment if not key=val format
          if (key === "action" || key === "watch_action") obj.watch_action = val;
          else if (key === "mode") obj.mode = val;
          else if (key === "wakeup") obj.wakeup = val;
          if (key === "interval_ms" || key === "interval") obj.interval_ms = Number(val ?? 0);
        }
      } else {
        obj.x1 = Number(process.argv[5] ?? 0); obj.y1 = Number(process.argv[6] ?? 0); obj.z1 = Number(process.argv[7] ?? 0);
        obj.x2 = Number(process.argv[8] ?? 0); obj.y2 = Number(process.argv[9] ?? 0); obj.z2 = Number(process.argv[10] ?? 0);
        obj.interval_ms = Number(process.argv[11] ?? 0); obj.mode = process.argv[12] ?? ""; obj.watch_action = process.argv[13] ?? "";
      }
    }
    if (action === "addbot" || action === "removebot") {
      obj.x = Number(process.argv[5] ?? 0); obj.y = Number(process.argv[6] ?? 0); obj.z = Number(process.argv[7] ?? 0);
    }
    if (action === "poll") obj.id = process.argv[4] ?? "";
    return obj;
  } // if

  if (cmd == "create_watch_region") {
    return {
      cmd: "create_watch_region",
      x1: Number(process.argv[3] ?? 0), y1: Number(process.argv[4] ?? 0), z1: Number(process.argv[5] ?? 0),
      x2: Number(process.argv[6] ?? 0), y2: Number(process.argv[7] ?? 0), z2: Number(process.argv[8] ?? 0),
      type: process.argv[9] ?? "box"
    };
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

  
  if (cmd == "get_address_route") {
    return {
      cmd: "get_address_route",
      start_bot: process.argv[3] ?? "MB",
      address: process.argv[4] ?? ""
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

  if (cmd == "build_address") {
    return {
      cmd: "build_address",
      x1: Number(process.argv[3] ?? 0),
      y1: Number(process.argv[4] ?? 0),
      z1: Number(process.argv[5] ?? 0),
      x2: Number(process.argv[6] ?? 0),
      y2: Number(process.argv[7] ?? 0),
      z2: Number(process.argv[8] ?? 0)
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

  if (cmd == "draw_path_for_bot") {
    return {
      cmd: "draw_path_for_bot",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
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
      bot_id: process.argv[3] ?? "",
      slot: process.argv[4] ?? ""
    };
  } // if

  if (cmd == "release_bot") {
    return {
      cmd: "release_bot",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "register_payload_link") {
    return {
      cmd: "register_payload_link",
      carrier_bot_id: process.argv[3] ?? "",
      payload_bot_id: process.argv[4] ?? "",
      slot: process.argv[5] ?? "B",
      attached: ((process.argv[6] ?? "true") === "true")
    };
  } // if

  if (cmd == "get_payload_link") {
    return {
      cmd: "get_payload_link",
      carrier_bot_id: process.argv[3] ?? ""
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
    let args = process.argv.slice(3);
    return {
      cmd: "raw_cmd",
      value: args[0] || "",
      connector: args[1] || ""
    };
  } // if

  if (cmd == "assign_bot_to_mb") {
    return {
      cmd: "assign_bot_to_mb",
      bot_id: process.argv[3] || "",
      hmb_id: process.argv[4] || ""
    };
  } // if

  if (cmd == "get_assigned_bots") {
    return { cmd: "get_assigned_bots" };
  } // if

  if (cmd == "check_if_inactive") {
    return {
      cmd: "check_if_inactive",
      x: Number(process.argv[3] ?? 0),
      y: Number(process.argv[4] ?? 0),
      z: Number(process.argv[5] ?? 0)
    };
  } // if

  if (cmd == "check_mbs") {
    return { cmd: "check_mbs" };
  } // if

  if (cmd == "diagnose_bot_address") {
    return {
      cmd: "diagnose_bot_address",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "trace_move_path") {
    return {
      cmd: "trace_move_path",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "verify_bot_position") {
    return {
      cmd: "verify_bot_position",
      bot_id: process.argv[3] ?? "",
      x: Number(process.argv[4] ?? 0),
      y: Number(process.argv[5] ?? 0),
      z: Number(process.argv[6] ?? 0)
    };
  } // if

  if (cmd == "integrate_bot") {
    return {
      cmd: "integrate_bot",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "set_active") {
    return {
      cmd: "set_active",
      bot_id: process.argv[3] ?? "",
      active: process.argv[4] ?? "true"
    };
  } // if

  if (cmd == "remove_bot") {
    return {
      cmd: "remove_bot",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "set_mobility") {
    return {
      cmd: "set_mobility",
      bot_id: process.argv[3] ?? "",
      mobility: process.argv[4] ?? "true"
    };
  } // if

  if (cmd == "get_resilience_status") {
    return { cmd: "get_resilience_status" };
  } // if

  if (cmd == "get_status_adc") {
    return { cmd: "get_status_adc" };
  } // if

  if (cmd == "generate_detour_address") {
    return {
      cmd: "generate_detour_address",
      bot_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "disable_mb") {
    return {
      cmd: "disable_mb",
      mb_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "enable_mb") {
    return {
      cmd: "enable_mb",
      mb_id: process.argv[3] ?? ""
    };
  } // if

  if (cmd == "adc_assign_proximity") {
    return { cmd: "adc_assign_proximity" };
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
  // If text mode (from api_ref/ files), output directly
  if (responseObject.text) {
    return responseObject.text;
  }
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
      // All moves processed – output result
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

    // Buffer for TCP chunking: Large responses may arrive in multiple
    // data events → collect first, then parse.
    let responseBuffer = "";

    client.on("data", (data) => {
      responseBuffer += data.toString();

      // Try to parse – if complete, it works; if not,
      // we wait for the next chunk.
      let responseObject;
      try {
        responseObject = JSON.parse(responseBuffer);
      } catch (err) {
        // Not yet complete – wait for next chunk
        return;
      } // try

      // Complete JSON received
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


// Draws the path for a bot as green markers in the WebGUI.
// 1. Calls find_path_for_bot to get path steps
// 2. Sets a green marker (size 0.5) for each step
// 3. Refreshes the GUI
function drawPathForBot(apiPort, botId, tx, ty, tz) {
  const net = require("net");

  // Step 1: Get path from find_path_for_bot
  const client = new net.Socket();
  let responseData = "";

  client.connect(apiPort, "127.0.0.1", () => {
    const req = {
      cmd: "find_path_for_bot",
      bot_id: botId,
      x: Number(tx), y: Number(ty), z: Number(tz),
      show: false
    };
    client.write(JSON.stringify(req) + "\n");
  });

  client.on("data", (data) => {
    responseData += data.toString();
  });

  client.on("close", () => {
    let steps = [];
    try {
      const resp = JSON.parse(responseData);
      if (resp.path_found === true && Array.isArray(resp.steps)) {
        steps = resp.steps;
      } else if (resp.path_found === true && Array.isArray(resp.vehicle_path_dry_run?.states)) {
        steps = resp.vehicle_path_dry_run.states.map(s => ({
          x: s.x, y: s.y, z: s.z
        }));
      }
    } catch (e) {
      console.error("draw_path_for_bot: failed to parse path response:", e.message);
      return;
    }

    if (steps.length === 0) {
      console.log("draw_path_for_bot: no path found or no steps returned");
      return;
    }

    // Step 2: Set markers for each step
    let markerIndex = 0;
    function setNextMarker() {
      if (markerIndex >= steps.length) {
        // Step 3: Refresh GUI
        const refreshClient = new net.Socket();
        refreshClient.connect(apiPort, "127.0.0.1", () => {
          refreshClient.write(JSON.stringify({ cmd: "gui_refresh" }) + "\n");
        });
        refreshClient.on("data", () => { refreshClient.destroy(); });
        refreshClient.on("close", () => {
          console.log(`draw_path_for_bot: ${steps.length} markers set + GUI refreshed`);
        });
        refreshClient.on("error", (err) => {
          console.error("draw_path_for_bot: refresh error:", err.message);
        });
        return;
      }

      const step = steps[markerIndex];
      const color = markerIndex === 0 ? "green" : (markerIndex === steps.length - 1 ? "red" : "yellow");
      const markerClient = new net.Socket();
      markerClient.connect(apiPort, "127.0.0.1", () => {
        markerClient.write(JSON.stringify({
          cmd: "gui_set_marker",
          x: Number(step.x), y: Number(step.y), z: Number(step.z),
          size: 0.5,
          color: color
        }) + "\n");
      });
      markerClient.on("data", () => { markerClient.destroy(); });
      markerClient.on("close", () => {
        markerIndex++;
        setNextMarker();
      });
      markerClient.on("error", (err) => {
        console.error("draw_path_for_bot: marker error:", err.message);
        markerIndex++;
        setNextMarker();
      });
    }

    setNextMarker();
  });

  client.on("error", (err) => {
    console.error("draw_path_for_bot: connection error:", err.message);
  });
} // drawPathForBot()


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
    client.destroy();
    const BatchController = require('./libs/batch_controller');
    const runner = new BatchController(__dirname);
    try {
      runner.load(requestObject.file);
      runner.run();
    } catch (e) {
      console.error("[BATCH] Error:", e.message);
      process.exit(1);
    }
    return;
  } // if

  if (requestObject.cmd === "draw_path_for_bot") {
    client.destroy();
    drawPathForBot(apiPort, requestObject.bot_id, requestObject.x, requestObject.y, requestObject.z);
    return;
  } // if

  if (requestObject.cmd === "sleep") {
    client.destroy();
    const ms = requestObject.ms || 1000;
    setTimeout(() => {
      console.log(JSON.stringify({ ok: true, result: "slept", ms: ms }));
    }, ms);
    return;
  } // if

  client.connect(apiPort, "127.0.0.1", () => {
    // Normal single request (as before)
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
      const reason = responseObject.final_diagnostic_reason || responseObject.reason || responseObject.error || "";
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
          // Include payload_bot_id for grab_bot
          if (responseObject.payload_bot_id) result.payload_bot_id = responseObject.payload_bot_id;
        } else if (ok && executed) {
          result = { ok: true, result: "succeeded", ack: "pending" };
          // Include payload_bot_id for grab_bot
          if (responseObject.payload_bot_id) result.payload_bot_id = responseObject.payload_bot_id;
        } else if (ok && !executed) {
          // Diagnosis mode (executed=false): show diagnostic result
          result = {
            ok: true,
            result: "diagnosis",
            executable: responseObject.executable === true,
            path_found: responseObject.path_found === true,
            would_split_cluster: responseObject.would_split_cluster === true,
            disconnected_bots: responseObject.disconnected_bots || [],
            executed: false
          };
          if (responseObject.carrier_bot_id) result.carrier_bot_id = responseObject.carrier_bot_id;
          result.carried_payload_bot_id = responseObject.carried_payload_bot_id ?? null;
          if (responseObject.target) result.target = responseObject.target;
          if (responseObject.target_orientation) result.target_orientation = responseObject.target_orientation;
          if (responseObject.steps) result.steps = responseObject.steps;
          if (responseObject.move_result) result.move_result = responseObject.move_result;
          if (responseObject.rotate_result) result.rotate_result = responseObject.rotate_result;
          if (responseObject.release_result) result.release_result = responseObject.release_result;
          if (responseObject.error) result.error = responseObject.error;
          if (responseObject.final_diagnostic_reason) result.reason = responseObject.final_diagnostic_reason;
        } else {
          result = { ok: false, result: "failed" };
          if (reason) result.reason = reason;
          if (responseObject.carrier_bot_id) result.carrier_bot_id = responseObject.carrier_bot_id;
          if (responseObject.bot_id) result.bot_id = responseObject.bot_id;
        }

      // Query commands (describe, get_bot_by_id, get_status, etc.)
      } else if (ok) {
        if (answer === "api_get_bot_by_id" && responseObject.position) {
          const p = responseObject.position;
          result = { ok: true, result: "bot_info", bot_id: responseObject.bot_id, position: { x: p.x, y: p.y, z: p.z } };
          if (responseObject.orientation) {
            result.orientation = { x: responseObject.orientation.x, y: responseObject.orientation.y, z: responseObject.orientation.z };
          }
        } else if (answer === "api_get_bots_by_prefix") {
          result = {
            ok: true,
            result: "api_get_bots_by_prefix",
            prefix: responseObject.prefix ?? "",
            count: responseObject.count ?? 0,
            bots: responseObject.bots ?? []
          };
        } else if (answer === "api_get_bots") {
          result = {
            ok: true,
            result: "api_get_bots",
            mode: responseObject.mode ?? "",
            center: responseObject.center ?? null,
            radius: responseObject.radius ?? 0,
            count: responseObject.count ?? 0,
            bots: responseObject.bots ?? []
          };
        } else if (answer === "api_get_grab_positions") {
          result = {
            ok: true,
            result: "api_get_grab_positions",
            bot_id: responseObject.bot_id ?? "",
            slot: responseObject.slot ?? "",
            positions: responseObject.positions ?? [],
            payload_bot_id: responseObject.payload_bot_id ?? null
          };
        } else if (answer === "api_safe_mode") {
          result = {
            ok: true,
            result: "api_safe_mode",
            safe_mode: responseObject.safe_mode ?? null
          };
        } else if (answer === "api_get_last_moves" || answer === "api_get_last_raw_cmds") {
          result = {
            ok: true,
            result: answer,
            moves: responseObject.moves ?? responseObject.raw_cmds ?? []
          };
        } else if (answer === "api_get_bot_history") {
          result = {
            ok: true,
            result: "api_get_bot_history",
            bot_id: responseObject.bot_id ?? "",
            history: responseObject.history ?? []
          };
        } else if (answer === "api_probe_move_bot") {
          result = {
            ok: responseObject.ok === true,
            result: "api_probe_move_bot",
            possible: responseObject.possible ?? false,
            predicted_target: responseObject.predicted_target ?? null
          };
        } else if (answer === "api_debug_move") {
          result = {
            ok: true,
            result: "api_debug_move",
            debug_move_enabled: responseObject.debug_move_enabled ?? null
          };
        } else if (answer === "api_suggest_simple_move") {
          result = {
            ok: true,
            result: "api_suggest_simple_move",
            suggested: responseObject.suggested ?? false,
            move_candidate: responseObject.move_candidate ?? ""
          };
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
        } else if (answer === "api_status") {
          result = {
            ok: true,
            result: "api_status",
            loaded_bots: responseObject.loaded_bots,
            mobility_mode: responseObject.mobility_mode,
            communication_mode: responseObject.communication_mode,
            resilience: responseObject.resilience ?? null
          };
        } else if (answer === "api_is_occupied") {
          result = {
            ok: true,
            result: "api_is_occupied",
            position: responseObject.position,
            occupied: responseObject.occupied === true,
            bot_id: responseObject.id ?? null,
            state: responseObject.state ?? null
          };
          if (responseObject.orientation) {
            result.orientation = { x: responseObject.orientation.x, y: responseObject.orientation.y, z: responseObject.orientation.z };
          }
                } else if (answer === "api_get_address_route") {
          result = {
            ok: true,
            result: "api_get_address_route",
            count: responseObject.count ?? 0,
            hops: responseObject.hops ?? []
          };
        } else if (answer === "api_version") {
          result = { ok: true, result: "version", version: responseObject.version || "?" };
        } else if (answer === "api_morph_check_progress") {
          result = {
            ok: true,
            result: "morph_progress",
            running: responseObject.running === true,
            phase: responseObject.phase ?? "idle",
            progress: responseObject.progress ?? 0,
            success: responseObject.success ?? null,
            structure: responseObject.structure ?? null,
            algo: responseObject.algo ?? null,
            started_at: responseObject.started_at ?? null,
            finished_at: responseObject.finished_at ?? null,
            message: responseObject.message ?? ""
          };
        } else if (answer === "api_find_path_for_bot") {
          // Return movement primitives (actions) + intermediate coordinates (steps)
          const actions = responseObject.vehicle_path_dry_run?.actions ?? [];
          const rawStates = responseObject.vehicle_path_dry_run?.states ?? responseObject.path ?? [];
          // steps: coordinates + orientation for each step (start + after each action)
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
        } else if (answer === "api_get_bots") {
          result = {
            ok: true,
            result: "api_get_bots",
            mode: responseObject.mode,
            center: responseObject.center,
            radius: responseObject.radius,
            count: responseObject.count,
            bots: responseObject.bots
          };
        } else if (answer === "api_get_neighbors") {
          result = {
            ok: true,
            result: "api_get_neighbors",
            bot_id: responseObject.bot_id,
            neighbors: responseObject.neighbors
          };
        } else if (answer === "api_get_bots_in_region") {
          result = {
            ok: true,
            result: "api_get_bots_in_region",
            region: responseObject.region,
            count: responseObject.count,
            bots: responseObject.bots
          };
        } else if (answer === "api_get_masterbot") {
          result = {
            ok: true,
            result: "api_get_masterbot",
            id: responseObject.id ?? "",
            name: responseObject.name ?? "",
            connected: responseObject.connected === true,
            connection_slot: responseObject.connection_slot ?? "",
            position: responseObject.position ?? null,
            orientation: responseObject.orientation ?? null
          };
        } else if (answer === "api_get_bot_info") {
          result = {
            ok: true,
            result: "api_get_bot_info",
            bot_id: responseObject.bot_id,
            position: responseObject.position,
            orientation: responseObject.orientation,
            adress: responseObject.adress,
            adress_first: responseObject.adress_first ?? "",
            adress_short: responseObject.adress_short ?? "",
            adress_detour: responseObject.adress_detour ?? "",
            carried_payload_bot_id: responseObject.carried_payload_bot_id,
            neighbors: responseObject.neighbors,
            masterbot: responseObject.masterbot,
            connector: responseObject.connector,
            inactive: responseObject.inactive ?? false,
            mobility: responseObject.mobility ?? true,
            resilience_scores: responseObject.resilience_scores ?? {}
          };
        } else if (answer === "api_morph_get_algos") {
          result = {
            ok: true,
            result: "api_morph_get_algos",
            count: responseObject.count,
            list: responseObject.list
          };
        } else if (answer === "api_morph_get_structures") {
          result = {
            ok: true,
            result: "api_morph_get_structures",
            count: responseObject.count,
            list: responseObject.list
          };
        } else if (answer === "api_raw_cmd") {
          result = {
            ok: true,
            result: "api_raw_cmd",
            accepted: responseObject.accepted === true
          };
        } else if (answer === "api_poll_masterbot_queue") {
          result = {
            ok: true,
            result: "api_poll_masterbot_queue",
            accepted: responseObject.accepted === true
          };
        } else if (answer === "api_get_api_messages") {
          result = {
            ok: true,
            result: "api_get_api_messages",
            count: responseObject.count ?? 0,
            messages: responseObject.messages ?? []
          };
        } else if (answer === "api_recalibrate_bot_addresses") {
          result = {
            ok: true,
            result: "api_recalibrate_bot_addresses",
            count: responseObject.count ?? 0,
            changed_count: responseObject.changed_count ?? 0
          };
        } else if (answer === "api_recalibrate_bot_address") {
          result = {
            ok: true,
            result: "api_recalibrate_bot_address",
            old_adress: responseObject.old_adress ?? "",
            new_adress: responseObject.new_adress ?? "",
            changed: responseObject.changed === true
          };
        } else if (answer === "api_set_bot_address") {
          result = {
            ok: true,
            result: "api_set_bot_address",
            bot_id: responseObject.bot_id ?? "",
            adress: responseObject.adress ?? "",
            old_adress: responseObject.old_adress ?? "",
            changed: responseObject.changed === true
          };
        } else if (answer === "api_switch_bot_address") {
          result = {
            ok: true,
            result: "api_switch_bot_address",
            bot_id: responseObject.bot_id,
            target: responseObject.target,
            old_adress: responseObject.old_adress ?? "",
            new_adress: responseObject.new_adress ?? ""
          };
        } else if (answer === "api_ping_position") {
          result = {
            ok: true,
            result: "api_ping_position",
            target: responseObject.target,
            tmpid: responseObject.tmpid ?? "",
            adress_used: responseObject.adress_used ?? "",
            accepted: responseObject.accepted === true
          };
        } else if (answer === "api_ping_status") {
          result = {
            ok: true,
            result: "api_ping_status",
            tmpid: responseObject.tmpid ?? "",
            status: responseObject.status ?? 0,
            bot_found: responseObject.bot_found === true,
            timed_out: responseObject.timed_out === true,
            rtt_ms: responseObject.rtt_ms ?? null,
            target: responseObject.target ?? null,
            response: responseObject.response ?? null
          };
        } else if (answer === "api_build_address") {
          result = {
            ok: true,
            result: "api_build_address",
            from: responseObject.from ?? null,
            to: responseObject.to ?? null,
            found: responseObject.found === true,
            adress: responseObject.adress ?? "",
            hops: responseObject.hops ?? 0
          };
        } else if (answer === "api_watch_region") {
          result = {
            ok: true,
            result: "api_watch_region",
            info: responseObject.info ?? "",
            region_id: responseObject.region_id ?? null,
            region: responseObject.region ?? null,
            regions: responseObject.regions ?? null,
            count: responseObject.count ?? null,
            bot_count: responseObject.bot_count ?? null,
            changed: responseObject.changed ?? null,
            changes: responseObject.changes ?? null,
            error: responseObject.error ?? null
          };
        } else if (answer === "api_create_watch_region") {
          result = {
            ok: true,
            result: "api_create_watch_region",
            info: responseObject.info ?? "",
            region_id: responseObject.region_id ?? null,
            bot_count: responseObject.bot_count ?? null,
            type: responseObject.type ?? null
          };
        } else if (answer === "api_assign_bot_to_mb") {
          result = {
            ok: responseObject.ok === true,
            result: "api_assign_bot_to_mb",
            hmb_id: responseObject.hmb_id ?? "",
            connector_id: responseObject.connector_id ?? "",
            bot_id: responseObject.bot_id ?? "",
            old_adress: responseObject.old_adress ?? "",
            adress_mb: responseObject.adress_mb ?? "",
            warning: responseObject.warning ?? null,
            error: responseObject.error ?? null
          };
        } else if (answer === "api_get_assigned_bots") {
          result = {
            ok: true,
            result: "api_get_assigned_bots",
            count: responseObject.count ?? 0,
            assignments: responseObject.assignments ?? {}
          };
        } else if (answer === "api_check_if_inactive") {
          result = {
            ok: responseObject.ok === true,
            result: "api_check_if_inactive",
            position: responseObject.position ?? {},
            bot_found: responseObject.bot_found ?? false,
            inactive: responseObject.inactive ?? false,
            neighbor_used: responseObject.neighbor_used ?? "",
            slot: responseObject.slot ?? "",
            status: responseObject.status ?? ""
          };
        } else if (answer === "api_check_mbs") {
          result = {
            ok: responseObject.ok === true,
            result: "api_check_mbs",
            mbs: responseObject.mbs ?? {}
          };
        } else if (answer === "api_diagnose_bot_address") {
          result = {
            ok: responseObject.ok === true,
            result: "api_diagnose_bot_address",
            bot_id: responseObject.bot_id ?? "",
            start_pos: responseObject.start_pos ?? null,
            hops: responseObject.hops ?? [],
            inactive_found: responseObject.inactive_found ?? [],
            recalibrate_triggered: responseObject.recalibrate_triggered ?? false,
            message: responseObject.message ?? ""
          };
        } else if (answer === "api_trace_move_path") {
          result = {
            ok: responseObject.ok === true,
            result: "api_trace_move_path",
            bot_id: responseObject.bot_id ?? "",
            target: responseObject.target ?? null,
            steps: responseObject.steps ?? [],
            found_at: responseObject.found_at ?? null,
            found: responseObject.found ?? false,
            message: responseObject.message ?? ""
          };
        } else if (answer === "api_verify_bot_position") {
          result = {
            ok: responseObject.ok === true,
            result: "api_verify_bot_position",
            bot_id: responseObject.bot_id ?? "",
            check_position: responseObject.check_position ?? null,
            old_position: responseObject.old_position ?? null,
            bot_found: responseObject.bot_found ?? false,
            action: responseObject.action ?? "none",
            message: responseObject.message ?? ""
          };
        } else if (answer === "api_integrate_bot") {
          result = {
            ok: responseObject.ok === true,
            result: "api_integrate_bot",
            bot_id: responseObject.bot_id ?? "",
            actions: responseObject.actions ?? [],
            message: responseObject.message ?? ""
          };
        } else if (answer === "api_set_active") {
          result = {
            ok: responseObject.ok === true,
            result: "api_set_active",
            bot_id: responseObject.bot_id ?? "",
            active: responseObject.active ?? true,
            recalibrate_triggered: responseObject.recalibrate_triggered ?? false
          };
        } else if (answer === "api_remove_bot") {
          result = {
            ok: responseObject.ok === true,
            result: "api_remove_bot",
            bot_id: responseObject.bot_id ?? "",
            removed: responseObject.removed ?? false,
            recalibrate_triggered: responseObject.recalibrate_triggered ?? false,
            message: responseObject.message ?? ""
          };
        } else if (answer === "api_set_mobility") {
          result = {
            ok: responseObject.ok === true,
            result: "api_set_mobility",
            bot_id: responseObject.bot_id ?? "",
            mobility: responseObject.mobility ?? true,
            recalibrate_triggered: responseObject.recalibrate_triggered ?? false
          };
        } else if (answer === "api_get_resilience_status") {
          result = {
            ok: responseObject.ok === true,
            result: "api_get_resilience_status",
            status: responseObject.status ?? "",
            message: responseObject.message ?? "",
            config_loaded: responseObject.config_loaded ?? false,
            register_unexpected_ids: responseObject.register_unexpected_ids ?? false,
            register_duplicate_msg: responseObject.register_duplicate_msg ?? false,
            duplicate_msg_detected: responseObject.duplicate_msg_detected ?? false,
            duplicate_msg_count: responseObject.duplicate_msg_count ?? 0,
            register_duplicate_ids: responseObject.register_duplicate_ids ?? false,
            duplicate_ids_detected: responseObject.duplicate_ids_detected ?? false,
            duplicate_ids_list: responseObject.duplicate_ids_list ?? [],
            mb_auto_check: responseObject.mb_auto_check ?? false,
            mb_auto_check_interval_sec: responseObject.mb_auto_check_interval_sec ?? null,
            mb_auto_check_action: responseObject.mb_auto_check_action ?? "",
            last_action: responseObject.last_action ?? "",
            last_action_ts: responseObject.last_action_ts ?? ""
          };
        } else if (answer === "api_get_status_adc") {
          result = {
            ok: true,
            result: "api_get_status_adc",
            total_assigned: responseObject.total_assigned ?? 0,
            domains: responseObject.domains ?? {}
          };
        } else if (answer === "api_adc_assign_proximity") {
          result = {
            ok: responseObject.ok === true,
            result: "api_adc_assign_proximity",
            total_assigned: responseObject.total_assigned ?? 0,
            changed: responseObject.changed ?? 0,
            assignments: responseObject.assignments ?? {}
          };
        } else if (answer === "api_disable_mb" || answer === "api_enable_mb") {
          result = {
            ok: responseObject.ok === true,
            result: answer,
            mb_id: responseObject.mb_id ?? "",
            active: responseObject.active ?? null,
            reassigned: responseObject.reassigned ?? null
          };
        // VoxelEdit API response handlers
        } else if (answer === "ve_create_box") {
          result = { ok: true, result: answer, set: responseObject.set ?? 0, count: responseObject.count ?? 0, box: responseObject.box ?? {} };
        } else if (answer === "ve_import") {
          result = { ok: true, result: answer, count: responseObject.count ?? 0, region: responseObject.region ?? {} };
        } else if (answer === "ve_emptyarea") {
          result = { ok: true, result: answer, emptyArea: responseObject.emptyArea ?? null };
        } else if (answer === "ve_new") {
          result = { ok: true, result: answer, count: responseObject.count ?? 0, sets: responseObject.sets ?? {} };
        } else if (answer === "ve_get_status") {
          result = { ok: true, result: answer, count: responseObject.count ?? 0, sets: responseObject.sets ?? {} };
          if (responseObject.bounding_box) result.bounding_box = responseObject.bounding_box;
        } else if (answer === "ve_get_voxels") {
          result = { ok: true, result: answer, set: responseObject.set ?? 0, count: responseObject.count ?? 0 };
          if (responseObject.voxels) result.voxels = responseObject.voxels;
        } else if (answer === "ve_set_voxel") {
          result = { ok: true, result: answer, set: responseObject.set ?? 0, position: responseObject.position ?? {}, count: responseObject.count ?? 0 };
        } else if (answer === "ve_clear_voxel") {
          result = { ok: true, result: answer, set: responseObject.set ?? 0, position: responseObject.position ?? {}, removed: responseObject.removed ?? false, count: responseObject.count ?? 0 };
        } else if (answer === "ve_clear_set") {
          result = { ok: true, result: answer, set: responseObject.set ?? 0, count: responseObject.count ?? 0 };
        } else if (answer === "ve_translate") {
          result = { ok: true, result: answer, set: responseObject.set ?? 0, delta: responseObject.delta ?? {}, count: responseObject.count ?? 0 };
        } else if (answer === "ve_duplicate") {
          result = { ok: true, result: answer, src: responseObject.src, dst: responseObject.dst, count: responseObject.count ?? 0 };
        } else if (answer === "ve_save") {
          result = { ok: true, result: answer, name: responseObject.name ?? "", file: responseObject.file ?? "", count: responseObject.count ?? 0 };
        } else if (answer === "ve_load") {
          result = { ok: true, result: answer, name: responseObject.name ?? "", count: responseObject.count ?? 0, emptyArea: responseObject.emptyArea ?? null };
        } else if (answer === "ve_gravity") {
          result = { ok: true, result: answer, total_voxels: responseObject.total_voxels ?? 0, min_y: responseObject.min_y, max_y: responseObject.max_y, levels: responseObject.levels ?? [] };
        } else if (answer === "ve_is_connected") {
          result = { ok: true, result: answer, connected: responseObject.connected ?? false, cluster_contact: responseObject.cluster_contact ?? false, count: responseObject.count ?? 0, details: responseObject.details ?? {} };
        } else if (answer === "ve_show") {
          result = { ok: true, result: answer, count: responseObject.count ?? 0, frontend_attached: responseObject.frontend_attached ?? false };
        } else if (answer === "ve_hide") {
          result = { ok: true, result: answer };
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
    process.stdout.write(JSON.stringify({ ok: false, result: "failed", reason: "BOTCONTROLLER_OFFLINE", error: err.message }) + "\n");
    process.exit(1);
  });
} // main()

main();
