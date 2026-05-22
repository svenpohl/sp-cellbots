/**
 * @file        botcontroller_class.js
 * @author      Sven Pohl <sven.pohl@zen-systems.de>
 * @copyright   Copyright (c) 2025 Sven Pohl
 * @license     MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const fs       = require('fs');
const path     = require('path');
const net      = require('net');
const readline = require('readline');
const { exec } = require('child_process');


const WebSocket = require('ws');
const http      = require('http');

const self_assembly   = require('./self_assembly'); 
const signature_class = require('../common/signature/signature_class'); 
const { console_format_log } = require('../common/system_utils');
const { parse_config_file } = require('../common/config_parser');


//const MorphBFSSimple    = require('./morph/morph_bfs_simple');
const MorphBFSWavefront = require('./morph/morph_bfs_wavefront');
const MorphVehicleKinematics = require('./morph/morph_vehicle_kinematics');
const MorphVehicleKinematicsParallel = require('./morph/morph_vehicle_kinematics_parallel');


const Logger = require('./logger');

const cmd_parser_class = require('../common/cmd_parser_class');  

const bot_class_mini = require('./bot_class_mini');
const BotControllerApiService = require('./api_service/botcontroller_api_service');
const { build_api_describe_head } = require('./api_service/modules/api_describe_registry');
const { handle_readonly_api_command } = require('./api_service/modules/api_query_command_handler');
const { handle_gui_roles_api_command } = require('./api_service/modules/api_gui_roles_command_handler');
const { handle_ack_api_command } = require('./api_service/modules/api_ack_command_handler');
const { handle_motion_api_command } = require('./api_service/modules/api_motion_command_handler');
const { handle_orchestration_api_command } = require('./api_service/modules/api_orchestration_command_handler');
const {
      apicall_get_cmd_name: runtime_get_cmd_name,
      apicall_get_bot_snapshot: runtime_get_bot_snapshot,
      apicall_get_bot_history: runtime_get_bot_history,
      apicall_generate_ack_id: runtime_generate_ack_id,
      apicall_register_ack: runtime_register_ack,
      apicall_get_ack: runtime_get_ack,
      apicall_mark_ack_received: runtime_mark_ack_received,
      apicall_mark_ack_recovered: runtime_mark_ack_recovered,
      apicall_remove_ack: runtime_remove_ack,
      apicall_sleep: runtime_sleep,
      apicall_positions_equal: runtime_positions_equal,
      apicall_orientations_equal: runtime_orientations_equal,
      apicall_resolve_bot_id_by_address: runtime_resolve_bot_id_by_address,
      apicall_get_last_moves: runtime_get_last_moves,
      apicall_get_last_raw_cmds: runtime_get_last_raw_cmds,
      apicall_get_api_messages: runtime_get_api_messages
      } = require('./api_service/modules/api_state_log_runtime');
const {
      apicall_get_status_extended: runtime_get_status_extended,
      apicall_get_masterbot: runtime_get_masterbot,
      apicall_get_scan_state: runtime_get_scan_state
      } = require('./api_service/modules/api_scan_sync_runtime');
const {
      apicall_gui_set_marker: runtime_gui_set_marker,
      apicall_gui_clear_markers: runtime_gui_clear_markers,
      apicall_gui_refresh: runtime_gui_refresh,
      apicall_set_debug_move: runtime_set_debug_move
      } = require('./api_service/modules/api_gui_runtime');
const {
      apicall_get_structure_role_list: runtime_get_structure_role_list,
      apicall_normalize_grid_point: runtime_normalize_grid_point,
      apicall_role_point_index: runtime_role_point_index,
      apicall_forbidden_add: runtime_forbidden_add,
      apicall_forbidden_remove: runtime_forbidden_remove,
      apicall_forbidden_clear: runtime_forbidden_clear,
      apicall_forbidden_list: runtime_forbidden_list,
      apicall_servicebay_add: runtime_servicebay_add,
      apicall_servicebay_remove: runtime_servicebay_remove,
      apicall_servicebay_clear: runtime_servicebay_clear,
      apicall_servicebay_list: runtime_servicebay_list
      } = require('./api_service/modules/api_roles_runtime');
const {
      apicall_get_bots: runtime_get_bots,
      apicall_get_bots_by_prefix: runtime_get_bots_by_prefix,
      apicall_get_inactive_bots: runtime_get_inactive_bots,
      apicall_get_inactive_bot_by_xyz: runtime_get_inactive_bot_by_xyz,
      apicall_get_neighbors: runtime_get_neighbors
      } = require('./api_service/modules/api_spatial_query_runtime');
const {
      apicall_get_grab_positions: runtime_get_grab_positions,
      apicall_evaluate_turn_position: runtime_evaluate_turn_position,
      apicall_get_turn_positions: runtime_get_turn_positions,
      apicall_is_occupied: runtime_is_occupied,
      apicall_is_occupied_excluding_ids: runtime_is_occupied_excluding_ids,
      apicall_get_slot_status: runtime_get_slot_status
      } = require('./api_service/modules/api_spatial_analysis_runtime');
const {
      apicall_get_neighbor_bot_id_by_slot: runtime_get_neighbor_bot_id_by_slot,
      apicall_get_payload_target_from_carrier_state: runtime_get_payload_target_from_carrier_state,
      apicall_register_payload_link: runtime_register_payload_link,
      apicall_clear_payload_link: runtime_clear_payload_link,
      apicall_mark_pending_servicebay_recycle: runtime_mark_pending_servicebay_recycle,
      apicall_get_pending_servicebay_recycle: runtime_get_pending_servicebay_recycle,
      apicall_clear_pending_servicebay_recycle: runtime_clear_pending_servicebay_recycle,
      apicall_get_payload_link_for_carrier: runtime_get_payload_link_for_carrier,
      apicall_get_carried_payload_bot_id: runtime_get_carried_payload_bot_id,
      apicall_sync_payload_from_carrier: runtime_sync_payload_from_carrier,
      apicall_is_servicebay_cell: runtime_is_servicebay_cell,
      apicall_rebuild_botindex: runtime_rebuild_botindex,
      apicall_recycle_bot_if_in_servicebay: runtime_recycle_bot_if_in_servicebay,
      apicall_recycle_bot_force: runtime_recycle_bot_force
      } = require('./api_service/modules/api_payload_servicebay_runtime');
const {
      apicall_morph_get_structures: runtime_morph_get_structures,
      apicall_morph_get_algos: runtime_morph_get_algos,
      apicall_morph_start: runtime_morph_start,
      apicall_update_morph_status: runtime_update_morph_status,
      apicall_get_morph_status: runtime_get_morph_status
      } = require('./api_service/modules/api_morph_runtime');
const {
      apicall_get_bot_by_id: runtime_get_bot_by_id,
      apicall_get_safe_adress: runtime_get_safe_adress,
      apicall_recalibrate_bot_address: runtime_recalibrate_bot_address,
      apicall_recalibrate_bot_addresses: runtime_recalibrate_bot_addresses,
      apicall_apply_safe_mode_for_bot: runtime_apply_safe_mode_for_bot,
      apicall_apply_safe_mode_after_structure_change: runtime_apply_safe_mode_after_structure_change,
      apicall_set_safe_mode: runtime_set_safe_mode
      } = require('./api_service/modules/api_safemode_runtime');
const {
      apicall_raw_cmd: runtime_raw_cmd,
      apicall_poll_masterbot_queue: runtime_poll_masterbot_queue,
      apicall_search_bot: runtime_search_bot,
      apicall_collect_neighbor_probe: runtime_collect_neighbor_probe,
      apicall_probe_move_bot: runtime_probe_move_bot
      } = require('./api_service/modules/api_scan_queue_runtime');
const {
      apicall_create_sparse_grid: runtime_create_sparse_grid,
      apicall_build_structure_grid_without_bot: runtime_build_structure_grid_without_bot,
      apicall_would_split_cluster: runtime_would_split_cluster,
      apicall_build_forbidden_grid: runtime_build_forbidden_grid,
      apicall_is_forbidden_cell: runtime_is_forbidden_cell,
      apicall_get_wrapped_cell_for_double_step: runtime_get_wrapped_cell_for_double_step,
      apicall_is_valid_wrapped_double_step: runtime_is_valid_wrapped_double_step,
      apicall_calc_single_path: runtime_calc_single_path,
      apicall_calc_single_path_payload: runtime_calc_single_path_payload,
      apicall_calc_vehicle_kinematics_path: runtime_calc_vehicle_kinematics_path,
      apicall_calc_vehicle_kinematics_payload_path: runtime_calc_vehicle_kinematics_payload_path,
      apicall_calc_hybrid_kinematics_path: runtime_calc_hybrid_kinematics_path
      } = require('./api_service/modules/api_path_core_runtime');
const {
      apicall_get_normalized_crater_id: runtime_get_normalized_crater_id,
      apicall_has_running_crater_session: runtime_has_running_crater_session,
      apicall_ensure_crater_session: runtime_ensure_crater_session,
      apicall_update_crater_status: runtime_update_crater_status,
      apicall_get_crater_status: runtime_get_crater_status,
      apicall_list_craters: runtime_list_craters,
      apicall_build_fill_plan_from_crater: runtime_build_fill_plan_from_crater,
      apicall_run_crater_plan: runtime_run_crater_plan,
      apicall_crater_start: runtime_crater_start,
      apicall_crater_fill: runtime_crater_fill,
      apicall_calc_crater_stub: runtime_calc_crater_stub
      } = require('./api_service/modules/api_crater_runtime');
const {
      apicall_can_reach_position: runtime_can_reach_position,
      apicall_find_path_for_bot: runtime_find_path_for_bot,
      apicall_find_path_for_bot_payload: runtime_find_path_for_bot_payload,
      apicall_suggest_simple_move: runtime_suggest_simple_move,
      apicall_move_bot_to: runtime_move_bot_to,
      apicall_diagnose_move_bot_to: runtime_diagnose_move_bot_to,
      apicall_build_move_diagnostic_summary: runtime_build_move_diagnostic_summary,
      apicall_get_valid_double_primitives: runtime_get_valid_double_primitives,
      apicall_is_valid_double_primitive: runtime_is_valid_double_primitive,
      apicall_translate_path_to_primitive_paths: runtime_translate_path_to_primitive_paths,
      apicall_select_anchor_slot: runtime_select_anchor_slot,
      apicall_collect_anchor_candidates: runtime_collect_anchor_candidates,
      apicall_add_anchors_to_primitive_paths: runtime_add_anchors_to_primitive_paths,
      apicall_build_raw_move_cmd: runtime_build_raw_move_cmd
      } = require('./api_service/modules/api_move_runtime');
const {
      apicall_rotate_orientation: runtime_rotate_orientation,
      apicall_build_stationary_ack_returnaddr: runtime_build_stationary_ack_returnaddr,
      apicall_rotate_bot: runtime_rotate_bot,
      apicall_execute_rotation_plan: runtime_execute_rotation_plan,
      apicall_rotate_bot_to: runtime_rotate_bot_to,
      apicall_get_vk_rotation_direction: runtime_get_vk_rotation_direction
      } = require('./api_service/modules/api_rotation_runtime');
const {
      apicall_grab_bot: runtime_grab_bot,
      apicall_release_bot: runtime_release_bot,
      apicall_move_payload_to: runtime_move_payload_to,
      apicall_move_carrier_to: runtime_move_carrier_to,
      apicall_diagnose_move_carrier_to: runtime_diagnose_move_carrier_to
      } = require('./api_service/modules/api_transport_runtime');
const {
      apicall_build_active_bots_tmp: runtime_build_active_bots_tmp,
      apicall_build_botindex_map_for_bots: runtime_build_botindex_map_for_bots,
      apicall_get_inverse_address_for_bots: runtime_get_inverse_address_for_bots,
      apicall_derive_target_address_from_neighbours: runtime_derive_target_address_from_neighbours,
      apicall_derive_ack_returnaddr_from_neighbours: runtime_derive_ack_returnaddr_from_neighbours,
      apicall_diagnose_ack_route: runtime_diagnose_ack_route
      } = require('./api_service/modules/api_ack_route_runtime');




class botcontroller_class 
{
  
  
constructor() 
   {            
   this.self_assembly_obj   = new self_assembly( );
   this.signature_class_obj = new signature_class( );
   
      
   Logger.reset();
   Logger.log("Start Botcontroller");
   
   this.setup_console_interface();   
   this._shutdownRequested = false;
   

   let configPath = path.join(__dirname, 'config.cfg');
   this.config = this.loadconfig(configPath);
   Logger.setTimezone(this.config.timezone);
   
   this.bots           = [];
   this.botindex       = [];

   this.structure_roles = {
                          carrier: [],
                          reserve: [],
                          x: [],
                          forbidden: [],
                          inactive: []
                          };

   // Save config to variables
   this.version           = this.config.version;
   this.connect_masterbot = this.config.connect_masterbot;
   this.HOST              = this.config.masterbot_host;
   this.PORT = parseInt( this.config.masterbot_port, 10 );
   this.ENABLE_API        = this.config.enable_api;
   this.API_PORT          = parseInt( this.config.api_port, 10 );

 
 
   this.mb = [];
   this.mb['x']          = this.config.mb_x;
   this.mb['y']          = this.config.mb_y;
   this.mb['z']          = this.config.mb_z;
   this.mb['vx']         = this.config.mb_vx;
   this.mb['vy']         = this.config.mb_vy;
   this.mb['vz']         = this.config.mb_vz;
   this.mb['connection'] = this.config.mb_connection;
   this.mb['connection_id'] = String(this.config.mb_connection_id ?? "").trim().replace(/^['"]+|['"]+$/g, "");

 

   
   // Status-vars
   this.MASTERBOT_CONNECTED = 0;
   this.masterbot_name = "";
   this.masterbot_first_scan = 1;

   this.scan_status  = 0;
   this.scan_status_lvl2 = 0;
   this.scan_status_radio = 0;
   this.tmpid_cnt    = 0;
 
   this.scan_waiting_info          = {}; 
   this.scan_waiting_check         = {};
   this.scan_waiting_radio         = {};
   this.scan_targets_lvl2          = [];
   this.scan_targets_lvl2_index    = 0;
   this.scan_timeout = 0;


   this.threadcounter          = 0;
   this.scanwaitingcounter     = 0;
   this.scanwaitingcounter_lvl2 = 0;
   this.scanwaitingcounter_radio = 0;
   this.max_scanwaitingcounter = 80;

   this.scan_radio_pending_ids = [];
   this.scan_radio_requested_ids = {};
   this.scan_radio_completed_ids = {};
   this.scan_radio_parent_hint = {};
   this.scan_radio_neighbors_by_bot = {};
   this.scan_radio_seed_id = "";
   this.scan_radio_seed_registered = false;
   this.scan_radio_mode = "full";
   this.scan_radio_search_level = 1;
   this.scan_radio_search_target_id = "";

   this.signal_botids = null;
   this.detected_inactive_bots = [];
   this.api_message_log = [];
   this.api_message_log_max = 500;
   this.api_action_log = [];
   this.api_action_log_max = 100;
   this.api_bot_history_log = [];
   this.api_bot_history_log_max = 300;
   this.api_raw_cmd_log = [];
   this.api_raw_cmd_log_max = 100;
   this.api_ack_map = {};
   this.api_ack_counter = 0;
   this.api_grab_state_map = {};
   this.api_payload_links = {};
   this.api_servicebay_pending_recycle = {};
   this.api_crater_counter = 0;
   this.api_crater_default_id = "crater_default";
   this.api_crater_runs = {};
   this.crater_active_id = this.api_crater_default_id;
   this.debug_move_enabled = false;
   this.debug_vk_exports = false;
   this.safe_mode = 2;
   this.direct_radio_id_rid_map = {};
   this.direct_radio_rid_id_map = {};
   this.direct_radio_xml_file = "";
   this.direct_radio_xml_loaded = false;

   let configured_save_mode = Number(this.config.save_mode);
   if (
      Number.isNaN(configured_save_mode) !== true &&
      [0, 1, 2].includes(configured_save_mode)
      )
      {
      this.safe_mode = configured_save_mode;
      } // if
   this.masterbot_incoming_buffer = "";
   this.morph_status = {
                       running: false,
                       phase: "idle",
                       progress: 0,
                       structure: null,
                       algo: null,
                       success: null,
                       started_at: null,
                       finished_at: null,
                       last_update: null,
                       message: ""
                       };
   this.crater_status = {
                        running: false,
                        phase: "idle",
                        progress: 0,
                        success: null,
                        started_at: null,
                        finished_at: null,
                        last_update: null,
                        message: "",
                        session_id: null,
                        request: null,
                        total_steps: 0,
                        completed_steps: 0,
                        current_step: null,
                        last_result: null,
                        last_error: null,
                        failed_step: null
                        };
   
   this.ws_gui = null;
   this.api_server = null;
   
    // Define supportet morph-Algorithms
    this.morphAlgorithms = [
        {
        id: "bfs_wavefront",
        name: "BFS Wavefront",
        description: "Default wavefront morphing with parallel waves and neighborhood checks.",
        default: false
        },
        {
        id: "bfs_simple",
        name: "BFS Simple",
        description: "Simple, serial BFS morphing. Always one bot per step.",
        default: false
        },
        {
        id: "vehicle_kinematics",
        name : "Sequential Vehicle Kinematics Morph",
        description: "Vehicle-kinematics-based morphing using path planning (Sequential).",
        default: false
        },
        {
        id: "parallel_vehicle_kinematics",
        name : "Parallel Vehicle Kinematics Morph",
        description: "Vehicle-kinematics-based morphing using parallel path planning.",
        default: true
        }
    ];
    this.morphAlgorithmSelected = "parallel_vehicle_kinematics";



   console.log(console_format_log("BotController Version", 30, `${this.version} - CellBots`));
   console.log(console_format_log("Port", 30, this.PORT));
   console.log(console_format_log("enable_api", 30, this.ENABLE_API));
   console.log(console_format_log("API Port", 30, this.API_PORT));
   console.log(console_format_log("connect_masterbot", 30, this.connect_masterbot));
   console.log(console_format_log("safe_mode", 30, this.safe_mode));
   console.log(console_format_log("mobility_mode", 30, (this.config.mobility_mode ?? "full_edge")));
   console.log(console_format_log("communication_mode", 30, (this.config.communication_mode ?? "mesh_opcode")));

   const communication_mode = String(this.config.communication_mode ?? "mesh_opcode").trim();
   if (communication_mode == "direct_radio")
      {
      this.direct_radio_xml_file = String(this.config.direct_radio_xml ?? "").trim();

      if (this.direct_radio_xml_file == "")
         {
         Logger.log("WARNING: direct_radio mode active, but config.direct_radio_xml is missing.");
         } else
           {
           this.direct_radio_xml_loaded = this.load_direct_radio_static_info(this.direct_radio_xml_file);
           } // else
      } // if



   // Add virtual Masterbot (important for get_inverse_address() !)
   this.bot_class_mini_obj = new bot_class_mini();
   this.bot_class_mini_obj.setvalues( "masterbot", "", this.mb['x'], this.mb['y'], this.mb['z'], this.mb['vx'], this.mb['vy'], this.mb['vz'] );
   this.bot_class_mini_obj.checked = 1;
   this.register_bot( this.bot_class_mini_obj );
 
   this.api_service = new BotControllerApiService(this);


   this.connect_to_external_masterbot();
   this.start_api_service();

   // Start thread
   this.thread_botcontroller();


    
   
   // start WebGUI (async Modul)
   const { startWebGUI } = require('./webgui_server');
   startWebGUI(this);

   // Auto structurescan on startup (config: auto_structurescan = true)
   if (String(this.config.auto_structurescan ?? "").trim().toLowerCase() === "true")
      {
      console.log("[config] auto_structurescan = true → starting scan in 3 seconds...");
      setTimeout(() => {
                       this.start_scan(1);
                       }, 3000);
      } // if

   } // constructor()


append_api_message_log(raw_message, parsed_message)
{
if (this.api_service === undefined)
   {
   return(this.append_api_message_log_internal(raw_message, parsed_message));
   } // if

return(this.api_service.append_api_message_log(raw_message, parsed_message));
} // append_api_message_log()


append_api_message_log_internal(raw_message, parsed_message)
{
const cmd = parsed_message?.cmd ?? null;
const cmd_name = this.apicall_get_cmd_name(cmd);
const bot_id = parsed_message?.botid ?? null;
const bottmpid = parsed_message?.bottmpid ?? null;
const status = parsed_message?.status ?? null;
const status_mode = parsed_message?.status_mode ?? null;

this.api_message_log.push(
                         {
                         ts: new Date().toISOString(),
                         raw: raw_message,
                         cmd: cmd,
                         cmd_name: cmd_name,
                         bot_id: bot_id,
                         bottmpid: bottmpid,
                         status: status,
                         status_mode: status_mode,
                         parsed: parsed_message
                         }
                         );

while (this.api_message_log.length > this.api_message_log_max)
      {
      this.api_message_log.shift();
      } // while
} // append_api_message_log_internal()


apicall_get_cmd_name(cmd)
{
return(runtime_get_cmd_name(this, cmd));
} // apicall_get_cmd_name()


reset_api_message_log()
{
this.api_message_log = [];
} // reset_api_message_log()


append_api_action_log(cmd_name, payload, result)
{
this.api_action_log.push(
                        {
                        ts: new Date().toISOString(),
                        cmd: cmd_name,
                        payload: payload ?? {},
                        result: result ?? {}
                        }
                        );

while (this.api_action_log.length > this.api_action_log_max)
      {
      this.api_action_log.shift();
      } // while
} // append_api_action_log()


append_api_raw_cmd_log(raw_value, bot_id = null, accepted = false)
{
let raw_parts = String(raw_value ?? "").split("#");
let target_address = String(raw_parts[0] ?? "");

this.api_raw_cmd_log.push(
                          {
                          ts: new Date().toISOString(),
                          raw_value: String(raw_value ?? ""),
                          target_address: target_address,
                          bot_id: bot_id,
                          accepted: accepted === true
                          }
                          );

while (this.api_raw_cmd_log.length > this.api_raw_cmd_log_max)
      {
      this.api_raw_cmd_log.shift();
      } // while
} // append_api_raw_cmd_log()


apicall_get_bot_snapshot(bot_id)
{
return(runtime_get_bot_snapshot(this, bot_id));
} // apicall_get_bot_snapshot()


append_api_bot_history(bot_id, cmd_name, payload, result)
{
if (!bot_id)
   {
   return(false);
   } // if

this.api_bot_history_log.push(
                             {
                             ts: new Date().toISOString(),
                             bot_id: bot_id,
                             cmd: cmd_name,
                             payload: payload ?? {},
                             result: result ?? {},
                             snapshot: this.apicall_get_bot_snapshot(bot_id)
                             }
                             );

while (this.api_bot_history_log.length > this.api_bot_history_log_max)
      {
      this.api_bot_history_log.shift();
      } // while

return(true);
} // append_api_bot_history()


apicall_get_bot_history(bot_id, limit)
{
return(runtime_get_bot_history(this, bot_id, limit));
} // apicall_get_bot_history()


apicall_generate_ack_id(bot_id = "")
{
return(runtime_generate_ack_id(this, bot_id));
} // apicall_generate_ack_id()


apicall_register_ack(ack_id, ack_payload = {})
{
return(runtime_register_ack(this, ack_id, ack_payload));
} // apicall_register_ack()


apicall_get_ack(ack_id)
{
return(runtime_get_ack(this, ack_id));
} // apicall_get_ack()


apicall_get_neighbor_bot_id_by_slot(bot_snapshot, slot = "F")
{
return(runtime_get_neighbor_bot_id_by_slot(this, bot_snapshot, slot));
} // apicall_get_neighbor_bot_id_by_slot()


apicall_get_payload_target_from_carrier_state(position, orientation, relative_slot = "F")
{
return(runtime_get_payload_target_from_carrier_state(this, position, orientation, relative_slot));
} // apicall_get_payload_target_from_carrier_state()


apicall_get_rotation_plan_between_orientations(from_orientation, to_orientation)
{
if (!from_orientation || !to_orientation)
   {
   return([]);
   } // if

let from_x = Number(from_orientation.x);
let from_y = Number(from_orientation.y);
let from_z = Number(from_orientation.z);
let target_x = Number(to_orientation.x);
let target_y = Number(to_orientation.y);
let target_z = Number(to_orientation.z);

if (from_x === target_x && from_y === target_y && from_z === target_z)
   {
   return([]);
   } // if

let rotate_right_once = this.apicall_rotate_orientation(from_x, from_y, from_z, "R");
if (
   rotate_right_once &&
   Number(rotate_right_once.x) === target_x &&
   Number(rotate_right_once.y) === target_y &&
   Number(rotate_right_once.z) === target_z
   )
   {
   return(["R"]);
   } // if

let rotate_left_once = this.apicall_rotate_orientation(from_x, from_y, from_z, "L");
if (
   rotate_left_once &&
   Number(rotate_left_once.x) === target_x &&
   Number(rotate_left_once.y) === target_y &&
   Number(rotate_left_once.z) === target_z
   )
   {
   return(["L"]);
   } // if

let rotate_right_twice = rotate_right_once
                         ? this.apicall_rotate_orientation(
                                                          Number(rotate_right_once.x),
                                                          Number(rotate_right_once.y),
                                                          Number(rotate_right_once.z),
                                                          "R"
                                                          )
                         : null;

if (
   rotate_right_twice &&
   Number(rotate_right_twice.x) === target_x &&
   Number(rotate_right_twice.y) === target_y &&
   Number(rotate_right_twice.z) === target_z
   )
   {
   return(["R", "R"]);
   } // if

return([]);
} // apicall_get_rotation_plan_between_orientations()


apicall_register_payload_link(carrier_bot_id, payload_bot_id, relative_slot = "F", attached = true)
{
return(runtime_register_payload_link(this, carrier_bot_id, payload_bot_id, relative_slot, attached));
} // apicall_register_payload_link()


apicall_clear_payload_link(carrier_bot_id)
{
return(runtime_clear_payload_link(this, carrier_bot_id));
} // apicall_clear_payload_link()


apicall_mark_pending_servicebay_recycle(payload_bot_id, carrier_bot_id = "", source = "payload_sync", position = null)
{
return(runtime_mark_pending_servicebay_recycle(this, payload_bot_id, carrier_bot_id, source, position));
} // apicall_mark_pending_servicebay_recycle()


apicall_get_pending_servicebay_recycle(payload_bot_id)
{
return(runtime_get_pending_servicebay_recycle(this, payload_bot_id));
} // apicall_get_pending_servicebay_recycle()


apicall_clear_pending_servicebay_recycle(payload_bot_id)
{
return(runtime_clear_pending_servicebay_recycle(this, payload_bot_id));
} // apicall_clear_pending_servicebay_recycle()


apicall_get_payload_link_for_carrier(carrier_bot_id)
{
return(runtime_get_payload_link_for_carrier(this, carrier_bot_id));
} // apicall_get_payload_link_for_carrier()


apicall_get_carried_payload_bot_id(carrier_bot_id)
{
return(runtime_get_carried_payload_bot_id(this, carrier_bot_id));
} // apicall_get_carried_payload_bot_id()


apicall_morph_get_structures()
{
return(runtime_morph_get_structures(this));
} // apicall_morph_get_structures()


apicall_morph_get_algos()
{
return(runtime_morph_get_algos(this));
} // apicall_morph_get_algos()


apicall_morph_start(algo, structure)
{
return(runtime_morph_start(this, algo, structure));
} // apicall_morph_start()


apicall_update_morph_status(patch = {})
{
return(runtime_update_morph_status(this, patch));
} // apicall_update_morph_status()


apicall_get_morph_status()
{
return(runtime_get_morph_status(this));
} // apicall_get_morph_status()


apicall_sync_payload_from_carrier(carrier_bot_id, carrier_position, carrier_orientation, payload_rotation_plan = [], carrier_old_orientation = null)
{
return(runtime_sync_payload_from_carrier(this, carrier_bot_id, carrier_position, carrier_orientation, payload_rotation_plan, carrier_old_orientation));
} // apicall_sync_payload_from_carrier()


apicall_mark_ack_received(ack_id, ack_status = "ack")
{
return(runtime_mark_ack_received(this, ack_id, ack_status));
} // apicall_mark_ack_received()


apicall_mark_ack_recovered(ack_id)
{
return(runtime_mark_ack_recovered(this, ack_id));
} // apicall_mark_ack_recovered()


apicall_apply_ack_local_state(ack_id)
{
let normalized_ack_id = String(ack_id ?? "").trim();
let ack_entry = this.apicall_get_ack(normalized_ack_id);
let bot_id = String(ack_entry?.bot_id ?? "").trim();
let botindex = null;
let mode = String(ack_entry?.mode ?? "").trim().toLowerCase();
let mobility_mode = String(this?.config?.mobility_mode ?? "full_edge").trim().toLowerCase();
let payload_bot_id = String(ack_entry?.payload_bot_id ?? "").trim();
let target_position = ack_entry?.to ?? null;
let target_orientation = ack_entry?.orientation ?? null;
let applied = false;

if (!ack_entry || bot_id == "")
   {
   return({
          ok: false,
          answer: "api_ack_local_state",
          ack_id: normalized_ack_id,
          error: "ACK_ENTRY_MISSING",
          applied: false
          });
   } // if

botindex = this.get_bot_by_id(bot_id, this.bots);

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_ack_local_state",
          ack_id: normalized_ack_id,
          bot_id: bot_id,
          error: "BOT_NOT_FOUND",
          applied: false
          });
   } // if

if (target_position && typeof target_position == "object")
   {
   let oldx = Number(this.bots[botindex].x);
   let oldy = Number(this.bots[botindex].y);
   let oldz = Number(this.bots[botindex].z);
   let nextx = Number(target_position.x ?? oldx);
   let nexty = Number(target_position.y ?? oldy);
   let nextz = Number(target_position.z ?? oldz);

   if (oldx !== nextx || oldy !== nexty || oldz !== nextz)
      {
      this.update_keyindex(oldx, oldy, oldz, nextx, nexty, nextz);
      this.bots[botindex].x = nextx;
      this.bots[botindex].y = nexty;
      this.bots[botindex].z = nextz;
      applied = true;
      } // if
   } // if

if (target_orientation && typeof target_orientation == "object")
   {
   let nextvx = Number(target_orientation.x ?? this.bots[botindex].vector_x ?? 0);
   let nextvy = Number(target_orientation.y ?? this.bots[botindex].vector_y ?? 0);
   let nextvz = Number(target_orientation.z ?? this.bots[botindex].vector_z ?? 0);

   if (
       (mode == "spin" || mobility_mode == "vehicle_kinematics") &&
       (
        Number(this.bots[botindex].vector_x) !== nextvx ||
        Number(this.bots[botindex].vector_y) !== nextvy ||
        Number(this.bots[botindex].vector_z) !== nextvz
       )
      )
      {
      this.bots[botindex].vector_x = nextvx;
      this.bots[botindex].vector_y = nextvy;
      this.bots[botindex].vector_z = nextvz;
      applied = true;
      } // if
   } // if

if (mode == "move" || mode == "spin")
   {
   let carrier_snapshot = this.apicall_get_bot_snapshot(bot_id);

   if (carrier_snapshot && payload_bot_id != "")
      {
      this.apicall_sync_payload_from_carrier(
                                             bot_id,
                                             carrier_snapshot.position,
                                             carrier_snapshot.orientation
                                             );
      applied = true;
      } // if
   } // if
else if (mode == "grab")
   {
   if (payload_bot_id != "")
      {
      let grab_slot = String(ack_entry?.slot ?? "").trim().toUpperCase();
      if (grab_slot == "")
         {
         grab_slot = "F";
         } // if

      // console.log("[DEBUG] apicall_apply_ack_local_state GRAB mode bot_id=" + bot_id + " payload_bot_id=" + payload_bot_id + " grab_slot=" + grab_slot + " ack_id=" + ack_id);

      this.apicall_register_payload_link(bot_id, payload_bot_id, grab_slot, true);
      let carrier_snapshot = this.apicall_get_bot_snapshot(bot_id);

      if (carrier_snapshot)
         {
         this.apicall_sync_payload_from_carrier(
                                                bot_id,
                                                carrier_snapshot.position,
                                                carrier_snapshot.orientation
                                                );
         } // if

      applied = true;
      } // if
   } // else if
else if (mode == "release")
   {
   if (payload_bot_id != "")
      {
      this.apicall_clear_payload_link(bot_id);
      applied = true;
      } // if
   } // else if

if (applied === true)
   {
   this.apicall_gui_refresh();
   } // if

return({
       ok: true,
       answer: "api_ack_local_state",
       ack_id: normalized_ack_id,
       bot_id: bot_id,
       mode: mode,
       mobility_mode: mobility_mode,
       applied: applied,
       snapshot: this.apicall_get_bot_snapshot(bot_id)
       });
} // apicall_apply_ack_local_state()


apicall_remove_ack(ack_id)
{
return(runtime_remove_ack(this, ack_id));
} // apicall_remove_ack()


apicall_sleep(ms)
{
return(runtime_sleep(this, ms));
} // apicall_sleep()


async apicall_wait_for_ack(ack_id, max_rounds = 3, delay_ms = 350)
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return({
          ack_id: normalized_ack_id,
          ack_received: false,
          ack_status: "missing_ack_id",
          rounds_used: 0
          });
   } // if

let normalized_rounds = Number(max_rounds);
if (!Number.isFinite(normalized_rounds) || normalized_rounds <= 0)
   {
   normalized_rounds = 3;
   } // if

let normalized_delay = Number(delay_ms);
if (!Number.isFinite(normalized_delay) || normalized_delay < 0)
   {
   normalized_delay = 350;
   } // if

let delay_schedule = [];

for (let i = 0; i < normalized_rounds; i++)
    {
    let next_delay = normalized_delay * Math.pow(2, i);

    if (next_delay > 5000)
       {
       next_delay = 5000;
       } // if

    delay_schedule.push(next_delay);
    } // for

for (let i = 0; i < normalized_rounds; i++)
    {
    this.apicall_poll_masterbot_queue();
    await this.apicall_sleep(delay_schedule[i]);

    let ack_entry = this.apicall_get_ack(normalized_ack_id);
    if (ack_entry && ack_entry.status == "ack")
       {
       return({
              ack_id: normalized_ack_id,
              ack_received: true,
              ack_status: ack_entry.status,
              rounds_used: (i + 1),
              ack_ts: ack_entry.ack_ts ?? null,
              delay_schedule_ms: delay_schedule.slice(0, i + 1)
              });
       } // if
    } // for

let final_ack_entry = this.apicall_get_ack(normalized_ack_id);

return({
       ack_id: normalized_ack_id,
       ack_received: false,
       ack_status: final_ack_entry?.status ?? "pending",
       rounds_used: normalized_rounds,
       ack_ts: final_ack_entry?.ack_ts ?? null,
       delay_schedule_ms: delay_schedule
       });
} // apicall_wait_for_ack()


async apicall_attach_ack_wait_and_recovery(ret)
{
if (!ret || typeof ret != "object" || !ret.ack_id)
   {
   return(ret);
   } // if

let ack_wait_ret = await this.apicall_wait_for_ack(ret.ack_id, 6, 500);
ret.ack_wait = ack_wait_ret;
ret.ack_received = ack_wait_ret.ack_received;

if (ack_wait_ret.ack_received !== true)
   {
   ret.ack_recovery = await this.apicall_recover_after_ack_timeout(ret.ack_id);
   } // if

return(ret);
} // apicall_attach_ack_wait_and_recovery()


apicall_positions_equal(pos1, pos2)
{
return(runtime_positions_equal(this, pos1, pos2));
} // apicall_positions_equal()


apicall_orientations_equal(ori1, ori2)
{
return(runtime_orientations_equal(this, ori1, ori2));
} // apicall_orientations_equal()


apicall_collect_neighbor_probe(bot_id, expected_position, snapshot)
{
return(runtime_collect_neighbor_probe(this, bot_id, expected_position, snapshot));
} // apicall_collect_neighbor_probe()


async apicall_recover_after_ack_timeout(ack_id)
{
let normalized_ack_id = String(ack_id ?? "").trim();
let ack_entry = this.apicall_get_ack(normalized_ack_id);

if (normalized_ack_id == "")
   {
   return({
          ok: false,
          answer: "api_ack_recovery",
          ack_id: normalized_ack_id,
          recovery_status: "missing_ack_id"
          });
   } // if

if (!ack_entry)
   {
   return({
          ok: false,
          answer: "api_ack_recovery",
          ack_id: normalized_ack_id,
          recovery_status: "ack_entry_missing"
          });
   } // if

let bot_id = String(ack_entry.bot_id ?? "").trim();
let expected_position = ack_entry.to ?? null;
let expected_orientation = ack_entry.orientation ?? null;

this.append_api_action_log(
                           "ack_recovery_start",
                           {
                           ack_id: normalized_ack_id,
                           bot_id: bot_id,
                           mode: ack_entry.mode ?? null
                           },
                           {
                           ok: true,
                           answer: "api_ack_recovery",
                           recovery_status: "started",
                           expected_position: expected_position,
                           expected_orientation: expected_orientation
                           }
                           );

if (bot_id != "")
   {
   this.append_api_bot_history(
                              bot_id,
                              "ack_recovery_start",
                              {
                              ack_id: normalized_ack_id,
                              mode: ack_entry.mode ?? null
                              },
                              {
                              ok: true,
                              answer: "api_ack_recovery",
                              recovery_status: "started",
                              expected_position: expected_position,
                              expected_orientation: expected_orientation
                              }
                              );
   } // if

this.append_api_action_log(
                           "ack_recovery_probe",
                           {
                           ack_id: normalized_ack_id,
                           bot_id: bot_id,
                           probe_kind: "late_ack_poll",
                           mode: ack_entry.mode ?? null
                           },
                           {
                           ok: true,
                           answer: "api_ack_recovery",
                           recovery_status: "probing"
                           }
                           );

if (bot_id != "")
   {
   this.append_api_bot_history(
                              bot_id,
                              "ack_recovery_probe",
                              {
                              ack_id: normalized_ack_id,
                              probe_kind: "late_ack_poll",
                              mode: ack_entry.mode ?? null
                              },
                              {
                              ok: true,
                              answer: "api_ack_recovery",
                              recovery_status: "probing"
                              }
                              );
   } // if

this.apicall_poll_masterbot_queue();
await this.apicall_sleep(250);

let late_ack_entry = this.apicall_get_ack(normalized_ack_id);

if (late_ack_entry && late_ack_entry.status == "ack")
   {
   let late_ret = {
                  ok: true,
                  answer: "api_ack_recovery",
                  ack_id: normalized_ack_id,
                  bot_id: bot_id,
                  recovery_status: "late_ack",
                  ack_status: late_ack_entry.status,
                  ack_ts: late_ack_entry.ack_ts ?? null
                  };

   this.append_api_action_log(
                              "ack_recovery_result",
                              {
                              ack_id: normalized_ack_id,
                              bot_id: bot_id
                              },
                              late_ret
                              );

   if (bot_id != "")
      {
      this.append_api_bot_history(
                                 bot_id,
                                 "ack_recovery_result",
                                 {
                                 ack_id: normalized_ack_id
                                 },
                                 late_ret
                                 );
      } // if

   return(late_ret);
   } // if

let snapshot = (bot_id != "" ? this.apicall_get_bot_snapshot(bot_id) : null);
let recovery_status = "unresolved";
let matches_expected_position = false;
let matches_expected_orientation = false;
let mode = String(ack_entry.mode ?? "").trim();
let likely_blocked_motion = false;
let likely_late_ack_only = false;
let likely_servicebay_extraction = false;
let recovery_hint = "";
let neighbor_probe = this.apicall_collect_neighbor_probe(bot_id, expected_position, snapshot);
let effectively_done = false;
let resolved_locally = false;

this.append_api_action_log(
                           "ack_recovery_probe",
                           {
                           ack_id: normalized_ack_id,
                           bot_id: bot_id,
                           probe_kind: "local_snapshot",
                           mode: ack_entry.mode ?? null
                           },
                           {
                           ok: true,
                           answer: "api_ack_recovery",
                           recovery_status: "probing",
                           snapshot_available: (snapshot ? true : false)
                           }
                           );

if (bot_id != "")
   {
   this.append_api_bot_history(
                              bot_id,
                              "ack_recovery_probe",
                              {
                              ack_id: normalized_ack_id,
                              probe_kind: "local_snapshot",
                              mode: ack_entry.mode ?? null
                              },
                              {
                              ok: true,
                              answer: "api_ack_recovery",
                              recovery_status: "probing",
                              snapshot_available: (snapshot ? true : false)
                              }
                              );
   } // if

this.append_api_action_log(
                           "ack_recovery_probe",
                           {
                           ack_id: normalized_ack_id,
                           bot_id: bot_id,
                           probe_kind: "neighbor_probe",
                           mode: ack_entry.mode ?? null
                           },
                           {
                           ok: true,
                           answer: "api_ack_recovery",
                           recovery_status: "probing",
                           target_state: neighbor_probe.target_state,
                           occupied_orthogonal_count: neighbor_probe.occupied_orthogonal_count
                           }
                           );

if (bot_id != "")
   {
   this.append_api_bot_history(
                              bot_id,
                              "ack_recovery_probe",
                              {
                              ack_id: normalized_ack_id,
                              probe_kind: "neighbor_probe",
                              mode: ack_entry.mode ?? null
                              },
                              {
                              ok: true,
                              answer: "api_ack_recovery",
                              recovery_status: "probing",
                              target_state: neighbor_probe.target_state,
                              occupied_orthogonal_count: neighbor_probe.occupied_orthogonal_count
                              }
                              );
   } // if

if (snapshot && expected_position)
   {
   matches_expected_position = this.apicall_positions_equal(snapshot.position, expected_position);
   } // if

if (snapshot && expected_orientation)
   {
   matches_expected_orientation = this.apicall_orientations_equal(snapshot.orientation, expected_orientation);
   } // if

if (matches_expected_position && matches_expected_orientation)
   {
   recovery_status = "state_matches_expected";
   } // if
else if (matches_expected_position)
   {
   recovery_status = "position_matches_expected";
   } // else if
else if (matches_expected_orientation)
   {
   recovery_status = "orientation_matches_expected";
   } // else if
else if (snapshot)
   {
   recovery_status = "snapshot_collected";
   } // else if

if (mode == "spin" && matches_expected_position === true && matches_expected_orientation === false)
   {
   likely_blocked_motion = true;
   recovery_hint = "position stable but orientation unchanged after spin timeout";

   if (neighbor_probe.occupied_orthogonal_count > 0)
      {
      recovery_hint += "; local neighborhood may be blocking rotation";
      } // if
   } // if
else if ((mode == "move" || mode == "grab" || mode == "release") && matches_expected_position === true)
   {
   likely_late_ack_only = true;
   recovery_hint = "expected position already visible locally despite missing ack";
   } // else if
else if (recovery_status == "unresolved")
   {
   recovery_hint = "local snapshot does not yet explain missing ack";
   } // else if
else if (recovery_status == "snapshot_collected")
   {
   recovery_hint = "snapshot collected but does not match expected target state";
   } // else if
else if (recovery_status == "state_matches_expected")
   {
   recovery_hint = "local state already matches expected target state";
   } // else if
else if (recovery_status == "position_matches_expected")
   {
   recovery_hint = "position matches expected target state";
   } // else if
else if (recovery_status == "orientation_matches_expected")
   {
   recovery_hint = "orientation matches expected target state";
   } // else if

if (mode == "spin" && matches_expected_position === true && matches_expected_orientation === true)
   {
   effectively_done = true;
   resolved_locally = true;
   } // if

if (mode == "move" && matches_expected_position === true)
   {
   effectively_done = true;
   resolved_locally = true;
   } // if

if (mode == "move" && expected_position && this.apicall_is_servicebay_cell(expected_position.x, expected_position.y, expected_position.z))
   {
   let force_recycle_ret = this.apicall_recycle_bot_force(bot_id, "ack_timeout_servicebay");

   if (force_recycle_ret?.recycled === true)
      {
      likely_servicebay_extraction = true;
      likely_late_ack_only = true;
      effectively_done = true;
      resolved_locally = true;
      recovery_status = "servicebay_extraction_assumed";
      recovery_hint = "missing ack tolerated: servicebay target reached or assumed, bot recycled locally";

      this.append_api_bot_history(
                                 bot_id,
                                 "servicebay_autorecycle",
                                 {
                                 ack_id: normalized_ack_id,
                                 source: "ack_timeout_servicebay"
                                 },
                                 force_recycle_ret
                                 );
      } // if
   } // if

if (mode == "release")
   {
   let release_payload_bot_id = String(ack_entry.payload_bot_id ?? "").trim();
   let pending_release_payload = this.apicall_get_pending_servicebay_recycle(release_payload_bot_id);

   if (release_payload_bot_id != "" && pending_release_payload)
      {
      let release_recycle_ret = this.apicall_recycle_bot_if_in_servicebay(
                                                                       release_payload_bot_id,
                                                                       "ack_timeout_release_payload"
                                                                       );

      if (release_recycle_ret?.recycled === true)
         {
         likely_servicebay_extraction = true;
         likely_late_ack_only = true;
         effectively_done = true;
         resolved_locally = true;
         recovery_status = "servicebay_payload_extraction_assumed";
         recovery_hint = "missing release ack tolerated: payload at servicebay recycled locally";

         this.append_api_bot_history(
                                    release_payload_bot_id,
                                    "servicebay_autorecycle",
                                    {
                                    ack_id: normalized_ack_id,
                                    source: "ack_timeout_release_payload",
                                    carrier_bot_id: bot_id
                                    },
                                    release_recycle_ret
                                    );
         } // if
      } // if
   } // if

if (resolved_locally === true)
   {
   this.apicall_mark_ack_recovered(normalized_ack_id);

   if (recovery_hint != "")
      {
      recovery_hint += "; local state is sufficient to treat the command as completed";
      } // if
   else
      {
      recovery_hint = "local state is sufficient to treat the command as completed";
      } // else
   } // if

let recovery_ret = {
                   ok: true,
                   answer: "api_ack_recovery",
                   ack_id: normalized_ack_id,
                   bot_id: bot_id,
                   mode: ack_entry.mode ?? null,
                   recovery_status: recovery_status,
                   expected_position: expected_position,
                   expected_orientation: expected_orientation,
                   matches_expected_position: matches_expected_position,
                   matches_expected_orientation: matches_expected_orientation,
                   effectively_done: effectively_done,
                   resolved_locally: resolved_locally,
                   likely_blocked_motion: likely_blocked_motion,
                   likely_late_ack_only: likely_late_ack_only,
                   likely_servicebay_extraction: likely_servicebay_extraction,
                   recovery_hint: recovery_hint,
                   neighbor_probe: neighbor_probe,
                   snapshot: snapshot
                   };

this.append_api_action_log(
                           "ack_recovery_result",
                           {
                           ack_id: normalized_ack_id,
                           bot_id: bot_id
                           },
                           recovery_ret
                           );

if (bot_id != "")
   {
   this.append_api_bot_history(
                              bot_id,
                              "ack_recovery_result",
                              {
                              ack_id: normalized_ack_id
                              },
                              recovery_ret
                              );
   } // if

return(recovery_ret);
} // apicall_recover_after_ack_timeout()


apicall_resolve_bot_id_by_address(address)
{
return(runtime_resolve_bot_id_by_address(this, address));
} // apicall_resolve_bot_id_by_address()


apicall_get_last_moves(limit)
{
return(runtime_get_last_moves(this, limit));
} // apicall_get_last_moves()


apicall_get_last_raw_cmds(limit)
{
return(runtime_get_last_raw_cmds(this, limit));
} // apicall_get_last_raw_cmds()


apicall_get_status_extended()
{
return(runtime_get_status_extended(this));
} // apicall_get_status_extended()


apicall_get_masterbot()
{
return(runtime_get_masterbot(this));
} // apicall_get_masterbot()


apicall_get_scan_state()
{
return(runtime_get_scan_state(this));
} // apicall_get_scan_state()


apicall_gui_set_marker(x, y, z, size, color)
{
return(runtime_gui_set_marker(this, x, y, z, size, color));
} // apicall_gui_set_marker()


apicall_gui_clear_markers()
{
return(runtime_gui_clear_markers(this));
} // apicall_gui_clear_markers()


apicall_gui_refresh()
{
return(runtime_gui_refresh(this));
} // apicall_gui_refresh()


apicall_set_debug_move(mode)
{
return(runtime_set_debug_move(this, mode));
} // apicall_set_debug_move()


apicall_get_api_messages(filter_cmd, limit)
{
return(runtime_get_api_messages(this, filter_cmd, limit));
} // apicall_get_api_messages()
   
   
   
   

 
loadconfig(filePath) {
  const config = parse_config_file(filePath);

  if (!config.mobility_mode || config.mobility_mode.trim() == "") {
    config.mobility_mode = "full_edge";
  } // if

  if (!config.communication_mode || config.communication_mode.trim() == "") {
    config.communication_mode = "mesh_opcode";
  } // if

  if (!config.direct_radio_xml || config.direct_radio_xml.trim() == "") {
    config.direct_radio_xml = "";
  } // if

  if (!config.mb_connection_id || String(config.mb_connection_id).trim() == "") {
    config.mb_connection_id = "";
  } // if

  return config;
} // loadconfig()


//
// load_direct_radio_static_info()
//
load_direct_radio_static_info(xml_filename)
{
const static_dir = path.join(__dirname, "static_bot_info");
const xml_path = path.join(static_dir, String(xml_filename ?? "").trim());

if (!fs.existsSync(xml_path))
   {
   Logger.log("WARNING: direct_radio_xml not found: " + xml_path);
   return(false);
   } // if

let xml_content = "";
try
   {
   xml_content = fs.readFileSync(xml_path, "utf8");
   } catch (error)
     {
     Logger.log("WARNING: failed to read direct_radio_xml: " + xml_path + " error: " + error.message);
     return(false);
     } // catch

const parsed = this.parse_direct_radio_static_xml(xml_content);
this.direct_radio_id_rid_map = parsed.id_rid_map;
this.direct_radio_rid_id_map = parsed.rid_id_map;

Logger.log(
          "direct_radio static info loaded from " + xml_filename +
          " entries(id->rid): " + Object.keys(this.direct_radio_id_rid_map).length
          );

return(true);
} // load_direct_radio_static_info()


//
// parse_direct_radio_static_xml()
//
parse_direct_radio_static_xml(xml_content)
{
const id_rid_map = {};
const rid_id_map = {};

const extract_tag = (block, tag_name) =>
{
const re = new RegExp("<" + tag_name + ">\\s*([\\s\\S]*?)\\s*</" + tag_name + ">", "i");
const match = String(block ?? "").match(re);
if (!match)
   {
   return("");
   } // if
return(String(match[1] ?? "").trim());
}; // extract_tag

const add_entry = (id_value, rid_value) =>
{
const id_key = String(id_value ?? "").trim();
const rid_key = String(rid_value ?? "").trim();
if (id_key == "" || rid_key == "")
   {
   return;
   } // if
id_rid_map[id_key] = rid_key;
rid_id_map[rid_key] = id_key;
}; // add_entry

const master_match = String(xml_content ?? "").match(/<masterbot>[\s\S]*?<\/masterbot>/i);
if (master_match)
   {
   const master_id = extract_tag(master_match[0], "id");
   const master_rid = extract_tag(master_match[0], "rid");
   add_entry(master_id, master_rid);
   } // if

const cell_matches = String(xml_content ?? "").match(/<cell>[\s\S]*?<\/cell>/gi) ?? [];
for (let i = 0; i < cell_matches.length; i++)
    {
    const cell_id = extract_tag(cell_matches[i], "id");
    const cell_rid = extract_tag(cell_matches[i], "rid");
    add_entry(cell_id, cell_rid);
    } // for

return({
       id_rid_map: id_rid_map,
       rid_id_map: rid_id_map
       });
} // parse_direct_radio_static_xml()
 
 
  
 
split_first(text, separator) {
  const index = text.indexOf(separator);
  if (index === -1) {
    return [text, null]; // Separator not found
  }
  const part1 = text.slice(0, index);
  const part2 = text.slice(index + separator.length);
  return [part1, part2];
} // split_first()


//
// get_direct_radio_rid_by_id()
//
get_direct_radio_rid_by_id(bot_id)
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return("");
   } // if

return(String(this.direct_radio_id_rid_map[normalized_bot_id] ?? "").trim());
} // get_direct_radio_rid_by_id()


//
// get_direct_radio_master_rid()
//
get_direct_radio_master_rid()
{
let rid = this.get_direct_radio_rid_by_id("MASTERBOT");
if (rid == "")
   {
   rid = this.get_direct_radio_rid_by_id("masterbot");
   } // if

if (rid == "")
   {
   rid = "00:00:00:00:00:00";
   } // if

return(String(rid).trim());
} // get_direct_radio_master_rid()


//
// scan_radio_enqueue_neighbor_ids()
//
scan_radio_enqueue_neighbor_ids(source_bot_id, nbh_neighbors)
{
const entries = Object.entries(nbh_neighbors ?? {});

for (let i = 0; i < entries.length; i++)
    {
    const slot_name = String(entries[i][0] ?? "").trim().toUpperCase();
    const neighbor_id = String(entries[i][1]?.id ?? "x").trim();

    if (slot_name == "")
       {
       continue;
       } // if

    if (neighbor_id == "" || neighbor_id == "x" || neighbor_id == "MB")
       {
       continue;
       } // if

    if (this.scan_radio_requested_ids[neighbor_id] === true)
       {
       continue;
       } // if

    if (this.scan_radio_completed_ids[neighbor_id] === true)
       {
       continue;
       } // if

    if (this.scan_radio_pending_ids.includes(neighbor_id))
       {
       continue;
       } // if

    this.scan_radio_parent_hint[neighbor_id] = String(source_bot_id ?? "");
    this.scan_radio_pending_ids.push(neighbor_id);
    } // for
} // scan_radio_enqueue_neighbor_ids()


//
// scan_radio_dispatch_nbh_by_id()
//
scan_radio_dispatch_nbh_by_id(bot_id)
{
let normalized_bot_id = String(bot_id ?? "").trim();
let target_rid = this.get_direct_radio_rid_by_id(normalized_bot_id);
let master_rid = this.get_direct_radio_master_rid();

if (normalized_bot_id == "")
   {
   return(false);
   } // if

if (target_rid == "")
   {
   Logger.log("scan_radio_dispatch_nbh_by_id: missing RID for bot_id: " + normalized_bot_id);
   return(false);
   } // if

let cmd = target_rid + "#NBH#id#.#" + master_rid;
cmd = this.sign(cmd);

let cellbot_cmd = "{ \"cmd\":\"push\", \"param\":\""+cmd+"\" }\n";
this.client.write(cellbot_cmd);

this.scan_radio_requested_ids[normalized_bot_id] = true;
this.scan_waiting_radio[normalized_bot_id] =
   {
   bot_id: normalized_bot_id,
   rid: target_rid,
   status: 0,
   requested_ts: Number(new Date().getTime())
   };

return(true);
} // scan_radio_dispatch_nbh_by_id()


//
// scan_radio_register_seed_from_rnbh()
//
scan_radio_register_seed_from_rnbh(msgarray)
{
let seed_id = String(this.scan_radio_seed_id ?? "").trim();
let response_bot_id = String(msgarray?.botid ?? "").trim();
let nbh_neighbors = msgarray?.nbh_neighbors ?? {};

if (seed_id == "" || response_bot_id == "" || response_bot_id != seed_id)
   {
   return(false);
   } // if

let mb_slot = "";
const entries = Object.entries(nbh_neighbors);
for (let i = 0; i < entries.length; i++)
    {
    if (String(entries[i][1]?.id ?? "").trim() == "MB")
       {
       mb_slot = String(entries[i][0] ?? "").trim().toUpperCase();
       break;
       } // if
    } // for

if (mb_slot == "")
   {
   Logger.log("scan_radio_register_seed_from_rnbh: missing MB slot in seed response for " + response_bot_id);
   return(false);
   } // if

let cmd_slot = String(this.mb['connection'] ?? "").toUpperCase().trim();
if (cmd_slot == "")
   {
   Logger.log("scan_radio_register_seed_from_rnbh: missing mb.connection");
   return(false);
   } // if

let targetcoor = this.get_next_target_coor(
                                      this.mb['x'],
                                      this.mb['y'],
                                      this.mb['z'],
                                      this.mb['vx'],
                                      this.mb['vy'],
                                      this.mb['vz'],
                                      cmd_slot
                                      );

let target_vectorx = Number(this.mb['vx']);
let target_vectory = Number(this.mb['vy']);
let target_vectorz = Number(this.mb['vz']);

if (mb_slot != 'T' && mb_slot != 'D')
   {
   let orientation_vector = this.calc_target_orientation_vector(
                                                               this.mb['x'],
                                                               this.mb['y'],
                                                               this.mb['z'],
                                                               targetcoor.x,
                                                               targetcoor.y,
                                                               targetcoor.z,
                                                               mb_slot
                                                               );

   target_vectorx = Number(orientation_vector.vx);
   target_vectory = Number(orientation_vector.vy);
   target_vectorz = Number(orientation_vector.vz);
   } else
     {
     let rel_vec = String(nbh_neighbors[mb_slot]?.vec ?? "x").trim();
     if (rel_vec != "x")
        {
        let vecparts = rel_vec.split(",");
        if (vecparts.length == 3)
           {
           let orientation_vector = this.calc_target_orientation_vector_relative(
                                                                             Number(this.mb['vx']),
                                                                             Number(this.mb['vy']),
                                                                             Number(this.mb['vz']),
                                                                             Number(vecparts[0]),
                                                                             Number(vecparts[1]),
                                                                             Number(vecparts[2])
                                                                             );
           target_vectorx = Number(orientation_vector.vx);
           target_vectory = Number(orientation_vector.vy);
           target_vectorz = Number(orientation_vector.vz);
           } // if
        } // if
     } // else

let target_bot_index = this.get_3d(targetcoor.x, targetcoor.y, targetcoor.z);
if (target_bot_index == null)
   {
   let bot_class_mini_obj = new bot_class_mini();
   bot_class_mini_obj.setvalues(
                               response_bot_id,
                               this.get_direct_radio_rid_by_id(response_bot_id),
                               targetcoor.x,
                               targetcoor.y,
                               targetcoor.z,
                               target_vectorx,
                               target_vectory,
                               target_vectorz,
                               "eeeeff",
                               ""
                               );
   this.register_bot(bot_class_mini_obj);

   const events = [];
   let notify_msg =
       {
       event: "addbot",
       botid: response_bot_id,
       position: { x: Number(targetcoor.x), y: Number(targetcoor.y), z: Number(targetcoor.z) },
       orientation: { x: Number(target_vectorx), y: Number(target_vectory), z: Number(target_vectorz) },
       color: "eeeeff",
       adress: ""
       };
   events.push(notify_msg);
   this.notify_frontend(events);
   } // if

this.scan_radio_seed_registered = true;
this.scanwaitingcounter_radio = 0;
this.scan_radio_enqueue_neighbor_ids(response_bot_id, nbh_neighbors);
return(true);
} // scan_radio_register_seed_from_rnbh()


//
// scan_radio_find_slot_to_neighbor()
//
scan_radio_find_slot_to_neighbor(nbh_neighbors, neighbor_id)
{
let normalized_neighbor_id = String(neighbor_id ?? "").trim();
const entries = Object.entries(nbh_neighbors ?? {});

for (let i = 0; i < entries.length; i++)
    {
    const slot_name = String(entries[i][0] ?? "").trim().toUpperCase();
    const slot_neighbor_id = String(entries[i][1]?.id ?? "").trim();

    if (slot_name == "")
       {
       continue;
       } // if

    if (slot_neighbor_id == normalized_neighbor_id)
       {
       return(slot_name);
       } // if
    } // for

return("");
} // scan_radio_find_slot_to_neighbor()


//
// scan_radio_get_parent_slot_to_child()
//
scan_radio_get_parent_slot_to_child(parent_id, child_id)
{
let normalized_parent_id = String(parent_id ?? "").trim();
let normalized_child_id = String(child_id ?? "").trim();

if (normalized_parent_id == "" || normalized_child_id == "")
   {
   return("");
   } // if

const parent_neighbors = this.scan_radio_neighbors_by_bot[normalized_parent_id] ?? {};
return(this.scan_radio_find_slot_to_neighbor(parent_neighbors, normalized_child_id));
} // scan_radio_get_parent_slot_to_child()


//
// scan_radio_register_or_update_bot_from_rnbh()
//
scan_radio_register_or_update_bot_from_rnbh(msgarray)
{
let child_id = String(msgarray?.botid ?? "").trim();
let child_neighbors = msgarray?.nbh_neighbors ?? {};

if (child_id == "")
   {
   return(false);
   } // if

if (child_id == String(this.scan_radio_seed_id ?? "").trim())
   {
   return(false);
   } // if

let existing_index = this.get_bot_by_id(child_id, this.bots);
let parent_id = String(this.scan_radio_parent_hint[child_id] ?? "").trim();
let parent_index = null;
let slot_parent_to_child = "";
let slot_child_to_parent = "";

if (existing_index != null)
   {
   const preferred_vertical_slots = ["D", "T"];

   for (let i = 0; i < preferred_vertical_slots.length; i++)
       {
       const vertical_slot = preferred_vertical_slots[i];
       const vertical_neighbor_id = String(child_neighbors?.[vertical_slot]?.id ?? "").trim();
       const vertical_vec = String(child_neighbors?.[vertical_slot]?.vec ?? "x").trim();

       if (vertical_neighbor_id == "" || vertical_neighbor_id == "x" || vertical_vec == "x")
          {
          continue;
          } // if

       const vertical_parent_index = this.get_bot_by_id(vertical_neighbor_id, this.bots);
       if (vertical_parent_index == null)
          {
          continue;
          } // if

       const vecparts = vertical_vec.split(",");
       if (vecparts.length != 3)
          {
          continue;
          } // if

       let orientation_vector = this.calc_target_orientation_vector_relative(
                                                                         Number(this.bots[vertical_parent_index].vector_x),
                                                                         Number(this.bots[vertical_parent_index].vector_y),
                                                                         Number(this.bots[vertical_parent_index].vector_z),
                                                                         Number(vecparts[0]),
                                                                         Number(vecparts[1]),
                                                                         Number(vecparts[2])
                                                                         );

       this.bots[existing_index].vector_x = Number(orientation_vector.vx);
       this.bots[existing_index].vector_y = Number(orientation_vector.vy);
       this.bots[existing_index].vector_z = Number(orientation_vector.vz);
       break;
       } // for
   } // if

if (parent_id != "")
   {
   parent_index = this.get_bot_by_id(parent_id, this.bots);

   if (parent_index != null)
      {
      slot_parent_to_child = this.scan_radio_get_parent_slot_to_child(parent_id, child_id);
      slot_child_to_parent = this.scan_radio_find_slot_to_neighbor(child_neighbors, parent_id);
      } // if
   } // if

if (parent_index == null || slot_parent_to_child == "")
   {
   const slot_names = ["D", "T", "F", "R", "B", "L"];

   for (let i = 0; i < slot_names.length; i++)
       {
       const slot_name = String(slot_names[i] ?? "").trim();
       const candidate_parent_id = String(child_neighbors?.[slot_name]?.id ?? "").trim();

       if (candidate_parent_id == "" || candidate_parent_id == "x")
          {
          continue;
          } // if

       const candidate_parent_index = this.get_bot_by_id(candidate_parent_id, this.bots);
       if (candidate_parent_index == null)
          {
          continue;
          } // if

       const candidate_slot_parent_to_child = this.scan_radio_get_parent_slot_to_child(candidate_parent_id, child_id);
       if (candidate_slot_parent_to_child == "")
          {
          if (slot_name == "D")
             {
             parent_id = candidate_parent_id;
             parent_index = candidate_parent_index;
             slot_parent_to_child = "T";
             slot_child_to_parent = "D";
             break;
             } // if

          if (slot_name == "T")
             {
             parent_id = candidate_parent_id;
             parent_index = candidate_parent_index;
             slot_parent_to_child = "D";
             slot_child_to_parent = "T";
             break;
             } // if

          continue;
          } // if

       parent_id = candidate_parent_id;
       parent_index = candidate_parent_index;
       slot_parent_to_child = candidate_slot_parent_to_child;
       slot_child_to_parent = slot_name;
       break;
       } // for
   } // if

if (parent_index == null || slot_parent_to_child == "")
   {
   return(false);
   } // if

let parent_bot = this.bots[parent_index];

let targetcoor = this.get_next_target_coor(
                                      parent_bot.x,
                                      parent_bot.y,
                                      parent_bot.z,
                                      parent_bot.vector_x,
                                      parent_bot.vector_y,
                                      parent_bot.vector_z,
                                      slot_parent_to_child
                                      );

let child_slot_to_parent = this.scan_radio_find_slot_to_neighbor(child_neighbors, parent_id);
if (child_slot_to_parent == "" && slot_child_to_parent != "")
   {
   child_slot_to_parent = slot_child_to_parent;
   } // if

let target_vectorx = Number(parent_bot.vector_x);
let target_vectory = Number(parent_bot.vector_y);
let target_vectorz = Number(parent_bot.vector_z);

if (child_slot_to_parent != "")
   {
   if (child_slot_to_parent != "T" && child_slot_to_parent != "D")
      {
      let orientation_vector = this.calc_target_orientation_vector(
                                                                  parent_bot.x,
                                                                  parent_bot.y,
                                                                  parent_bot.z,
                                                                  targetcoor.x,
                                                                  targetcoor.y,
                                                                  targetcoor.z,
                                                                  child_slot_to_parent
                                                                  );
      target_vectorx = Number(orientation_vector.vx);
      target_vectory = Number(orientation_vector.vy);
      target_vectorz = Number(orientation_vector.vz);
      } else
        {
        let rel_vec = String(child_neighbors[child_slot_to_parent]?.vec ?? "x").trim();
        if (rel_vec != "x")
           {
           let vecparts = rel_vec.split(",");
           if (vecparts.length == 3)
              {
              let orientation_vector = this.calc_target_orientation_vector_relative(
                                                                                Number(parent_bot.vector_x),
                                                                                Number(parent_bot.vector_y),
                                                                                Number(parent_bot.vector_z),
                                                                                Number(vecparts[0]),
                                                                                Number(vecparts[1]),
                                                                                Number(vecparts[2])
                                                                                );
              target_vectorx = Number(orientation_vector.vx);
              target_vectory = Number(orientation_vector.vy);
              target_vectorz = Number(orientation_vector.vz);
              } // if
           } // if
        } // else
   } // if

let target_bot_index = this.get_3d(targetcoor.x, targetcoor.y, targetcoor.z);
if (target_bot_index != null && target_bot_index != existing_index)
   {
   return(false);
   } // if

if (existing_index != null)
   {
   this.bots[existing_index].x = Number(targetcoor.x);
   this.bots[existing_index].y = Number(targetcoor.y);
   this.bots[existing_index].z = Number(targetcoor.z);
   this.bots[existing_index].vector_x = Number(target_vectorx);
   this.bots[existing_index].vector_y = Number(target_vectory);
   this.bots[existing_index].vector_z = Number(target_vectorz);
   this.scanwaitingcounter_radio = 0;
   return(true);
   } // if

let bot_class_mini_obj = new bot_class_mini();
bot_class_mini_obj.setvalues(
                            child_id,
                            this.get_direct_radio_rid_by_id(child_id),
                            targetcoor.x,
                            targetcoor.y,
                            targetcoor.z,
                            target_vectorx,
                            target_vectory,
                            target_vectorz,
                            "eeeeff",
                            ""
                            );
this.register_bot(bot_class_mini_obj);

const events = [];
let notify_msg =
    {
    event: "addbot",
    botid: child_id,
    position: { x: Number(targetcoor.x), y: Number(targetcoor.y), z: Number(targetcoor.z) },
    orientation: { x: Number(target_vectorx), y: Number(target_vectory), z: Number(target_vectorz) },
    color: "eeeeff",
    adress: ""
    };
events.push(notify_msg);
this.notify_frontend(events);

this.scanwaitingcounter_radio = 0;
return(true);
} // scan_radio_register_or_update_bot_from_rnbh()

 

 
//
// sign()
//  
sign( param )
{
let signparam = "";


if ( this.config.enable_signing == "true" )
   {
   let param_to_sign = this.split_first( param, '#' )[1];
   
   if ( this.config.signature_type == 'HMAC' )
      {
      signparam += "01";
      signparam += this.signature_class_obj.signMessage( this.signature_class_obj.SIG_HMAC, param_to_sign, this.config.private_key_or_secret );      
      } // HMAC

   if ( this.config.signature_type == 'ED25519' )
      {
      signparam += "02";
      signparam += this.signature_class_obj.signMessage( this.signature_class_obj.SIG_ED25519, param_to_sign, this.config.private_key_or_secret );      
      } // HMAC

   if ( this.config.signature_type == 'RSA' )
      {      
      let private_key = this.signature_class_obj.restorePEM( this.config.private_key_or_secret , "PRIVATE KEY");
                 
      signparam += "03";
      signparam += this.signature_class_obj.signMessage( this.signature_class_obj.SIG_RSA, param_to_sign, private_key );      
      } // HMAC
   
   return ( signparam + "@" + param ); 
   } // this.config.enable_signing

return ( param );
} // sign()
  
  
  
  
  
  

//
// connect_to_external_masterbot()
//   
connect_to_external_masterbot() {
    if (this.connect_masterbot == 1) {
        this.start_masterbot_autoconnect();
    }
} // connect_to_external_masterbot



  
  
  


//
// start_masterbot_autoconnect()
//  - versucht Verbindung → reconnect bei Fehler
//
start_masterbot_autoconnect() {

    const tryConnect = () => {

        console.log(`[BotController] Trying to connect to ClusterSim at ${this.HOST}:${this.PORT} ...`);

        this.client = new net.Socket();
        this.client.setNoDelay(true);

        this.client.connect(this.PORT, this.HOST, () => {
            console.log("[BotController] Connected with MasterBot");

            this.MASTERBOT_CONNECTED = 1;

            // Status anfordern
            this.client.write('{ "cmd":"status" }\n');

            // !!! WICHTIG:
            // nach erfolgreichem Connect wieder Listener aktivieren
            this.setup_masterbot_data_listener();
        });

        this.client.on('error', (err) => {
            console.log("[BotController] Connection failed:", err.code);

            this.MASTERBOT_CONNECTED = 0;

            // Nach 2s erneut versuchen
            setTimeout(tryConnect, 2000);
        });

        // NEU: sauberer close-Listener
        this.client.on('close', () => {

            console.log("[BotController] Connection closed.");

            this.MASTERBOT_CONNECTED = 0;

            if (!this._shutdownRequested) {
                console.log("[BotController] Lost connection → attempting reconnect...");
                setTimeout(tryConnect, 2000);
            }
        });
    };

    tryConnect();
} // start_masterbot_autoconnect()




afterMasterbotConnected() {

    console.log('Connected with MasterBot');
    console.log('Enter command (gettime/getstatus) or "quit":');

    this.MASTERBOT_CONNECTED = 1;

    // initial Status holen
    this.client.write('{ "cmd": "status" }\n');

    // ✨ alte Event-Handler wieder aktivieren
    this.setup_readline_interface();
    this.setup_masterbot_data_listener();
} // afterMasterbotConnected

  
  


setup_readline_interface() {
    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

  
    
      
  this.rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      this.rl.close();
      this.client.end();
    } else 
           {
    
           if (input == "status")
              {               
              cmd = "{ \"cmd\":\"status\" }\n";              
              }
           else
           
            
           if (input == "quit")
              {               
              this.shutdown();

/*              cmd = "{ \"cmd\":\"quit\" }\n";
              this.client.write(cmd);

              this.rl.close();
              this.client.end();*/
              }
           else

           
           if (input == "dump")
              {               
              cmd = "{ \"cmd\":\"dump\" }\n";
              }
           else


           if (input == "step")
              {               
              cmd = "{ \"cmd\":\"step\" }\n";
              }
           else

           
           if (input == "debug")
              {
                                           
              cmd = "{debug}";
              cmd = "{ \"cmd\":\"debug\" }";
              
              }
           else
           
           if (input == "push")
              {               
         
              param = "F#SC#00ff00";
              param = "FFF#SC#00ff00";
              param = "FFR#SC#00ff00";
              param = "FFL#SC#00ff00";
              param = "F#PING#S";     // Directly conncted cube
              param = "FF#PING#BB";   // Second conncted cube
 
               
              param = "F#INFO#0_01#S";     // Directly conncted cube - ok
              param = "FF#INFO#0_02#SB";   //   cube - ok
              param = "FFL#INFO#0_05#SBB"; //   cube 
              

              param = "FFT#INFO#0_04#DBB"; //   cube TD-Test
              param = "T#INFO#0_06#D";     //   masterbot T-Test
              param = "D#INFO#0_06#T";     //   masterbot D-Test
              param = "T#INFO#0_06#S";     //   masterbot D-Test - SELF


              param = "FFTT#INFO#0_06#DDBB"; //   masterbot T-Test 
              param = "FFD#INFO#0_06#TBB";   //   masterbot D-Test 
              param = "F#CHECK#F#B";         //   check
              param = "FF#CHECK#F#BB";       //   check
              
              param = "F#XSC#ffaa00";        //   XSC - Setcolor
              param = "FF#XSC#ffaa00#BB";    //   XSC - Setcolor
              param = "FF#XRC##BB";          //   XRC - ReadColor
              
              param = "FFT#MOVE#D_F_D";       //   Move
              param = "FFT#MOVE#D_FT_D;LIFE"; //   Move
              param = "FFT#MOVE#D_F_D;LIFE";  //   Move

              param = "FFT#MOVE#D_SR_D;LIFE";      //   Move
              param = "FFT#MOVE#D_SL_D;ALIFE#DBB"; //   ALIFE
              param = "FFT#MOVE#D_F_D;ALIFE#DLBB"; //   ALIFE 
              
              param = "FFT#MOVE#D_SL_D;CFDT";  // Connect-Test
              param = "FFT#MOVE#D_SL_D;C";     // Connect-Test

              param = "FFT#MOVE#GF";        // Grab
              
              
              param = "FFT#MOVE#D_F_D;ALIFE;4711#DLBB"; 
//            
              param = "FFT#MOVE#D_F_D;ALIFE;5522#DLBB"; 

                      
              param = "FF#MOVE#D_TF_D;ALIFE;5523#DBB";   
              param = "FF#MOVE#D_TF_D;D_F_D;ALIFE;5523#DBBB"; 
              param = "FF#MOVE#D_TF_D;D_F_D;ALIFE;5523#DBLBBRB";  

              param = "FFT#MOVE#D_F_D#";  
              param = "FFT#MOVE#D_SL_D;ALIFE;hic#DLB";  



              param = "FFT#MOVE#GF;D_F_D#";  // Front
              param = "FFT#MOVE#GF;D_SL_D#"; // Spin-Left
              
              param = "FFT#MOVE#D_GF;D_SL_D#"; // Spin-Left

              param = "FFT#XSC#ff0000#";       // SetColor
              
              param = "FFF#MOVE#D_F_D";       // SetColor
              
               
              param = "FFF#XDUMMY#{dummy:'ok',x:42,parameter1:'this is a test1' }#"; // Dummy-X Command  
                 
              param = "FF#SYS#LOCKFRL"; // LOCK
                 
                 
              param = "FF#XSC#ff0000#";
              
              //param = "FF#MOVE#NONCE;42"; // NONCE
              
                 
              // Signing
              //console.log("param: ["+param+"]");
              param = this.sign( param );
                  
              cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
                            
              console.log("CMD:" + cmd);
                           
              }
           else           
           
           
   if (input == "push2")
              {                                     
              param = "FFT#MOVE#D_F_D"; //   Move
                      
              param = "FFT#XRC##DLB";   // ReadColor
              
              param = "FFF#XSC#ff0000#";
              
              param = "FF#SYS#LOCK"; // LOCK
              
              
              
              // HMAC
              //  param = "FF#SYS#UPDATEKEY01f3573fc481087cd80aa60ed72d6197180712c1a1b318d87fb0a7473566b3919c"; //
              
              // ED25519
              //  param = "FF#SYS#UPDATEKEY02X3wjg+AEDHHTu99/0UYlfkvJVkEPhJjP0y5Aa39Bj34="; //
               
              // RSA
              param = "FF#SYS#UPDATEKEY03PEM|MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArb/fDWScRvlgNj12A22y|GRCjtvSkMxMYRSnaLnEyWbOPVU+EEtV7UVRPEE6ZoDkFOWKJnkN459jGyG+/7hfR|afHKywCi3SGkEGnOg42onpUU6k/j89n1jjQ/KdmY+4zZMmI9TJABU/dXzr8KyjNj|xgUJB3rz6wMwZm4COsLOlXt9+vKSCL8++zaa19Eno0PjavEQ2lFUBHUm1QJoSRR6|X3Lk4tPBKJqac7U6dzZwGPL40qsZ6Xw51wJDEtRyYpBluzwC4yceuWwHU3D8utAy|Uqh19i5DdniAym1z9xPN11e+SfZ9l3CQiaGrwxwG8rz2qvh5eYmnyE/BsUxaubzH|sQIDAQAB;NONCE;43"; //
               
              param = this.sign( param );               
              
              cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
              
              // Set current signature to new setting
              this.config.signature_type = "RSA";
              this.config.private_key_or_secret = "PEM|MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCtv98NZJxG+WA2|PXYDbbIZEKO29KQzExhFKdoucTJZs49VT4QS1XtRVE8QTpmgOQU5YomeQ3jn2MbI|b7/uF9Fp8crLAKLdIaQQac6DjaielRTqT+Pz2fWOND8p2Zj7jNkyYj1MkAFT91fO|vwrKM2PGBQkHevPrAzBmbgI6ws6Ve3368pIIvz77NprX0SejQ+Nq8RDaUVQEdSbV|AmhJFHpfcuTi08EomppztTp3NnAY8vjSqxnpfDnXAkMS1HJikGW7PALjJx65bAdT|cPy60DJSqHX2LkN2eIDKbXP3E83XV75J9n2XcJCJoavDHAbyvPaq+Hl5iafIT8Gx|TFq5vMexAgMBAAECggEAJQCYuxxzH7ZaJBMAwAgrhqUBiKQfF/V4FLquCXf39hyE|aPGvOeeXBKIE2H80vmeGUktG7ZqG9DE5XFRYNpeB9KMWwhbXmGpiq1AtN90CTQuI|0cHD1RnU7rz3uqzppKDBXLaJQXXlooEphREwdhFtrS1DWAF6UtFyDE5fUS5Nmo3A|knxIEMcMfK0tOqt9ZEwpYZc67fZYrkYaazbQ13aJs5Hoa4r6C/PrWXtdM2Tw8a3w|WKmH92dqeHlvCfg2Ug5L5zmZz8wWfOHvyyqzczweewiFRIk0S1uGGW2Q1+mOohEw|CfFpyQCgmCS6LeXtWMi9WPNtkc6UsU8E5NHhUqM0xQKBgQDwfvk1yAYVNWe5btAd|ut2+QtPNTwiut4zyaGoBL3c5IeNDW5czocQt1c6ZoZDL/MszFuIjW2nbu0OHFvS3|O1tK2MjEOOCPltL3ZAX1vSnhe2VWxA8HUrvO9QWO7k6fqP64Id6XBFVkV9YzXCQI|XlFwKlOaLlqj0BITSVaQd2/8CwKBgQC481jIsKBEphnT7nv7/XbAJs0CASBa0gA9|DrdmV8lwFYcMDPYNs8a3yyM8eKZ10lSsWv8K0vnPVfuaJ1u8gWuxE/uZUpWI5j6p|BB3/aq7G1R28OJaNlhplVG5BHvTu3wWMJJTs0leLMTOzyEV3fvCc52HJKzqinLN4|X5T6ZbokswKBgBWXkNBfUQx+av2fEVhZ+qamYVXBjsoA+MqazUml9VJP1JOrmXut|PmvPEmmAs/tcivHfUBZUksCDo6BxUy9QSPYDWKMlaCP8KpzDgjV58lSoO4T6vU6v|AuWl4gXfJ3f2OEhX4iA052XG7RhXYXTO4wjrA+6H0uN6PuU0ZG08C/XZAoGAdFN6|UB/nbcYbEJU7Hi85dXnyD4St2PGkfMK4z4H/jKO9oPK1/8BHCGqX6vznlcuIvi8t|op03yhSGf1qp9FJibann4XNz4fsPBjc0tuVesGhyn2PoLX1vdLQ59HOIEoXrc02+|7YUO0tlLb5RTPOl2ZPmTI3gxFP4CU3+qsCMzhMkCgYBEyT13L2kXnaP5PpmcIB04|GGfwAnHkzKVpYcp/7DWZHsyin+dRn7+D4PSZbLTqsGCufhx+vK4tIU/d4wM6GfL4|zZDIOGujOGkrc2axY+yhyJ+/2hw4hJGD2bs+8JoXFZgG7nsd0u9EvVuq0QiueJBT|9BYdXPvO8L923ocNgB3I1A==";
              
             
              }
           else   
           
          if (input == "push3")
              {                     
                          param = "FF#XSC#0000ff#";
              
              //param = "FF#MOVE#NONCE;42"; // NONCE
              
                 
              // Signing
              //console.log("param: ["+param+"]");
              param = this.sign( param );
                  
              cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
                            
              console.log("CMD:" + cmd);
              } 
            else
           
           
           if (input == "scanstep")
              {              
           
              this.scan_step();
              
              }
           else   
                      
  
           if (input == "pop")
              {              
              param = "";
              
              cmd = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";
              
              //console.log("CMD:" + cmd);
               
              }
           else   
           
           
       if (input == "export")
              {              
              this.bots_jsonexport("logs/botexport_live.json");
               
              }
           else           
            
           
           if (input == "run")
              {              
                              
              let retstruct = this.create_opcode_sequence( "" );
              let opcodes = retstruct.opcodes;
              
              console.log("RETSTRUCT: ");
              console.log( retstruct );
  
              // Write opcodes to file  
              const filePath = path.join(__dirname, 'sequences', 'morph.sequence');
    
              fs.writeFileSync(filePath, opcodes, 'utf8');

              }
           else              
      
      
                 {
                 cmd = input;
                 console.log("cmd = input");
                 }
                 
                 
                 
      if (
         input != 'quit'     &&
         input != 'scanstep' &&
         input != 'run' 
         ) 
         {
         
         console.log("cmd: " + cmd);
         this.client.write(cmd);
         }
    }
  });
  
  
  
    
} // setup_readline_interface()




setup_masterbot_data_listener() {

/*
    this.client.on('data', (data) => {
        // dein alter JSON-Parsing-Code hier rein
    });
  */  
    
   
this.client.on('data', (data) => 
{
this.masterbot_incoming_buffer += data.toString();

const messages = this.masterbot_incoming_buffer.split("\n");
this.masterbot_incoming_buffer = messages.pop() ?? "";
  

  
 messages.forEach(msg => 
 {
const jsonstring = msg.toString().trim();
  
   
   try {
       const decodedobject = JSON.parse(jsonstring);
       
       if ( decodedobject.cmd == "submitstatus" )
          {
          this.masterbot_name = decodedobject.masterbot_name;
          } // "submitstatus"
       else
       
       if ( decodedobject.cmd == "submitqueue" )
          {
          
          this.handle_answer( decodedobject );
          
          } // "submitstatus"
          
          
       else
       if ( decodedobject.cmd == "msg" )
          {
          msg = decodedobject.msg;
          } // "submitstatus"
       
       } catch (error) 
         {
         console.error("Error parsing JSON:", error);
         console.error("Raw JSON chunk:", jsonstring);
         }
         
  
  
 });   /// messages.forEach(msg =>     
   


}); // this.client.on
 
    
 


this.client.on('close', () => {
    console.log('MasterBot connection closed.');

    this.MASTERBOT_CONNECTED = 0;
    this.masterbot_incoming_buffer = "";

    // Versuche nicht, neu zu verbinden, falls der Benutzer absichtlich "quit" gedrückt hat
    if (this._shutdownRequested) {
        console.log("Shutting down BotController.");
        process.exit(0);
    }

    // Andernfalls einfach die Schleife weiterlaufen lassen:
    console.log("Waiting for MasterBot to come online...");
});





} // setup_masterbot_data_listener()





  /*
//
// connect_to_external_masterbot()
// 
connect_to_external_masterbot()
{
let param = "";

this.client = new net.Socket();

this.rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


 



if (this.connect_masterbot == 1)
{

this.client.connect( this.PORT, this.HOST, () => {
  console.log('Connected with MasterBot');
  console.log('Enter command (gettime/getstatus) or "quit":');
  
  this.MASTERBOT_CONNECTED = 1;
  let cmd = "";
  
    
  // ask for initial status 
  cmd = "{ \"cmd\":\"status\" }\n";
  this.client.write(cmd);
  
    

}); // this.client.connect






 


this.client.on('close', () => {
  console.log('Connection closed!');
  process.exit(0);
});


} // if (connect_masterbot == 1)
else
{

}



 


} // connect_to_external_masterbot()
  
  
  

*/




//
// setup_console_interface()
//  (safe mode: only adds a wrapper, nothing removed)
//
setup_console_interface() {

    // Falls später schon gesetzt, abbrechen (sicherheitscheck)
    if (this.rl) {
        console.log("[setup_console_interface] readline already active.");
        return;
    }

    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('Console ready. Type "quit" to exit.');

    this.rl.on('line', input => {
        input = input.trim();

        // Quit -> sauber shutdown
        if (input === 'quit') {
            console.log("Shutting down...");
            this._shutdownRequested = true;

            try { if (this.client) this.client.end(); } catch(e) {}

            process.exit(0);
        }

        // Alle anderen Eingaben erstmal NICHT verändern!
        // Deine alte Console-Logik darf sich erstmal weiter darum kümmern.
        console.log("[Console passthrough]", input);
    });

} // setup_console_interface()



 
 
shutdown() 
{
    if (this._shutdownRequested) return;  
    this._shutdownRequested = true;

    console.log("Shutting down...");

   

    // 2) Close GUI-Websocket  
    if (this.ws_gui) {
        try {
            console.log("→ Closing WebGUI WebSocket...");
            this.ws_gui.close();
        } catch(e) {}
    } // if

    if (this.api_server) {
        try {
            console.log("→ Closing API Server...");
            this.api_server.close();
        } catch(e) {}
    } // if

    // 3) close readline 
    if (this.rl) {
        try {
            this.rl.close();
        } catch(e) {}
    } // if

    // 4) exit process
    setTimeout(() => {
        console.log("→ Exit.");
        process.exit(0);
    }, 300);
    
} // shutdown()
 
 
 
 
 
start_scan( reset = 1)
{

this.bots     = [];  
this.botindex = [];

this.scan_waiting_info = {};


this.scan_status  = 0;
this.tmpid_cnt    = 0;
this.scan_timeout = 0;



// Add masterbot ...
const bot_class_mini_obj = new bot_class_mini();
  
    
bot_class_mini_obj.setvalues(
                            "masterbot",
                            "",
                             this.mb['x'],
                             this.mb['y'],
                             this.mb['z'],
                             this.mb['vx'],
                             this.mb['vy'],
                             this.mb['vz'],
                             "FF0000"                            
                           );
             
            
                       
                 
bot_class_mini_obj.checked = 1;
   
bot_class_mini_obj.checked_neighbors['f'] = 1;
bot_class_mini_obj.checked_neighbors['r'] = 1;
bot_class_mini_obj.checked_neighbors['b'] = 1;
bot_class_mini_obj.checked_neighbors['l'] = 1;
bot_class_mini_obj.checked_neighbors['t'] = 1;
bot_class_mini_obj.checked_neighbors['d'] = 1;

bot_class_mini_obj.checked_neighbors[ this.mb['connection']] = 0;


 


bot_class_mini_obj.adress += this.mb['connection'].toUpperCase();


 

this.register_bot( bot_class_mini_obj );

 

this.scanwaitingcounter = 0;
this.scan_status        = 1;

this.tmpid_cnt          = 0;
this.threadcounter      = 0;

} // start_scan()



//
//
//  
start_scan_lvl2( reset = 1)
{
this.scan_waiting_check      = {};
this.scan_targets_lvl2       = [];
this.scan_targets_lvl2_index = 0;
this.scanwaitingcounter_lvl2 = 0;
this.detected_inactive_bots  = [];

let size = this.bots.length;

for (let i=1; i<size; i++)
    {
    this.scan_targets_lvl2.push(this.bots[i].id);
    } // for

this.scan_status_lvl2 = 1;

this.notify_frontend_console("Start Scan Level 2");
} // start_scan_lvl2


//
// start_scan_radio()
//
start_scan_radio( reset = 1 )
{
const communication_mode = String(this.config.communication_mode ?? "mesh_opcode").trim();

if (communication_mode != "direct_radio")
   {
   this.scan_status_radio = 0;
   this.notify_frontend_console("Start Scan Radio blocked: communication_mode is not direct_radio");
   return;
   } // if

this.bots = [];
this.botindex = [];
this.scan_waiting_radio = {};
this.scan_radio_pending_ids = [];
this.scan_radio_requested_ids = {};
this.scan_radio_completed_ids = {};
this.scan_radio_parent_hint = {};
this.scan_radio_neighbors_by_bot = {};
this.scan_radio_mode = "full";
this.scan_radio_search_level = 1;
this.scan_radio_search_target_id = "";
this.scan_radio_seed_registered = false;
this.scanwaitingcounter_radio = 0;

const bot_class_mini_obj = new bot_class_mini();
bot_class_mini_obj.setvalues(
                            "masterbot",
                            this.get_direct_radio_master_rid(),
                            this.mb['x'],
                            this.mb['y'],
                            this.mb['z'],
                            this.mb['vx'],
                            this.mb['vy'],
                            this.mb['vz'],
                            "FF0000",
                            ""
                            );
bot_class_mini_obj.checked = 1;
this.register_bot(bot_class_mini_obj);

this.scan_radio_seed_id = String(this.mb['connection_id'] ?? "").trim();

if (this.scan_radio_seed_id == "")
   {
   this.scan_status_radio = 0;
   this.notify_frontend_console("Start Scan Radio aborted: mb_connection_id missing in config");
   return;
   } // if

this.scan_radio_pending_ids.push(this.scan_radio_seed_id);
this.scan_status_radio = 1;
this.notify_frontend_console("Start Scan Radio");
} // start_scan_radio()


//
// scan_radio_collect_known_neighbor_ids()
//
scan_radio_collect_known_neighbor_ids(bot_id)
{
let ret = [];
let snapshot = this.apicall_get_neighbors(bot_id);
const slot_names = ["F", "R", "B", "L", "T", "D"];

if (snapshot?.ok !== true)
   {
   return(ret);
   } // if

for (let i = 0; i < slot_names.length; i++)
    {
    const slot_name = slot_names[i];
    const entry = snapshot?.neighbors?.[slot_name] ?? null;
    const state = String(entry?.state ?? "").trim().toLowerCase();
    const neighbor_id = String(entry?.id ?? "").trim();

    if (state != "active" || neighbor_id == "")
       {
       continue;
       } // if

    if (ret.includes(neighbor_id))
       {
       continue;
       } // if

    ret.push(neighbor_id);
    } // for

return(ret);
} // scan_radio_collect_known_neighbor_ids()


//
// start_search_bot_radio()
//
start_search_bot_radio(bot_id, level = 1)
{
const communication_mode = String(this.config.communication_mode ?? "mesh_opcode").trim();
const normalized_bot_id = String(bot_id ?? "").trim();
let normalized_level = Number(level);

if (communication_mode != "direct_radio")
   {
   return({
          ok: false,
          answer: "api_search_bot",
          error: "SEARCH_BOT_DIRECT_RADIO_ONLY",
          communication_mode: communication_mode
          });
   } // if

if (normalized_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_search_bot",
          error: "BOT_ID_REQUIRED"
          });
   } // if

if (Number.isNaN(normalized_level) === true || normalized_level < 1)
   {
   normalized_level = 1;
   } // if

if (normalized_level > 2)
   {
   normalized_level = 2;
   } // if

if (this.get_direct_radio_rid_by_id(normalized_bot_id) == "")
   {
   return({
          ok: false,
          answer: "api_search_bot",
          error: "BOT_RID_UNKNOWN",
          bot_id: normalized_bot_id
          });
   } // if

this.scan_waiting_radio = {};
this.scan_radio_pending_ids = [];
this.scan_radio_requested_ids = {};
this.scan_radio_completed_ids = {};
this.scan_radio_parent_hint = {};
this.scan_radio_neighbors_by_bot = {};
this.scan_radio_seed_registered = true;
this.scan_radio_seed_id = normalized_bot_id;
this.scan_radio_mode = "search";
this.scan_radio_search_level = normalized_level;
this.scan_radio_search_target_id = normalized_bot_id;
this.scanwaitingcounter_radio = 0;

this.scan_radio_pending_ids.push(normalized_bot_id);

if (normalized_level >= 2)
   {
   let neighbor_ids = this.scan_radio_collect_known_neighbor_ids(normalized_bot_id);

   for (let i = 0; i < neighbor_ids.length; i++)
       {
       if (this.scan_radio_pending_ids.includes(neighbor_ids[i]))
          {
          continue;
          } // if

       this.scan_radio_pending_ids.push(neighbor_ids[i]);
       } // for

   if (this.scan_radio_pending_ids.includes(normalized_bot_id) !== true)
      {
      this.scan_radio_pending_ids.push(normalized_bot_id);
      } // if
   else
      {
      this.scan_radio_pending_ids.push(normalized_bot_id);
      } // else
   } // if

this.scan_status_radio = 1;
this.notify_frontend_console("Search Bot Radio: " + normalized_bot_id + " (level " + String(normalized_level) + ")");

return({
       ok: true,
       answer: "api_search_bot_started",
       accepted: true,
       bot_id: normalized_bot_id,
       level: normalized_level,
       queued_ids: this.scan_radio_pending_ids.slice()
       });
} // start_search_bot_radio()
  



//
// createAlgorithm()
// Called by prepare_morph()
//
createAlgorithm(algoName, startBots, targetBots, params) {

    switch (algoName) {
        //case "simple": return new MorphBFSSimple(startBots, targetBots, params);
        case "wavefront": return new MorphBFSWavefront(startBots, targetBots, params);
        case "vehicle_kinematics": return new MorphVehicleKinematics(startBots, targetBots, params);
        case "parallel_vehicle_kinematics": return new MorphVehicleKinematicsParallel(startBots, targetBots, params);
        default: throw new Error("Unknown algorithm: " + algoName);
    }
} // createAlgorithm


//
// load_structure_definition()
// Normalizes old array-based and new object-based structure JSON files.
//
load_structure_definition(structure)
{
const filepath = path.join(__dirname, 'structures', structure + '.json');
const data = fs.readFileSync(filepath, 'utf8');
const parsed = JSON.parse(data);

if (Array.isArray(parsed))
   {
   return {
          name: structure,
          meta: {},
          structure: parsed,
          carrier: [],
          reserve: [],
          x: [],
          forbidden: [],
          inactive: [],
          raw: parsed
          };
   }

return {
       name: parsed.meta?.name ?? structure,
       meta: parsed.meta ?? {},
       structure: Array.isArray(parsed.structure) ? parsed.structure : [],
       carrier: Array.isArray(parsed.carrier) ? parsed.carrier : [],
       reserve: Array.isArray(parsed.reserve) ? parsed.reserve : [],
       x: Array.isArray(parsed.x) ? parsed.x : [],
       forbidden: Array.isArray(parsed.forbidden) ? parsed.forbidden : [],
       inactive: Array.isArray(parsed.inactive) ? parsed.inactive : [],
       raw: parsed
       };
} // load_structure_definition()
  
 






//
// prepare_morph()
//
prepare_morph( structure, algo_selected )
{
this.apicall_update_morph_status(
                                 {
                                 running: true,
                                 phase: "preparing",
                                 progress: 0,
                                 structure: String(structure ?? "").trim() || null,
                                 algo: String(algo_selected ?? "").trim() || null,
                                 success: null,
                                 started_at: new Date().toISOString(),
                                 finished_at: null,
                                 message: "Prepare Morph"
                                 }
                                 );
        
// Set to global space
this.morphAlgorithmSelected = algo_selected;

let startBots = [];
let size      = this.bots.length;

for (let i=0; i<size; i++)
    {
    let bot = this.bots[i];
    // The bot object uses vector_x/vector_y/vector_z for orientation (from botexport.json).
    // Map them to vx/vy/vz for the morph planner.
    let { id, x, y, z, vector_x, vector_y, vector_z } = bot;
    let vx = vector_x;
    let vy = vector_y;
    let vz = vector_z;
    
       {
       startBots.push( { 
           id: id, 
           x: Number(x), y: Number(y), z: Number(z),
           vx: Number(vx ?? 0), vy: Number(vy ?? 0), vz: Number(vz ?? 0)
       } ) ;
       }
    }


const targetDefinition = this.load_structure_definition(structure);
const targetBots = targetDefinition.structure;

this.structure_roles = {
                       carrier: targetDefinition.carrier,
                       reserve: targetDefinition.reserve,
                       x: targetDefinition.x,
                       forbidden: targetDefinition.forbidden,
                       inactive: targetDefinition.inactive
                       };


 

let params = {};
let algo = null;

if ( this.morphAlgorithmSelected == "bfs_wavefront" ) 
   {
   console.log("Prepare bfs_wavefront...");
   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("wavefront", startBots, targetBots, params);

   } // "bfs_wavefront"
 
 

if ( this.morphAlgorithmSelected == "bfs_simple" ) 
   {
   console.log("Prepare bfs_simple...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 1, // Only one Bot per wave
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("wavefront", startBots, targetBots, params);

   } // "bfs_simple"
  
 

if ( this.morphAlgorithmSelected == "vehicle_kinematics" ) 
   {
   console.log("Prepare vehicle_kinematics...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("vehicle_kinematics", startBots, targetBots, params);

   } // "vehicle_kinematics"
   
if ( this.morphAlgorithmSelected == "parallel_vehicle_kinematics" ) 
   {
   console.log("Prepare parallel_vehicle_kinematics...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("parallel_vehicle_kinematics", startBots, targetBots, params);

   } // "parallel_vehicle_kinematics"
  
 
 




this.notify_frontend_console("Prepare Morph");

algo.run( this,  this.morph_finish_handler.bind(this) );




} // prepare_morph( structure )


//
// headless_prepare_morph()
// Like prepare_morph(), but:
// - Does NOT start sequence execution (no create_opcode_sequence, no run_sequence)
// - Calls callback(morphLog, success, outputPath) when done
// - If output_file is set, writes morphLog to that file (in logs/ dir)
// - If output_file is empty, only returns the result via callback
//
headless_prepare_morph( structure, algo_selected, output_file, callback )
{
this.apicall_update_morph_status(
                                 {
                                 running: true,
                                 phase: "preparing",
                                 progress: 0,
                                 structure: String(structure ?? "").trim() || null,
                                 algo: String(algo_selected ?? "").trim() || null,
                                 success: null,
                                 started_at: new Date().toISOString(),
                                 finished_at: null,
                                 message: "Headless Prepare Morph"
                                 }
                                 );

// Set to global space
this.morphAlgorithmSelected = algo_selected;

let startBots = [];
let size      = this.bots.length;

for (let i=0; i<size; i++)
    {
    let bot = this.bots[i];
    let { id, x, y, z, vector_x, vector_y, vector_z } = bot;
    let vx = vector_x;
    let vy = vector_y;
    let vz = vector_z;

       {
       startBots.push( {
           id: id,
           x: Number(x), y: Number(y), z: Number(z),
           vx: Number(vx ?? 0), vy: Number(vy ?? 0), vz: Number(vz ?? 0)
       } ) ;
       }
    }


const targetDefinition = this.load_structure_definition(structure);
const targetBots = targetDefinition.structure;

this.structure_roles = {
                       carrier: targetDefinition.carrier,
                       reserve: targetDefinition.reserve,
                       x: targetDefinition.x,
                       forbidden: targetDefinition.forbidden,
                       inactive: targetDefinition.inactive
                       };



 

let params = {};
let algo = null;

if ( this.morphAlgorithmSelected == "bfs_wavefront" )
   {
   console.log("Headless prepare bfs_wavefront...");
   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("wavefront", startBots, targetBots, params);

   } // "bfs_wavefront"
 


if ( this.morphAlgorithmSelected == "bfs_simple" )
   {
   console.log("Headless prepare bfs_simple...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 1,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("wavefront", startBots, targetBots, params);

   } // "bfs_simple"
  
 


if ( this.morphAlgorithmSelected == "vehicle_kinematics" )
   {
   console.log("Headless prepare vehicle_kinematics...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("vehicle_kinematics", startBots, targetBots, params);

   } // "vehicle_kinematics"

if ( this.morphAlgorithmSelected == "parallel_vehicle_kinematics" )
   {
   console.log("Headless prepare parallel_vehicle_kinematics...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("parallel_vehicle_kinematics", startBots, targetBots, params);

   } // "parallel_vehicle_kinematics"
  





this.notify_frontend_console("Headless Prepare Morph");

// Run algorithm with headless finish handler
algo.run( this,  function(morphLog, success) {
                    this.headless_morph_finish_handler(morphLog, success, output_file, callback);
                    }.bind(this) );



} // headless_prepare_morph( structure )


//
// Morph finish handler
//
morph_finish_handler( morphLog, success ) 
{
console.log("Morphing calculation complete!");
this.notify_frontend_console("Morphing calculation complete!");


if (success === false)
   {
   console.log("Morphing stuck! No more moves possible, but not all bots are happy!");
   this.notify_frontend_console("Morphing stuck! No more moves possible, but not all bots are happy!");
   this.apicall_update_morph_status(
                                    {
                                    running: false,
                                    phase: "stuck",
                                    success: false,
                                    finished_at: new Date().toISOString(),
                                    message: "Morphing stuck! No more moves possible, but not all bots are happy!"
                                    }
                                    );

   return;
   } else
     {
     console.log("Morphing calculation success!");
     this.notify_frontend_console("Morphing calculation success!");
     this.apicall_update_morph_status(
                                      {
                                      running: false,
                                      phase: "calculation_success",
                                      progress: 100,
                                      success: true,
                                      finished_at: new Date().toISOString(),
                                      message: "Morphing calculation success!"
                                      }
                                      );
     }
    
// console.log("morphLog returns:");
// console.log(JSON.stringify(morphLog, null, 2));
 
fs.writeFileSync("logs/morphresult.json", JSON.stringify(morphLog, null, 2));  

  
  
             let retstruct      = this.create_opcode_sequence( morphLog );
             let opcodes        = retstruct.opcodes;
             this.signal_botids = retstruct.signal_botids;
          
              
             // console.log("RETSTRUCT: ");
             // console.log( retstruct );
             // console.log(JSON.stringify(retstruct, null, 2));

// Write opcodes to file  
const filePath = path.join(__dirname, 'sequences', 'morph.sequence');
    
fs.writeFileSync(filePath, opcodes, 'utf8');


// Store morphLog for later use in onMorphSequenceFinished()
// (called when the FIN signal is received, i.e. all ACKs processed)
this.lastMorphLog = morphLog;


this.self_assembly_obj.run_sequence( "morph" );
  
 } // morph_finish_handler()


//
// headless_morph_finish_handler()
// Called by headless_prepare_morph() when the algorithm finishes.
// Does NOT start sequence execution - only writes morphLog to file (if requested)
// and calls the callback.
//
headless_morph_finish_handler( morphLog, success, output_file, callback )
{
console.log("Headless morphing calculation complete!");
this.notify_frontend_console("Headless morphing calculation complete!");

let outputPath = null;

if (success === false)
   {
   console.log("Headless morphing stuck! No more moves possible, but not all bots are happy!");
   this.notify_frontend_console("Headless morphing stuck! No more moves possible, but not all bots are happy!");
   this.apicall_update_morph_status(
                                    {
                                    running: false,
                                    phase: "stuck",
                                    success: false,
                                    finished_at: new Date().toISOString(),
                                    message: "Headless morphing stuck! No more moves possible, but not all bots are happy!"
                                    }
                                    );

   // Still write the morphLog if output_file is set (partial result)
   if (output_file && output_file != "" && morphLog)
      {
      outputPath = path.join(__dirname, 'logs', output_file);
      fs.writeFileSync(outputPath, JSON.stringify(morphLog, null, 2));
      console.log("Headless morphLog (stuck) written to: " + outputPath);
      }

   if (typeof callback === "function")
      {
      callback(morphLog, false, outputPath);
      }

   return;
   } // if (success === false)

console.log("Headless morphing calculation success!");
this.notify_frontend_console("Headless morphing calculation success!");
this.apicall_update_morph_status(
                                 {
                                 running: false,
                                 phase: "calculation_success",
                                 progress: 100,
                                 success: true,
                                 finished_at: new Date().toISOString(),
                                 message: "Headless morphing calculation success!"
                                 }
                                 );

// Write morphLog to file if output_file is specified
if (output_file && output_file != "")
   {
   outputPath = path.join(__dirname, 'logs', output_file);
   fs.writeFileSync(outputPath, JSON.stringify(morphLog, null, 2));
   console.log("Headless morphLog written to: " + outputPath);
   }

// Call the callback with the result
if (typeof callback === "function")
   {
   callback(morphLog, true, outputPath);
   }
} // headless_morph_finish_handler()


//
// onMorphSequenceFinished()
// Called by self_assembly.addsignal() when the FIN signal is received,
// meaning all ACKs have been processed and the morph sequence is complete.
// Updates this.bots with final positions and orientations from the morphLog.
//
onMorphSequenceFinished()
{
console.log("onMorphSequenceFinished: updating bot positions/orientations from morphLog");
this.notify_frontend_console("Morph sequence finished - persisting final positions/orientations");

if (!this.lastMorphLog || !this.lastMorphLog.waves)
   {
   console.log("onMorphSequenceFinished: no morphLog data found, skipping");
   return;
   }

let updatedCount = 0;

for (let wave of this.lastMorphLog.waves)
   {
   for (let move of wave.moves)
      {
      let botindex = move.botindex;
      if (botindex === undefined || botindex === null) continue;
      if (!this.bots[botindex]) continue;

      // Update position from move.to
      if (move.to)
         {
         this.bots[botindex].x = move.to.x;
         this.bots[botindex].y = move.to.y;
         this.bots[botindex].z = move.to.z;

         // Update orientation (vector_x/y/z) from move.to.vx/vy/vz
         if (move.to.vx !== undefined)
            {
            this.bots[botindex].vector_x = move.to.vx;
            this.bots[botindex].vector_y = move.to.vy;
            this.bots[botindex].vector_z = move.to.vz;
            }
         }

      updatedCount++;
      }
   }

console.log("onMorphSequenceFinished: updated " + updatedCount + " bots");
this.notify_frontend_console("Morph sequence finished - updated " + updatedCount + " bots");

// Clean up
this.lastMorphLog = null;
} // onMorphSequenceFinished()




//
// create_opcode_sequence()
//
create_opcode_sequence( morphLog )
{
Logger.log("[DEBUG create_opcode_sequence] FUNKTION AUFGERUFEN - morphLog vorhanden: " + (morphLog ? "ja" : "nein") + " waves: " + (morphLog?.waves?.length ?? 0));
let locallog = false;
let signal_botids = {};

if (locallog) console.log( "create_opcode_sequence..." );
let ret = "";

 

let bots_tmp = this.bots.map(b => ({
  id: b.id,
  x: b.x,
  y: b.y,
  z: b.z,
  vector_x: b.vector_x,
  vector_y: b.vector_y,
  vector_z: b.vector_z,
  adress: b.adress
}));
  
let size = morphLog.waves.length;
if (locallog) console.log("size: " + size);


let signalbuffer = "";
let signalindex = 1;

for (let i=0; i<size; i++)
    {    
    let size2 = morphLog.waves[i].moves.length;
    
    if (locallog) console.log("size2: " + size2); 
    
  
    // create blockedBots
    let blockedBots = morphLog.waves[i].moves.map(mv => mv.from);

    // Also add the current positions of wave bots to blockedBots so the BFS
    // does not route RALIFE through a bot that is about to move. Unlike FROM
    // positions (which are the start positions before this wave), this catches
    // bots that were already moved in a previous wave and now sit elsewhere.
    const waveBotIdsAddr = new Set(morphLog.waves[i].moves.map(mv => String(mv.id ?? "")));
    for (const b of bots_tmp) {
        if (waveBotIdsAddr.has(String(b.id ?? ""))) {
            blockedBots.push({ x: b.x, y: b.y, z: b.z });
        }
    }

    ret += "block "+signalbuffer+"\n";
    ret += "{\n";
    
    
    signalbuffer = "";
    
    for (let i2=0; i2<size2; i2++)
        {
        
        if (locallog) console.log(morphLog.waves[i].moves[i2]);
        let thebotid = morphLog.waves[i].moves[i2].id;
       
        
     
        
      
        let thex = morphLog.waves[i].moves[i2].from.x;
        let they = morphLog.waves[i].moves[i2].from.y;
        let thez = morphLog.waves[i].moves[i2].from.z;
        let thekey = this.getKey_3d(thex, they, thez);
        let bindex = this.botindex[thekey];
    
        if (locallog) console.log("thebotid: ");
        if (locallog) console.log(bindex);
        if (locallog) console.log(thebotid);
        
        let neighbours1 = this.get_valid_neighbours( {x:bots_tmp[bindex].x, y:bots_tmp[bindex].y, z:bots_tmp[bindex].z },{x:0, y:0, z:0 }, bots_tmp );
 
 
        
       
        
        if (locallog) console.log("thebotid: " + thebotid + " " + bindex + " vxyz: " + bots_tmp[bindex].vector_x + " " +   bots_tmp[bindex].vector_y + " " +  bots_tmp[bindex].vector_z + " " ); 
        
        let size3 = morphLog.waves[i].moves[i2].fullPath.length;
        if (locallog) console.log( " thebotid:" + thebotid + " size3:"+size3 + " Adress: " + bots_tmp[bindex].adress );
    
        // Get Bot coordinate...
        let bot_from = morphLog.waves[i].moves[i2].from;
        let bot_to   = morphLog.waves[i].moves[i2].to;
        
        if (locallog) 
        {
        console.log("bot_from: ");
        console.log(bot_from);
        console.log("bot_to: ");
        console.log(bot_to);
        }
        
        
 
       

       
        // Adress-Update (all bots!)
        for (let b = 0; b < bots_tmp.length; b++)
            {

            // Don't block masterbot and current target-bot
            const cleanedBlockedBots = blockedBots.filter(b2 =>
             !(b2.x === this.mb.x && b2.y === this.mb.y && b2.z === this.mb.z) &&
             !(b2.x === bots_tmp[b].x && b2.y === bots_tmp[b].y && b2.z === bots_tmp[b].z)
            );
            bots_tmp[b].adress = this.get_mb_returnaddr(
             {x: this.mb.x, y: this.mb.y, z: this.mb.z},
             {x: bots_tmp[b].x, y: bots_tmp[b].y, z: bots_tmp[b].z},
             bots_tmp, cleanedBlockedBots
            );

           if (bots_tmp[b].adress  == "" )
            {
            if (locallog)  console.log("empty adress!!!! ---- Bot:", bots_tmp[b].id, "Pos:", bots_tmp[b].x, bots_tmp[b].y, bots_tmp[b].z);
            }


            }      // for b...   
      
          
         
         
       
         
  
    
        let signal = "";
        // mobility_mode must be declared before it's used for signal_botids orientation storage
        let mobility_mode = String(this?.config?.mobility_mode ?? "full_edge").trim().toLowerCase();
        if (i < (size-1) )
           {
           signal += "sig" + (signalindex);
           
           // In vehicle_kinematics mode, also store goal orientation (vx/vy/vz) in signal_botids
           // so that handle_answer() can update the bot's orientation when the ACK arrives.
           let signal_to = {x:bot_to.x, y:bot_to.y, z:bot_to.z};
           if (mobility_mode == "vehicle_kinematics" && bot_to.vx !== undefined)
              {
              signal_to.vx = Number(bot_to.vx);
              signal_to.vy = Number(bot_to.vy);
              signal_to.vz = Number(bot_to.vz);
               Logger.log("[DEBUG create_opcode_sequence] signal=" + signal + " thebotid=" + thebotid + " bot_to.vx=" + bot_to.vx + " bot_to.vy=" + bot_to.vy + " bot_to.vz=" + bot_to.vz + " mobility_mode=" + mobility_mode);
               } else
                 {
                 Logger.log("[DEBUG create_opcode_sequence] signal=" + signal + " thebotid=" + thebotid + " KEINE Orientierung gespeichert - bot_to.vx=" + bot_to.vx + " mobility_mode=" + mobility_mode);
                }
           signal_botids[signal] = { thebotid:thebotid, to:signal_to };
           signalindex++;
           
           signalbuffer += signal + " ";
           } else
             {
             signal = "FIN";
             let signal_to_fin = {x:bot_to.x, y:bot_to.y, z:bot_to.z};
             if (mobility_mode == "vehicle_kinematics" && bot_to.vx !== undefined)
                {
                signal_to_fin.vx = Number(bot_to.vx);
                signal_to_fin.vy = Number(bot_to.vy);
                signal_to_fin.vz = Number(bot_to.vz);
                Logger.log("[DEBUG create_opcode_sequence] signal=FIN thebotid=" + thebotid + " bot_to.vx=" + bot_to.vx + " bot_to.vy=" + bot_to.vy + " bot_to.vz=" + bot_to.vz + " mobility_mode=" + mobility_mode);
                } else
                  {
                  Logger.log("[DEBUG create_opcode_sequence] signal=FIN thebotid=" + thebotid + " KEINE Orientierung gespeichert - bot_to.vx=" + bot_to.vx + " mobility_mode=" + mobility_mode);
                  }
             signal_botids[signal] = { thebotid:thebotid, to:signal_to_fin };
             }
    
    
    
        let cmd = "";
    
    
        cmd += bots_tmp[bindex].adress + "#MOVE#";


        let fullPath = morphLog.waves[i].moves[i2].fullPath;

        
        // mobility_mode switch: use calc_move_vk_cmds() for vehicle_kinematics (rotation-aware),
        // otherwise fall back to calc_move_cmds() (legacy full_edge mode).
        let result = null;
        
        if (mobility_mode == "vehicle_kinematics" && typeof this.calc_move_vk_cmds == "function")
           {
           // Extract goal_orientation from morphLog's "to" field (contains vx/vy/vz)
           let goal_orientation = {
                                   x: Number(bot_to.vx ?? 0),
                                   y: Number(bot_to.vy ?? 0),
                                   z: Number(bot_to.vz ?? 0)
                                   };
           result = this.calc_move_vk_cmds(
                                           fullPath,
                                           bots_tmp[bindex].vector_x,
                                           bots_tmp[bindex].vector_y,
                                           bots_tmp[bindex].vector_z,
                                           bots_tmp,
                                           goal_orientation
                                           );
           } else
             {
             result = this.calc_move_cmds(fullPath, bots_tmp[bindex].vector_x, bots_tmp[bindex].vector_y, bots_tmp[bindex].vector_z ,bots_tmp);
             }
        
        let movecmds = result.movecmds;
            
           
        if (locallog) console.log("movecmds: ["+movecmds+"]");


 
 
        
    
      
      
        // UPDATE bots_tmp: verschiebe den aktuellen Bot auf die neue Position
        bots_tmp[bindex].x = bot_to.x;
        bots_tmp[bindex].y = bot_to.y;
        bots_tmp[bindex].z = bot_to.z;

        // In vehicle_kinematics mode, also update the orientation (vector_x/y/z)
        // because calc_move_vk_cmds() may have generated SPINs that change orientation.
        // The new orientation comes from the morphLog's "to" field (vx/vy/vz).
        if (mobility_mode == "vehicle_kinematics")
           {
           bots_tmp[bindex].vector_x = Number(bot_to.vx ?? bots_tmp[bindex].vector_x ?? 0);
           bots_tmp[bindex].vector_y = Number(bot_to.vy ?? bots_tmp[bindex].vector_y ?? 0);
           bots_tmp[bindex].vector_z = Number(bot_to.vz ?? bots_tmp[bindex].vector_z ?? 0);
           }
        
        
        // Get returnaddress
        let retaddr = "[retaddr]";
        
           
        if (locallog) console.log("result.lastneighbour:");
        if (locallog) console.log(JSON.stringify( result.lastneighbour , null, 2));
        
        
        retaddr = this.get_mb_returnaddr({x:bot_to.x, y:bot_to.y, z:bot_to.z }, {x:this.mb.x, y:this.mb.y, z:this.mb.z }, bots_tmp, blockedBots );
        

        if (locallog) console.log("new retaddr: [" + retaddr + "]");
        
       
        
      
        cmd += movecmds + ";ALIFE;" + signal + "#" + retaddr; 
                       
    
        cmd += "\n";        
    
        ret += cmd;
        
        
        } // for i2...
    
    
    ret += "}\n"; // block...

  
    ret += "\n";     
    } // for i...
    
    
 



if (locallog) 
{
console.log("ret:");
console.log("-----");
console.log(ret);
console.log("-----");

 
console.log("FIN reate_opcode_sequence()");
}


 
let retstruct = { opcodes:ret, signal_botids:signal_botids };
return (retstruct);
} // create_opcode_sequence()




 

//
// Get return adress with blocketBots
//
get_mb_returnaddr(pos_from, pos_to, bots_tmp, blockedBots=[], options={}) {
    let normalized_from = {
                           x: Number(pos_from?.x),
                           y: Number(pos_from?.y),
                           z: Number(pos_from?.z)
                           };
    let normalized_to = {
                         x: Number(pos_to?.x),
                         y: Number(pos_to?.y),
                         z: Number(pos_to?.z)
                         };
    let queue = [{pos: normalized_from, path: ""}];
    let visited = new Set();
    let routing_mode = String(options?.routing_mode ?? "standard").trim().toLowerCase();

     
    // Set for quick block check
    const blockedSet = new Set(
      blockedBots.map(b => `${b.x},${b.y},${b.z}`)
    );

    let steps = 0;

    while (queue.length > 0) {
        let current = queue.shift();
        let key = `${current.pos.x},${current.pos.y},${current.pos.z}`;
        steps++;

        if (visited.has(key)) continue;
        visited.add(key);

        if (
            Number(current.pos.x) === Number(normalized_to.x) &&
            Number(current.pos.y) === Number(normalized_to.y) &&
            Number(current.pos.z) === Number(normalized_to.z)
        ) {
            return current.path;
        }

        let from_bot = bots_tmp.find(b =>
            Number(b.x) === Number(current.pos.x) &&
            Number(b.y) === Number(current.pos.y) &&
            Number(b.z) === Number(current.pos.z)
        );
        if (!from_bot) continue;

        let candidate_neighbours = [];

        // iterarte all neighbours
        for (let bot of bots_tmp) {
            // -----> New: skip blocked-bots!
            if (blockedSet.has(`${bot.x},${bot.y},${bot.z}`)) continue;

            // skip self coordinate
            if (
                bot.x === current.pos.x &&
                bot.y === current.pos.y &&
                bot.z === current.pos.z
            ) continue;

            let dx = Math.abs(bot.x - current.pos.x);
            let dy = Math.abs(bot.y - current.pos.y);
            let dz = Math.abs(bot.z - current.pos.z);
            if (dx + dy + dz !== 1) continue; // only orthogonal neighbours

            let dx2 = bot.x - from_bot.x;
            let dy2 = bot.y - from_bot.y;
            let dz2 = bot.z - from_bot.z;
            let vx = from_bot.vector_x;
            let vy = from_bot.vector_y;
            let vz = from_bot.vector_z;
            let port = this.get_cell_slot_byvector(dx2, dy2, dz2, vx, vy, vz);

            if (!port) continue;

            candidate_neighbours.push({
                                       bot: bot,
                                       port: port,
                                       distance_to_target: (
                                                           Math.abs(Number(bot.x) - Number(normalized_to.x)) +
                                                           Math.abs(Number(bot.y) - Number(normalized_to.y)) +
                                                           Math.abs(Number(bot.z) - Number(normalized_to.z))
                                                           )
                                       });
        } // for

        if (routing_mode == "minimal")
           {
           const slot_priority = {
                                 F: 0,
                                 L: 1,
                                 R: 2,
                                 B: 3,
                                 T: 4,
                                 D: 5
                                 };

           candidate_neighbours.sort((a, b) => {
               if (a.distance_to_target !== b.distance_to_target)
                  {
                  return a.distance_to_target - b.distance_to_target;
                  } // if

               let pa = slot_priority[a.port] ?? 99;
               let pb = slot_priority[b.port] ?? 99;

               if (pa !== pb)
                  {
                  return pa - pb;
                  } // if

               return String(a.port).localeCompare(String(b.port));
           }); // sort
           } // if

        for (let i = 0; i < candidate_neighbours.length; i++)
            {
            let candidate = candidate_neighbours[i];
            let newpath = current.path + candidate.port;

            queue.push({
                pos: {
                      x: candidate.bot.x,
                      y: candidate.bot.y,
                      z: candidate.bot.z,
                      vector_x: candidate.bot.vector_x,
                      vector_y: candidate.bot.vector_y,
                      vector_z: candidate.bot.vector_z
                      },
                path: newpath
            });
            } // for
        } // while
    // not path found
    return ""; //  
} // get_mb_returnaddr()


 

printPathCoords(start, path) {
    let x = parseInt(start.x), y = parseInt(start.y), z = parseInt(start.z);
    console.log(`Start: (${x},${y},${z})`);
    for (let i = 0; i < path.length; i++) {
        let step = path[i];
        if (step === 'F') x++;
        if (step === 'B') x--;
        if (step === 'T') y++;      
        if (step === 'D') y--;     
        if (step === 'R') z++;
        if (step === 'L') z--;
        console.log(`Schritt ${i+1} (${step}): (${x},${y},${z})`);
    }
} // printPathCoords()


 

//
// get_valid_neighbours() ... of a coordinate
//
get_valid_neighbours(pos, excludePos, botsInput) 
{
let neighbours = [];

const bots_tmp = Array.isArray(botsInput) ? botsInput : Object.values(botsInput);

 

  // 6 possible directions
  const directions = [
    {dx:  1, dy: 0, dz: 0},
    {dx: -1, dy: 0, dz: 0},
    {dx:  0, dy: 1, dz: 0},
    {dx:  0, dy: -1, dz: 0},
    {dx:  0, dy: 0, dz: 1},
    {dx:  0, dy: 0, dz: -1}
  ];

  function isSamePos(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

 

  for (let dir of directions) 
      {
      let np = { x: pos.x + dir.dx, y: pos.y + dir.dy, z: pos.z + dir.dz };

      // Exclude the given position
      if (excludePos && isSamePos(np, excludePos)) continue;

 


      // search bot on neighbour-position (options: faster with indexobject)
      let bot = bots_tmp.find(b => isSamePos(b, np));
      if (bot) {
               neighbours.push(bot);
               }
      } // for
  
  return neighbours;
} // get_valid_neighbours()



 

//
// calc_move_cmd()
//
calc_move_cmds(fullPath, vx, vy, vz, bots, goal_orientation = null)
{
let movecmds = "";

         

const moveMap = {
  "E,1,0,0": "F",
  "E,0,-1,0": "D",
  "E,-1,0,0": "B",
  "E,0,1,0": "T",
  "E,0,0,-1": "R",
  "E,0,0,1": "L",

  "S,1,0,0": "L",
  "S,0,-1,0": "D",
  "S,-1,0,0": "R",
  "S,0,1,0": "T",
  "S,0,0,-1": "F",
  "S,0,0,1": "B",

  "W,1,0,0": "B",
  "W,0,-1,0": "D",
  "W,-1,0,0": "F",
  "W,0,1,0": "T",
  "W,0,0,-1": "L",
  "W,0,0,1": "R",
  
  "N,1,0,0": "R",
  "N,0,-1,0": "D",
  "N,-1,0,0": "L",
  "N,0,1,0": "T",
  "N,0,0,-1": "B",
  "N,0,0,1": "F"
     
};


let orientation = "";

if (vx ==  1 && vy ==  0 && vz ==  0) orientation = "E";
if (vx ==  0 && vy ==  0 && vz == -1) orientation = "S";
if (vx == -1 && vy ==  0 && vz ==  0) orientation = "W";
if (vx ==  0 && vy ==  0 && vz ==  1) orientation = "N";


// Create raw moves
let rawMoves = "";

let bot_x = fullPath[0].x;
let bot_y = fullPath[0].y;
let bot_z = fullPath[0].z;


let size = fullPath.length;

for (let i=0; i<size-1; i++)
    {
    
        
    
    let diffx = fullPath[i+1].x - fullPath[i].x;
    let diffy = fullPath[i+1].y - fullPath[i].y;
    let diffz = fullPath[i+1].z - fullPath[i].z;
    

    let moveMapIndex = orientation + "," + diffx + "," + diffy + "," + diffz ;

    let result = moveMap[ moveMapIndex ] ;
    
    if (!result) {
    console.warn('WARN: no mapping for:', moveMapIndex, '(orientation:', orientation, ')');  
    }
    
    rawMoves += moveMap[ moveMapIndex ];

    } // for i..size



    
    
size = rawMoves.length;


let lastneighbour = {};
let final_lastanchor = "";
let final_lastanchorneighbour = null;
//    
// Iterate all SubMoves, e.g. 'F' or 'FT'...    
//
for (let i=0; i<size; i++)
    {
    
    //
    // Get first anchor slot
    //

    let neighbours = this.get_valid_neighbours( {x:bot_x, y:bot_y, z:bot_z },{x:this.mb.x, y:this.mb.y, z:this.mb.z }, bots );


    let tx = neighbours[0].x - bot_x;
    let ty = neighbours[0].y - bot_y;
    let tz = neighbours[0].z - bot_z;
    
    lastneighbour = {x:neighbours[0].x, y:neighbours[0].y, z:neighbours[0].z };
    
     
    let move = this.get_cell_slot_byvector(tx,ty,tz, vx,vy,vz);
    

    movecmds += move + "_";
     
     
    
    let MoveSubCmd = rawMoves[i];
    let check = "";
    let lastanchor = "";
    let teststruct = null;
    
    
    // check if last valid connection slot 
    teststruct   = this.test_virtual_botmove( {x:bot_x, y:bot_y, z:bot_z } , MoveSubCmd ,  bots);
    check        = teststruct.check;
    lastanchor   = teststruct.lastanchor;
 
    
    
    // must check again with next movecmds
    if (check === false)
       {
       
       i++;
       MoveSubCmd += rawMoves[i];
    
       // check ist last valid connection slot          
       teststruct   = this.test_virtual_botmove( {x:bot_x, y:bot_y, z:bot_z } , MoveSubCmd ,  bots);
       check        = teststruct.check;
       lastanchor   = teststruct.lastanchor;
       
        
       //console.log("second i: "+i + " : MoveSubCmd:" + MoveSubCmd + " check: [" + check +"]" );
        
       } // if check === false
    
    //   
    // Here Path should be valid
    //
    if (check === false)
       {  
       
       console.log('\x1b[1m\x1b[31m%s\x1b[0m', 'No valid move found!');
       //process.exit(1);
       } else
         {
         // check if last valid connection slot
         movecmds += MoveSubCmd + "_" + lastanchor ;
         final_lastanchor = lastanchor;
         final_lastanchorneighbour = teststruct.lastanchorneighbour;
         
         
         if (i < (size-1) ) 
            {
            movecmds += ";";
                        
            } else
              {
              
              //console.log( "teststruct.lastanchorneighbour :" + JSON.stringify(teststruct.lastanchorneighbour, null, 2)  );
              //console.log( "last anchor: " + lastanchor );
              
              }
         
         //
         // Set tmpbot virtual to new target coordinate
         //
         let botindex = this.get_botindex_by_xyz(  {x:bot_x, y:bot_y, z:bot_z }, bots  );
         
         if ( botindex != null )
            {

            bots[botindex].x = teststruct.lastpos.x;
            bots[botindex].y = teststruct.lastpos.y;
            bots[botindex].z = teststruct.lastpos.z;
            
            bot_x            = teststruct.lastpos.x;
            bot_y            = teststruct.lastpos.y;
            bot_z            = teststruct.lastpos.z;

            } else
              {
              console.warn("botindex is null");
              }
         

         } // else
       
    
    
    
    } // for i..size        
    
    
 

let ret = {
           movecmds: movecmds,
           lastneighbour: lastneighbour,
           final_lastanchor: final_lastanchor,
           final_lastanchorneighbour: final_lastanchorneighbour
           };

let calc_move_cmds_return_path = path.join(__dirname, "logs", "calc_move_cmds_return.json");
if (this.debug_vk_exports === true)
   {
   fs.writeFileSync(calc_move_cmds_return_path, JSON.stringify(ret, null, 2), "utf8");
   Logger.log("calc_move_cmds return dumped: " + calc_move_cmds_return_path);
   } // if (this.debug_vk_exports === true)

// console.log("ret: calc_move_cmds");
// console.log( ret );

return(ret);
} // calc_move_cmds



//
// calc_move_vk_cmds()
// Vehicle-kinematics entry point for the MOVE translation chain.
// For now this mirrors calc_move_cmds() so we can switch call sites
// cleanly and extend the rotation-aware logic later in one place.
//
calc_move_vk_cmds(fullPath, vx, vy, vz, bots, goal_orientation = null)
{
const self = this;

let stage_dump_path = path.join(__dirname, "logs", "calc_move_vk_stages.json");
let stage_dump = {
                 timestamp: new Date().toISOString(),
                 start_orientation: {
                                     x: Number(vx),
                                     y: Number(vy),
                                     z: Number(vz)
                                     },
                 goal_orientation: goal_orientation ?? null,
                 path_length: Array.isArray(fullPath) ? fullPath.length : 0,
                 bots_count: Array.isArray(bots) ? bots.length : 0,
                 stages: Array.isArray(fullPath) ? fullPath : []
                 };

if (self.debug_vk_exports === true)
   {
   Logger.log("calc_move_vk_cmds called: path_length=" + stage_dump.path_length + " goal_orientation=" + JSON.stringify(stage_dump.goal_orientation) + " dump_path=" + stage_dump_path);
   }
vk_debug_write(stage_dump_path, JSON.stringify(stage_dump, null, 2), "utf8");

//return(this.calc_move_cmds(fullPath, vx, vy, vz, bots, goal_orientation));

// ---

let movecmds = "";

// =====================================================================
// NEUE OPCODE-TABELLE (09.05.2026) - in calc_move_hybrid_cmds() definiert
// =====================================================================

let lastneighbour= null;
let final_lastanchor= null;
let final_lastanchorneighbour = null;

let vk_movesubcmds = [];
let vk_bots = Array.isArray(bots) ? bots.map(bot => Object.assign({}, bot)) : [];
let vk_moving_bot_index = null;
let pending_vk_macro_step = null;

function vk_debug_write(file_path, content, encoding = "utf8")
{
if (self.debug_vk_exports !== true)
   {
   return;
   }

fs.writeFileSync(file_path, content, encoding);
} // vk_debug_write()

function get_vk_anchor(stage, exclude_slots)
{
let exclude_set = new Set();

if (Array.isArray(exclude_slots))
   {
   for (let i=0; i<exclude_slots.length; i++)
       {
       exclude_set.add(String(exclude_slots[i]).toUpperCase());
       }
   }

let result = {
             slot: "D",
             neighbour: {
                        x: stage.x,
                        y: stage.y - 1,
                        z: stage.z
                        },
             fallback: true
             };

let neighbours = self.get_valid_neighbours(
                                           {x:stage.x, y:stage.y, z:stage.z},
                                           {x:self.mb.x, y:self.mb.y, z:self.mb.z},
                                           vk_bots
                                           );

if (Array.isArray(neighbours) && neighbours.length > 0)
   {
   // Try to find a neighbour whose slot is NOT in exclude_set
   let best_neighbour = null;
   let best_slot = "";

   for (let n=0; n<neighbours.length; n++)
       {
       let tx = neighbours[n].x - stage.x;
       let ty = neighbours[n].y - stage.y;
       let tz = neighbours[n].z - stage.z;
       let slot = self.get_cell_slot_byvector(tx, ty, tz, stage.vx, stage.vy, stage.vz);

       if (exclude_set.has(slot))
          {
          continue;
          }

       best_neighbour = neighbours[n];
       best_slot = slot;
       break;
       }

   // If all neighbours are excluded, fall back to the first one
   if (best_neighbour == null && neighbours.length > 0)
      {
      best_neighbour = neighbours[0];
      let tx = neighbours[0].x - stage.x;
      let ty = neighbours[0].y - stage.y;
      let tz = neighbours[0].z - stage.z;
      best_slot = self.get_cell_slot_byvector(tx, ty, tz, stage.vx, stage.vy, stage.vz);
      }

   if (best_neighbour != null)
      {
      result = {
               slot: best_slot,
               neighbour: {
                          x: best_neighbour.x,
                          y: best_neighbour.y,
                          z: best_neighbour.z
                          },
               fallback: false
               };
      }
   } // if (Array.isArray(neighbours) && neighbours.length > 0)

return(result);
} // get_vk_anchor()

function get_vk_policy_anchor(stage, slot)
{
let rel = self.get_cell_relation_vector_byslot(slot, stage.vx, stage.vy, stage.vz);

return({
       slot: slot,
       neighbour: {
                  x: stage.x + Number(rel.x ?? 0),
                  y: stage.y + Number(rel.y ?? 0),
                  z: stage.z + Number(rel.z ?? 0)
                  },
       fallback: false
       });
} // get_vk_policy_anchor()

function resolve_vk_anchor_safe(stage, preferred_slot, bots, exclude_slots)
{
let policy_anchor = get_vk_policy_anchor(stage, preferred_slot);
let bot_index = self.get_botindex_by_xyz(policy_anchor.neighbour, bots);

if (bot_index != null)
   {
   return(policy_anchor);
   }

Logger.log("resolve_vk_anchor_safe: preferred_slot=" + preferred_slot + " at (" + policy_anchor.neighbour.x + "," + policy_anchor.neighbour.y + "," + policy_anchor.neighbour.z + ") NOT FOUND – falling back to get_vk_anchor()");
return(get_vk_anchor(stage, exclude_slots));
} // resolve_vk_anchor_safe()

function get_vk_anchor_policy(step)
{
let policy = {
             start_slot: "D",
             stop_slot: "D",
             reason: "horizontal_or_rotation"
             };

if (step != null && step.merged === true)
   {
   if (step.merge_type == "step_up")
      {
      policy = {
               start_slot: "F",
               stop_slot: "D",
               reason: "merged_step_up_transition"
               };
      } else if (step.merge_type == "step_down")
        {
        policy = {
                 start_slot: "D",
                 stop_slot: "F",
                 reason: "merged_step_down_transition"
                 };
        } else
          {
          policy = {
                   start_slot: "F",
                   stop_slot: "D",
                   reason: "merged_step_transition"
                   };
          }
   } else if (step != null && (step.direction === "up" || step.direction === "down"))
     {
     policy = {
              start_slot: "F",
              stop_slot: "F",
              reason: "wall_vertical_move"
              };
     }

return(policy);
} // get_vk_anchor_policy()

function get_vk_step_primitive(from_stage, to_stage)
{
let dx = to_stage.x - from_stage.x;
let dy = to_stage.y - from_stage.y;
let dz = to_stage.z - from_stage.z;

if (dx == 0 && dy == 1 && dz == 0)
   {
   return("T");
   }

if (dx == 0 && dy == -1 && dz == 0)
   {
   return("D");
   }

if (dy == 0 && dx == from_stage.vx && dz == from_stage.vz)
   {
   return("F");
   }

if (dy == 0 && dx == -from_stage.vx && dz == -from_stage.vz)
   {
   return("B");
   }

return("");
} // get_vk_step_primitive()

function get_vk_step_merge_info(current, next, next2)
{
let result = {
             merged: false,
             merge_type: "",
             merged_primitive: "",
             first_primitive: "",
             second_primitive: "",
             merge_detail: ""
             };

if (current == null || next == null || next2 == null)
   {
   return(result);
   }

if (current.vx != next.vx || current.vy != next.vy || current.vz != next.vz)
   {
   return(result);
   }

if (next.vx != next2.vx || next.vy != next2.vy || next.vz != next2.vz)
   {
   return(result);
   }

let first_primitive = get_vk_step_primitive(current, next);
let second_primitive = get_vk_step_primitive(next, next2);

if (first_primitive == "" || second_primitive == "")
   {
   return(result);
   }

let first_is_vertical = (first_primitive == "T" || first_primitive == "D");
let first_is_horizontal = (first_primitive == "F" || first_primitive == "B");
let second_is_vertical = (second_primitive == "T" || second_primitive == "D");
let second_is_horizontal = (second_primitive == "F" || second_primitive == "B");

if (first_is_vertical && second_is_horizontal)
   {
   if (first_primitive == "T")
      {
      result.merged = true;
      result.merge_type = "step_up";
      result.merged_primitive = first_primitive + second_primitive;
      result.first_primitive = first_primitive;
      result.second_primitive = second_primitive;
      result.merge_detail = "vertical_then_horizontal";
      return(result);
      } // if (first_primitive == "T")
   }

if (first_is_horizontal && second_is_vertical)
   {
   if (second_primitive == "D")
      {
      result.merged = true;
      result.merge_type = "step_down";
      result.merged_primitive = first_primitive + second_primitive;
      result.first_primitive = first_primitive;
      result.second_primitive = second_primitive;
      result.merge_detail = "horizontal_then_vertical";
      return(result);
      } // if (second_primitive == "D")
   }

return(result);
} // get_vk_step_merge_info()

function get_vk_merged_movesubcmd(merge_type, merged_primitive)
{
if (merge_type == "step_up")
   {
   return("F_" + String(merged_primitive ?? "") + "_D");
   }

if (merge_type == "step_down")
   {
   return("D_" + String(merged_primitive ?? "") + "_F");
   }

return(String(merged_primitive ?? ""));
} // get_vk_merged_movesubcmd()

function build_vk_macro_steps(raw_path)
{
let macro_steps = [];
let merge_trace = [];

if (!Array.isArray(raw_path) || raw_path.length == 0)
   {
   return(macro_steps);
   } // if

    for (let i=0; i<raw_path.length-1; i++)
    {
    let current = raw_path[i];
    let next = raw_path[i+1];
    let anchor_start_info = get_vk_anchor(current);
    let anchor_stop_info = get_vk_anchor(next);
    let merged_move = null;

    if (i + 2 < raw_path.length)
       {
       merged_move = get_vk_step_merge_info(current, next, raw_path[i+2]);
       } // if

    if (merged_move != null && merged_move.merged === true)
       {
       let merge_next = raw_path[i+2];

       merge_trace.push({
                        raw_index: i,
                        raw_span: 2,
                        merged: true,
                        merge_type: merged_move.merge_type,
                        merge_detail: merged_move.merge_detail,
                        merged_primitive: merged_move.merged_primitive,
                        first_primitive: merged_move.first_primitive,
                        second_primitive: merged_move.second_primitive,
                        from: current,
                        next: next,
                        to: merge_next
                        });

       macro_steps.push({
                        index: macro_steps.length,
                        raw_index: i,
                        raw_span: 2,
                        merged: true,
                        merge_type: merged_move.merge_type,
                        merge_detail: merged_move.merge_detail,
                        merged_primitive: merged_move.merged_primitive,
                        from: current,
                        to: merge_next,
                        anchor_start_info: anchor_start_info,
                        anchor_stop_info: get_vk_anchor(merge_next)
                        });

       i += 1;
       continue;
       } // if

    merge_trace.push({
                     raw_index: i,
                     raw_span: 1,
                     merged: false,
                     merge_type: "",
                     merge_detail: "",
                     merged_primitive: "",
                     first_primitive: "",
                     second_primitive: "",
                     from: current,
                     next: next,
                     to: next
                     });

    macro_steps.push({
                     index: macro_steps.length,
                     raw_index: i,
                     raw_span: 1,
                     merged: false,
                     merge_type: "",
                     merge_detail: "",
                     merged_primitive: "",
                     from: current,
                     to: next,
                     anchor_start_info: anchor_start_info,
                     anchor_stop_info: anchor_stop_info
                     });
    } // for i<raw_path.length-1

   return({
          macro_steps: macro_steps,
          merge_trace: merge_trace
          });
} // build_vk_macro_steps()

let vk_macro_build = build_vk_macro_steps(fullPath);
let vk_macro_steps = Array.isArray(vk_macro_build?.macro_steps) ? vk_macro_build.macro_steps : [];
let vk_merge_trace = Array.isArray(vk_macro_build?.merge_trace) ? vk_macro_build.merge_trace : [];

if (Array.isArray(vk_macro_steps) && vk_macro_steps.length > 0)
   {
   vk_moving_bot_index = self.get_botindex_by_xyz(
                                                  {x: vk_macro_steps[0].from.x, y: vk_macro_steps[0].from.y, z: vk_macro_steps[0].from.z},
                                                  vk_bots
                                                  );
   lastneighbour = vk_macro_steps[0].anchor_start_info.neighbour;

   for (let i=0; i<vk_macro_steps.length; i++)
       {
        let step = vk_macro_steps[i];
        let current = step.from;
        let next = step.to;
        let anchor_start_info = step.anchor_start_info;
        let anchor_stop_info = step.anchor_stop_info;
        let anchor_policy = get_vk_anchor_policy(step);

        let dx = next.x - current.x;
        let dy = next.y - current.y;
        let dz = next.z - current.z;
       let same_position = (dx == 0 && dy == 0 && dz == 0);
       let same_orientation = (current.vx == next.vx && current.vy == next.vy && current.vz == next.vz);

       let current_dir = String(current.dir || (current.vx + "," + current.vy + "," + current.vz));
       let next_dir = String(next.dir || (next.vx + "," + next.vy + "," + next.vz));
       let rotation = "";
       let type = "";
       let direction = "";
       let movesubcmd = "";
       let validation = {
                        checked: false,
                        ok: null,
                        reason: "",
                        expected_pos: {
                                      x: next.x,
                                      y: next.y,
                                      z: next.z
                                      },
                        virtual_pos: null,
                        lastanchor: "",
                        lastanchorneighbour: null
                        };

       if (step.merged === true)
          {
          type = "translation";
          rotation = "none";
          direction = step.merge_type;
          movesubcmd = get_vk_merged_movesubcmd(step.merge_type, step.merged_primitive);

          anchor_start_info = get_vk_policy_anchor(current, anchor_policy.start_slot);
          anchor_stop_info = get_vk_policy_anchor(next, anchor_policy.stop_slot);

          validation = {
                       checked: true,
                       ok: (movesubcmd !== ""),
                       reason: (movesubcmd === "" ? "MERGED_COMPOSITE_UNKNOWN" : "MERGED_COMPOSITE_ACCEPTED"),
                       expected_pos: {
                                     x: next.x,
                                     y: next.y,
                                     z: next.z
                                     },
                       virtual_pos: {
                                    x: next.x,
                                    y: next.y,
                                    z: next.z
                                    },
                       lastanchor: anchor_stop_info.slot,
                       lastanchorneighbour: anchor_stop_info.neighbour
                       };
          } else if (same_position && !same_orientation)
            {
            type = "rotation";
            direction = "stay";

            let turn_key = current_dir + ">" + next_dir;
            let spin_right = {
                             "ZP>PX": true,
                             "PX>ZN": true,
                             "ZN>XN": true,
                             "XN>ZP": true
                             };
            let spin_left = {
                            "ZP>XN": true,
                            "XN>ZN": true,
                            "ZN>PX": true,
                            "PX>ZP": true
                            };

            if (spin_right[turn_key] === true)
               {
               rotation = "SR";
               movesubcmd = "D_SR_D";
               } else if (spin_left[turn_key] === true)
                 {
                 rotation = "SL";
                 movesubcmd = "D_SL_D";
                 } else
                   {
                   rotation = "UNKNOWN";
                   movesubcmd = "";
                   }

            let rotation_anchor_pos = {
                                      x: current.x,
                                      y: current.y - 1,
                                      z: current.z
                                      };
            let rotation_anchor_index = self.get_botindex_by_xyz(rotation_anchor_pos, bots);
            anchor_start_info = get_vk_policy_anchor(current, "D");
            anchor_stop_info = get_vk_policy_anchor(next, "D");
            validation = {
                         checked: true,
                         ok: (movesubcmd !== "" && rotation_anchor_index != null),
                         reason: (movesubcmd === "" ? "UNKNOWN_ROTATION" : (rotation_anchor_index == null ? "DOWN_ANCHOR_MISSING" : "ROTATION_DOWN_ANCHOR_OK")),
                         expected_pos: {
                                       x: next.x,
                                       y: next.y,
                                       z: next.z
                                       },
                         virtual_pos: {
                                      x: current.x,
                                      y: current.y,
                                      z: current.z
                                      },
                         lastanchor: "D",
                         lastanchorneighbour: rotation_anchor_pos
                         };
            } else if (!same_position)
              {
              type = "translation";
              rotation = "none";

              if (dy == 1)
                 {
                 direction = "up";
                 movesubcmd = "F_T_F";
                 anchor_start_info = get_vk_policy_anchor(current, "F");
                 anchor_stop_info = get_vk_policy_anchor(next, "F");
                 } else if (dy == -1)
                   {
                   direction = "down";
                   movesubcmd = "F_D_F";
                   anchor_start_info = get_vk_policy_anchor(current, "F");
                   anchor_stop_info = get_vk_policy_anchor(next, "F");
                      } else if (dx == current.vx && dz == current.vz)
                      {
                      direction = "forward";
                       movesubcmd = anchor_start_info.slot + "_F_" + anchor_stop_info.slot;
                       anchor_start_info = resolve_vk_anchor_safe(current, "D", vk_bots, ["B"]);
                       anchor_stop_info = resolve_vk_anchor_safe(next, "D", vk_bots, ["B"]);
                      } else if (dx == -current.vx && dz == -current.vz)
                        {
                        direction = "backward";
                        movesubcmd = anchor_start_info.slot + "_B_" + anchor_stop_info.slot;
                        anchor_start_info = resolve_vk_anchor_safe(current, "D", vk_bots, ["F"]);
                        anchor_stop_info = resolve_vk_anchor_safe(next, "D", vk_bots, ["F"]);
                        } else
                          {
                          direction = "unsupported";
                          }

              if (movesubcmd !== "")
                 {
                 let move_parts = movesubcmd.split("_");
                 let virtual_move_cmd = move_parts.length >= 2 ? move_parts[1] : "";
                 let teststruct = self.test_virtual_botmove(
                                                           {x:current.x, y:current.y, z:current.z},
                                                           virtual_move_cmd,
                                                           vk_bots
                                                           );

                 let virtual_pos = teststruct && teststruct.lastpos ? teststruct.lastpos : null;
                 let virtual_matches_expected = (
                                                 virtual_pos != null &&
                                                 virtual_pos.x == next.x &&
                                                 virtual_pos.y == next.y &&
                                                 virtual_pos.z == next.z
                                                 );

                 validation = {
                              checked: true,
                              ok: (teststruct != null && teststruct.check === true && virtual_matches_expected === true),
                              reason: (teststruct == null ? "NO_TESTSTRUCT" : (teststruct.check !== true ? "VIRTUAL_MOVE_INVALID" : (virtual_matches_expected !== true ? "VIRTUAL_POS_MISMATCH" : "VIRTUAL_MOVE_OK"))),
                              expected_pos: {
                                            x: next.x,
                                            y: next.y,
                                            z: next.z
                                            },
                              virtual_pos: virtual_pos,
                              lastanchor: teststruct ? teststruct.lastanchor : "",
                              lastanchorneighbour: teststruct ? teststruct.lastanchorneighbour : null
                              };

                 if (validation.ok === true)
                    {
                  if (direction == "forward" || direction == "backward")
                     {
                     anchor_start_info = resolve_vk_anchor_safe(current, "D", vk_bots, direction === "forward" ? ["B"] : ["F"]);
                     anchor_stop_info = resolve_vk_anchor_safe(next, "D", vk_bots, direction === "forward" ? ["B"] : ["F"]);
                     } else if (direction == "up" || direction == "down")
                         {
                         anchor_start_info = get_vk_policy_anchor(current, "F");
                         anchor_stop_info = get_vk_policy_anchor(next, "F");
                         }

                    movesubcmd = anchor_start_info.slot + "_" + virtual_move_cmd + "_" + anchor_stop_info.slot;
                    } else
                      {
                      }
                 } // if (movesubcmd !== "")
              } else
                {
                type = "noop";
                direction = "stay";
                rotation = "none";
                validation = {
                             checked: true,
                             ok: true,
                             reason: "NOOP",
                             expected_pos: {
                                           x: next.x,
                                           y: next.y,
                                           z: next.z
                                           },
                             virtual_pos: {
                                          x: current.x,
                                          y: current.y,
                                          z: current.z
                                          },
                             lastanchor: anchor_stop_info.slot,
                             lastanchorneighbour: anchor_stop_info.neighbour
                             };
                }

       vk_movesubcmds.push({
                            index: i,
                            type: type,
                            direction: direction,
                            rotation: rotation,
                            translation: {
                                         dx: dx,
                                         dy: dy,
                                         dz: dz
                                         },
                            from: {
                                  x: current.x,
                                  y: current.y,
                                  z: current.z,
                                  vx: current.vx,
                                  vy: current.vy,
                                  vz: current.vz,
                                  dir: current.dir ?? null
                                  },
                            to: {
                                x: next.x,
                                y: next.y,
                                z: next.z,
                                vx: next.vx,
                                vy: next.vy,
                                vz: next.vz,
                                dir: next.dir ?? null
                                },
                            anchor_start: anchor_start_info.slot,
                            anchor_start_info: anchor_start_info,
                            anchor_stop: anchor_stop_info.slot,
                            anchor_stop_info: anchor_stop_info,
                            validation: validation,
                            movesubcmd: movesubcmd,
                            merged: step.merged === true,
                            merged_detail: step.merge_detail ?? "",
                            merged_primitive: step.merged_primitive ?? ""
                            });

       if (vk_moving_bot_index != null && vk_bots[vk_moving_bot_index] !== undefined)
          {
          vk_bots[vk_moving_bot_index].x = next.x;
          vk_bots[vk_moving_bot_index].y = next.y;
          vk_bots[vk_moving_bot_index].z = next.z;
          vk_bots[vk_moving_bot_index].vector_x = next.vx;
          vk_bots[vk_moving_bot_index].vector_y = next.vy;
          vk_bots[vk_moving_bot_index].vector_z = next.vz;
          } // if (vk_moving_bot_index != null && vk_bots[vk_moving_bot_index] !== undefined)
       } // for i<vk_macro_steps.length

   let last_step = vk_macro_steps[vk_macro_steps.length-1];
   final_lastanchor = last_step.anchor_stop_info.slot;
   final_lastanchorneighbour = last_step.anchor_stop_info.neighbour;
   } // if (Array.isArray(vk_macro_steps) && vk_macro_steps.length > 0)

movecmds = vk_movesubcmds
           .map(item => item.movesubcmd)
           .filter(item => item !== "")
           .join(";");

let vk_movesubcmds_path = path.join(__dirname, "logs", "calc_move_vk_movesubcmds.json");
vk_debug_write(vk_movesubcmds_path, JSON.stringify(vk_movesubcmds, null, 2), "utf8");
if (self.debug_vk_exports === true)
    {
    Logger.log("calc_move_vk_cmds movesubcmds dumped: " + vk_movesubcmds_path);
    }

let vk_merge_trace_path = path.join(__dirname, "logs", "calc_move_vk_merge_trace.json");
vk_debug_write(vk_merge_trace_path, JSON.stringify(vk_merge_trace, null, 2), "utf8");
if (self.debug_vk_exports === true)
    {
    Logger.log("calc_move_vk_cmds merge trace dumped: " + vk_merge_trace_path);
    }

let vk_merge_trace_lines = [];

for (let i=0; i<vk_merge_trace.length; i++)
    {
    let item = vk_merge_trace[i];
    let from_dir = item.from && item.from.dir != null ? item.from.dir : (item.from ? (item.from.vx + "," + item.from.vy + "," + item.from.vz) : "");
    let next_dir = item.next && item.next.dir != null ? item.next.dir : (item.next ? (item.next.vx + "," + item.next.vy + "," + item.next.vz) : "");
    let to_dir = item.to && item.to.dir != null ? item.to.dir : (item.to ? (item.to.vx + "," + item.to.vy + "," + item.to.vz) : "");
    let line = [
                String(item.raw_index).padStart(2, "0"),
                item.merged === true ? "merged" : "single",
                item.merge_type || "-",
                item.merge_detail || "-",
                item.merged_primitive || "-",
                `from=(${item.from.x},${item.from.y},${item.from.z})[${from_dir}]`,
                `next=(${item.next.x},${item.next.y},${item.next.z})[${next_dir}]`,
                `to=(${item.to.x},${item.to.y},${item.to.z})[${to_dir}]`
                ].join(" | ");
    vk_merge_trace_lines.push(line);
    } // for i<vk_merge_trace.length

let vk_merge_trace_text = [
                           "calc_move_vk_cmds merge_trace",
                           "path_length=" + vk_merge_trace.length,
                           "goal_orientation=" + JSON.stringify(goal_orientation ?? null),
                           ""
                           ].concat(vk_merge_trace_lines).join("\n");

let vk_merge_trace_text_path = path.join(__dirname, "logs", "calc_move_vk_merge_trace.txt");
vk_debug_write(vk_merge_trace_text_path, vk_merge_trace_text, "utf8");
if (self.debug_vk_exports === true)
    {
    Logger.log("calc_move_vk_cmds merge trace text dumped: " + vk_merge_trace_text_path);
    }

let vk_chain_lines = [];

for (let i=0; i<vk_movesubcmds.length; i++)
    {
    let item = vk_movesubcmds[i];
    let from_dir = item.from && item.from.dir != null ? item.from.dir : (item.from ? (item.from.vx + "," + item.from.vy + "," + item.from.vz) : "");
    let to_dir = item.to && item.to.dir != null ? item.to.dir : (item.to ? (item.to.vx + "," + item.to.vy + "," + item.to.vz) : "");
    let line = [
                String(item.index).padStart(2, "0"),
                item.type,
                item.direction,
                item.rotation,
                `from=(${item.from.x},${item.from.y},${item.from.z})[${from_dir}]`,
                `to=(${item.to.x},${item.to.y},${item.to.z})[${to_dir}]`,
                `anchor=${item.anchor_start}->${item.anchor_stop}`,
                `move=${item.movesubcmd || ""}`,
                item.merged === true ? `merged=${item.merged_primitive}` : ""
                ].filter(part => part !== "").join(" | ");
    vk_chain_lines.push(line);
    } // for i<vk_movesubcmds.length

let vk_chain_text = [
                    "calc_move_vk_cmds chain",
                    "path_length=" + vk_movesubcmds.length,
                    "goal_orientation=" + JSON.stringify(goal_orientation ?? null),
                    ""
                    ].concat(vk_chain_lines).join("\n");

let vk_chain_text_path = path.join(__dirname, "logs", "calc_move_vk_chain.txt");
vk_debug_write(vk_chain_text_path, vk_chain_text, "utf8");
if (self.debug_vk_exports === true)
    {
    Logger.log("calc_move_vk_cmds chain dumped: " + vk_chain_text_path);
    }

let vk_chain_dump = {
                     timestamp: new Date().toISOString(),
                     path_length: vk_movesubcmds.length,
                     goal_orientation: goal_orientation ?? null,
                     chain: vk_movesubcmds
                     };

let vk_chain_json_path = path.join(__dirname, "logs", "calc_move_vk_chain.json");
vk_debug_write(vk_chain_json_path, JSON.stringify(vk_chain_dump, null, 2), "utf8");
if (self.debug_vk_exports === true)
    {
    Logger.log("calc_move_vk_cmds chain json dumped: " + vk_chain_json_path);
    }


 

let ret = {
           movecmds: movecmds,
           lastneighbour: lastneighbour,
           final_lastanchor: final_lastanchor,
           final_lastanchorneighbour: final_lastanchorneighbour
           };

let calc_move_cmds_return_path = path.join(__dirname, "logs", "calc_move_cmds_return.json");
if (self.debug_vk_exports === true)
   {
   fs.writeFileSync(calc_move_cmds_return_path, JSON.stringify(ret, null, 2), "utf8");
   Logger.log("calc_move_cmds return dumped: " + calc_move_cmds_return_path);
   } // if (self.debug_vk_exports === true)

// console.log("ret: calc_move_cmds");
// console.log( ret );

return(ret);

// ---
} // calc_move_vk_cmds()





//
// calc_move_hybrid_cmds()
// Hybrid-kinematics entry point for the MOVE translation chain.
// Copy of calc_move_vk_cmds() with CLIMB primitives for hybrid mode.
//

calc_move_hybrid_cmds(fullPath, vx, vy, vz, bots, goal_orientation = null, hybrid_actions = null)
{
const self = this;
self.debug_hybrid_exports = true;

// Log fullPath + orientation at the very start (before any early return)
if (self.debug_hybrid_exports === true)
   {
   let fullpath_log_path = path.join(__dirname, "logs", "calc_move_hybrid_cmds_fullpath.json");
   let fullpath_log = {
       timestamp: new Date().toISOString(),
       start_orientation: { x: Number(vx), y: Number(vy), z: Number(vz) },
       goal_orientation: goal_orientation ? { x: Number(goal_orientation.x), y: Number(goal_orientation.y), z: Number(goal_orientation.z) } : null,
       path_length: Array.isArray(fullPath) ? fullPath.length : 0,
       bots_count: Array.isArray(bots) ? bots.length : 0,
       hybrid_actions: Array.isArray(hybrid_actions) ? hybrid_actions : [],
       fullPath: Array.isArray(fullPath) ? fullPath : []
   };
   fs.writeFileSync(fullpath_log_path, JSON.stringify(fullpath_log, null, 2), "utf8");
   Logger.log("calc_move_hybrid_cmds fullPath logged: " + fullpath_log_path);
   }

if (Array.isArray(hybrid_actions) && hybrid_actions.length > 0)
   {
   console.log("calc_move_hybrid_cmds hybrid_actions:", JSON.stringify(hybrid_actions));
   } else
     {
     console.log("calc_move_hybrid_cmds hybrid_actions: EMPTY (path_found via fullPath length=" + (Array.isArray(fullPath) ? fullPath.length : 0) + ")");
     }

// =====================================================================
// NEUE OPCODE-TABELLE (09.05.2026)
// Übersetzt Path-Planner Actions direkt in Opcodes, ohne Merge-Logik.
// Status: EXPERIMENTELL - alte Merge-Logik bleibt erhalten.
// =====================================================================
// Jedes Primitiv aus api_hybrid_kinematics_path_runtime.js bekommt
// einen festen oder dynamischen Opcode.
// Für FWD/BWD: Anker werden via resolve_hybrid_anchor_safe() bestimmt.
// =====================================================================

// Opcode-Tabelle: Primitive-Name -> { opcode: String/Funktion, type: String }
// type: "fixed" = immer gleicher Opcode
//       "dynamic_fwd" = FWD mit dynamischen Ankern
//       "dynamic_bwd" = BWD mit dynamischen Ankern
const HYBRID_OPCODE_TABLE = {
  // --- MOVE (horizontale Translation) - hartverdratet für Test (kein Kopfüber) ---
  "MOVE_XP_FWD": { opcode: "D_F_D", type: "fixed", desc: "forward in XP direction" },
  "MOVE_XP_BWD": { opcode: "D_B_D", type: "fixed", desc: "backward in XP direction" },
  "MOVE_XN_FWD": { opcode: "D_F_D", type: "fixed", desc: "forward in XN direction" },
  "MOVE_XN_BWD": { opcode: "D_B_D", type: "fixed", desc: "backward in XN direction" },
  "MOVE_ZP_FWD": { opcode: "D_F_D", type: "fixed", desc: "forward in ZP direction" },
  "MOVE_ZP_BWD": { opcode: "D_B_D", type: "fixed", desc: "backward in ZP direction" },
  "MOVE_ZN_FWD": { opcode: "D_F_D", type: "fixed", desc: "forward in ZN direction" },
  "MOVE_ZN_BWD": { opcode: "D_B_D", type: "fixed", desc: "backward in ZN direction" },

  // --- ROT (Rotationen) ---
  "ROT_LEFT_XP_TO_ZN":  { opcode: "D_SR_D", type: "fixed", desc: "spin left" },
  "ROT_RIGHT_XP_TO_ZP": { opcode: "D_SL_D", type: "fixed", desc: "spin right" },
  "ROT_LEFT_XN_TO_ZP":  { opcode: "D_SR_D", type: "fixed", desc: "spin left" },
  "ROT_RIGHT_XN_TO_ZN": { opcode: "D_SL_D", type: "fixed", desc: "spin right" },
  "ROT_LEFT_ZP_TO_XP":  { opcode: "D_SR_D", type: "fixed", desc: "spin left" },
  "ROT_RIGHT_ZP_TO_XN": { opcode: "D_SL_D", type: "fixed", desc: "spin right" },
  "ROT_LEFT_ZN_TO_XN":  { opcode: "D_SR_D", type: "fixed", desc: "spin left" },
  "ROT_RIGHT_ZN_TO_XP": { opcode: "D_SL_D", type: "fixed", desc: "spin right" },

  // --- WALL_UP (vertikale Aufwärtsbewegung an der Wand) ---
  "WALL_UP_XP": { opcode: "F_T_F", type: "fixed", desc: "wall up XP" },
  "WALL_UP_XN": { opcode: "F_T_F", type: "fixed", desc: "wall up XN" },
  "WALL_UP_ZP": { opcode: "F_T_F", type: "fixed", desc: "wall up ZP" },
  "WALL_UP_ZN": { opcode: "F_T_F", type: "fixed", desc: "wall up ZN" },

  // --- WALL_DOWN (vertikale Abwärtsbewegung an der Wand) ---
  "WALL_DOWN_XP": { opcode: "F_D_F", type: "fixed", desc: "wall down XP" },
  "WALL_DOWN_XN": { opcode: "F_D_F", type: "fixed", desc: "wall down XN" },
  "WALL_DOWN_ZP": { opcode: "F_D_F", type: "fixed", desc: "wall down ZP" },
  "WALL_DOWN_ZN": { opcode: "F_D_F", type: "fixed", desc: "wall down ZN" },

  // --- STEP_UP (T+F merged) ---
  "STEP_UP_XP": { opcode: "F_TF_D", type: "fixed", desc: "step up XP" },
  "STEP_UP_XN": { opcode: "F_TF_D", type: "fixed", desc: "step up XN" },
  "STEP_UP_ZP": { opcode: "F_TF_D", type: "fixed", desc: "step up ZP" },
  "STEP_UP_ZN": { opcode: "F_TF_D", type: "fixed", desc: "step up ZN" },

  // --- STEP_DOWN (F+D merged) ---
  "STEP_DOWN_XP": { opcode: "D_BD_F", type: "fixed", desc: "step down XP" },
  "STEP_DOWN_XN": { opcode: "D_BD_F", type: "fixed", desc: "step down XN" },
  "STEP_DOWN_ZP": { opcode: "D_BD_F", type: "fixed", desc: "step down ZP" },
  "STEP_DOWN_ZN": { opcode: "D_BD_F", type: "fixed", desc: "step down ZN" },

  // --- CLIMB_UP (F+T diagonal) ---
  "CLIMB_UP_XP": { opcode: "T_BT_F", type: "fixed", desc: "climb up XP" },
  "CLIMB_UP_XN": { opcode: "T_BT_F", type: "fixed", desc: "climb up XN" },
  "CLIMB_UP_ZP": { opcode: "T_BT_F", type: "fixed", desc: "climb up ZP" },
  "CLIMB_UP_ZN": { opcode: "T_BT_F", type: "fixed", desc: "climb up ZN" },

  // --- CLIMB_DOWN (D+F diagonal) ---
  "CLIMB_DOWN_XP": { opcode: "F_DF_T", type: "fixed", desc: "climb down XP" },
  "CLIMB_DOWN_XN": { opcode: "F_DF_T", type: "fixed", desc: "climb down XN" },
  "CLIMB_DOWN_ZP": { opcode: "F_DF_T", type: "fixed", desc: "climb down ZP" },
  "CLIMB_DOWN_ZN": { opcode: "F_DF_T", type: "fixed", desc: "climb down ZN" },

  // --- CEILING (horizontale Fahrt an der Decke, Kopf über) ---
  "MOVE_XP_FWD_CEILING": { opcode: "T_F_T", type: "fixed", desc: "ceiling forward XP" },
  "MOVE_XP_BWD_CEILING": { opcode: "T_B_T", type: "fixed", desc: "ceiling backward XP" },
  "MOVE_XN_FWD_CEILING": { opcode: "T_F_T", type: "fixed", desc: "ceiling forward XN" },
  "MOVE_XN_BWD_CEILING": { opcode: "T_B_T", type: "fixed", desc: "ceiling backward XN" },
  "MOVE_ZP_FWD_CEILING": { opcode: "T_F_T", type: "fixed", desc: "ceiling forward ZP" },
  "MOVE_ZP_BWD_CEILING": { opcode: "T_B_T", type: "fixed", desc: "ceiling backward ZP" },
  "MOVE_ZN_FWD_CEILING": { opcode: "T_F_T", type: "fixed", desc: "ceiling forward ZN" },
  "MOVE_ZN_BWD_CEILING": { opcode: "T_B_T", type: "fixed", desc: "ceiling backward ZN" },
};

// Neue Opcode-Liste für das Logging
let hybrid_actions_opcodes = [];

// Nur ausführen wenn hybrid_actions vorhanden sind
if (Array.isArray(hybrid_actions) && hybrid_actions.length > 0)
   {
   console.log("=== HYBRID ACTIONS -> OPCODES (NEU) ===");
   for (let ha_i = 0; ha_i < hybrid_actions.length; ha_i++)
       {
       let action_name = hybrid_actions[ha_i];
       let entry = HYBRID_OPCODE_TABLE[action_name];
       let opcode = "";
       let opcode_ok = false;

       if (entry && entry.type === "fixed")
          {
          opcode = entry.opcode;
          opcode_ok = true;
          }

       hybrid_actions_opcodes.push({
           index: ha_i,
           action: action_name,
           opcode: opcode,
           ok: opcode_ok
       });

       console.log("  [" + ha_i + "] " + action_name + " -> " + (opcode_ok ? opcode : "??? (unbekannt)"));
       }
   console.log("=== ENDE HYBRID ACTIONS -> OPCODES ===");
   }

// Logge hybrid_actions + neue Opcodes in Log-Datei (wenn debug aktiv)
if (self.debug_hybrid_exports === true && Array.isArray(hybrid_actions))
   {
   let hybrid_actions_log_path = path.join(__dirname, "logs", "calc_move_hybrid_actions_log.json");
   let hybrid_actions_log = {
       timestamp: new Date().toISOString(),
       actions: hybrid_actions,
       opcodes: hybrid_actions_opcodes,
       path_length: Array.isArray(fullPath) ? fullPath.length : 0
   };
   fs.writeFileSync(hybrid_actions_log_path, JSON.stringify(hybrid_actions_log, null, 2), "utf8");
   Logger.log("calc_move_hybrid_cmds hybrid_actions+opcodes logged: " + hybrid_actions_log_path);
   }
// =====================================================================
// ENDE NEUE OPCODE-TABELLE
// =====================================================================

// Wenn hybrid_actions vorhanden sind, die neuen Opcodes in movecmds setzen
// und per early return zurückgeben (alte VK-Merge-Logik überspringen).
if (Array.isArray(hybrid_actions_opcodes) && hybrid_actions_opcodes.length > 0)
   {
   let new_movecmds = hybrid_actions_opcodes
       .filter(item => item.ok === true && item.opcode !== "")
       .map(item => item.opcode)
       .join(";");

   if (new_movecmds !== "")
      {
      console.log("=== VERWENDE NEUE OPCODES (statt Merge-Logik) ===");
      console.log("  movecmds: " + new_movecmds);

      // Der letzte Opcode enthält den End-Anker (alles nach dem letzten '_').
      // Z.B. "D_F_D" -> End-Anker "D", "F_TF_D" -> End-Anker "D".
      let last_opcode = hybrid_actions_opcodes[hybrid_actions_opcodes.length - 1]?.opcode || "";
      let last_parts = last_opcode.split("_");
      let final_lastanchor = last_parts.length >= 3 ? last_parts[2] : "D";

      // Zielkoordinate aus fullPath (letztes Element)
      let last_path = fullPath[fullPath.length - 1];

      // Anker-Position via get_next_target_coor() berechnen
      let anchor_pos = self.get_next_target_coor(
          last_path.x, last_path.y, last_path.z,
          vx, vy, vz, final_lastanchor
      );

      // lastneighbour = erster gültiger Nachbar am Ziel (für ACK-Route)
      let neighbours = self.get_valid_neighbours(
          {x: last_path.x, y: last_path.y, z: last_path.z},
          null, bots
      );
      let lastneighbour = neighbours.length > 0 ? neighbours[0] : anchor_pos;

      // Early return - alte VK-Merge-Logik komplett überspringen
      return({
             movecmds: new_movecmds,
             lastneighbour: lastneighbour,
             final_lastanchor: final_lastanchor,
             final_lastanchorneighbour: anchor_pos
             });
      }
   }

let stage_dump_path = path.join(__dirname, "logs", "calc_move_hybrid_stages.json");
let stage_dump = {
                 timestamp: new Date().toISOString(),
                 start_orientation: {
                                     x: Number(vx),
                                     y: Number(vy),
                                     z: Number(vz)
                                     },
                 goal_orientation: goal_orientation ?? null,
                 path_length: Array.isArray(fullPath) ? fullPath.length : 0,
                 bots_count: Array.isArray(bots) ? bots.length : 0,
                 stages: Array.isArray(fullPath) ? fullPath : []
                 };

if (self.debug_hybrid_exports === true)
   {
   Logger.log("calc_move_hybrid_cmds called: path_length=" + stage_dump.path_length + " goal_orientation=" + JSON.stringify(stage_dump.goal_orientation) + " dump_path=" + stage_dump_path);
   }
fs.writeFileSync(stage_dump_path, JSON.stringify(stage_dump, null, 2), "utf8");

//return(this.calc_move_cmds(fullPath, vx, vy, vz, bots, goal_orientation));

// ---

let lastneighbour= null;
let final_lastanchor= null;
let final_lastanchorneighbour = null;

// Alte Merge-Logik entfernt (09.05.2026) - ersetzt durch HYBRID_OPCODE_TABLE
// Die Funktionen get_hybrid_anchor_policy, get_hybrid_step_primitive,
// get_hybrid_step_merge_info, get_hybrid_merged_movesubcmd, build_hybrid_macro_steps
// und der gesamte hybrid_macro_build-Block wurden entfernt.
// Die Opcode-Übersetzung erfolgt jetzt direkt über hybrid_actions -> HYBRID_OPCODE_TABLE.
// Auch die zugehörigen Debug-Logging-Blöcke (hybrid_movesubcmds, hybrid_merge_trace)
// wurden entfernt, da diese Arrays von der alten Merge-Logik befüllt wurden.

let ret = {
           movecmds: movecmds,
           lastneighbour: lastneighbour,
           final_lastanchor: final_lastanchor,
           final_lastanchorneighbour: final_lastanchorneighbour
           };

let calc_move_cmds_return_path = path.join(__dirname, "logs", "calc_move_cmds_return.json");
if (self.debug_hybrid_exports === true)
   {
   fs.writeFileSync(calc_move_cmds_return_path, JSON.stringify(ret, null, 2), "utf8");
   Logger.log("calc_move_cmds return dumped: " + calc_move_cmds_return_path);
   } // if (self.debug_hybrid_exports === true)

// console.log("ret: calc_move_cmds");
// console.log( ret );

return(ret);

// ---
} // calc_move_hybrid_cmds()




 


//
// Get-Botindex by xyz (for temporary bots-sturucture)
//
get_botindex_by_xyz(  Botpos , bots )
{
let botindex = null;


let size = bots.length;
for (let i=0; i<size; i++)
    {
    
    if ( bots[i].x == Botpos.x &&
         bots[i].y == Botpos.y &&
         bots[i].z == Botpos.z )
         {
         botindex = i;
         i = size;        
         }
    
    } // for i...
 
 
return( botindex ); 
} // get_botindex_by_xyz






//
// test_virtual_botmove
//
test_virtual_botmove( Botpos, MoveSubCmd ,  bots)
{
let result = {};
let check = false;
 
let locallog = false;
if (locallog ) console.log("-----test_virtual_botmove-----");
if (locallog ) console.log("-Botpos: " +  JSON.stringify(Botpos, null, 2));
if (locallog ) console.log("-MoveSubCmd: " + MoveSubCmd);

let bot_x = Botpos.x;
let bot_y = Botpos.y;
let bot_z = Botpos.z;

if (locallog ) console.log("-botpos pre:");
if (locallog ) console.log(bot_x + " " + bot_y + " " + bot_z);

 
 
let keyindex = this.get_botindex_by_xyz(  {x:bot_x, y:bot_y, z:bot_z } , bots );
if (locallog ) console.log( "-keyindex:" + keyindex);

if (keyindex == null || bots[keyindex] === undefined)
   {
   result.check      = false;
   result.reason     = "BOT_NOT_FOUND_AT_VIRTUAL_START";
   result.lastanchor = "";
   result.lastpos    = {x:bot_x, y:bot_y, z:bot_z };
   result.lastanchorneighbour = null;
   return(result);
   } // if (keyindex == null || bots[keyindex] === undefined)

let vx = bots[ keyindex ] .vector_x;
let vy = bots[ keyindex ] .vector_y;
let vz = bots[ keyindex ] .vector_z;
 
 
 
if (locallog ) console.log( "-botid: " + bots[ keyindex ] .id + " vxyz:" +  bots[ keyindex ] .vector_x + " " + bots[ keyindex ] .vector_y + " " + bots[ keyindex ] .vector_z + " " );


let size = MoveSubCmd.length;
let lastmove   = "";
let lastanchor = "";
let neighbour_bot_x,neighbour_bot_y,neighbour_bot_z;

for (let i=0; i<size; i++)
    {
    lastmove = MoveSubCmd[i];
    if (locallog ) console.log("-lastmove: " + lastmove);
    
    let relvector = this.get_cell_relation_vector_byslot(lastmove, vx,vy,vz); 
    if (locallog ) console.log("-relvector:");
    if (locallog ) console.log(relvector);
    
    bot_x += Number( relvector.x );
    bot_y += Number( relvector.y );
    bot_z += Number( relvector.z );
    
    } // for i...


if (locallog ) console.log("-botpos after:");
if (locallog ) console.log(bot_x + " " + bot_y + " " + bot_z);

     

//
// check if Bot on target position has neighbours:
// 
let neighbours = this.get_valid_neighbours( {x:bot_x, y:bot_y, z:bot_z },{x:Botpos.x, y:Botpos.y, z:Botpos.z }, bots );
 
size = neighbours.length;
if (locallog ) console.log("-size neighbours: " + size); 
if (size > 0)
   {
   

   
   //   
   // get lastanchor
   //
   lastanchor = '';
   
   
   let nv_x = neighbours[0].x - bot_x;
   let nv_y = neighbours[0].y - bot_y;
   let nv_z = neighbours[0].z - bot_z;
   
   lastanchor = this.get_cell_slot_byvector(nv_x,nv_y,nv_z, vx,vy,vz);

   neighbour_bot_x = neighbours[0].x;
   neighbour_bot_y = neighbours[0].y;
   neighbour_bot_z = neighbours[0].z;
   
   
   
   check = true;
   if (locallog ) console.log("-size > 0 : " + check +  "  lastanchor:"  +lastanchor );
   }
   else
      {
      if (locallog ) 
         {
         // This could happen if the command works only with a double-move (climbing-action)     
         }
      }
    
//   
// is target-position free?
//
let botindex = this.get_botindex_by_xyz(  {x:bot_x, y:bot_y, z:bot_z } , bots );

if ( botindex != null )
   {
   if (locallog ) console.log("-Target pos is not free");
   check = false;
   } else
     {
     if (locallog )  console.log("-Target pos is free");
     }
   

  
 
result.check      = check; 
result.lastanchor = lastanchor; 
result.lastpos    = {x:bot_x, y:bot_y, z:bot_z };
result.lastanchorneighbour   = {x:neighbour_bot_x, y:neighbour_bot_y, z:neighbour_bot_z };

if (locallog ) console.log(" - tvb returns -------------");
return (result);
} // test_virtual_botmove




 

//
// getclusterdata_json()
//
getclusterdata_json()
{

 
let jsondata = "";

jsondata += "{";

jsondata += " \"masterbot\":  [   ";

jsondata += "   { ";
jsondata += "   \"x\": "+this.mb['x']+",  ";
jsondata += "   \"y\": "+this.mb['y']+",  ";
jsondata += "   \"z\": "+this.mb['z']+",  ";

jsondata += "   \"vx\": "+this.mb['vx']+",  ";
jsondata += "   \"vy\": "+this.mb['vy']+",  ";
jsondata += "   \"vz\": "+this.mb['vz']+"  ";

jsondata += "   }    ";

jsondata += "  ],  ";
//jsondata += "  ]  ";



jsondata += " \"bots\":  [   ";


 
let l = this.bots.length;



// Bot '0' is masterbot
for (let i=1; i < l; i++)
    {

 
    jsondata += "   { ";
    jsondata += "   \"id\": \""+ this.bots[i].id +"\" ,  ";
    jsondata += "   \"x\": "+ this.bots[i].x +",  ";
    jsondata += "   \"y\": "+ this.bots[i].y +",  ";
    jsondata += "   \"z\": "+ this.bots[i].z +",  ";

    jsondata += "   \"vx\": "+ this.bots[i].vector_x +",  ";
    jsondata += "   \"vy\": "+ this.bots[i].vector_y +",  ";
    jsondata += "   \"vz\": "+ this.bots[i].vector_z +",  ";

    jsondata += "   \"col\": \""+ this.bots[i].color +"\"  ";
    
    jsondata += "   }    ";
    
    if (i < ( l-1) )
       {
       jsondata += "   ,    ";
       }
       
    } // for i...
     
jsondata += "]";       
jsondata += ", \"inactive_bots\": [";

let inactive_size = this.detected_inactive_bots.length;

for (let i=0; i<inactive_size; i++)
    {
    jsondata += "   { ";
    jsondata += "   \"id\": \""+ this.detected_inactive_bots[i].id +"\" ,  ";
    jsondata += "   \"x\": "+ this.detected_inactive_bots[i].x +",  ";
    jsondata += "   \"y\": "+ this.detected_inactive_bots[i].y +",  ";
    jsondata += "   \"z\": "+ this.detected_inactive_bots[i].z +",  ";
    jsondata += "   \"vx\": "+ this.detected_inactive_bots[i].vx +",  ";
    jsondata += "   \"vy\": "+ this.detected_inactive_bots[i].vy +",  ";
    jsondata += "   \"vz\": "+ this.detected_inactive_bots[i].vz +",  ";
    jsondata += "   \"col\": \""+ this.detected_inactive_bots[i].col +"\"  ";
    jsondata += "   }    ";

    if (i < ( inactive_size-1) )
       {
       jsondata += "   ,    ";
       } // if
    } // for

jsondata += "]";
jsondata += ", \"communication_mode\": \"" + String(this.config.communication_mode ?? "mesh_opcode") + "\"";
        

  
jsondata += "}";

 

return(jsondata);
} // getclusterdata_json()




 
 
 

//
// Returns answer-address (if path does exist!)
// firstindex_xyz, if 
//
get_inverse_address( firstindex_xyz, addr )
{
let ret = "";
 
  
let keyindex = this.botindex[firstindex_xyz];

// 1) Only Index in x_y_z-format
// Index of sending Cells (addr -> direction)
let pathindexarray = []; // x_y_z,...

pathindexarray[0] = firstindex_xyz;


let size = addr.length;
for (let i=0; i<size; i++)
    {
    let slot = addr[i];
    
    let keyindex = this.botindex[ pathindexarray[i] ];
   
    // Get orientation vector
    let vx = this.bots[ keyindex ].vector_x;     
    let vy = this.bots[ keyindex ].vector_y;     
    let vz = this.bots[ keyindex ].vector_z;
    
    let rel_vector = this.get_cell_relation_vector_byslot(slot,vx,vy,vz);
    
    //
    // Get addressed Cellbot
    //
    let cb_x = Number(this.bots[ keyindex ].x) + Number(rel_vector.x);
    let cb_y = Number(this.bots[ keyindex ].y) + Number(rel_vector.y);
    let cb_z = Number(this.bots[ keyindex ].z) + Number(rel_vector.z);
        
    let nextindex_xyz = this.getKey_3d(cb_x,cb_y,cb_z);
        
    pathindexarray[i+1] = nextindex_xyz; 
    } // for i

     
    

       
    
//    
// 2) Iterate reverse the pathindex-array    
//
size = pathindexarray.length;

ret += "S";

for (let i = (size-2); i > 0; i--)
    {
    
    // Target-vector
    let index1  = this.botindex[pathindexarray[i] ];
    let index2  = this.botindex[pathindexarray[i-1] ];
    
    
    let tx = this.bots[ index2 ].x - this.bots[ index1 ].x  ;     
    let ty = this.bots[ index2 ].y - this.bots[ index1 ].y  ;     
    let tz = this.bots[ index2 ].z - this.bots[ index1 ].z  ;     
    
    let slot2 = this.get_cell_slot_byvector(tx,ty,tz,  this.bots[ index1 ].vector_x, this.bots[ index1 ].vector_y, this.bots[ index1 ].vector_z);
 
    
    ret += slot2;
    } // for --i
    
    
// 2) Traverse the indexes backwards and fetch the Cellbot data:
//     - Index, slot (e.g. L), and the orientation of the (sending) bot
//     - For the first (last) slot (L), set an 'S' because the rotation direction is not yet known -> S
//     - For each following bot, determine the source slot based on the rotation direction (instead of 'F', use 'B') -> B
//     - repeat the last steps

return(ret);
} // get_inverse_address







//
// get_cell_relation_vector
// Relative vector of the slot, taking under acount the rotation of the cellbot.
//
get_cell_relation_vector_byslot(slot,vx,vy,vz)
{
let rx = 0;
let ry = 0;
let rz = 0;

if (slot != 'T' && slot != 'D')
{
// rotation 1
if ( vx == 1 && vy == 0 && vz == 0)
   {
   if (slot == 'F') {      rx =  1; ry =  0; rz =  0;      } else
   if (slot == 'R') {      rx =  0; ry =  0; rz = -1;      } else
   if (slot == 'B') {      rx = -1; ry =  0; rz =  0;      } else
   if (slot == 'L') {      rx =  0; ry =  0; rz =  1;      };
   } // if rotation 1

// rotation 2
if ( vx == 0 && vy == 0 && vz == -1)
   {
   if (slot == 'F') {      rx =   0; ry =  0; rz = -1;      } else
   if (slot == 'R') {      rx =  -1; ry =  0; rz =  0;      } else
   if (slot == 'B') {      rx =   0; ry =  0; rz =  1;      } else
   if (slot == 'L') {      rx =   1; ry =  0; rz =  0;      };
   } // if rotation 2

// rotation 3
if ( vx == -1 && vy == 0 && vz == 0)
   {
   if (slot == 'F') {      rx =   -1; ry =  0; rz =   0;      } else
   if (slot == 'R') {      rx =    0; ry =  0; rz =   1;      } else
   if (slot == 'B') {      rx =    1; ry =  0; rz =   0;      } else
   if (slot == 'L') {      rx =    0; ry =  0; rz =  -1;      };
   } // if rotation 3

// rotation 4
if ( vx == 0 && vy == 0 && vz == 1)
   {
   if (slot == 'F') {      rx =    0; ry =  0; rz =   1;      } else
   if (slot == 'R') {      rx =    1; ry =  0; rz =   0;      } else
   if (slot == 'B') {      rx =    0; ry =  0; rz =  -1;      } else
   if (slot == 'L') {      rx =   -1; ry =  0; rz =   0;      };
   } // if rotation 4
} // if (slot != 'T' && slot != 'D')
else
   if (slot == 'T') {      rx =    0; ry =  1; rz =   0;      }  else
   if (slot == 'D') {      rx =    0; ry = -1; rz =   0;      };  


return { x: rx, y: ry, z: rz };
} // get_cell_relation_vector_byslot


 




//
// get_cell_slot_byvector
// Relative vector of the slot, taking under acount the rotation of the cellbot.
// tx,ty,tz -> target vector (instead of the slot)
// vx,vy,vz -> rotation vector of the cellbot
//
get_cell_slot_byvector(tx,ty,tz, vx,vy,vz)
{
let ret = "";


// rotation 1
if ( vx == 1 && vy == 0 && vz == 0)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "F"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "R"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "B"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "L"  };
   } // if rotation 1


// rotation 2
if ( vx == 0 && vy == 0 && vz == -1)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "L"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "F"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "R"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "B"  };
   } // if rotation 2


// rotation 3
if ( vx == -1 && vy == 0 && vz == 0)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "B"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "L"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "F"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "R"  };
   } // if rotation 3

// rotation 4
if ( vx == 0 && vy == 0 && vz == 1)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "R"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "B"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "L"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "F"  };
   } // if rotation 4

if ( tx == 0 && ty == -1 && tz == 0) ret = "D";
if ( tx == 0 && ty ==  1 && tz == 0) ret = "T";


return (ret);
} // get_cell_slot_byvector





//
// function calc_target_orientation_vector
// params stl_x, stl_y, stl_z, stl_vx, stl_vy, stl_vz, target_x,target_y,target_z, target_sourceslot 
// used by RINFO-handler ( this.handle_answer() )
//
calc_target_orientation_vector
        (
        stl_x,               
        stl_y,            
        stl_z, 
        target_x,
        target_y,
        target_z, 
        target_sourceslot
        )
{
let vx,vy,vz;


// calc difference-vector (from stl to target)
let diff_x = target_x - stl_x;
let diff_y = target_y - stl_y;
let diff_z = target_z - stl_z;




// 1. Relation of STL to target
if (diff_x == 1 && diff_y == 0 && diff_z == 0)
   {     
      if (target_sourceslot == 'B') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'R') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'F') {vx = -1, vy =  0, vz =  0};
      if (target_sourceslot == 'L') {vx =  0, vy =  0, vz =  1};        
   } // diffxyz = 1,0,0
   
   
// 2. Relation of STL to target
if (diff_x == 0 && diff_y == 0 && diff_z == -1)
   {     
      if (target_sourceslot == 'L') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'B') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'R') {vx = -1, vy =  0, vz =  0};        
      if (target_sourceslot == 'F') {vx =  0, vy =  0, vz =  1};
   } // diffxyz = 0,0,-1


// 3. Relation of STL to target
if (diff_x == -1 && diff_y == 0 && diff_z == 0)
   {     
      if (target_sourceslot == 'F') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'L') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'B') {vx = -1, vy =  0, vz =  0};        
      if (target_sourceslot == 'R') {vx =  0, vy =  0, vz =  1};
   } // diffxyz = -1,0,0


// 4. Relation of STL to target
if (diff_x == 0 && diff_y == 0 && diff_z == 1)
   {     
      if (target_sourceslot == 'R') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'F') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'L') {vx = -1, vy =  0, vz =  0};        
      if (target_sourceslot == 'B') {vx =  0, vy =  0, vz =  1};
   } // diffxyz = -1,0,0


return { vx: vx, vy: vy, vz: vz };
} // function calc_target_orientation_vector(...)       






//
// calc_target_orientation_vector_relative()
// returns the absolute orientation of target, depending from relativ-vector 
// (for Top/Down-scans).
// stl - orientation vecdtor of second-to-last element
// target_vx - relative vector of target
//
calc_target_orientation_vector_relative(
                                                                          stl_vx,
                                                                          stl_vy,
                                                                          stl_vz,
                                                                          target_vx,
                                                                          target_vy,
                                                                          target_vz
                                                                          )
{
let vx,vy,vz, angle;
 
if (target_vx ==  0 && target_vy ==  0 && target_vz ==  1) angle =   0;
if (target_vx ==  1 && target_vy ==  0 && target_vz ==  0) angle =  90;
if (target_vx ==  0 && target_vy ==  0 && target_vz == -1) angle = 180;
if (target_vx == -1 && target_vy ==  0 && target_vz ==  0) angle = 270;


if (angle == 0)
   {
   // Same orientation
   vx = stl_vx;
   vy = stl_vy;
   vz = stl_vz;
   } // 0°

if (angle == 90)
   {
   if (stl_vx ==  1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz = -1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz == -1) {vx = -1; vy =  0; vz =  0; }
   if (stl_vx == -1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz =  1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz ==  1) {vx =  1; vy =  0; vz =  0; }
   } // 90° 

if (angle == 180)
   {
   if (stl_vx ==  1 && stl_vy ==  0 && stl_vz ==  0) {vx = -1; vy =  0; vz =  0; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz == -1) {vx =  0; vy =  0; vz =  1; }
   if (stl_vx == -1 && stl_vy ==  0 && stl_vz ==  0) {vx =  1; vy =  0; vz =  0; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz ==  1) {vx =  0; vy =  0; vz = -1; }
   } // 180° 

if (angle == 270)
   {
   if (stl_vx ==  1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz =  1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz == -1) {vx =  1; vy =  0; vz =  0; }
   if (stl_vx == -1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz = -1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz ==  1) {vx = -1; vy =  0; vz =  0; }
   } // 270° 


return { vx: vx, vy: vy, vz: vz };
} // calc_target_orientation_vector_relative()


                                                                      

//
// Register Bot - add bot to bots-array and also set the index
//
register_bot( bot_class_mini_obj )
{
let size = this.bots.length;
 
this.bots.push( bot_class_mini_obj ); 

this.set_3d(bot_class_mini_obj.x, bot_class_mini_obj.y, bot_class_mini_obj.z,  size );
} // register_bot()


 


// ---> key handling

// Funktion, um einen Schlüssel aus x, y, z zu erstellen
getKey_3d(x, y, z) {
    return `${x},${y},${z}`; // Kombiniere die Koordinaten als String
}  


// Wert setzen
set_3d(x, y, z, value) {
    const key = this.getKey_3d(x, y, z);
    this.botindex[key] = value;
}

// Wert abrufen
get_3d(x, y, z) {
    const key = this.getKey_3d(x, y, z);
    return this.botindex[key] ?? null; // Gib den Wert zurück oder null, falls nicht vorhanden
}

// <--- key handling




 
//
// notify_frontend()
//
notify_frontend( events )
{
if ( !this.ws_gui || this.ws_gui.readyState !== WebSocket.OPEN )
   {
   return(false);
   } // if

let msg =
{
notify: "update",
msg: events
};
 
this.ws_gui.send( JSON.stringify(msg) );

return(true);
 
} // notify_frontend()


//
//
//
notify_frontend_console( msg )
{
        let normalized_msg = String(msg ?? "");
        let progress_match = normalized_msg.match(/^Progress:\s*(\d+)%$/i);

        if (progress_match)
           {
           this.apicall_update_morph_status(
                                            {
                                            running: true,
                                            phase: "calculating",
                                            progress: Number(progress_match[1] ?? 0),
                                            message: normalized_msg
                                            }
                                            );
           }
        else if (normalized_msg == "Prepare Morph")
             {
             this.apicall_update_morph_status(
                                              {
                                              running: true,
                                              phase: "preparing",
                                              progress: 0,
                                              success: null,
                                              message: normalized_msg
                                              }
                                              );
             }
        else if (normalized_msg == "Morphing calculation complete!")
             {
             this.apicall_update_morph_status(
                                              {
                                              running: true,
                                              phase: "calculation_complete",
                                              progress: Math.max(Number(this.morph_status?.progress ?? 0), 100),
                                              message: normalized_msg
                                              }
                                              );
             }
        else if (normalized_msg == "Finish morph process!")
             {
             this.apicall_update_morph_status(
                                              {
                                              running: false,
                                              phase: "finished",
                                              progress: 100,
                                              success: true,
                                              finished_at: new Date().toISOString(),
                                              message: normalized_msg
                                              }
                                              );
             }

        const events = [];
      
        let notify_msg =
            {
            event: "console",
            msg: msg 
            };

        events.push( notify_msg );
        this.notify_frontend( events );

} // notify_frontend_console


//
// update_keyindex()
//
update_keyindex( old_x, old_y, old_z, target_x, target_y, target_z )
{
 
let old_keyindex3d = this.getKey_3d( old_x, old_y, old_z );
let old_keyindex = this.botindex[ old_keyindex3d ];
   
delete this.botindex[ old_keyindex3d ];
    
// set new botindex-entry
this.set_3d(target_x, target_y, target_z, old_keyindex); 
 
} // update_keyindex





//
// get_bot_by_id()
// -> to refactor (!) - should be index-based
//
get_bot_by_id( id, bots )
{
let ret = null;

let size = bots.length;

for (let i=0; i<size; i++)
    {
    if (bots[i].id == id)
       {
       ret = i;
       i = size;       
       }
    } // for i...

return (ret);
} // get_bot_by_id();


//
// apicall_get_bot_by_id()
//
apicall_get_bot_by_id( bot_id )
{
return(runtime_get_bot_by_id(this, bot_id));
} // apicall_get_bot_by_id()


//
// apicall_get_safe_adress()
//
apicall_get_safe_adress( bot )
{
return(runtime_get_safe_adress(this, bot));
} // apicall_get_safe_adress()


//
// apicall_recalibrate_bot_address()
//
apicall_recalibrate_bot_address(bot_id, mode = "standard")
{
return(runtime_recalibrate_bot_address(this, bot_id, mode));
} // apicall_recalibrate_bot_address()


//
// apicall_recalibrate_bot_addresses()
//
apicall_recalibrate_bot_addresses(mode = "standard")
{
return(runtime_recalibrate_bot_addresses(this, mode));
} // apicall_recalibrate_bot_addresses()


//
// apicall_apply_safe_mode_for_bot()
//
apicall_apply_safe_mode_for_bot(bot_id)
{
return(runtime_apply_safe_mode_for_bot(this, bot_id));
} // apicall_apply_safe_mode_for_bot()


//
// apicall_apply_safe_mode_after_structure_change()
//
apicall_apply_safe_mode_after_structure_change(trigger_bot_id, change_type = "structure_change")
{
return(runtime_apply_safe_mode_after_structure_change(this, trigger_bot_id, change_type));
} // apicall_apply_safe_mode_after_structure_change()


//
// apicall_set_safe_mode()
//
apicall_set_safe_mode(mode)
{
return(runtime_set_safe_mode(this, mode));
} // apicall_set_safe_mode()


//
// apicall_get_structure_role_list()
//
apicall_get_structure_role_list(role_key)
{
return(runtime_get_structure_role_list(this, role_key));
} // apicall_get_structure_role_list()


//
// apicall_normalize_grid_point()
//
apicall_normalize_grid_point(x, y, z)
{
return(runtime_normalize_grid_point(this, x, y, z));
} // apicall_normalize_grid_point()


//
// apicall_role_point_index()
//
apicall_role_point_index(role_key, x, y, z)
{
return(runtime_role_point_index(this, role_key, x, y, z));
} // apicall_role_point_index()


//
// apicall_forbidden_add()
//
apicall_forbidden_add(x, y, z)
{
return(runtime_forbidden_add(this, x, y, z));
} // apicall_forbidden_add()


//
// apicall_forbidden_remove()
//
apicall_forbidden_remove(x, y, z)
{
return(runtime_forbidden_remove(this, x, y, z));
} // apicall_forbidden_remove()


//
// apicall_forbidden_clear()
//
apicall_forbidden_clear()
{
return(runtime_forbidden_clear(this));
} // apicall_forbidden_clear()


//
// apicall_forbidden_list()
//
apicall_forbidden_list()
{
return(runtime_forbidden_list(this));
} // apicall_forbidden_list()


//
// apicall_servicebay_add()
//
apicall_servicebay_add(x, y, z)
{
return(runtime_servicebay_add(this, x, y, z));
} // apicall_servicebay_add()


//
// apicall_servicebay_remove()
//
apicall_servicebay_remove(x, y, z)
{
return(runtime_servicebay_remove(this, x, y, z));
} // apicall_servicebay_remove()


//
// apicall_servicebay_clear()
//
apicall_servicebay_clear()
{
return(runtime_servicebay_clear(this));
} // apicall_servicebay_clear()


//
// apicall_servicebay_list()
//
apicall_servicebay_list()
{
return(runtime_servicebay_list(this));
} // apicall_servicebay_list()


//
// apicall_is_servicebay_cell()
//
apicall_is_servicebay_cell(x, y, z)
{
return(runtime_is_servicebay_cell(this, x, y, z));
} // apicall_is_servicebay_cell()


//
// apicall_rebuild_botindex()
//
apicall_rebuild_botindex()
{
return(runtime_rebuild_botindex(this));
} // apicall_rebuild_botindex()


//
// apicall_recycle_bot_if_in_servicebay()
//
apicall_recycle_bot_if_in_servicebay(bot_id, source = "move")
{
return(runtime_recycle_bot_if_in_servicebay(this, bot_id, source));
} // apicall_recycle_bot_if_in_servicebay()


//
// apicall_recycle_bot_force()
//
apicall_recycle_bot_force(bot_id, source = "ack_timeout_servicebay")
{
return(runtime_recycle_bot_force(this, bot_id, source));
} // apicall_recycle_bot_force()


//
// apicall_get_bots()
//
apicall_get_bots( center_x, center_y, center_z, mode, radius )
{
return(runtime_get_bots(this, center_x, center_y, center_z, mode, radius));
} // apicall_get_bots()


//
// apicall_get_bots_by_prefix()
//
apicall_get_bots_by_prefix(prefix = "")
{
return(runtime_get_bots_by_prefix(this, prefix));
} // apicall_get_bots_by_prefix()


//
// apicall_raw_cmd()
//
apicall_raw_cmd( raw_value )
{
return(runtime_raw_cmd(this, raw_value));
} // apicall_raw_cmd()


//
// apicall_poll_masterbot_queue()
//
apicall_poll_masterbot_queue()
{
return(runtime_poll_masterbot_queue(this));
} // apicall_poll_masterbot_queue()


//
// apicall_search_bot()
//
apicall_search_bot(bot_id, level = 1)
{
return(runtime_search_bot(this, bot_id, level));
} // apicall_search_bot()


//
// apicall_get_inactive_bots()
//
apicall_get_inactive_bots()
{
return(runtime_get_inactive_bots(this));
} // apicall_get_inactive_bots()


apicall_get_inactive_bot_by_xyz(x, y, z)
{
return(runtime_get_inactive_bot_by_xyz(this, x, y, z));
} // apicall_get_inactive_bot_by_xyz()


//
// apicall_get_neighbors()
//
apicall_get_neighbors(bot_id)
{
return(runtime_get_neighbors(this, bot_id));
} // apicall_get_neighbors()


//
// apicall_get_grab_positions()
//
apicall_get_grab_positions(x, y, z)
{
return(runtime_get_grab_positions(this, x, y, z));
} // apicall_get_grab_positions()


apicall_evaluate_turn_position(x, y, z, excluded_bot_ids = [])
{
return(runtime_evaluate_turn_position(this, x, y, z, excluded_bot_ids));
} // apicall_evaluate_turn_position()


apicall_get_turn_positions(x, y, z, radius = 1, excluded_bot_ids = [])
{
return(runtime_get_turn_positions(this, x, y, z, radius, excluded_bot_ids));
} // apicall_get_turn_positions()


//
// apicall_is_occupied()
//
apicall_is_occupied(x, y, z)
{
return(runtime_is_occupied(this, x, y, z));
} // apicall_is_occupied()


apicall_is_occupied_excluding_ids(x, y, z, excluded_bot_ids = [])
{
return(runtime_is_occupied_excluding_ids(this, x, y, z, excluded_bot_ids));
} // apicall_is_occupied_excluding_ids()


//
// apicall_get_slot_status()
//
apicall_get_slot_status(bot_id, slot)
{
return(runtime_get_slot_status(this, bot_id, slot));
} // apicall_get_slot_status()


//
// apicall_probe_move_bot()
//
apicall_probe_move_bot(bot_id, move)
{
return(runtime_probe_move_bot(this, bot_id, move));
} // apicall_probe_move_bot()


//
// apicall_can_reach_position()
//
apicall_can_reach_position(bot_id, x, y, z)
{
return(runtime_can_reach_position(this, bot_id, x, y, z));
} // apicall_can_reach_position()


apicall_create_sparse_grid()
{
return(runtime_create_sparse_grid(this));
} // apicall_create_sparse_grid()


apicall_build_structure_grid_without_bot(bot_id, excluded_bot_ids = [])
{
return(runtime_build_structure_grid_without_bot(this, bot_id, excluded_bot_ids));
} // apicall_build_structure_grid_without_bot()


apicall_would_split_cluster(bot_id)
{
return(runtime_would_split_cluster(this, bot_id));
} // apicall_would_split_cluster()


apicall_build_forbidden_grid()
{
return(runtime_build_forbidden_grid(this));
} // apicall_build_forbidden_grid()


apicall_is_forbidden_cell(x, y, z, forbidden_grid = null)
{
return(runtime_is_forbidden_cell(this, x, y, z, forbidden_grid));
} // apicall_is_forbidden_cell()


apicall_get_wrapped_cell_for_double_step(from_pos, to_pos)
{
return(runtime_get_wrapped_cell_for_double_step(this, from_pos, to_pos));
} // apicall_get_wrapped_cell_for_double_step()


apicall_is_valid_wrapped_double_step(from_pos, to_pos, bots_s)
{
return(runtime_is_valid_wrapped_double_step(this, from_pos, to_pos, bots_s));
} // apicall_is_valid_wrapped_double_step()


apicall_calc_single_path(src, dest, bots_s, bots_f)
{
return(runtime_calc_single_path(this, src, dest, bots_s, bots_f));
} // apicall_calc_single_path()


apicall_calc_single_path_payload(src, dest, bots_s, bots_f, payload_options = {})
{
return(runtime_calc_single_path_payload(this, src, dest, bots_s, bots_f, payload_options));
} // apicall_calc_single_path_payload()


apicall_calc_vehicle_kinematics_path(src, dest, bots_s, bots_f, vehicle_options = {})
{
return(runtime_calc_vehicle_kinematics_path(this, src, dest, bots_s, bots_f, vehicle_options));
} // apicall_calc_vehicle_kinematics_path()


apicall_calc_vehicle_kinematics_payload_path(src, dest, bots_s, bots_f, vehicle_options = {})
{
return(runtime_calc_vehicle_kinematics_payload_path(this, src, dest, bots_s, bots_f, vehicle_options));
} // apicall_calc_vehicle_kinematics_payload_path()


apicall_calc_hybrid_kinematics_path(src, dest, bots_s, bots_f, vehicle_options = {})
{
return(runtime_calc_hybrid_kinematics_path(this, src, dest, bots_s, bots_f, vehicle_options));
} // apicall_calc_hybrid_kinematics_path()


apicall_find_path_for_bot(bot_id, x, y, z, show = false, planning_options = {})
{
return(runtime_find_path_for_bot(this, bot_id, x, y, z, show, planning_options));
} // apicall_find_path_for_bot()


apicall_find_path_for_bot_payload(bot_id, payload_bot_id, x, y, z, show = false)
{
return(runtime_find_path_for_bot_payload(this, bot_id, payload_bot_id, x, y, z, show));
} // apicall_find_path_for_bot_payload()


apicall_build_active_bots_tmp(include_masterbot = false, excluded_bot_ids = [])
{
return(runtime_build_active_bots_tmp(this, include_masterbot, excluded_bot_ids));
} // apicall_build_active_bots_tmp()


apicall_build_botindex_map_for_bots(bots_tmp)
{
return(runtime_build_botindex_map_for_bots(this, bots_tmp));
} // apicall_build_botindex_map_for_bots()


apicall_get_inverse_address_for_bots(firstindex_xyz, addr, bots_tmp, botindex_map = null)
{
return(runtime_get_inverse_address_for_bots(this, firstindex_xyz, addr, bots_tmp, botindex_map));
} // apicall_get_inverse_address_for_bots()


apicall_derive_target_address_from_neighbours(target_pos, bots_tmp)
{
return(runtime_derive_target_address_from_neighbours(this, target_pos, bots_tmp));
} // apicall_derive_target_address_from_neighbours()


apicall_derive_ack_returnaddr_from_neighbours(target_bot, bots_tmp)
{
return(runtime_derive_ack_returnaddr_from_neighbours(this, target_bot, bots_tmp));
} // apicall_derive_ack_returnaddr_from_neighbours()


apicall_diagnose_ack_route(bot_id, x, y, z, vx = null, vy = null, vz = null)
{
return(runtime_diagnose_ack_route(this, bot_id, x, y, z, vx, vy, vz));
} // apicall_diagnose_ack_route()


apicall_get_simple_move_library()
{
return([
       "D_F_D",
       "D_R_D",
       "D_B_D",
       "D_L_D",
       "F_TF_D",
       "B_TB_D",
       "L_TL_D",
       "R_TR_D"
       ]);
} // apicall_get_simple_move_library()


apicall_rotate_orientation(vx, vy, vz, direction)
{
return(runtime_rotate_orientation(this, vx, vy, vz, direction));
} // apicall_rotate_orientation()


apicall_get_vk_rotation_direction(old_vx, old_vy, old_vz, new_vx, new_vy, new_vz)
{
return(runtime_get_vk_rotation_direction(old_vx, old_vy, old_vz, new_vx, new_vy, new_vz));
} // apicall_get_vk_rotation_direction()


apicall_rotate_bot(bot_id, direction)
{
return(runtime_rotate_bot(this, bot_id, direction));
} // apicall_rotate_bot()


apicall_execute_rotation_plan(bot_id, rotation_plan, target_orientation = null)
{
return(runtime_execute_rotation_plan(this, bot_id, rotation_plan, target_orientation));
} // apicall_execute_rotation_plan()


apicall_rotate_bot_to(bot_id, x, y, z)
{
return(runtime_rotate_bot_to(this, bot_id, x, y, z));
} // apicall_rotate_bot_to()


apicall_build_stationary_ack_returnaddr(bot_snapshot, target_orientation = null, excluded_bot_ids = [])
{
return(runtime_build_stationary_ack_returnaddr(this, bot_snapshot, target_orientation, excluded_bot_ids));
} // apicall_build_stationary_ack_returnaddr()


apicall_grab_bot(bot_id, slot = null)
{
return(runtime_grab_bot(this, bot_id, slot));
} // apicall_grab_bot()


apicall_release_bot(bot_id)
{
return(runtime_release_bot(this, bot_id));
} // apicall_release_bot()


async apicall_move_payload_to(carrier_bot_id, payload_bot_id, x, y, z, release_after = false)
{
return(await runtime_move_payload_to(this, carrier_bot_id, payload_bot_id, x, y, z, release_after));
} // apicall_move_payload_to()


async apicall_move_carrier_to(carrier_bot_id, x, y, z, vx, vy, vz, release_after = false)
{
return(await runtime_move_carrier_to(this, carrier_bot_id, x, y, z, vx, vy, vz, release_after));
} // apicall_move_carrier_to()


apicall_diagnose_move_carrier_to(carrier_bot_id, x, y, z, vx, vy, vz, release_after = false)
{
return(runtime_diagnose_move_carrier_to(this, carrier_bot_id, x, y, z, vx, vy, vz, release_after));
} // apicall_diagnose_move_carrier_to()


apicall_get_normalized_crater_id(crater_id = "")
{
return(runtime_get_normalized_crater_id(this, crater_id));
} // apicall_get_normalized_crater_id()


apicall_has_running_crater_session()
{
return(runtime_has_running_crater_session(this));
} // apicall_has_running_crater_session()


apicall_ensure_crater_session(crater_id = "")
{
return(runtime_ensure_crater_session(this, crater_id));
} // apicall_ensure_crater_session()


apicall_update_crater_status(patch = {}, crater_id = "")
{
return(runtime_update_crater_status(this, patch, crater_id));
} // apicall_update_crater_status()


apicall_get_crater_status(crater_id = "")
{
return(runtime_get_crater_status(this, crater_id));
} // apicall_get_crater_status()


apicall_list_craters()
{
return(runtime_list_craters(this));
} // apicall_list_craters()


apicall_build_fill_plan_from_crater(crater_id = "")
{
return(runtime_build_fill_plan_from_crater(this, crater_id));
} // apicall_build_fill_plan_from_crater()


async apicall_run_crater_plan(session_id, crater_id, request, plan, run_mode = "dig")
{
return(await runtime_run_crater_plan(this, session_id, crater_id, request, plan, run_mode));
} // apicall_run_crater_plan()


apicall_crater_start(decodedobject = {})
{
return(runtime_crater_start(this, decodedobject));
} // apicall_crater_start()


apicall_crater_fill(crater_id = "", mode = "execute")
{
return(runtime_crater_fill(this, crater_id, mode));
} // apicall_crater_fill()


apicall_calc_crater_stub(decodedobject = {})
{
return(runtime_calc_crater_stub(this, decodedobject));
} // apicall_calc_crater_stub()


apicall_suggest_simple_move(bot_id, x, y, z)
{
return(runtime_suggest_simple_move(this, bot_id, x, y, z));
} // apicall_suggest_simple_move()


apicall_move_bot_to(bot_id, x, y, z, execute_move = true, goal_orientation = null)
{
return(runtime_move_bot_to(this, bot_id, x, y, z, execute_move, goal_orientation));
} // apicall_move_bot_to()


apicall_diagnose_move_bot_to(bot_id, x, y, z, goal_orientation = null)
{
return(runtime_diagnose_move_bot_to(this, bot_id, x, y, z, goal_orientation));
} // apicall_diagnose_move_bot_to()


apicall_build_move_diagnostic_summary(planned_primitives, planned_movecmds_legacy, planned_raw_cmd, path_debug_rejections = [])
{
return(runtime_build_move_diagnostic_summary(this, planned_primitives, planned_movecmds_legacy, planned_raw_cmd, path_debug_rejections));
} // apicall_build_move_diagnostic_summary()


apicall_get_valid_double_primitives()
{
return(runtime_get_valid_double_primitives(this));
} // apicall_get_valid_double_primitives()


apicall_is_valid_double_primitive(slot1, slot2)
{
return(runtime_is_valid_double_primitive(this, slot1, slot2));
} // apicall_is_valid_double_primitive()


apicall_translate_path_to_primitive_paths(path, vx, vy, vz, bots_tmp = null)
{
return(runtime_translate_path_to_primitive_paths(this, path, vx, vy, vz, bots_tmp));
} // apicall_translate_path_to_primitive_paths()


apicall_select_anchor_slot(x, y, z, vx, vy, vz, excluded_slots = [], excluded_bot_ids = [])
{
return(runtime_select_anchor_slot(this, x, y, z, vx, vy, vz, excluded_slots, excluded_bot_ids));
} // apicall_select_anchor_slot()


apicall_collect_anchor_candidates(x, y, z, vx, vy, vz, excluded_slots = [], excluded_bot_ids = [])
{
return(runtime_collect_anchor_candidates(this, x, y, z, vx, vy, vz, excluded_slots, excluded_bot_ids));
} // apicall_collect_anchor_candidates()


apicall_add_anchors_to_primitive_paths(planned_moves, vx, vy, vz, excluded_bot_ids = [])
{
return(runtime_add_anchors_to_primitive_paths(this, planned_moves, vx, vy, vz, excluded_bot_ids));
} // apicall_add_anchors_to_primitive_paths()


apicall_build_raw_move_cmd(address, planned_primitives)
{
return(runtime_build_raw_move_cmd(this, address, planned_primitives));
} // apicall_build_raw_move_cmd()



//
// register_inactive_detected()
//
register_inactive_detected( x, y, z, vx, vy, vz, source_bot_id, source_slot )
{
let target_key = this.getKey_3d(x, y, z);
let size = this.detected_inactive_bots.length;

for (let i=0; i<size; i++)
    {
    let tmpkey = this.getKey_3d(
                               this.detected_inactive_bots[i].x,
                               this.detected_inactive_bots[i].y,
                               this.detected_inactive_bots[i].z
                               );

    if (tmpkey == target_key)
       {
       return(false);
       } // if
    } // for

let inactive_id = "IBOT_" + x + "_" + y + "_" + z;

this.detected_inactive_bots.push(
                                 {
                                 id: inactive_id,
                                 x: x,
                                 y: y,
                                 z: z,
                                 vx: vx,
                                 vy: vy,
                                 vz: vz,
                                 col: "ff6666",
                                 source_bot_id: source_bot_id,
                                 source_slot: source_slot
                                 }
                                );

const events = [];

let notify_msg =
    {
    event: "addinactivebot",
    botid: inactive_id,
    position: { x: Number(x), y: Number(y), z: Number(z) },
    orientation: { x: Number(vx), y: Number(vy), z: Number(vz) },
    color: "ff6666"
    };

events.push( notify_msg );
this.notify_frontend( events );

return(true);
} // register_inactive_detected()



//
// handle_answer (e.g. RINFO-handling)
//
handle_answer( decodedobject )
{
let cmd_parser_class_obj = new cmd_parser_class();
let logging = false;


let cmd_to_decode = decodedobject.jsondata['msgqueue_bc'][0];

 
if (cmd_to_decode == undefined) 
   {
   // nothing to do
   return;
   }
   
   
if (logging) Logger.log("size mbc: " + decodedobject.jsondata['msgqueue_bc'].length );
if (logging) console.log("size mbc: " + decodedobject.jsondata['msgqueue_bc'].length );

let size = decodedobject.jsondata['msgqueue_bc'].length;

if (size > 1)
   {
   if (logging) console.log("DEBUG:");
   if (logging) console.log(decodedobject.jsondata['msgqueue_bc']);
   }

for (let i=0; i<size; i++)
{
cmd_to_decode = decodedobject.jsondata['msgqueue_bc'][i];


let msgarray = cmd_parser_class_obj.parse( cmd_to_decode );
this.append_api_message_log(cmd_to_decode, msgarray);

   

if ( msgarray.cmd == cmd_parser_class_obj.CMD_RINFO )
   {
   if (logging) console.log("RINFO detected");
   
   let bottmpid = msgarray.bottmpid;
   
    
   if (this.scan_waiting_info[bottmpid] === undefined) 
      {
      if (logging) console.log("RINFO ignored: scan_waiting_info entry missing for " + bottmpid);
      } else
        {
        this.scan_waiting_info[bottmpid].status = 1;
        }
   
   
   // Register new detected Cellbot to internals structure...
   let bot_class_mini_obj = new bot_class_mini();
 
   let target_x      = this.scan_waiting_info[bottmpid]['x'];
   let target_y      = this.scan_waiting_info[bottmpid]['y'];
   let target_z      = this.scan_waiting_info[bottmpid]['z'];
   let target_color  = this.scan_waiting_info[bottmpid]['color'];
   let target_stl_id = this.scan_waiting_info[bottmpid]['stl_id'];
   let target_addr   = this.scan_waiting_info[bottmpid].addr;
   
   
   
   
   // Check if CellBot already is registered!   
   let target_bot_index = this.get_3d( target_x, target_y, target_z );
   if (target_bot_index != null)
      {
      //  console.log("ALREADY REGISTERED!!!");
      //  return(0);
      }
   // END - Check
   
   
   
   let target_vectorx,target_vectory,target_vectorz;
   
  

   // Get STL xyz and vx,vy,vz
   let stl_x = 0;
   let stl_y = 0;
   let stl_z = 0;

   let stl_vx = 0;
   let stl_vy = 0;
   let stl_vz = 0;

   // if STL == Masterbot...
   if (target_stl_id == "MB")
      {
      stl_x = this.mb['x'];
      stl_y = this.mb['y'];
      stl_z = this.mb['z'];

      stl_vx = this.mb['vx'];
      stl_vy = this.mb['vy'];
      stl_vz = this.mb['vz'];
      } else
        {
        // other cellbot
        let bi = this.botindex[target_stl_id];
        stl_x = this.bots[bi].x;
        stl_y = this.bots[bi].y;
        stl_z = this.bots[bi].z;

        stl_vx = this.bots[bi].vector_x;
        stl_vy = this.bots[bi].vector_y;
        stl_vz = this.bots[bi].vector_z;       
        }
        
        


   let target_vector;
   
   if (msgarray.sourceslot != 'T' && msgarray.sourceslot != 'D')
      {
   
      let target_vector = this.calc_target_orientation_vector (
                                                         stl_x,
                                                         stl_y,
                                                         stl_z,
                                                         target_x,
                                                         target_y,
                                                         target_z,
                                                         msgarray.sourceslot                  
                                                         );
 
    
    
      target_vectorx = target_vector.vx;
      target_vectory = target_vector.vy;
      target_vectorz = target_vector.vz;
                                                 
      } // if (msgarray.sourceslot != 'T' && msgarray.sourceslot != 'D')                                                   
      else
          {
          // Orientation is delivered by the RINFO-command
          // ...or is this the relative vector?          
    
          let orientation_vector = this.calc_target_orientation_vector_relative(
                                                                          stl_vx,
                                                                          stl_vy,
                                                                          stl_vz,
                                                                          msgarray.vx,
                                                                          msgarray.vy,
                                                                          msgarray.vz
                                                                          ); 
           
          target_vectorx = orientation_vector.vx;
          target_vectory = orientation_vector.vy;
          target_vectorz = orientation_vector.vz;
          }
      

    
 

   // Register new detected cellbot   
   
   if (target_bot_index != null)
      {
      // console.log("ALREADY REGISTERED!!!");
      } else
        {
        // will register
        bot_class_mini_obj.setvalues( msgarray.botid, (msgarray.rid ?? ""), target_x,target_y,target_z,  target_vectorx,target_vectory,target_vectorz,  target_color, target_addr); 
        this.register_bot( bot_class_mini_obj );
   
        this.scanwaitingcounter = 0;
        
        
        // notify new bot to fronend / webgui
        const events = [];
      
        let notify_msg =
            {
            event: "addbot",
            botid: msgarray.botid ,
            position: { x: Number(target_x), y: Number(target_y), z: Number(target_z) },
            orientation: { x: Number(target_vectorx), y: Number(target_vectory), z: Number(target_vectorz) },
            color: undefined,
            adress: undefined
          };

        events.push( notify_msg );
        this.notify_frontend( events );
        
        
          
        } // else
   

   
   } // CMD_RINFO
   
   
if ( msgarray.cmd == cmd_parser_class_obj.CMD_RALIFE )
   {
   // console.log("RALIFE");
   // Logger.log("RALIFE " + msgarray.botid + " - " + msgarray.bottmpid);
 


   if ( this.signal_botids && this.signal_botids[ msgarray.bottmpid ] !== undefined )
      {
      // console.log("Signal found !");
      
              
      const events = [];
      

      let notify_msg =
          {
          event: "move",
          botid: this.signal_botids[ msgarray.bottmpid ].thebotid ,
          to: this.signal_botids[ msgarray.bottmpid ].to
          };

      events.push( notify_msg );




      this.notify_frontend( events );
    

      //
      // Update Bot-Position
      //
      let tmpbotid = this.get_bot_by_id( this.signal_botids[ msgarray.bottmpid ].thebotid, this.bots );
      
      let oldx = this.bots[tmpbotid].x;
      let oldy = this.bots[tmpbotid].y;
      let oldz = this.bots[tmpbotid].z;
      
      let new_x = this.signal_botids[ msgarray.bottmpid ].to.x;
      let new_y = this.signal_botids[ msgarray.bottmpid ].to.y;
      let new_z = this.signal_botids[ msgarray.bottmpid ].to.z;
 
      this.update_keyindex( oldx, oldy, oldz, new_x, new_y, new_z );  
      this.bots[tmpbotid].x = new_x;
      this.bots[tmpbotid].y = new_y;
      this.bots[tmpbotid].z = new_z;
      
      // In vehicle_kinematics mode, also update orientation (vx/vy/vz) from signal_botids
      // if the orientation was stored in create_opcode_sequence().
      let signal_to = this.signal_botids[ msgarray.bottmpid ].to;
      if (signal_to && signal_to.vx !== undefined)
         {
         this.bots[tmpbotid].vector_x = Number(signal_to.vx);
         this.bots[tmpbotid].vector_y = Number(signal_to.vy);
         this.bots[tmpbotid].vector_z = Number(signal_to.vz);
         }

      this.bots[tmpbotid].adress = this.get_mb_returnaddr( {x:this.mb.x, y:this.mb.y, z:this.mb.z }, {x:new_x, y:new_y, z:new_z }, this.bots );

      let recycle_ret = this.apicall_recycle_bot_if_in_servicebay(
                                                                   this.signal_botids[ msgarray.bottmpid ].thebotid,
                                                                   "signal_move"
                                                                   );
      this.append_api_bot_history(
                                 this.signal_botids[ msgarray.bottmpid ].thebotid,
                                 "servicebay_autorecycle",
                                 {
                                 ack_id: msgarray.bottmpid,
                                 source: "signal_move"
                                 },
                                 recycle_ret
                                 );

      let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                               this.signal_botids[ msgarray.bottmpid ].thebotid,
                                                                               (recycle_ret?.recycled === true ? "servicebay_recycle" : "signal_move")
                                                                               );
      this.append_api_bot_history(
                                 this.signal_botids[ msgarray.bottmpid ].thebotid,
                                 "safe_mode_after_change",
                                 {
                                 ack_id: msgarray.bottmpid,
                                 change_type: "signal_move"
                                 },
                                 {
                                 ok: Boolean(safe_mode_after_ret?.ok),
                                 answer: safe_mode_after_ret?.answer ?? "",
                                 recalibrated: Boolean(safe_mode_after_ret?.recalibrated),
                                 safe_mode: Number(safe_mode_after_ret?.safe_mode ?? this.safe_mode)
                                 }
                                 );


         
      }
      else
         {
         let api_ack_entry = this.apicall_get_ack(msgarray.bottmpid);

         if (api_ack_entry)
            {
            const events = [];
            let ack_applied = false;

            let tmpbotid = this.get_bot_by_id( api_ack_entry.bot_id, this.bots );

            if (tmpbotid != null)
               {
               let oldx = this.bots[tmpbotid].x;
               let oldy = this.bots[tmpbotid].y;
               let oldz = this.bots[tmpbotid].z;
               let old_vx = this.bots[tmpbotid].vector_x;
               let old_vy = this.bots[tmpbotid].vector_y;
               let old_vz = this.bots[tmpbotid].vector_z;

               if (api_ack_entry.mode == "spin" && api_ack_entry.orientation)
                  {
                  let notify_msg =
                      {
                      event: "spin",
                      botid: api_ack_entry.bot_id,
                      from: {
                            x: Number(oldx),
                            y: Number(oldy),
                            z: Number(oldz),
                            vx: Number(old_vx),
                            vy: Number(old_vy),
                            vz: Number(old_vz)
                            },
                      to: {
                          x: Number(oldx),
                          y: Number(oldy),
                          z: Number(oldz),
                          vx: Number(api_ack_entry.orientation.x),
                          vy: Number(api_ack_entry.orientation.y),
                          vz: Number(api_ack_entry.orientation.z)
                          },
                      parent: "",
                      duration: 0,
                      ts: Number(new Date().getTime())
                      };

                  events.push( notify_msg );
                  this.notify_frontend( events );

                  this.bots[tmpbotid].vector_x = Number(api_ack_entry.orientation.x);
                  this.bots[tmpbotid].vector_y = Number(api_ack_entry.orientation.y);
                  this.bots[tmpbotid].vector_z = Number(api_ack_entry.orientation.z);

                  let payload_sync_applied = this.apicall_sync_payload_from_carrier(
                                                                            api_ack_entry.bot_id,
                                                                            {
                                                                            x: Number(oldx),
                                                                            y: Number(oldy),
                                                                            z: Number(oldz)
                                                                            },
                                                                            {
                                                                            x: Number(api_ack_entry.orientation.x),
                                                                            y: Number(api_ack_entry.orientation.y),
                                                                            z: Number(api_ack_entry.orientation.z)
                                                                            },
                                                                            this.apicall_get_rotation_plan_between_orientations(
                                                                                                                                  {
                                                                                                                                  x: Number(old_vx),
                                                                                                                                  y: Number(old_vy),
                                                                                                                                  z: Number(old_vz)
                                                                                                                                  },
                                                                                                                                  {
                                                                                                                                  x: Number(api_ack_entry.orientation.x),
                                                                                                                                  y: Number(api_ack_entry.orientation.y),
                                                                                                                                  z: Number(api_ack_entry.orientation.z)
                                                                                                                                  }
                                                                                                                                  )
                                                                            );

                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "payload_sync_debug",
                                             {
                                             ack_id: msgarray.bottmpid,
                                             stage: "spin_ack_hook"
                                             },
                                             {
                                             ok: Boolean(payload_sync_applied),
                                             answer: "api_payload_sync_spin_hook",
                                             payload_sync_applied: Boolean(payload_sync_applied)
                                             }
                                             );

                  let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                                           api_ack_entry.bot_id,
                                                                                           "spin"
                                                                                           );
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "safe_mode_after_change",
                                             {
                                             ack_id: msgarray.bottmpid,
                                             change_type: "spin"
                                             },
                                             {
                                             ok: Boolean(safe_mode_after_ret?.ok),
                                             answer: safe_mode_after_ret?.answer ?? "",
                                             recalibrated: Boolean(safe_mode_after_ret?.recalibrated),
                                             safe_mode: Number(safe_mode_after_ret?.safe_mode ?? this.safe_mode)
                                             }
                                             );

                  this.apicall_mark_ack_received(msgarray.bottmpid, "ack");
                  ack_applied = true;
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "api_ack",
                                             { ack_id: msgarray.bottmpid },
                                             {
                                             ok: true,
                                             answer: "api_ack_applied",
                                             orientation: api_ack_entry.orientation
                                             }
                                             );
                  } // if
               else if (api_ack_entry.mode == "move" && api_ack_entry.to)
                  {
                  let notify_msg =
                      {
                      event: "move",
                      botid: api_ack_entry.bot_id,
                      to: api_ack_entry.to
                      };

                  events.push( notify_msg );
                  this.notify_frontend( events );

               let oldx = this.bots[tmpbotid].x;
               let oldy = this.bots[tmpbotid].y;
               let oldz = this.bots[tmpbotid].z;

               // Save old carrier orientation before it gets overwritten below
               let carrier_old_orientation = {
                                               x: Number(this.bots[tmpbotid].vector_x),
                                               y: Number(this.bots[tmpbotid].vector_y),
                                               z: Number(this.bots[tmpbotid].vector_z)
                                               };

               let new_x = Number(api_ack_entry.to.x);
               let new_y = Number(api_ack_entry.to.y);
               let new_z = Number(api_ack_entry.to.z);

               this.update_keyindex( oldx, oldy, oldz, new_x, new_y, new_z );
               this.bots[tmpbotid].x = new_x;
               this.bots[tmpbotid].y = new_y;
               this.bots[tmpbotid].z = new_z;

               // Bug B fix: set orientation from api_ack_entry.orientation when available
               if (api_ack_entry.orientation)
                  {
                  if (api_ack_entry.orientation.vx !== undefined)
                     {
                     this.bots[tmpbotid].vector_x = Number(api_ack_entry.orientation.vx);
                     }
                  if (api_ack_entry.orientation.vy !== undefined)
                     {
                     this.bots[tmpbotid].vector_y = Number(api_ack_entry.orientation.vy);
                     }
                  if (api_ack_entry.orientation.vz !== undefined)
                     {
                     this.bots[tmpbotid].vector_z = Number(api_ack_entry.orientation.vz);
                     }
                  }

               this.bots[tmpbotid].adress = this.get_mb_returnaddr(
                                                                  {x:this.mb.x, y:this.mb.y, z:this.mb.z },
                                                                  {x:new_x, y:new_y, z:new_z },
                                                                  this.bots
                                                                  );

               let recycle_ret = this.apicall_recycle_bot_if_in_servicebay(
                                                                            api_ack_entry.bot_id,
                                                                            "api_move_ack"
                                                                            );
               this.append_api_bot_history(
                                          api_ack_entry.bot_id,
                                          "servicebay_autorecycle",
                                          {
                                          ack_id: msgarray.bottmpid,
                                          source: "api_move_ack"
                                          },
                                          recycle_ret
                                          );

               if (api_ack_entry.mode == "move" && recycle_ret?.recycled !== true)
                  {
                  let payload_sync_applied = this.apicall_sync_payload_from_carrier(
                                                                                api_ack_entry.bot_id,
                                                                                {
                                                                                x: Number(new_x),
                                                                                y: Number(new_y),
                                                                                z: Number(new_z)
                                                                                },
                                                                                {
                                                                                x: Number(this.bots[tmpbotid].vector_x),
                                                                                y: Number(this.bots[tmpbotid].vector_y),
                                                                                z: Number(this.bots[tmpbotid].vector_z)
                                                                                },
                                                                                carrier_old_orientation
                                                                                );

                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "payload_sync_debug",
                                             {
                                             ack_id: msgarray.bottmpid,
                                             stage: "move_ack_hook"
                                             },
                                             {
                                             ok: Boolean(payload_sync_applied),
                                             answer: "api_payload_sync_move_hook",
                                             payload_sync_applied: Boolean(payload_sync_applied)
                                             }
                                             );
                  } // if

               let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                                        api_ack_entry.bot_id,
                                                                                        (recycle_ret?.recycled === true ? "servicebay_recycle" : "move")
                                                                                        );
               this.append_api_bot_history(
                                          api_ack_entry.bot_id,
                                          "safe_mode_after_change",
                                          {
                                          ack_id: msgarray.bottmpid,
                                          change_type: "move"
                                          },
                                          {
                                          ok: Boolean(safe_mode_after_ret?.ok),
                                          answer: safe_mode_after_ret?.answer ?? "",
                                          recalibrated: Boolean(safe_mode_after_ret?.recalibrated),
                                          safe_mode: Number(safe_mode_after_ret?.safe_mode ?? this.safe_mode)
                                          }
                                          );

               this.apicall_mark_ack_received(msgarray.bottmpid, "ack");
               ack_applied = true;
               this.append_api_bot_history(
                                          api_ack_entry.bot_id,
                                          "api_ack",
                                          { ack_id: msgarray.bottmpid },
                                          { ok: true, answer: "api_ack_applied", to: api_ack_entry.to }
                                          );
                  } // else if

                if (api_ack_entry.mode == "grab")
                   {
                   if (api_ack_entry.payload_bot_id)
                      {
                      let grab_slot = String(api_ack_entry?.slot ?? "").trim().toUpperCase();
                      if (grab_slot == "")
                         {
                         grab_slot = "F";
                         } // if
                      // console.log("[DEBUG] handle_answer GRAB mode bot_id=" + api_ack_entry.bot_id + " payload=" + api_ack_entry.payload_bot_id + " grab_slot=" + grab_slot + " ack_id=" + msgarray.bottmpid);
                      this.apicall_register_payload_link(
                                                        api_ack_entry.bot_id,
                                                        api_ack_entry.payload_bot_id,
                                                        grab_slot,
                                                        true
                                                        );
                      } // if


                  let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                                           api_ack_entry.bot_id,
                                                                                           "grab"
                                                                                           );
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "safe_mode_after_change",
                                             {
                                             ack_id: msgarray.bottmpid,
                                             change_type: "grab"
                                             },
                                             {
                                             ok: Boolean(safe_mode_after_ret?.ok),
                                             answer: safe_mode_after_ret?.answer ?? "",
                                             recalibrated: Boolean(safe_mode_after_ret?.recalibrated),
                                             safe_mode: Number(safe_mode_after_ret?.safe_mode ?? this.safe_mode)
                                             }
                                             );

                  this.apicall_mark_ack_received(msgarray.bottmpid, "ack");
                  ack_applied = true;
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "api_ack",
                                             { ack_id: msgarray.bottmpid },
                                             {
                                             ok: true,
                                             answer: "api_ack_applied",
                                             payload_bot_id: api_ack_entry.payload_bot_id ?? null,
                                             mode: "grab"
                                             }
                                             );
                  } // if

               if (api_ack_entry.mode == "release")
                  {
                  let release_payload_bot_id = String(api_ack_entry.payload_bot_id ?? "").trim();
                  let release_recycle_ret = {
                                            ok: true,
                                            answer: "api_servicebay_autorecycle",
                                            recycled: false,
                                            reason: "NO_PAYLOAD_LINKED"
                                            };

                  if (release_payload_bot_id != "")
                     {
                     release_recycle_ret = this.apicall_recycle_bot_if_in_servicebay(
                                                                              release_payload_bot_id,
                                                                              "release_ack_payload"
                                                                              );

                     if (release_recycle_ret?.recycled !== true)
                        {
                        this.apicall_clear_pending_servicebay_recycle(release_payload_bot_id);
                        } // if

                     this.append_api_bot_history(
                                                release_payload_bot_id,
                                                "servicebay_autorecycle",
                                                {
                                                ack_id: msgarray.bottmpid,
                                                source: "release_ack_payload",
                                                carrier_bot_id: api_ack_entry.bot_id
                                                },
                                                release_recycle_ret
                                                );
                     } // if

                  this.apicall_clear_payload_link(api_ack_entry.bot_id);

                  let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                                           api_ack_entry.bot_id,
                                                                                           (release_recycle_ret?.recycled === true ? "release_servicebay_recycle" : "release")
                                                                                           );
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "safe_mode_after_change",
                                             {
                                             ack_id: msgarray.bottmpid,
                                             change_type: "release"
                                             },
                                             {
                                             ok: Boolean(safe_mode_after_ret?.ok),
                                             answer: safe_mode_after_ret?.answer ?? "",
                                             recalibrated: Boolean(safe_mode_after_ret?.recalibrated),
                                             safe_mode: Number(safe_mode_after_ret?.safe_mode ?? this.safe_mode)
                                             }
                                             );

                  this.apicall_mark_ack_received(msgarray.bottmpid, "ack");
                  ack_applied = true;
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "api_ack",
                                             { ack_id: msgarray.bottmpid },
                                             {
                                             ok: true,
                                             answer: "api_ack_applied",
                                             payload_bot_id: api_ack_entry.payload_bot_id ?? null,
                                             mode: "release",
                                             release_recycle_result: release_recycle_ret
                                             }
                                             );
                  } // if

               if (ack_applied === true)
                  {
                  this.apicall_gui_refresh();
                  } // if
               } // if
            } else
              {
              console.log("Signal is undefined!");
              } // else
         }
 
 
   
   
   
   // submit signal
   this.self_assembly_obj.addsignal ( this, msgarray.bottmpid );
   
   } // CMD_RALIFE  


if ( msgarray.cmd == cmd_parser_class_obj.CMD_RCHECK )
   {
   if (this.scan_waiting_check[msgarray.botid] !== undefined)
      {
      this.scan_waiting_check[msgarray.botid].status = 1;
      } // if

   if (msgarray.status_mode == "compact")
      {
      let scanbot_index = this.get_bot_by_id( msgarray.botid, this.bots );
      const slotnames_lvl2 = ['F','R','B','L','T','D'];

      if (scanbot_index != null)
         {
         for (let i=0; i<slotnames_lvl2.length; i++)
             {
             let slotname = slotnames_lvl2[i];
             let statuschar = msgarray.status[i];

             if (statuschar == 'b')
                {
                let target_xyz = this.get_next_target_coor(
                                                        this.bots[scanbot_index].x,
                                                        this.bots[scanbot_index].y,
                                                        this.bots[scanbot_index].z,
                                                        this.bots[scanbot_index].vector_x,
                                                        this.bots[scanbot_index].vector_y,
                                                        this.bots[scanbot_index].vector_z,
                                                        slotname
                                                        );

                this.register_inactive_detected(
                                              target_xyz.x,
                                              target_xyz.y,
                                              target_xyz.z,
                                              this.bots[scanbot_index].vector_x,
                                              this.bots[scanbot_index].vector_y,
                                              this.bots[scanbot_index].vector_z,
                                              msgarray.botid,
                                              slotname
                                              );
                } // if
             } // for
         } // if
      } // if compact
   } // CMD_RCHECK

if ( msgarray.cmd == cmd_parser_class_obj.CMD_RNBH )
   {
   let rnbh_bot_id = String(msgarray.botid ?? "").trim();
   let nbh_neighbors = msgarray.nbh_neighbors ?? {};

   if (rnbh_bot_id != "")
      {
      this.scan_radio_completed_ids[rnbh_bot_id] = true;
      this.scan_radio_neighbors_by_bot[rnbh_bot_id] = nbh_neighbors;

      if (this.scan_waiting_radio[rnbh_bot_id] === undefined)
         {
         this.scan_waiting_radio[rnbh_bot_id] = {
                                                bot_id: rnbh_bot_id,
                                                rid: this.get_direct_radio_rid_by_id(rnbh_bot_id),
                                                status: 1,
                                                requested_ts: Number(new Date().getTime())
                                                };
         } // if

      this.scan_waiting_radio[rnbh_bot_id].status = 1;
      this.scan_waiting_radio[rnbh_bot_id].received_ts = Number(new Date().getTime());
      } // if

   if (this.scan_status_radio == 1)
      {
      if (this.scan_radio_mode == "full")
         {
         this.scan_radio_register_seed_from_rnbh(msgarray);
         this.scan_radio_register_or_update_bot_from_rnbh(msgarray);
         this.scan_radio_enqueue_neighbor_ids(rnbh_bot_id, nbh_neighbors);
         } // if
      else
         {
         this.scan_radio_register_or_update_bot_from_rnbh(msgarray);
         } // else
      this.scanwaitingcounter_radio = 0;
      } // if
   } // CMD_RNBH

   
 if ( msgarray.cmd == "XRRC" )
   {
   console.log("XRRC");
   console.log(msgarray);
   
   let colorarray = msgarray.raw.split(';');
      
   const events = [];
   let notify_msg =
          {
          event: "setcolor",
          botid: colorarray[0],
          color: colorarray[1]
          };

   events.push( notify_msg );

   this.notify_frontend( events );
        
   } // XRRC
 
} // for i...
 

} // handle_answer( decodedobject )



 
 


//
// scan_Step - Single scan-step
//
scan_step()
{
const slotnames = ['f','r','b','l','t','d'];

 

// First Masterbot scan
if (this.masterbot_first_scan == 1)
   {
  
   
   let cmd_slot =  this.mb['connection'].toUpperCase();
 
   let retaddr = "S";
   
   let cmd = cmd_slot + "#INFO#" + this.tmpid_cnt + "#" + retaddr;
 
   // Must remember tmpid and address (!) for later assignment in case of an RINFO answer.    
   let targetcoor = this.get_next_target_coor( this.mb['x'],this.mb['y'], this.mb['z'],  this.mb['vx'], this.mb['vy'], this.mb['vz'],  cmd_slot );
   
   
   let stl_id = "MB"; // stl = second to last (not Standard Template Library, sorry C++)

   
   this.scan_waiting_info[this.tmpid_cnt] = {                         
                           tmpid: this.tmpid_cnt,
                           addr: cmd_slot,
                           status: 0,
                           x: targetcoor.x,
                           y: targetcoor.y,
                           z: targetcoor.z,
                           stl_id: stl_id,
                           };
  
  
   cmd = this.sign( cmd );  
   
   let mb_cmd = "{ \"cmd\":\"push\", \"param\":\""+cmd+"\" }\n";                                         
   this.client.write(mb_cmd);
                   
    
   // increment scan_waiting_info cellbot-ID
   this.tmpid_cnt++;
   
   this.masterbot_first_scan = 0;   
   } // if (masterbot_first_scan == 1)
   

        
        
        let l = this.bots.length;
                      
        // Search all cubes with checked == 0        
        for (let i=0; i<l; i++)
            {
            
            if ( this.bots[i].checked == 0 )
               {               
               let l2 = slotnames.length;
               
               
               // iterate all slots
               for (let i2=0; i2 < l2; i2++)
                   {
                   let sl = slotnames[i2];
                   
                   // If unchecked slot
                   if (this.bots[i].checked_neighbors[ sl ] != 1)
                      {
                      
                      // Check if coordinate already is known
                      let target_xyz = this.get_neighbor_by_slot( i, sl);
                                            
                   
                      let target_bot_index = this.get_3d(target_xyz.x, target_xyz.y, target_xyz.z);
                       
                       

                      let found_mb = 0; 
                      // Is coordinate of Masterbot? 
                         {
                         if (
                            target_xyz.x == this.mb['x'] &&
                            target_xyz.y == this.mb['y'] &&
                            target_xyz.z == this.mb['z'] 
                            ) found_mb = 1;
                         }                       
                      
                      
                      // END coordinate - check

                      if (target_bot_index == null)
                         {
                         
                         //
                         // Prepare INFO-command and send message
                         //                      
                         let cmd_slot = sl.toUpperCase();
                         
                         let new_addr = this.bots[i].adress + cmd_slot;
                         
                         // prepare return address
                         let firstindex = this.getKey_3d(this.mb.x, this.mb.y, this.mb.z);

                         let retaddr = this.get_inverse_address(firstindex,new_addr); 
   
                         let cmd = new_addr + "#INFO#" + this.tmpid_cnt + "#" + retaddr;
                      
                         // Must remember tmpid and address (!) for later assignment in case of an RINFO answer.
                         let targetcoor = this.get_next_target_coor( this.bots[i].x, this.bots[i].y, this.bots[i].z,  this.bots[i].vector_x, this.bots[i].vector_y, this.bots[i].vector_z,  cmd_slot );
                         
                         let stl_id = this.getKey_3d( this.bots[i].x, this.bots[i].y, this.bots[i].z ); // stl = second to last (not Standard Template Library, sorry C++)

   
       
                         this.scan_waiting_info[this.tmpid_cnt] = {                         
                                                        tmpid: this.tmpid_cnt,
                                                        addr: new_addr,
                                                        status: 0,
                                                        x: targetcoor.x,
                                                        y: targetcoor.y,
                                                        z: targetcoor.z,
                                                        stl_id: stl_id,
                                                        };
  
        
                         cmd = this.sign( cmd );  
   
                         let cellbot_cmd = "{ \"cmd\":\"push\", \"param\":\""+cmd+"\" }\n";                                         

                         this.client.write(cellbot_cmd);
                   
                         // Logger.log("Request cell: " + cmd);

    
                         // Mark as sent                      
                         this.bots[i].checked_neighbors[ sl ] = 1;
                    
                         // increment scan_waiting_info cellbot-ID
                         this.tmpid_cnt++;
   
                         } // if (target_bot_index == null && found_mb == 0)
                  
                      
                   
                      
                      } // if unchecked slot---
                      
 
                   } // for i2...
               
               this.bots[i].checked = 1;
               
               } // if ( bots[i].checked == 0 )
            
            } // for i..

     
        
     
     
        this.scanwaitingcounter++;
        
        if (this.scanwaitingcounter > this.max_scanwaitingcounter)
           {
           this.scan_status          = 0;
           this.masterbot_first_scan = 1;
           this.scanwaitingcounter   = 0;
           // console.log("NO MORE ANSWER - FINISH SCAN!");
           
           //
           this.bots_jsonexport("logs/botexport.json");
           }     
     
 
} // function scan_step()



//
// scan_step_lvl2()
//
scan_step_lvl2()
{
const communication_mode = String(this.config.communication_mode ?? "mesh_opcode").trim().toLowerCase();

if (this.scan_targets_lvl2_index < this.scan_targets_lvl2.length)
   {
   let target_bot_id = this.scan_targets_lvl2[this.scan_targets_lvl2_index];
   let target_bot_index = this.get_bot_by_id( target_bot_id, this.bots );

   if (target_bot_index != null)
      {
      let firstindex = this.getKey_3d(this.mb['x'], this.mb['y'], this.mb['z']);
      let target_addr = String(this.bots[target_bot_index].adress ?? "").trim();
      let retaddr = this.get_inverse_address(firstindex, target_addr);

      if (communication_mode == "direct_radio")
         {
         target_addr = String(this.get_direct_radio_rid_by_id(target_bot_id) ?? "").trim();
         retaddr = String(this.get_direct_radio_master_rid() ?? "").trim();
         } // if

      if (target_addr == "")
         {
         this.scan_waiting_check[target_bot_id] = {
                                                   botid: target_bot_id,
                                                   status: 1,
                                                   addr: "",
                                                   error: "TARGET_ADDRESS_MISSING"
                                                   };
         this.scan_targets_lvl2_index++;
         this.scanwaitingcounter_lvl2 = 0;
         return;
         } // if

      let cmd = target_addr + "#CHECK#.#" + retaddr;

      this.scan_waiting_check[target_bot_id] = {
                                                botid: target_bot_id,
                                                status: 0,
                                                addr: target_addr
                                                };

      cmd = this.sign( cmd );

      let cellbot_cmd = "{ \"cmd\":\"push\", \"param\":\""+cmd+"\" }\n";
      this.client.write(cellbot_cmd);
      } // if

   this.scan_targets_lvl2_index++;
   this.scanwaitingcounter_lvl2 = 0;
   return;
   } // if


this.scanwaitingcounter_lvl2++;

if (this.scanwaitingcounter_lvl2 > this.max_scanwaitingcounter)
   {
   this.scan_status_lvl2 = 0;
   this.scanwaitingcounter_lvl2 = 0;
   this.notify_frontend_console("Scan Level 2 complete");
   } // if
} // scan_step_lvl2()


//
// scan_step_radio()
//
scan_step_radio()
{
this.scanwaitingcounter_radio++;

if (this.scan_radio_pending_ids.length > 0)
   {
   let next_bot_id = String(this.scan_radio_pending_ids.shift() ?? "").trim();

   if (next_bot_id != "")
      {
      this.scan_radio_dispatch_nbh_by_id(next_bot_id);
      } // if
   } // if

const waiting_ids = Object.keys(this.scan_waiting_radio);
let open_waiting = 0;

for (let i = 0; i < waiting_ids.length; i++)
    {
    if (Number(this.scan_waiting_radio[waiting_ids[i]]?.status ?? 0) == 0)
       {
       open_waiting++;
       } // if
    } // for

if (
   this.scan_radio_pending_ids.length == 0 &&
   open_waiting == 0 &&
   (
    this.scan_radio_mode == "search" ||
    this.scan_radio_seed_registered === true
   )
   )
   {
   this.scan_status_radio = 0;
   this.scanwaitingcounter_radio = 0;
   if (this.scan_radio_mode == "search")
      {
      this.notify_frontend_console("Search Bot Radio complete");
      this.apicall_gui_refresh();
      } // if
   else
      {
      this.notify_frontend_console("Scan Radio complete");
      } // else
   } // if

if (this.scanwaitingcounter_radio > this.max_scanwaitingcounter)
   {
   this.scan_status_radio = 0;
   this.scanwaitingcounter_radio = 0;
   if (this.scan_radio_mode == "search")
      {
      this.notify_frontend_console("Search Bot Radio timeout");
      this.apicall_gui_refresh();
      } // if
   else
      {
      this.notify_frontend_console("Scan Radio timeout");
      } // else
   } // if
} // scan_step_radio()




 
 



//
// bots_jsonexport
// Export of bots for test purposes
//
bots_jsonexport( outfile )
{
 
 
fs.writeFile(outfile, JSON.stringify( this.bots, null, 2), (err) => {
  if (err) {
    console.error("Export-json error:", err);
  } else {
    console.log("Export-json successful.");
  }
});

    
} //  bots_jsonexport()









//
// get_neighbor_by_slot()
// in:  botindex, slot
// out: vector of target-cellbot
//
get_neighbor_by_slot( botindex, slot )
{
 
let x = this.bots[botindex].x;
let y = this.bots[botindex].y;
let z = this.bots[botindex].z;

let vector_x = this.bots[botindex].vector_x;
let vector_y = this.bots[botindex].vector_y;
let vector_z = this.bots[botindex].vector_z;

let vx,vy,vz;

if (vector_x ==  1 && vector_y ==  0 && vector_z ==  0)
   {
   if (slot == 'f') {vx =  1; vy =  0; vz =  0; };
   if (slot == 'r') {vx =  0; vy =  0; vz = -1; };
   if (slot == 'b') {vx = -1; vy =  0; vz =  0; };
   if (slot == 'l') {vx =  0; vy =  0; vz =  1; };
   }

if (vector_x ==  0 && vector_y ==  0 && vector_z == -1)
   {
   if (slot == 'f') {vx =  0; vy =  0; vz = -1; };
   if (slot == 'r') {vx = -1; vy =  0; vz =  0; };
   if (slot == 'b') {vx =  0; vy =  0; vz =  1; };
   if (slot == 'l') {vx =  1; vy =  0; vz =  0; };
   }

if (vector_x == -1 && vector_y ==  0 && vector_z ==  0)
   {
   if (slot == 'f') {vx = -1; vy =  0; vz =  0; };
   if (slot == 'r') {vx =  0; vy =  0; vz =  1; };
   if (slot == 'b') {vx =  1; vy =  0; vz =  0; };
   if (slot == 'l') {vx =  0; vy =  0; vz = -1; };
   }

if (vector_x ==  0 && vector_y ==  0 && vector_z ==  1)
   {
   if (slot == 'f') {vx =  0; vy =  0; vz =  1; };
   if (slot == 'r') {vx =  1; vy =  0; vz =  0; };
   if (slot == 'b') {vx =  0; vy =  0; vz = -1; };
   if (slot == 'l') {vx = -1; vy =  0; vz =  0; };
   }
   
// Top   
if (slot == 't') {vx =  0; vy =  1; vz =  0; };

// Down   
if (slot == 'd') {vx =  0; vy = -1; vz =  0; };
   
   

x = x + vx;
y = y + vy;
z = z + vz;


return { x: x, y: y, z: z };
} // get_neighbor_by_slot







//
// get_next_target_coor - helper function, returns coordinate depending from
//                        the orientation of sending Cellbot
//
get_next_target_coor( sx, sy, sz, vx,vy,vz, slot )
{
let rx = 0;
let ry = 0;
let rz = 0;

let relation_vector = this.get_cell_relation_vector_byslot(slot,vx,vy,vz)


rx = Number(sx) +  Number(relation_vector.x);
ry = Number(sy) +  Number(relation_vector.y);
rz = Number(sz) +  Number(relation_vector.z);

 
return { x: rx, y: ry, z: rz };
} // get_next_target_coor




 
 
 
 
 
 
// 
// Thread BotController communication 
//
async thread_botcontroller() {
let cmd = "";

const delayms = 100;
const slotnames = ['f','r','b','l','t','d']; 
  
  setInterval(() => 
  {

  
  if (this.MASTERBOT_CONNECTED)
     {
     
     if (1)
     {
           

     if (this.scan_status == 1)
        {
        
        this.scan_step();
        
        
        
        // Pop...
        let param = "";              
        let cmd_pop = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";
                    
        this.client.write(cmd_pop);
                
        } /// if (scan_status == 1)


     if (this.scan_status_lvl2 == 1)
        {
        this.scan_step_lvl2();

        let param = "";
        let cmd_pop = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";

        this.client.write(cmd_pop);
        } /// if (scan_status_lvl2 == 1)

     if (this.scan_status_radio == 1)
        {
        this.scan_step_radio();

        let param = "";
        let cmd_pop = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";

        this.client.write(cmd_pop);
        } /// if (scan_status_radio == 1)

     
     
     if ( this.self_assembly_obj.assembly_status == 1 )
        {        
        
        let nextcmd = this.self_assembly_obj.pop_cmd();

 
        if (nextcmd != undefined)
           {
            
            
           nextcmd = this.sign( nextcmd );            
              
           cmd = "{ \"cmd\":\"push\", \"param\":\""+nextcmd+"\" }\n";
              
           console.log("thread_botcontroller cmd: " + cmd);
       
           this.client.write(cmd);
           
           
           } // if nextcmd != undefined...
           else           
               {
                
               }
        
        // Pop...
        let param = "";              
        let cmd_pop = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";
                    
        this.client.write(cmd_pop);
        
        } // if (assembly_status == 1)
    
        
     this.threadcounter++;         
     } // if (0)    
         
     } // if (MASTERBOT_CONNECTED)

  }, delayms);
 
} // thread_botcontroller()
 
 

attachGUIWebSocket(ws_gui) {
    this.ws_gui = ws_gui;

    ws_gui.on('message', (message) => {
        this.handleGUIMessage(message);
    });
} // attachGUIWebSocket


start_api_service() {
    if (this.api_service === undefined) {
        return this.start_api_service_internal();
    } // if

    return this.api_service.start_api_service();
} // start_api_service()


start_api_service_internal() {
    if (this.ENABLE_API != "true") {
        console.log("[BotController API] API disabled by config.");
        return;
    } // if

    if (!this.API_PORT || Number.isNaN(this.API_PORT)) {
        console.log("[BotController API] No valid api_port configured.");
        return;
    } // if

    this.api_server = net.createServer((socket) => {
        let buffer = "";

        socket.on('data', async (data) => {
            buffer += data.toString();
            const messages = buffer.split("\n");
            buffer = messages.pop();

            for (let i = 0; i < messages.length; i++) {
                const message = messages[i].trim();
                if (!message) {
                    continue;
                } // if

                await this.handleAPIMessage_internal(message, socket);
            } // for
        });

        socket.on('error', (err) => {
            console.error("[BotController API] Socket error:", err.message);
        });
    });

    this.api_server.listen(this.API_PORT, () => {
        console.log(`[BotController API] listening on port ${this.API_PORT}`);
    });

    this.api_server.on('error', (err) => {
        console.error("[BotController API] Server error:", err.message);
    });
} // start_api_service_internal()


handleGUIMessage(message) {

    if (!this.counter) this.counter = 0;
    let answer = null;

    try {
        const decodedobject = JSON.parse(message);

        //
        // STATUS
        //
        if (decodedobject.cmd === 'status') {
            answer = JSON.stringify({
                answer: "answer_status",
                masterbot_name: this.masterbot_name
            });
            this.ws_gui.send(answer);
            return;
        }


        //
        // GETCLUSTERDATA
        //
        if (decodedobject.cmd === 'getclusterdata') {

            let jsondata = this.getclusterdata_json();

            try {
                let jsonObject = JSON.parse(jsondata);
                answer = JSON.stringify({
                    answer: "answer_getclusterdata",
                    jsondata: jsonObject,
                    structure_roles: this.structure_roles
                });

                this.ws_gui.send(answer);

            } catch (error) {
                console.error("Fehler beim Parsen von clusterdata:", error);
            }

            return;
        }


        //
        // GUI COMMAND (PUSH zum Masterbot)
        //
        if (decodedobject.cmd === 'gui_command') {

            console.log("gui_command:", decodedobject.value);

            let param = this.sign(decodedobject.value);
            let cmd = JSON.stringify({ cmd: "push", param }) + "\n";

            this.client.write(cmd);
            return;
        }


        //
        // VERSION
        //
        if (decodedobject.cmd === 'version') {

            answer = JSON.stringify({
                answer: "answer_version",
                version: this.version
            });

            this.ws_gui.send(answer);
            console.log("VERSION...");
            return;
        }


        //
        // STRUCTURESCAN
        //
        if (decodedobject.cmd === 'structurescan') {
            this.start_scan(1);
            return;
        }
        
        
        //
        // STRUCTURESCAN Level 2
        //
        if (decodedobject.cmd === 'structurescan_lvl2') {
            this.start_scan_lvl2(1);
            return;
        }

        //
        // STRUCTURESCAN Radio
        //
        if (decodedobject.cmd === 'structurescan_radio') {
            this.start_scan_radio(1);
            return;
        }


        //
        // PREPARE MORPH
        //
        if (decodedobject.cmd === 'preparemorph') {
            console.log("prepare morph:", decodedobject.structure);
            this.prepare_morph(decodedobject.structure, decodedobject.algo);
            return;
        }


        //
        // GET PREVIEW TARGET
        //
        if (decodedobject.cmd === 'getpreviewtarget') {

            console.log("getpreviewtarget:", decodedobject.structure);
            const targetDefinition = this.load_structure_definition(decodedobject.structure);

            answer = JSON.stringify({
                answer: "answer_getpreviewtarget",
                target: targetDefinition.structure,
                structure_roles: {
                                  carrier: targetDefinition.carrier,
                                  reserve: targetDefinition.reserve,
                                  x: targetDefinition.x,
                                  forbidden: targetDefinition.forbidden,
                                  inactive: targetDefinition.inactive
                                  }
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // APPLY PREVIEW FORBIDDEN
        //
        if (decodedobject.cmd === 'applypreviewforbidden') {

            let structure_name = String(decodedobject.structure ?? "").trim();

            if (structure_name == "")
               {
               answer = JSON.stringify({
                   answer: "answer_applypreviewforbidden",
                   ok: false,
                   error: "STRUCTURE_MISSING"
               });

               this.ws_gui.send(answer);
               return;
               } // if

            let targetDefinition = null;

            try
               {
               targetDefinition = this.load_structure_definition(structure_name);
               } // try
            catch (error)
               {
               answer = JSON.stringify({
                   answer: "answer_applypreviewforbidden",
                   ok: false,
                   error: "STRUCTURE_LOAD_FAILED",
                   structure: structure_name,
                   detail: String(error?.message ?? error)
               });

               this.ws_gui.send(answer);
               return;
               } // catch

            this.structure_roles = this.structure_roles || {};
            this.structure_roles.forbidden = Array.isArray(targetDefinition?.forbidden)
                                             ? targetDefinition.forbidden.map((point) => (
                                                                                          {
                                                                                          x: Number(point?.x ?? 0),
                                                                                          y: Number(point?.y ?? 0),
                                                                                          z: Number(point?.z ?? 0)
                                                                                          }
                                                                                          ))
                                             : [];
            this.structure_roles.x = Array.isArray(targetDefinition?.x)
                                     ? targetDefinition.x.map((point) => (
                                                                        {
                                                                        x: Number(point?.x ?? 0),
                                                                        y: Number(point?.y ?? 0),
                                                                        z: Number(point?.z ?? 0)
                                                                        }
                                                                        ))
                                     : [];

            this.apicall_gui_refresh();

            answer = JSON.stringify({
                answer: "answer_applypreviewforbidden",
                ok: true,
                structure: structure_name,
                applied_count: this.structure_roles.forbidden.length,
                applied_servicebay_count: this.structure_roles.x.length,
                forbidden: this.structure_roles.forbidden,
                x: this.structure_roles.x
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // REQUEST SEQUENCES
        //
        if (decodedobject.cmd === 'requestsequences') {

            const structuresDir = path.join(__dirname, 'structures');

            const getStructurePrefixes = () =>
                fs.readdirSync(structuresDir)
                    .filter(f => f.endsWith('.json'))
                    .map(f => f.replace(/\.json$/i, ''));

            answer = JSON.stringify({
                answer: "answer_requestsequences",
                list: getStructurePrefixes()
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // REQUEST MORPH ALGORITHMS
        //
        if (decodedobject.cmd === 'requestmorphalgorithms') {

            answer = JSON.stringify({
                answer: "answer_requestmorphalgorithms",
                list: this.morphAlgorithms
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // API_CLI — Execute node api.js commands via shell
        //
        if (decodedobject.cmd === 'api_cli') {
            const apiArgs = String(decodedobject.args ?? "").trim();
            if (apiArgs === "") {
                this.ws_gui.send(JSON.stringify({
                    answer: "answer_api_cli",
                    ok: false,
                    error: "EMPTY_ARGS"
                }));
                return;
            }
            const apiScript = path.join(__dirname, "api.js");
            const cmdLine = 'node "' + apiScript + '" ' + apiArgs;
            exec(cmdLine, { cwd: __dirname, timeout: 30000 }, (error, stdout, stderr) => {
                let result = { ok: false, error: "" };
                if (error) {
                    result.error = error.message;
                }
                if (stdout.trim() !== "") {
                    try {
                        result = JSON.parse(stdout.trim());
                    } catch (e) {
                        result = { ok: false, raw: stdout.trim(), error: "PARSE_ERROR" };
                    }
                }
                if (stderr.trim() !== "") {
                    result.stderr = stderr.trim();
                }
                this.ws_gui.send(JSON.stringify({
                    answer: "answer_api_cli",
                    ok: result.ok !== false,
                    data: result,
                    args: apiArgs
                }));
            });
            return;
        }


        //
        // QUIT (Weiterleitung zum Masterbot)
        //
        if (decodedobject.cmd === 'quit') {
/*
            const cmd = "{ \"cmd\":\"quit\" }\n";
            this.client.write(cmd);

            this.rl.close();
            this.client.end();
            */
            
            this.shutdown();
            return;
        }


        //
        // FALLBACK
        //
        console.log("Unknown GUI command:", decodedobject.cmd);

        this.counter++;

    } catch (err) {
        console.error("Error parsing GUI message:", err);
    }
} // handleGUIMessage()


async handleAPIMessage(message, socket) {
    if (this.api_service === undefined) {
        return await this.handleAPIMessage_internal(message, socket);
    } // if

    return await this.api_service.handleAPIMessage(message, socket);
} // handleAPIMessage()


async handleAPIMessage_internal(message, socket) {
    let answer = null;

    try {
        const decodedobject = JSON.parse(message);

        if (decodedobject.cmd === 'describe') {
            const describe_head = build_api_describe_head(this);
            answer = JSON.stringify({
                ...describe_head,
                commands: [
                    {
                        cmd: "describe",
                        params: {},
                        returns: {
                            answer: "api_description",
                            commands: "list"
                        },
                        description: "Returns a machine-readable description of the API interface."
                    },
                    {
                        cmd: "version",
                        params: {},
                        returns: {
                            answer: "api_version",
                            version: "string"
                        },
                        description: "Returns the current BotController version."
                    },
                    {
                        cmd: "get_status",
                        params: {},
                        returns: {
                            answer: "api_status",
                            loaded_bots: "number",
                            mobility_mode: "string",
                            communication_mode: "string"
                        },
                        description: "Returns the number of currently loaded bots in the BotController."
                    },
                    {
                        cmd: "get_status_extended",
                        params: {},
                        returns: {
                            answer: "api_status_extended",
                            loaded_bots_total: "number",
                            loaded_cluster_bots: "number",
                            mobility_mode: "string",
                            communication_mode: "string",
                            bounding_box: "object"
                        },
                        description: "Returns an extended BotController status including cluster bounding box."
                    },
                    {
                        cmd: "get_masterbot",
                        params: {},
                        returns: {
                            answer: "api_get_masterbot",
                            position: "{x,y,z}",
                            orientation: "{x,y,z}",
                            connection_slot: "string"
                        },
                        description: "Returns the current Masterbot reference data used by the BotController."
                    },
                    {
                        cmd: "get_scan_state",
                        params: {},
                        returns: {
                            answer: "api_get_scan_state",
                            level1: "object",
                            level2: "object"
                        },
                        description: "Returns the current running state of Scan Level 1 and Scan Level 2."
                    },
                    {
                        cmd: "gui_set_marker",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number",
                            size: "number",
                            color: "red|green|blue|yellow|cyan|white"
                        },
                        returns: {
                            answer: "api_gui_set_marker",
                            accepted: "boolean",
                            frontend_attached: "boolean"
                        },
                        description: "Draws one semi-transparent marker cube in the WebGUI."
                    },
                    {
                        cmd: "gui_clear_markers",
                        params: {},
                        returns: {
                            answer: "api_gui_clear_markers",
                            accepted: "boolean",
                            frontend_attached: "boolean"
                        },
                        description: "Clears all API marker cubes from the WebGUI."
                    },
                    {
                        cmd: "gui_refresh",
                        params: {},
                        returns: {
                            answer: "api_gui_refresh",
                            accepted: "boolean",
                            frontend_attached: "boolean"
                        },
                        description: "Requests the BotController WebGUI to reload the current cluster world from the controller."
                    },
                    {
                        cmd: "debug_move",
                        params: {
                            mode: "on|off|status"
                        },
                        returns: {
                            answer: "api_debug_move",
                            debug_move_enabled: "boolean"
                        },
                        description: "Enables, disables or queries the global MOVE diagnostics flag in the BotController."
                    },
                    {
                        cmd: "safe_mode",
                        params: {
                            mode: "0|1|2|on|off|status"
                        },
                        returns: {
                            answer: "api_safe_mode",
                            safe_mode: "number"
                        },
                        description: "Enables, disables or queries the address recalibration safety level. Mode 0 disables recalibration, mode 1 recalibrates one addressed bot before bot-scoped API actions, and mode 2 globally recalibrates all bot addresses after successful structural changes. Default is 2."
                    },
                    {
                        cmd: "recalibrate_bot_address",
                        params: {
                            bot_id: "string",
                            mode: "standard|minimal (optional)"
                        },
                        returns: {
                            answer: "api_recalibrate_bot_address",
                            old_adress: "string",
                            new_adress: "string",
                            changed: "boolean"
                        },
                        description: "Recalculates the current local address of one known bot from the existing BotController world model without performing a full scan. Optional mode=minimal prefers shorter and simpler routes."
                    },
                    {
                        cmd: "recalibrate_bot_addresses",
                        params: {
                            mode: "standard|minimal (optional)"
                        },
                        returns: {
                            answer: "api_recalibrate_bot_addresses",
                            count: "number",
                            changed_count: "number"
                        },
                        description: "Recalculates the current local addresses of all known non-master bots from the existing BotController world model. Optional mode=minimal prefers shorter and simpler routes."
                    },
                    {
                        cmd: "diagnose_ack_route",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number",
                            vx: "number|null",
                            vy: "number|null",
                            vz: "number|null"
                        },
                        returns: {
                            answer: "api_diagnose_ack_route",
                            ack_target_addr: "string",
                            ack_retaddr: "string",
                            ack_target_neighbors_debug: "array",
                            ack_target_neighbors_live_debug: "array",
                            ack_stl_debug: "object|null"
                        },
                        description: "Diagnoses the target-side address and ALIFE/RALIFE return route for a hypothetical bot target pose without executing a move."
                    },
                    {
                        cmd: "forbidden_add",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_forbidden_add",
                            changed: "boolean",
                            count: "number",
                            list: "list"
                        },
                        description: "Adds one forbidden grid cell to the runtime structure roles. The update is idempotent and triggers a WebGUI refresh."
                    },
                    {
                        cmd: "forbidden_remove",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_forbidden_remove",
                            changed: "boolean",
                            count: "number",
                            list: "list"
                        },
                        description: "Removes one forbidden grid cell from the runtime structure roles and triggers a WebGUI refresh."
                    },
                    {
                        cmd: "forbidden_clear",
                        params: {},
                        returns: {
                            answer: "api_forbidden_clear",
                            removed_count: "number",
                            count: "number",
                            list: "list"
                        },
                        description: "Clears all forbidden runtime cells and triggers a WebGUI refresh."
                    },
                    {
                        cmd: "forbidden_list",
                        params: {},
                        returns: {
                            answer: "api_forbidden_list",
                            count: "number",
                            list: "list"
                        },
                        description: "Returns the current runtime list of forbidden cells."
                    },
                    {
                        cmd: "servicebay_add",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_servicebay_add",
                            changed: "boolean",
                            count: "number",
                            list: "list"
                        },
                        description: "Adds one service-bay (X) grid cell to the runtime structure roles and triggers a WebGUI refresh. Direct movers can be recycled immediately when they end on X, while carried payload bots are marked pending on X and are recycled on release."
                    },
                    {
                        cmd: "servicebay_remove",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_servicebay_remove",
                            changed: "boolean",
                            count: "number",
                            list: "list"
                        },
                        description: "Removes one service-bay (X) grid cell from the runtime structure roles and triggers a WebGUI refresh."
                    },
                    {
                        cmd: "servicebay_clear",
                        params: {},
                        returns: {
                            answer: "api_servicebay_clear",
                            removed_count: "number",
                            count: "number",
                            list: "list"
                        },
                        description: "Clears all runtime service-bay (X) cells and triggers a WebGUI refresh."
                    },
                    {
                        cmd: "servicebay_list",
                        params: {},
                        returns: {
                            answer: "api_servicebay_list",
                            count: "number",
                            list: "list"
                        },
                        description: "Returns the current runtime list of service-bay (X) cells used by automatic recycle."
                    },
                    {
                        cmd: "structurescan",
                        params: {},
                        returns: {
                            answer: "api_structurescan_started",
                            accepted: "boolean"
                        },
                        description: "Starts Scan Level 1 for active structure discovery."
                    },
                    {
                        cmd: "structurescan_lvl2",
                        params: {},
                        returns: {
                            answer: "api_structurescan_lvl2_started",
                            accepted: "boolean"
                        },
                        description: "Starts Scan Level 2 for inactive-bot diagnostics."
                    },
                    {
                        cmd: "structurescan_radio",
                        params: {},
                        returns: {
                            answer: "api_structurescan_radio_started",
                            accepted: "boolean"
                        },
                        description: "Starts Scan Radio skeleton mode. This is currently a placeholder flow for direct_radio-specific scan orchestration."
                    },
                    {
                        cmd: "search_bot",
                        params: {
                            bot_id: "string",
                            level: "optional number, default 1 (1=only this bot, 2=this bot + known neighbors)"
                        },
                        returns: {
                            answer: "api_search_bot_started",
                            accepted: "boolean",
                            queued_ids: "list"
                        },
                        description: "Starts a targeted direct_radio NBH resync for one bot. Level 1 queries only the target bot, level 2 additionally queries its currently known neighbors for a more robust local relocalization."
                    },
                    {
                        cmd: "morph_get_structures",
                        params: {},
                        returns: {
                            answer: "api_morph_get_structures",
                            count: "number",
                            list: "list"
                        },
                        description: "Returns the available morph structure JSON names from botcontroller/structures."
                    },
                    {
                        cmd: "morph_get_algos",
                        params: {},
                        returns: {
                            answer: "api_morph_get_algos",
                            count: "number",
                            list: "list"
                        },
                        description: "Returns the currently available morph algorithms with ids, names and descriptions."
                    },
                    {
                        cmd: "morph_start",
                        params: {
                            algo: "string",
                            structure: "string"
                        },
                        returns: {
                            answer: "api_morph_start",
                            accepted: "boolean"
                        },
                        description: "Starts a morph calculation and subsequent sequence execution for one known structure with one known morph algorithm."
                    },
                    {
                        cmd: "morph_check_progress",
                        params: {},
                        returns: {
                            answer: "api_morph_check_progress",
                            running: "boolean",
                            phase: "string",
                            progress: "number",
                            success: "boolean|null",
                            message: "string"
                        },
                        description: "Returns the current structured morph progress state, including planning phases like calculation_success and the final finished state after sequence execution."
                    },
                    {
                        cmd: "get_bot_by_id",
                        params: {
                            bot_id: "string"
                        },
                        returns: {
                            answer: "api_get_bot_by_id",
                            position: "{x,y,z}",
                            orientation: "{x,y,z}"
                        },
                        description: "Returns position and orientation of a known bot by ID."
                    },
                    {
                        cmd: "get_bots",
                        params: {
                            mode: "cube",
                            x: "number",
                            y: "number",
                            z: "number",
                            radius: "number"
                        },
                        returns: {
                            answer: "api_get_bots",
                            count: "number",
                            bots: "list"
                        },
                        description: "Returns all bots inside a local cube around a given center coordinate."
                    },
                    {
                        cmd: "get_bots_by_prefix",
                        params: {
                            prefix: "string"
                        },
                        returns: {
                            answer: "api_get_bots_by_prefix",
                            count: "number",
                            bots: "list"
                        },
                        description: "Returns all known bots whose IDs start with the given prefix."
                    },
                    {
                        cmd: "get_inactive_bots",
                        params: {},
                        returns: {
                            answer: "api_get_inactive_bots",
                            count: "number",
                            bots: "list"
                        },
                        description: "Returns the inactive bots detected by Scan Level 2."
                    },
                    {
                        cmd: "get_neighbors",
                        params: {
                            bot_id: "string"
                        },
                        returns: {
                            answer: "api_get_neighbors",
                            neighbors: "object with F/R/B/L/T/D"
                        },
                        description: "Returns the direct local neighbors of a known bot, including active, inactive or empty slots."
                    },
                    {
                        cmd: "get_grab_positions",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_get_grab_positions",
                            feasible_count: "number",
                            candidates: "list"
                        },
                        description: "Returns up to four carrier grab candidates around a target coordinate, including required orientation, anchor checks and blocking reasons."
                    },
                    {
                        cmd: "get_turn_positions",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number",
                            radius: "optional number, default 1"
                        },
                        returns: {
                            answer: "api_get_turn_positions",
                            turnable_same_y_count: "number",
                            turnable_strict_count: "number",
                            candidates: "list"
                        },
                        description: "Returns rotation-capable candidate cells in a local 3D cube around a coordinate. turnable_same_y requires four free orthogonal neighbors on the same y-plane."
                    },
                    {
                        cmd: "is_occupied",
                        params: {
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_is_occupied",
                            occupied: "boolean",
                            state: "active|inactive|empty"
                        },
                        description: "Checks whether a specific coordinate is occupied by an active or inactive bot."
                    },
                    {
                        cmd: "get_slot_status",
                        params: {
                            bot_id: "string",
                            slot: "F|R|B|L|T|D"
                        },
                        returns: {
                            answer: "api_get_slot_status",
                            target: "occupancy object"
                        },
                        description: "Returns the status of one relative slot of a bot, respecting the bot orientation."
                    },
                    {
                        cmd: "probe_move_bot",
                        params: {
                            bot_id: "string",
                            move: "single primitive move, e.g. F_TF_D"
                        },
                        returns: {
                            answer: "api_probe_move_bot",
                            possible: "boolean",
                            predicted_target: "{x,y,z}"
                        },
                        description: "Performs a conservative local plausibility check for one single translational move primitive."
                    },
                    {
                        cmd: "can_reach_position",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number",
                            vx: "optional number",
                            vy: "optional number",
                            vz: "optional number"
                        },
                        returns: {
                            answer: "api_can_reach_position",
                            reachable: "boolean",
                            reason: "string"
                        },
                        description: "Performs a conservative surface check whether a target coordinate looks locally reachable."
                    },
                    {
                        cmd: "find_path_for_bot",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_find_path_for_bot",
                            path_found: "boolean",
                            path: "list of coordinates"
                        },
                        description: "Calculates a first surface path candidate for a bot to reach a target coordinate."
                    },
                    {
                        cmd: "find_path_for_bot_payload",
                        params: {
                            bot_id: "string",
                            payload_bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_find_path_for_bot_payload",
                            path_found: "boolean",
                            path: "list of coordinates"
                        },
                        description: "Calculates a payload-aware path candidate for a carrier bot with a virtual or real payload bot attached in F-direction."
                    },
                    {
                        cmd: "suggest_simple_move",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_suggest_simple_move",
                            suggested: "boolean",
                            move_candidate: "single primitive move or null"
                        },
                        description: "Suggests one simple primitive move candidate that matches the beginning of a calculated path."
                    },
                    {
                        cmd: "move_bot_to",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_move_bot_to",
                            executable: "boolean",
                            executed: "boolean",
                            path_found: "boolean",
                            turn_positions_on_path: "list"
                        },
                        description: "Plans and executes one complete translated MOVE command for a bot, including ALIFE/RALIFE handling when a return route is available. In vehicle_kinematics mode, an optional goal orientation can be supplied as vx/vy/vz."
                    },
                    {
                        cmd: "would_split_cluster",
                        params: {
                            bot_id: "string"
                        },
                        returns: {
                            answer: "api_would_split_cluster",
                            would_split_cluster: "boolean",
                            disconnected_bots: "list"
                        },
                        description: "Checks whether removing one bot from the currently known cluster would split the remaining structure into disconnected parts."
                    },
                    {
                        cmd: "diagnose_move_bot_to",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number",
                            vx: "optional number",
                            vy: "optional number",
                            vz: "optional number"
                        },
                        returns: {
                            answer: "api_diagnose_move_bot_to",
                            path_found: "boolean",
                            planned_moves: "list",
                            planned_primitives: "list",
                            turn_positions_on_path: "list"
                        },
                        description: "Plans a move like move_bot_to but stops before execution and returns path, primitives and MOVE translation for diagnostics. In vehicle_kinematics mode, an optional goal orientation can be supplied as vx/vy/vz."
                    },
                    {
                        cmd: "rotate_bot",
                        params: {
                            bot_id: "string",
                            direction: "L|R"
                        },
                        returns: {
                            answer: "api_rotate_bot",
                            executed: "boolean",
                            target_orientation: "{x,y,z}"
                        },
                        description: "Rotates one bot left or right and appends ALIFE so the local world model can update without a full scan."
                    },
                    {
                        cmd: "rotate_bot_to",
                        params: {
                            bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number"
                        },
                        returns: {
                            answer: "api_rotate_bot_to",
                            executed: "boolean",
                            target_orientation: "{x,y,z}",
                            rotation_plan: "list"
                        },
                        description: "Rotates one bot to an absolute horizontal target orientation vector and executes the required one-step or two-step spin plan as one bundled MOVE block with ALIFE/RALIFE."
                    },
                    {
                        cmd: "grab_bot",
                        params: {
                            bot_id: "string"
                        },
                        returns: {
                            answer: "api_grab_bot",
                            executed: "boolean"
                        },
                        description: "Sends a direct GF command for one bot and appends ALIFE when a return route is available."
                    },
                    {
                        cmd: "release_bot",
                        params: {
                            bot_id: "string"
                        },
                        returns: {
                            answer: "api_release_bot",
                            executed: "boolean"
                        },
                        description: "Sends a direct G command for one bot and appends ALIFE when a return route is available. If a carried payload is pending on a service-bay (X) cell, release finalizes the recycle and removes that payload from active bots."
                    },
                    {
                        cmd: "move_payload_to",
                        params: {
                            carrier_bot_id: "string",
                            payload_bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number",
                            release_after: "optional boolean"
                        },
                        returns: {
                            answer: "api_move_payload_to",
                            ok: "boolean",
                            steps: "list"
                        },
                        description: "Small convenience transport command that grabs a payload directly in front of a carrier, moves the carrier to a target coordinate and can optionally release afterwards. The target coordinate currently refers to the carrier, not the payload."
                    },
                    {
                        cmd: "move_carrier_to",
                        params: {
                            carrier_bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number",
                            vx: "number",
                            vy: "number",
                            vz: "number",
                            release_after: "optional boolean"
                        },
                        returns: {
                            answer: "api_move_carrier_to",
                            ok: "boolean",
                            steps: "list"
                        },
                        description: "Moves one carrier bot to a target coordinate, automatically using payload-aware path planning when the carrier currently holds a payload. It can then optionally rotate to a target orientation and optionally release afterwards. Use 0,0,0 as orientation when the final orientation is irrelevant."
                    },
                    {
                        cmd: "diagnose_move_carrier_to",
                        params: {
                            carrier_bot_id: "string",
                            x: "number",
                            y: "number",
                            z: "number",
                            vx: "number",
                            vy: "number",
                            vz: "number",
                            release_after: "optional boolean"
                        },
                        returns: {
                            answer: "api_diagnose_move_carrier_to",
                            ok: "boolean",
                            executable: "boolean",
                            steps: "list"
                        },
                        description: "Plans one carrier move like move_carrier_to but stops before execution and returns transport, rotation and optional release planning data."
                    },
                    {
                        cmd: "calc_crater",
                        params: {
                            tx: "number",
                            ty: "number",
                            tz: "number",
                            vx: "number",
                            vy: "number",
                            vz: "number",
                            sx: "number",
                            sy: "number",
                            sz: "number",
                            mode: "optional string, default plan",
                            max_depth: "optional number; when omitted, future implementations may auto-expand toward outer region"
                        },
                        returns: {
                            answer: "api_calc_crater",
                            implemented: "boolean",
                            error: "string"
                        },
                        description: "Calculates a crater planning stub around a target coordinate. The vector defines the dig direction, while sx/sy/sz define the shaft stamp shape (cross-section) relative to that direction."
                    },
                    {
                        cmd: "crater_start",
                        params: {
                            crater_id: "optional string, default crater_default",
                            tx: "number",
                            ty: "number",
                            tz: "number",
                            vx: "number",
                            vy: "number",
                            vz: "number",
                            sx: "number",
                            sy: "number",
                            sz: "number",
                            max_depth: "optional number"
                        },
                        returns: {
                            answer: "api_crater_start",
                            accepted: "boolean",
                            session_id: "number",
                            total_steps: "number"
                        },
                        description: "Starts an asynchronous crater execution process. The controller plans pair_order via calc_crater and executes moves step-by-step with ACK handling."
                    },
                    {
                        cmd: "crater_check_progress",
                        params: {
                            crater_id: "optional string, defaults to active crater session"
                        },
                        returns: {
                            answer: "api_crater_check_progress",
                            running: "boolean",
                            phase: "string",
                            progress: "number",
                            success: "boolean|null",
                            total_steps: "number",
                            completed_steps: "number"
                        },
                        description: "Returns progress and state for one crater execution session, similar to morph_check_progress."
                    },
                    {
                        cmd: "crater_fill",
                        params: {
                            crater_id: "string",
                            mode: "plan|execute (default execute)"
                        },
                        returns: {
                            answer: "api_crater_fill",
                            accepted: "boolean",
                            fillable: "boolean",
                            blocked_steps: "list"
                        },
                        description: "Builds an inverted fill plan from one stored crater id. In mode=plan it only runs prechecks; in mode=execute it starts asynchronous fill execution if prechecks pass."
                    },
                    {
                        cmd: "crater_list",
                        params: {},
                        returns: {
                            answer: "api_crater_list",
                            count: "number",
                            craters: "list"
                        },
                        description: "Lists known crater sessions by crater_id with their current status and plan availability."
                    },
                    {
                        cmd: "get_last_moves",
                        params: {
                            limit: "optional integer, default 10"
                        },
                        returns: {
                            answer: "api_get_last_moves",
                            moves: "list"
                        },
                        description: "Returns the most recent API actions stored in the BotController action ring buffer."
                    },
                    {
                        cmd: "get_bot_history",
                        params: {
                            bot_id: "string",
                            limit: "optional integer, default 10"
                        },
                        returns: {
                            answer: "api_get_bot_history",
                            history: "list"
                        },
                        description: "Returns recent bot-specific API history entries with state snapshots."
                    },
                    {
                        cmd: "get_last_raw_cmds",
                        params: {
                            limit: "optional integer, default 10"
                        },
                        returns: {
                            answer: "api_get_last_raw_cmds",
                            raw_cmds: "list"
                        },
                        description: "Returns the most recent raw_cmd strings sent through the API."
                    },
                    {
                        cmd: "raw_cmd",
                        params: {
                            value: "string"
                        },
                        returns: {
                            answer: "api_raw_cmd",
                            accepted: "boolean"
                        },
                        description: "Sends a raw OP-Code command directly to the Masterbot."
                    },
                    {
                        cmd: "poll_masterbot_queue",
                        params: {},
                        returns: {
                            answer: "api_poll_masterbot_queue",
                            accepted: "boolean"
                        },
                        description: "Triggers one explicit pop cycle from the Masterbot response queue."
                    },
                    {
                        cmd: "reset_api_message_log",
                        params: {},
                        returns: {
                            answer: "api_reset_api_message_log",
                            accepted: "boolean",
                            cleared: "boolean"
                        },
                        description: "Clears the internal API message ring buffer."
                    },
                    {
                        cmd: "get_api_messages",
                        params: {
                            cmd_filter: "optional string, e.g. RCHECK",
                            limit: "optional integer, default 50"
                        },
                        returns: {
                            answer: "api_get_api_messages",
                            count: "number",
                            messages: "list"
                        },
                        description: "Returns recent parsed Masterbot responses from the internal API message ring buffer."
                    }
                ]
            }) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        let query_handled = await handle_readonly_api_command(this, decodedobject, socket);
        if (query_handled === true)
           {
           return;
           } // if

        let gui_roles_handled = await handle_gui_roles_api_command(this, decodedobject, socket);
        if (gui_roles_handled === true)
           {
           return;
           } // if

        let ack_handled = await handle_ack_api_command(this, decodedobject, socket);
        if (ack_handled === true)
           {
           return;
           } // if

        let motion_handled = await handle_motion_api_command(this, decodedobject, socket);
        if (motion_handled === true)
           {
           return;
           } // if

        let orchestration_handled = await handle_orchestration_api_command(this, decodedobject, socket);
        if (orchestration_handled === true)
           {
           return;
           } // if

        answer = JSON.stringify({
            ok: false,
            error: "UNKNOWN_API_COMMAND",
            cmd: decodedobject.cmd ?? null
        }) + "\n";

        socket.write(answer, () => {
            socket.end();
        });
    } catch (err) {
        Logger.log("handleAPIMessage_internal error: " + (err && err.stack ? err.stack : err.message));
        answer = JSON.stringify({
            ok: false,
            error: "INVALID_JSON",
            message: err.message,
            stack: err && err.stack ? err.stack : ""
        }) + "\n";

        socket.write(answer, () => {
            socket.end();
        });
    } // try
} // handleAPIMessage_internal()

  
  
} // botcontroller_class


module.exports = botcontroller_class;

 
