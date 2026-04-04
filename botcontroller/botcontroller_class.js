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


const WebSocket = require('ws');
const http      = require('http');

const self_assembly   = require('./self_assembly'); 
const signature_class = require('../common/signature/signature_class'); 


//const MorphBFSSimple    = require('./morph/morph_bfs_simple');
const MorphBFSWavefront = require('./morph/morph_bfs_wavefront');


const Logger = require('./logger');

const cmd_parser_class = require('../common/cmd_parser_class');  

const bot_class_mini = require('./bot_class_mini');




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

 

   
   // Status-vars
   this.MASTERBOT_CONNECTED = 0;
   this.masterbot_name = "";
   this.masterbot_first_scan = 1;

   this.scan_status  = 0;
   this.scan_status_lvl2 = 0;
   this.tmpid_cnt    = 0;
 
   this.scan_waiting_info          = {}; 
   this.scan_waiting_check         = {};
   this.scan_targets_lvl2          = [];
   this.scan_targets_lvl2_index    = 0;
   this.scan_timeout = 0;


   this.threadcounter          = 0;
   this.scanwaitingcounter     = 0;
   this.scanwaitingcounter_lvl2 = 0;
   this.max_scanwaitingcounter = 80;

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
   this.debug_move_enabled = false;
   this.safe_mode = 2;

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
   
   this.ws_gui = null;
   this.api_server = null;
   
   // Define supportet morph-Algorithms
   this.morphAlgorithms = [
       {
       id: "bfs_wavefront",
       name: "BFS Wavefront",
       description: "Default wavefront morphing with parallel waves and neighborhood checks.",
       default: true
       },
       {
       id: "bfs_simple",
       name: "BFS Simple",
       description: "Simple, serial BFS morphing. Always one bot per step.",
       default: false
       }
       // More algorithms can be added later
   ];
   this.morphAlgorithmSelected = "bfs_wavefront";



   console.log(`BotController Version: ${this.version} - CellBots`);
   console.log(`Port: ${this.PORT}`);
   console.log(`enable_api: ${this.ENABLE_API}`);
   console.log(`API Port: ${this.API_PORT}`);
   console.log(`connect_masterbot: ${this.connect_masterbot}`);
   console.log(`safe_mode: ${this.safe_mode}`);



   // Add virtual Masterbot (important for get_inverse_address() !)
   this.bot_class_mini_obj = new bot_class_mini();
   this.bot_class_mini_obj.setvalues( "masterbot", this.mb['x'], this.mb['y'], this.mb['z'], this.mb['vx'], this.mb['vy'], this.mb['vz'] );
   this.bot_class_mini_obj.checked = 1;
   this.register_bot( this.bot_class_mini_obj );
 


   this.connect_to_external_masterbot();
   this.start_api_service();

   // Start thread
   this.thread_botcontroller();


    
   
   // start WebGUI (async Modul)
   const { startWebGUI } = require('./webgui_server');
   startWebGUI(this);

   } // constructor()


append_api_message_log(raw_message, parsed_message)
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
} // append_api_message_log()


apicall_get_cmd_name(cmd)
{
const cmd_parser_class_obj = new cmd_parser_class();

if (cmd == cmd_parser_class_obj.CMD_INFO)   return("INFO");
if (cmd == cmd_parser_class_obj.CMD_RINFO)  return("RINFO");
if (cmd == cmd_parser_class_obj.CMD_CHECK)  return("CHECK");
if (cmd == cmd_parser_class_obj.CMD_RCHECK) return("RCHECK");
if (cmd == cmd_parser_class_obj.CMD_ALIFE)  return("ALIFE");
if (cmd == cmd_parser_class_obj.CMD_RALIFE) return("RALIFE");
if (cmd == cmd_parser_class_obj.CMD_MOVE)   return("MOVE");
if (cmd == cmd_parser_class_obj.CMD_SYS)    return("SYS");

if (cmd == null || cmd == "") return("");

return(String(cmd));
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
let botindex = this.get_bot_by_id(bot_id, this.bots);

if (botindex == null)
   {
   return(null);
   } // if

return({
       id: this.bots[botindex].id,
       position: {
                  x: Number(this.bots[botindex].x),
                  y: Number(this.bots[botindex].y),
                  z: Number(this.bots[botindex].z)
                  },
       orientation: {
                     x: Number(this.bots[botindex].vector_x),
                     y: Number(this.bots[botindex].vector_y),
                     z: Number(this.bots[botindex].vector_z)
                     },
       adress: this.apicall_get_safe_adress(this.bots[botindex])
       });
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
let normalized_limit = Number(limit);
let history = this.api_bot_history_log.filter((entry) => entry.bot_id === bot_id);

if (!Number.isFinite(normalized_limit) || normalized_limit <= 0)
   {
   normalized_limit = 10;
   } // if

if (history.length > normalized_limit)
   {
   history = history.slice(history.length - normalized_limit);
   } // if

return({
       ok: true,
       answer: "api_get_bot_history",
       bot_id: bot_id,
       limit: normalized_limit,
       count: history.length,
       history: history
       });
} // apicall_get_bot_history()


apicall_generate_ack_id(bot_id = "")
{
this.api_ack_counter++;

let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return("API" + this.api_ack_counter);
   } // if

return("API_" + normalized_bot_id + "_" + this.api_ack_counter);
} // apicall_generate_ack_id()


apicall_register_ack(ack_id, ack_payload = {})
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return(false);
   } // if

this.api_ack_map[normalized_ack_id] = {
                                      ack_id: normalized_ack_id,
                                      bot_id: ack_payload.bot_id ?? "",
                                      mode: ack_payload.mode ?? "move",
                                      payload_bot_id: ack_payload.payload_bot_id ?? null,
                                      to: ack_payload.to ?? null,
                                      orientation: ack_payload.orientation ?? null,
                                      planned_raw_cmd: ack_payload.planned_raw_cmd ?? "",
                                      retaddr: ack_payload.retaddr ?? "",
                                      status: ack_payload.status ?? "pending",
                                      created_ts: new Date().toISOString(),
                                      ack_ts: null
                                      };

return(true);
} // apicall_register_ack()


apicall_get_ack(ack_id)
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return(null);
   } // if

if (this.api_ack_map[normalized_ack_id] === undefined)
   {
   return(null);
   } // if

return(this.api_ack_map[normalized_ack_id]);
} // apicall_get_ack()


apicall_get_front_neighbor_bot_id(bot_snapshot)
{
if (!bot_snapshot)
   {
   return(null);
   } // if

let rel_vector = this.get_cell_relation_vector_byslot(
                                                  "F",
                                                  Number(bot_snapshot.orientation.x),
                                                  Number(bot_snapshot.orientation.y),
                                                  Number(bot_snapshot.orientation.z)
                                                  );

if (!rel_vector)
   {
   return(null);
   } // if

let target_x = Number(bot_snapshot.position.x) + Number(rel_vector.x);
let target_y = Number(bot_snapshot.position.y) + Number(rel_vector.y);
let target_z = Number(bot_snapshot.position.z) + Number(rel_vector.z);
let target_index = this.get_3d(target_x, target_y, target_z);

if (target_index != null && this.bots[target_index] !== undefined)
   {
   if (this.bots[target_index].id == "masterbot")
      {
      return(null);
      } // if

   return(String(this.bots[target_index].id));
   } // if

for (let i = 0; i < this.bots.length; i++)
    {
    if (this.bots[i] === undefined || this.bots[i] === null)
       {
       continue;
       } // if

    if (String(this.bots[i].id) == "masterbot")
       {
       continue;
       } // if

    if (
       Number(this.bots[i].x) == Number(target_x) &&
       Number(this.bots[i].y) == Number(target_y) &&
       Number(this.bots[i].z) == Number(target_z)
       )
       {
       return(String(this.bots[i].id));
       } // if
    } // for

return(null);
} // apicall_get_front_neighbor_bot_id()


apicall_get_payload_target_from_carrier_state(position, orientation)
{
if (!position || !orientation)
   {
   return(null);
   } // if

let rel_vector = this.get_cell_relation_vector_byslot(
                                                  "F",
                                                  Number(orientation.x),
                                                  Number(orientation.y),
                                                  Number(orientation.z)
                                                  );

if (!rel_vector)
   {
   return(null);
   } // if

return({
       x: Number(position.x) + Number(rel_vector.x),
       y: Number(position.y) + Number(rel_vector.y),
       z: Number(position.z) + Number(rel_vector.z)
       });
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
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();

if (normalized_carrier_bot_id == "" || normalized_payload_bot_id == "")
   {
   return(null);
   } // if

let payload_link = {
                   carrier_bot_id: normalized_carrier_bot_id,
                   payload_bot_id: normalized_payload_bot_id,
                   relative_slot: String(relative_slot ?? "F").trim().toUpperCase(),
                   attached: attached === true
                   };

this.api_payload_links[normalized_carrier_bot_id] = payload_link;
this.api_grab_state_map[normalized_carrier_bot_id] = normalized_payload_bot_id;

return(payload_link);
} // apicall_register_payload_link()


apicall_clear_payload_link(carrier_bot_id)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();

if (normalized_carrier_bot_id == "")
   {
   return(false);
   } // if

delete this.api_payload_links[normalized_carrier_bot_id];
delete this.api_grab_state_map[normalized_carrier_bot_id];

return(true);
} // apicall_clear_payload_link()


apicall_get_payload_link_for_carrier(carrier_bot_id)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let payload_link = null;
let legacy_payload_bot_id = null;

if (normalized_carrier_bot_id == "")
   {
   return(null);
   } // if

payload_link = this.api_payload_links[normalized_carrier_bot_id] ?? null;

if (payload_link)
   {
   return(payload_link);
   } // if

legacy_payload_bot_id = this.api_grab_state_map[normalized_carrier_bot_id] ?? null;

if (String(legacy_payload_bot_id ?? "").trim() == "")
   {
   return(null);
   } // if

return(
      this.apicall_register_payload_link(
                                        normalized_carrier_bot_id,
                                        legacy_payload_bot_id,
                                        "F",
                                        true
                                        )
      );
} // apicall_get_payload_link_for_carrier()


apicall_get_carried_payload_bot_id(carrier_bot_id)
{
let payload_link = this.apicall_get_payload_link_for_carrier(carrier_bot_id);

if (!payload_link || payload_link.attached !== true)
   {
   return(null);
   } // if

return(String(payload_link.payload_bot_id ?? "").trim() || null);
} // apicall_get_carried_payload_bot_id()


apicall_morph_get_structures()
{
const structures_dir = path.join(__dirname, 'structures');
let structures = [];

try
   {
   structures = fs.readdirSync(structures_dir)
                  .filter((filename) => filename.endsWith('.json'))
                  .map((filename) => filename.replace(/\.json$/i, ''))
                  .sort();
   } catch (err)
     {
     return({
            ok: false,
            answer: "api_morph_get_structures",
            error: "STRUCTURES_READ_FAILED",
            details: String(err?.message ?? err)
            });
     } // catch

return({
       ok: true,
       answer: "api_morph_get_structures",
       count: structures.length,
       list: structures
       });
} // apicall_morph_get_structures()


apicall_morph_get_algos()
{
return({
       ok: true,
       answer: "api_morph_get_algos",
       count: Array.isArray(this.morphAlgorithms) ? this.morphAlgorithms.length : 0,
       list: Array.isArray(this.morphAlgorithms) ? this.morphAlgorithms : []
       });
} // apicall_morph_get_algos()


apicall_morph_start(algo, structure)
{
let normalized_algo = String(algo ?? "").trim();
let normalized_structure = String(structure ?? "").trim();
let structures_ret = this.apicall_morph_get_structures();
let algos_ret = this.apicall_morph_get_algos();
let selected_algo = null;

if (normalized_algo == "")
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_ALGO_MISSING"
          });
   } // if

if (normalized_structure == "")
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_STRUCTURE_MISSING",
          algo: normalized_algo
          });
   } // if

selected_algo = (algos_ret.list ?? []).find((entry) => String(entry?.id ?? "").trim() == normalized_algo) ?? null;

if (!selected_algo)
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_ALGO_NOT_FOUND",
          algo: normalized_algo,
          available_algos: algos_ret.list ?? []
          });
   } // if

if (!(structures_ret.list ?? []).includes(normalized_structure))
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_STRUCTURE_NOT_FOUND",
          algo: normalized_algo,
          structure: normalized_structure,
          available_structures: structures_ret.list ?? []
          });
   } // if

this.prepare_morph(normalized_structure, normalized_algo);

return({
       ok: true,
       answer: "api_morph_start",
       accepted: true,
       algo: normalized_algo,
       structure: normalized_structure
       });
} // apicall_morph_start()


apicall_update_morph_status(patch = {})
{
let now_iso = new Date().toISOString();

this.morph_status = {
                    ...this.morph_status,
                    ...(patch ?? {}),
                    last_update: now_iso
                    };

return(this.morph_status);
} // apicall_update_morph_status()


apicall_get_morph_status()
{
return({
       ok: true,
       answer: "api_morph_check_progress",
       running: Boolean(this.morph_status?.running),
       phase: this.morph_status?.phase ?? "idle",
       progress: Number(this.morph_status?.progress ?? 0),
       structure: this.morph_status?.structure ?? null,
       algo: this.morph_status?.algo ?? null,
       success: this.morph_status?.success ?? null,
       started_at: this.morph_status?.started_at ?? null,
       finished_at: this.morph_status?.finished_at ?? null,
       last_update: this.morph_status?.last_update ?? null,
       message: this.morph_status?.message ?? ""
       });
} // apicall_get_morph_status()


apicall_sync_payload_from_carrier(carrier_bot_id, carrier_position, carrier_orientation, payload_rotation_plan = [])
{
let payload_link = this.apicall_get_payload_link_for_carrier(carrier_bot_id);
let payload_bot_id = payload_link?.payload_bot_id ?? null;

if (!payload_bot_id)
   {
   this.append_api_bot_history(
                              carrier_bot_id,
                              "payload_sync_debug",
                              {
                              carrier_bot_id: carrier_bot_id,
                              stage: "no_grab_state"
                              },
                              {
                              ok: false,
                              answer: "api_payload_sync_skipped",
                              payload_bot_id: null
                              }
                              );
   return(false);
   } // if

let payload_target = this.apicall_get_payload_target_from_carrier_state(carrier_position, carrier_orientation);

if (!payload_target)
   {
   this.append_api_bot_history(
                              carrier_bot_id,
                              "payload_sync_debug",
                              {
                              carrier_bot_id: carrier_bot_id,
                              stage: "no_payload_target",
                              payload_bot_id: payload_bot_id
                              },
                              {
                              ok: false,
                              answer: "api_payload_sync_skipped"
                              }
                              );
   return(false);
   } // if

let payload_index = this.get_bot_by_id(payload_bot_id, this.bots);

if (payload_index == null)
   {
   this.append_api_bot_history(
                              carrier_bot_id,
                              "payload_sync_debug",
                              {
                              carrier_bot_id: carrier_bot_id,
                              stage: "payload_bot_not_found",
                              payload_bot_id: payload_bot_id,
                              payload_target: payload_target
                              },
                              {
                              ok: false,
                              answer: "api_payload_sync_skipped"
                              }
                              );
   return(false);
   } // if

let oldx = Number(this.bots[payload_index].x);
let oldy = Number(this.bots[payload_index].y);
let oldz = Number(this.bots[payload_index].z);
let old_vx = Number(this.bots[payload_index].vector_x);
let old_vy = Number(this.bots[payload_index].vector_y);
let old_vz = Number(this.bots[payload_index].vector_z);
let normalized_rotation_plan = Array.isArray(payload_rotation_plan) ? payload_rotation_plan : [];
let payload_orientation_target = {
                                 x: old_vx,
                                 y: old_vy,
                                 z: old_vz
                                 };

for (let i = 0; i < normalized_rotation_plan.length; i++)
    {
    let next_orientation = this.apicall_rotate_orientation(
                                                         Number(payload_orientation_target.x),
                                                         Number(payload_orientation_target.y),
                                                         Number(payload_orientation_target.z),
                                                         normalized_rotation_plan[i]
                                                         );

    if (!next_orientation)
       {
       break;
       } // if

    payload_orientation_target = {
                                 x: Number(next_orientation.x),
                                 y: Number(next_orientation.y),
                                 z: Number(next_orientation.z)
                                 };
    } // for

this.update_keyindex(oldx, oldy, oldz, payload_target.x, payload_target.y, payload_target.z);
this.bots[payload_index].x = Number(payload_target.x);
this.bots[payload_index].y = Number(payload_target.y);
this.bots[payload_index].z = Number(payload_target.z);
this.bots[payload_index].vector_x = Number(payload_orientation_target.x);
this.bots[payload_index].vector_y = Number(payload_orientation_target.y);
this.bots[payload_index].vector_z = Number(payload_orientation_target.z);
this.bots[payload_index].adress = this.get_mb_returnaddr(
                                                       {x:this.mb.x, y:this.mb.y, z:this.mb.z },
                                                       {x:payload_target.x, y:payload_target.y, z:payload_target.z },
                                                       this.bots
                                                       );

const events = [];
events.push(
            {
            event: "move",
            botid: payload_bot_id,
            to: {
                x: Number(payload_target.x),
                y: Number(payload_target.y),
                z: Number(payload_target.z)
                }
            }
            );

if (
   Number(old_vx) !== Number(payload_orientation_target.x) ||
   Number(old_vy) !== Number(payload_orientation_target.y) ||
   Number(old_vz) !== Number(payload_orientation_target.z)
   )
   {
   events.push(
               {
               event: "spin",
               botid: payload_bot_id,
               from: {
                     x: Number(payload_target.x),
                     y: Number(payload_target.y),
                     z: Number(payload_target.z),
                     vx: Number(old_vx),
                     vy: Number(old_vy),
                     vz: Number(old_vz)
                     },
               to: {
                   x: Number(payload_target.x),
                   y: Number(payload_target.y),
                   z: Number(payload_target.z),
                   vx: Number(payload_orientation_target.x),
                   vy: Number(payload_orientation_target.y),
                   vz: Number(payload_orientation_target.z)
                   },
               parent: "",
               duration: 0,
               ts: Number(new Date().getTime())
               }
               );
   } // if

this.notify_frontend(events);

this.append_api_bot_history(
                           payload_bot_id,
                           "payload_sync",
                           { carrier_bot_id: carrier_bot_id },
                           {
                           ok: true,
                           answer: "api_payload_sync_applied",
                           to: payload_target,
                           orientation: payload_orientation_target
                           }
                           );

this.append_api_bot_history(
                           carrier_bot_id,
                           "payload_sync_debug",
                           {
                           carrier_bot_id: carrier_bot_id,
                           stage: "applied",
                           payload_bot_id: payload_bot_id,
                           payload_target: payload_target
                           },
                           {
                           ok: true,
                           answer: "api_payload_sync_applied",
                           payload_orientation: payload_orientation_target
                           }
                           );

return(true);
} // apicall_sync_payload_from_carrier()


apicall_mark_ack_received(ack_id, ack_status = "ack")
{
let ack_entry = this.apicall_get_ack(ack_id);

if (!ack_entry)
   {
   return(false);
   } // if

ack_entry.status = ack_status;
ack_entry.ack_ts = new Date().toISOString();

return(true);
} // apicall_mark_ack_received()


apicall_mark_ack_recovered(ack_id)
{
return(this.apicall_mark_ack_received(ack_id, "recovered"));
} // apicall_mark_ack_recovered()


apicall_remove_ack(ack_id)
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return(false);
   } // if

if (this.api_ack_map[normalized_ack_id] === undefined)
   {
   return(false);
   } // if

delete this.api_ack_map[normalized_ack_id];
return(true);
} // apicall_remove_ack()


apicall_sleep(ms)
{
return(new Promise((resolve) => setTimeout(resolve, ms)));
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
if (!pos1 || !pos2)
   {
   return(false);
   } // if

return(
       Number(pos1.x) === Number(pos2.x) &&
       Number(pos1.y) === Number(pos2.y) &&
       Number(pos1.z) === Number(pos2.z)
       );
} // apicall_positions_equal()


apicall_orientations_equal(ori1, ori2)
{
if (!ori1 || !ori2)
   {
   return(false);
   } // if

return(
       Number(ori1.x) === Number(ori2.x) &&
       Number(ori1.y) === Number(ori2.y) &&
       Number(ori1.z) === Number(ori2.z)
       );
} // apicall_orientations_equal()


apicall_collect_neighbor_probe(bot_id, expected_position, snapshot)
{
let probe = {
            bot_id: String(bot_id ?? "").trim(),
            expected_position: expected_position ?? null,
            target_state: "unknown",
            occupied_orthogonal_count: 0,
            occupied_orthogonal_ids: [],
            orthogonal_neighbors: {},
            snapshot_neighbors: null
            };

if (expected_position)
   {
   const neighbor_offsets = [
                             { key: "XP", x:  1, y:  0, z:  0 },
                             { key: "XM", x: -1, y:  0, z:  0 },
                             { key: "YP", x:  0, y:  1, z:  0 },
                             { key: "YM", x:  0, y: -1, z:  0 },
                             { key: "ZP", x:  0, y:  0, z:  1 },
                             { key: "ZM", x:  0, y:  0, z: -1 }
                             ];
   let expected_x = Number(expected_position.x);
   let expected_y = Number(expected_position.y);
   let expected_z = Number(expected_position.z);
   let target_bot_index = this.get_3d(expected_x, expected_y, expected_z);
   let target_inactive_bot = this.apicall_get_inactive_bot_by_xyz(expected_x, expected_y, expected_z);

   if (target_bot_index != null)
      {
      probe.target_state = "active";
      probe.target_bot_id = this.bots[target_bot_index].id;
      } // if
   else if (target_inactive_bot != null)
      {
      probe.target_state = "inactive";
      probe.target_bot_id = target_inactive_bot.id;
      } // else if
   else
      {
      probe.target_state = "empty";
      } // else

   for (let i = 0; i < neighbor_offsets.length; i++)
       {
       let offset = neighbor_offsets[i];
       let nx = expected_x + offset.x;
       let ny = expected_y + offset.y;
       let nz = expected_z + offset.z;
       let neighbor_index = this.get_3d(nx, ny, nz);
       let inactive_neighbor = this.apicall_get_inactive_bot_by_xyz(nx, ny, nz);
       let neighbor_entry = {
                            position: {
                                       x: nx,
                                       y: ny,
                                       z: nz
                                       },
                            state: "empty"
                            };

       if (inactive_neighbor != null)
          {
          neighbor_entry = {
                           position: {
                                      x: nx,
                                      y: ny,
                                      z: nz
                                      },
                           state: "inactive",
                           id: inactive_neighbor.id
                           };
          } // if

       if (neighbor_index != null)
          {
          neighbor_entry = {
                           position: {
                                      x: nx,
                                      y: ny,
                                      z: nz
                                      },
                           state: "active",
                           id: this.bots[neighbor_index].id
                           };
          } // if

       if (neighbor_entry.state != "empty")
          {
          probe.occupied_orthogonal_count++;

          if (neighbor_entry.id !== undefined)
             {
             probe.occupied_orthogonal_ids.push(neighbor_entry.id);
             } // if
          } // if

       probe.orthogonal_neighbors[offset.key] = neighbor_entry;
       } // for
   } // if

if (snapshot && probe.bot_id != "")
   {
   let snapshot_neighbors_ret = this.apicall_get_neighbors(probe.bot_id);

   if (snapshot_neighbors_ret.ok === true)
      {
      probe.snapshot_neighbors = snapshot_neighbors_ret.neighbors ?? null;
      } // if
   } // if

return(probe);
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
let normalized_address = String(address ?? "").trim();

if (normalized_address == "")
   {
   return(null);
   } // if

for (let i = 0; i < this.bots.length; i++)
    {
    if (this.bots[i].id == "masterbot")
       {
       continue;
       } // if

    if (String(this.apicall_get_safe_adress(this.bots[i])) === normalized_address)
       {
       return(this.bots[i].id);
       } // if
    } // for

for (let i = this.api_bot_history_log.length - 1; i >= 0; i--)
    {
    let entry = this.api_bot_history_log[i];

    if (!entry.snapshot || !entry.snapshot.adress)
       {
       continue;
       } // if

    if (String(entry.snapshot.adress) === normalized_address)
       {
       return(entry.bot_id);
       } // if
    } // for

return(null);
} // apicall_resolve_bot_id_by_address()


apicall_get_last_moves(limit)
{
let normalized_limit = Number(limit);
if (!Number.isFinite(normalized_limit) || normalized_limit <= 0)
   {
   normalized_limit = 10;
   } // if

let moves = this.api_action_log;

if (moves.length > normalized_limit)
   {
   moves = moves.slice(moves.length - normalized_limit);
   } // if

return(
       {
       ok: true,
       answer: "api_get_last_moves",
       limit: normalized_limit,
       count: moves.length,
       moves: moves
       }
       );
} // apicall_get_last_moves()


apicall_get_last_raw_cmds(limit)
{
let normalized_limit = Number(limit);
let raw_cmds = this.api_raw_cmd_log;

if (!Number.isFinite(normalized_limit) || normalized_limit <= 0)
   {
   normalized_limit = 10;
   } // if

if (raw_cmds.length > normalized_limit)
   {
   raw_cmds = raw_cmds.slice(raw_cmds.length - normalized_limit);
   } // if

return({
       ok: true,
       answer: "api_get_last_raw_cmds",
       limit: normalized_limit,
       count: raw_cmds.length,
       raw_cmds: raw_cmds
       });
} // apicall_get_last_raw_cmds()


apicall_get_status_extended()
{
let total_bots = this.bots.length;
let cluster_bots = this.bots.filter((bot) => bot.id != "masterbot");
let cluster_count = cluster_bots.length;
let bounding_box = null;

if (cluster_count > 0)
   {
   let min_x = Number(cluster_bots[0].x);
   let max_x = Number(cluster_bots[0].x);
   let min_y = Number(cluster_bots[0].y);
   let max_y = Number(cluster_bots[0].y);
   let min_z = Number(cluster_bots[0].z);
   let max_z = Number(cluster_bots[0].z);

   for (let i=1; i<cluster_count; i++)
       {
       let x = Number(cluster_bots[i].x);
       let y = Number(cluster_bots[i].y);
       let z = Number(cluster_bots[i].z);

       if (x < min_x) min_x = x;
       if (x > max_x) max_x = x;
       if (y < min_y) min_y = y;
       if (y > max_y) max_y = y;
       if (z < min_z) min_z = z;
       if (z > max_z) max_z = z;
       } // for

   bounding_box = {
                   min_x: min_x,
                   max_x: max_x,
                   min_y: min_y,
                   max_y: max_y,
                   min_z: min_z,
                   max_z: max_z
                   };
   } // if

return({
       ok: true,
       answer: "api_status_extended",
       loaded_bots_total: total_bots,
       loaded_cluster_bots: cluster_count,
       masterbot_connected: (this.MASTERBOT_CONNECTED == 1),
       masterbot_name: this.masterbot_name,
       bounding_box: bounding_box
       });
} // apicall_get_status_extended()


apicall_get_masterbot()
{
return({
       ok: true,
       answer: "api_get_masterbot",
       id: "masterbot",
       name: this.masterbot_name,
       connected: (this.MASTERBOT_CONNECTED == 1),
       connection_slot: String(this.mb['connection'] ?? "").toUpperCase(),
       position: {
                  x: Number(this.mb['x']),
                  y: Number(this.mb['y']),
                  z: Number(this.mb['z'])
                  },
       orientation: {
                     x: Number(this.mb['vx']),
                     y: Number(this.mb['vy']),
                     z: Number(this.mb['vz'])
                     }
       });
} // apicall_get_masterbot()


apicall_get_scan_state()
{
return({
       ok: true,
       answer: "api_get_scan_state",
       level1: {
                running: (this.scan_status == 1),
                waiting_counter: Number(this.scanwaitingcounter),
                max_waiting_counter: Number(this.max_scanwaitingcounter)
                },
       level2: {
                running: (this.scan_status_lvl2 == 1),
                waiting_counter: Number(this.scanwaitingcounter_lvl2),
                max_waiting_counter: Number(this.max_scanwaitingcounter)
                },
       loaded_bots: Number(this.bots.length),
       detected_inactive_bots: Number(this.detected_inactive_bots.length)
       });
} // apicall_get_scan_state()


apicall_gui_set_marker(x, y, z, size, color)
{
const allowed_colors = ['red', 'green', 'blue', 'yellow', 'cyan', 'white'];
let marker_x = Number(x);
let marker_y = Number(y);
let marker_z = Number(z);
let marker_size = Number(size);
let marker_color = String(color ?? "").trim().toLowerCase();

if (
    Number.isNaN(marker_x) ||
    Number.isNaN(marker_y) ||
    Number.isNaN(marker_z) ||
    Number.isNaN(marker_size)
   )
   {
   return({
          ok: false,
          answer: "api_gui_set_marker",
          error: "INVALID_MARKER_PARAMETERS"
          });
   } // if

if (marker_size <= 0)
   {
   return({
          ok: false,
          answer: "api_gui_set_marker",
          error: "INVALID_MARKER_SIZE"
          });
   } // if

if (!allowed_colors.includes(marker_color))
   {
   return({
          ok: false,
          answer: "api_gui_set_marker",
          error: "INVALID_MARKER_COLOR",
          allowed_colors: allowed_colors
          });
   } // if

const events = [];
events.push(
           {
           event: "setmarker",
           x: marker_x,
           y: marker_y,
           z: marker_z,
           size: marker_size,
           color: marker_color,
           opacity: 0.8
           }
           );

const sent = this.notify_frontend(events);

return({
       ok: true,
       answer: "api_gui_set_marker",
       accepted: true,
       frontend_attached: sent,
       marker: {
                x: marker_x,
                y: marker_y,
                z: marker_z,
                size: marker_size,
                color: marker_color,
                opacity: 0.8
                }
       });
} // apicall_gui_set_marker()


apicall_gui_clear_markers()
{
const events = [];
events.push(
           {
           event: "clearmarkers"
           }
           );

const sent = this.notify_frontend(events);

return({
       ok: true,
       answer: "api_gui_clear_markers",
       accepted: true,
       frontend_attached: sent
       });
} // apicall_gui_clear_markers()


apicall_gui_refresh()
{
const events = [];
events.push(
           {
           event: "refreshworld"
           }
           );

const sent = this.notify_frontend(events);

return({
       ok: true,
       answer: "api_gui_refresh",
       accepted: true,
       frontend_attached: sent
       });
} // apicall_gui_refresh()


apicall_set_debug_move(mode)
{
let normalized_mode = String(mode ?? "status").trim().toLowerCase();

if (normalized_mode == "")
   {
   normalized_mode = "status";
   } // if

if (normalized_mode == "on")
   {
   this.debug_move_enabled = true;
   } // if
else if (normalized_mode == "off")
   {
   this.debug_move_enabled = false;
   } // else if
else if (normalized_mode != "status")
   {
   return({
          ok: false,
          answer: "api_debug_move",
          error: "INVALID_MODE",
          mode: normalized_mode,
          allowed_modes: ["on", "off", "status"]
          });
   } // else if

return({
       ok: true,
       answer: "api_debug_move",
       mode: normalized_mode,
       debug_move_enabled: (this.debug_move_enabled === true)
       });
} // apicall_set_debug_move()


apicall_get_api_messages(filter_cmd, limit)
{
let normalized_filter_cmd = null;

if (typeof filter_cmd == "string" && filter_cmd.trim() != "")
   {
   normalized_filter_cmd = filter_cmd.trim().toUpperCase();
   } // if

let normalized_limit = Number(limit);
if (!Number.isFinite(normalized_limit) || normalized_limit <= 0)
   {
   normalized_limit = 50;
   } // if

let filtered_messages = this.api_message_log.filter((entry) =>
                                                    {
                                                    if (normalized_filter_cmd == null) return true;
                                                    return (String(entry.cmd_name ?? "").toUpperCase() == normalized_filter_cmd);
                                                    });

if (filtered_messages.length > normalized_limit)
   {
   filtered_messages = filtered_messages.slice(filtered_messages.length - normalized_limit);
   } // if

return(
       {
       ok: true,
       answer: "api_get_api_messages",
       filter_cmd: normalized_filter_cmd,
       limit: normalized_limit,
       count: filtered_messages.length,
       messages: filtered_messages
       }
       );
} // apicall_get_api_messages()
   
   
   
   

 
loadconfig(filePath) {
  const configData = fs.readFileSync(filePath, 'utf-8');
  const config = {};

  configData.split('\n').forEach(line => 
  {
    const [key, value] = line.split('=');
    if (key && value) {
                      config[key.trim()] = value.trim();
                      }
  });

  return config;
}  
 
 
  
 
split_first(text, separator) {
  const index = text.indexOf(separator);
  if (index === -1) {
    return [text, null]; // Separator not found
  }
  const part1 = text.slice(0, index);
  const part2 = text.slice(index + separator.length);
  return [part1, part2];
}

 

 
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
// createAlgorithm()
// Called by prepare_morph()
//
createAlgorithm(algoName, startBots, targetBots, params) {

    switch (algoName) {
        //case "simple": return new MorphBFSSimple(startBots, targetBots, params);
        case "wavefront": return new MorphBFSWavefront(startBots, targetBots, params);
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
    let { id, x, y, z } = this.bots[i];    
    
       {
       startBots.push( { id:id, x:Number(x), y:Number(y), z:Number(z) } ) ;
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
  
 
 




this.notify_frontend_console("Prepare Morph");

algo.run( this,  this.morph_finish_handler.bind(this) );




} // prepare_morph( structure )


 


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

 
this.self_assembly_obj.run_sequence( "morph" );
  
} // morph_finish_handler()




//
// create_opcode_sequence()
//
create_opcode_sequence( morphLog )
{
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
        
        
 
       

       
        // console.log("Blocked bots:");
        // console.log(blockedBots);
        
        
       
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
        if (i < (size-1) )
           {
           signal += "sig" + (signalindex);
           
           signal_botids[signal] = { thebotid:thebotid, to:{x:bot_to.x, y:bot_to.y, z:bot_to.z} };
           signalindex++;
           
           signalbuffer += signal + " ";
           } else
             {
             signal = "FIN";
             signal_botids[signal] = { thebotid:thebotid, to:{x:bot_to.x, y:bot_to.y, z:bot_to.z} };
             }
    
    
    
        let cmd = "";
    
    
        cmd += bots_tmp[bindex].adress + "#MOVE#";


        let fullPath = morphLog.waves[i].moves[i2].fullPath;
        
        let result = this.calc_move_cmds(fullPath, bots_tmp[bindex].vector_x, bots_tmp[bindex].vector_y, bots_tmp[bindex].vector_z ,bots_tmp);
        
        let movecmds = result.movecmds;
            
           
        if (locallog) console.log("movecmds: ["+movecmds+"]");

 
 
 
        
    
      
      
        // UPDATE bots_tmp: verschiebe den aktuellen Bot auf die neue Position
        bots_tmp[bindex].x = bot_to.x;
        bots_tmp[bindex].y = bot_to.y;
        bots_tmp[bindex].z = bot_to.z;

        
        
        
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
calc_move_cmds(fullPath, vx, vy, vz, bots )
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

// console.log("ret: calc_move_cmds");
// console.log( ret );

return(ret);
} // calc_move_cmds




 


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
let botindex = this.get_bot_by_id( bot_id, this.bots );

if ( botindex == null )
   {
   return({
          ok: false,
          answer: "api_get_bot_by_id",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

let bot = this.bots[botindex];

return({
       ok: true,
       answer: "api_get_bot_by_id",
       bot_id: bot.id,
       position: {
                  x: Number(bot.x),
                  y: Number(bot.y),
                  z: Number(bot.z)
                  },
       orientation: {
                     x: Number(bot.vector_x),
                     y: Number(bot.vector_y),
                     z: Number(bot.vector_z)
                     },
       adress: this.apicall_get_safe_adress(bot)
       });
} // apicall_get_bot_by_id()


//
// apicall_get_safe_adress()
//
apicall_get_safe_adress( bot )
{
if ( !bot || bot.id == "masterbot" )
   {
   return("");
   } // if

let adress = bot.adress ?? "";

if ( typeof adress != "string" )
   {
   return("");
   } // if

adress = adress.replace(/^undefined/gi, "");

return(adress);
} // apicall_get_safe_adress()


//
// apicall_recalibrate_bot_address()
//
apicall_recalibrate_bot_address(bot_id, mode = "standard")
{
let normalized_bot_id = String(bot_id ?? "").trim();
let normalized_mode = String(mode ?? "standard").trim().toLowerCase();
let botindex = this.get_bot_by_id(normalized_bot_id, this.bots);
let old_adress = "";
let new_adress = "";

if (normalized_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_recalibrate_bot_address",
          error: "BOT_ID_EMPTY"
          });
   } // if

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_recalibrate_bot_address",
          error: "BOT_NOT_FOUND",
          bot_id: normalized_bot_id
          });
   } // if

if (this.bots[botindex].id == "masterbot")
   {
   return({
          ok: true,
          answer: "api_recalibrate_bot_address",
          bot_id: normalized_bot_id,
          skipped: true,
          reason: "MASTERBOT_HAS_NO_ADDRESS",
          old_adress: "",
          new_adress: ""
          });
   } // if

old_adress = this.apicall_get_safe_adress(this.bots[botindex]);
new_adress = this.get_mb_returnaddr(
                                    {x: this.mb.x, y: this.mb.y, z: this.mb.z},
                                    {
                                    x: Number(this.bots[botindex].x),
                                    y: Number(this.bots[botindex].y),
                                    z: Number(this.bots[botindex].z)
                                    },
                                    this.bots,
                                    [],
                                    { routing_mode: normalized_mode }
                                    );

this.bots[botindex].adress = new_adress;

return({
       ok: true,
       answer: "api_recalibrate_bot_address",
       bot_id: normalized_bot_id,
       mode: normalized_mode,
       old_adress: old_adress,
       new_adress: new_adress,
       changed: (String(old_adress) !== String(new_adress)),
       position: {
                  x: Number(this.bots[botindex].x),
                  y: Number(this.bots[botindex].y),
                  z: Number(this.bots[botindex].z)
                  }
       });
} // apicall_recalibrate_bot_address()


//
// apicall_recalibrate_bot_addresses()
//
apicall_recalibrate_bot_addresses(mode = "standard")
{
let recalibrated = [];
let changed_count = 0;
let normalized_mode = String(mode ?? "standard").trim().toLowerCase();

for (let i = 0; i < this.bots.length; i++)
    {
    if (this.bots[i].id == "masterbot")
       {
       continue;
       } // if

    let ret = this.apicall_recalibrate_bot_address(this.bots[i].id, normalized_mode);
    recalibrated.push(ret);

    if (ret?.changed === true)
       {
       changed_count++;
       } // if
    } // for

return({
       ok: true,
       answer: "api_recalibrate_bot_addresses",
       mode: normalized_mode,
       count: recalibrated.length,
       changed_count: changed_count,
       recalibrated: recalibrated
       });
} // apicall_recalibrate_bot_addresses()


//
// apicall_apply_safe_mode_for_bot()
//
apicall_apply_safe_mode_for_bot(bot_id)
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (Number(this.safe_mode) < 1)
   {
   return({
          ok: true,
          answer: "api_safe_mode_prepare",
          bot_id: normalized_bot_id,
          safe_mode: Number(this.safe_mode),
          recalibrated: false
          });
   } // if

if (Number(this.safe_mode) >= 2)
   {
   return({
          ok: true,
          answer: "api_safe_mode_prepare",
          bot_id: normalized_bot_id,
          safe_mode: Number(this.safe_mode),
          recalibrated: false,
          deferred_global_recalibration: true
          });
   } // if

let ret = this.apicall_recalibrate_bot_address(normalized_bot_id);

return({
       ok: ret.ok,
       answer: "api_safe_mode_prepare",
       bot_id: normalized_bot_id,
       safe_mode: Number(this.safe_mode),
       recalibrated: (ret.ok === true),
       recalibration: ret
       });
} // apicall_apply_safe_mode_for_bot()


//
// apicall_apply_safe_mode_after_structure_change()
//
apicall_apply_safe_mode_after_structure_change(trigger_bot_id, change_type = "structure_change")
{
let normalized_bot_id = String(trigger_bot_id ?? "").trim();

if (Number(this.safe_mode) < 2)
   {
   return({
          ok: true,
          answer: "api_safe_mode_after_change",
          bot_id: normalized_bot_id,
          safe_mode: Number(this.safe_mode),
          recalibrated: false,
          change_type: String(change_type ?? "structure_change")
          });
   } // if

let recalibration_ret = this.apicall_recalibrate_bot_addresses();

return({
       ok: recalibration_ret.ok,
       answer: "api_safe_mode_after_change",
       bot_id: normalized_bot_id,
       safe_mode: Number(this.safe_mode),
       recalibrated: (recalibration_ret.ok === true),
       change_type: String(change_type ?? "structure_change"),
       recalibration: recalibration_ret
       });
} // apicall_apply_safe_mode_after_structure_change()


//
// apicall_set_safe_mode()
//
apicall_set_safe_mode(mode)
{
let normalized_mode = String(mode ?? "status").trim().toLowerCase();

if (normalized_mode == "status")
   {
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (normalized_mode == "0" || normalized_mode == "off")
   {
   this.safe_mode = 0;
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (normalized_mode == "1")
   {
   this.safe_mode = 1;
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (normalized_mode == "2" || normalized_mode == "on")
   {
   this.safe_mode = 2;
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(this.safe_mode)
          });
   } // if

return({
       ok: false,
       answer: "api_safe_mode",
       error: "INVALID_SAFE_MODE",
       mode: mode
       });
} // apicall_set_safe_mode()


//
// apicall_get_bots()
//
apicall_get_bots( center_x, center_y, center_z, mode, radius )
{
let retbots = [];

center_x = Number(center_x);
center_y = Number(center_y);
center_z = Number(center_z);
radius   = Number(radius);

if ( Number.isNaN(center_x) || Number.isNaN(center_y) || Number.isNaN(center_z) || Number.isNaN(radius) )
   {
   return({
          ok: false,
          answer: "api_get_bots",
          error: "INVALID_PARAMETERS"
          });
   } // if

if ( mode != "cube" )
   {
   return({
          ok: false,
          answer: "api_get_bots",
          error: "UNSUPPORTED_MODE",
          mode: mode
          });
   } // if

for (let i=0; i<this.bots.length; i++)
    {
    let dx = Math.abs( Number(this.bots[i].x) - center_x );
    let dy = Math.abs( Number(this.bots[i].y) - center_y );
    let dz = Math.abs( Number(this.bots[i].z) - center_z );

    if ( dx <= radius && dy <= radius && dz <= radius )
       {
       retbots.push({
                    id: this.bots[i].id,
                    position: {
                               x: Number(this.bots[i].x),
                               y: Number(this.bots[i].y),
                               z: Number(this.bots[i].z)
                               },
                    orientation: {
                                  x: Number(this.bots[i].vector_x),
                                  y: Number(this.bots[i].vector_y),
                                  z: Number(this.bots[i].vector_z)
                                  },
                    adress: this.apicall_get_safe_adress(this.bots[i])
                    });
       } // if
    } // for

return({
       ok: true,
       answer: "api_get_bots",
       mode: "cube",
       center: {
                x: center_x,
                y: center_y,
                z: center_z
                },
       radius: radius,
       count: retbots.length,
       bots: retbots
       });
} // apicall_get_bots()


//
// apicall_raw_cmd()
//
apicall_raw_cmd( raw_value )
{
if ( typeof raw_value != "string" || raw_value.trim() == "" )
   {
   return({
          ok: false,
          answer: "api_raw_cmd",
          error: "EMPTY_RAW_COMMAND"
          });
   } // if

if ( this.MASTERBOT_CONNECTED != 1 )
   {
   return({
          ok: false,
          answer: "api_raw_cmd",
          error: "MASTERBOT_NOT_CONNECTED"
          });
   } // if

let param = this.sign( raw_value.trim() );
let cmd = JSON.stringify({ cmd: "push", param }) + "\n";

this.client.write(cmd);

return({
       ok: true,
       answer: "api_raw_cmd",
       accepted: true,
       raw_value: raw_value.trim()
       });
} // apicall_raw_cmd()


//
// apicall_poll_masterbot_queue()
//
apicall_poll_masterbot_queue()
{
if ( this.MASTERBOT_CONNECTED != 1 )
   {
   return({
          ok: false,
          answer: "api_poll_masterbot_queue",
          error: "MASTERBOT_NOT_CONNECTED"
          });
   } // if

let cmd = JSON.stringify({ cmd: "pop", param: "" }) + "\n";
this.client.write(cmd);

return({
       ok: true,
       answer: "api_poll_masterbot_queue",
       accepted: true
       });
} // apicall_poll_masterbot_queue()


//
// apicall_get_inactive_bots()
//
apicall_get_inactive_bots()
{
let retbots = [];
let size = this.detected_inactive_bots.length;

for (let i=0; i<size; i++)
    {
    retbots.push(
                {
                id: this.detected_inactive_bots[i].id,
                position: {
                           x: Number(this.detected_inactive_bots[i].x),
                           y: Number(this.detected_inactive_bots[i].y),
                           z: Number(this.detected_inactive_bots[i].z)
                           },
                orientation: {
                              x: Number(this.detected_inactive_bots[i].vx),
                              y: Number(this.detected_inactive_bots[i].vy),
                              z: Number(this.detected_inactive_bots[i].vz)
                              },
                color: this.detected_inactive_bots[i].col,
                source_bot_id: this.detected_inactive_bots[i].source_bot_id,
                source_slot: this.detected_inactive_bots[i].source_slot
                }
                );
    } // for

return({
       ok: true,
       answer: "api_get_inactive_bots",
       count: retbots.length,
       bots: retbots
       });
} // apicall_get_inactive_bots()


apicall_get_inactive_bot_by_xyz(x, y, z)
{
let size = this.detected_inactive_bots.length;

for (let i=0; i<size; i++)
    {
    if (
        Number(this.detected_inactive_bots[i].x) == Number(x) &&
        Number(this.detected_inactive_bots[i].y) == Number(y) &&
        Number(this.detected_inactive_bots[i].z) == Number(z)
       )
       {
       return this.detected_inactive_bots[i];
       } // if
    } // for

return null;
} // apicall_get_inactive_bot_by_xyz()


//
// apicall_get_neighbors()
//
apicall_get_neighbors(bot_id)
{
let botindex = this.get_bot_by_id(bot_id, this.bots);
const slotnames = ['F','R','B','L','T','D'];
let neighbors = {};

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_get_neighbors",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

for (let i=0; i<slotnames.length; i++)
    {
    let slotname = slotnames[i];
    let target_xyz = this.get_next_target_coor(
                                          this.bots[botindex].x,
                                          this.bots[botindex].y,
                                          this.bots[botindex].z,
                                          this.bots[botindex].vector_x,
                                          this.bots[botindex].vector_y,
                                          this.bots[botindex].vector_z,
                                          slotname
                                          );

    let target_bot_index = this.get_3d(target_xyz.x, target_xyz.y, target_xyz.z);
    let inactive_bot = this.apicall_get_inactive_bot_by_xyz(target_xyz.x, target_xyz.y, target_xyz.z);

    neighbors[slotname] = {
                          position: {
                                     x: Number(target_xyz.x),
                                     y: Number(target_xyz.y),
                                     z: Number(target_xyz.z)
                                     },
                          state: "empty"
                          };

    if (inactive_bot != null)
       {
       neighbors[slotname] = {
                             position: {
                                        x: Number(target_xyz.x),
                                        y: Number(target_xyz.y),
                                        z: Number(target_xyz.z)
                                        },
                             state: "inactive",
                             id: inactive_bot.id,
                             color: inactive_bot.col,
                             source_bot_id: inactive_bot.source_bot_id,
                             source_slot: inactive_bot.source_slot
                             };
       } // if

    if (target_bot_index != null)
       {
       neighbors[slotname] = {
                             position: {
                                        x: Number(target_xyz.x),
                                        y: Number(target_xyz.y),
                                        z: Number(target_xyz.z)
                                        },
                             state: "active",
                             id: this.bots[target_bot_index].id,
                             orientation: {
                                           x: Number(this.bots[target_bot_index].vector_x),
                                           y: Number(this.bots[target_bot_index].vector_y),
                                           z: Number(this.bots[target_bot_index].vector_z)
                                           },
                             adress: this.apicall_get_safe_adress(this.bots[target_bot_index])
                             };
       } // if
    } // for

return({
       ok: true,
       answer: "api_get_neighbors",
       bot_id: bot_id,
       center: {
                position: {
                           x: Number(this.bots[botindex].x),
                           y: Number(this.bots[botindex].y),
                           z: Number(this.bots[botindex].z)
                           },
                orientation: {
                              x: Number(this.bots[botindex].vector_x),
                              y: Number(this.bots[botindex].vector_y),
                              z: Number(this.bots[botindex].vector_z)
                              }
                },
       neighbors: neighbors
       });
} // apicall_get_neighbors()


//
// apicall_is_occupied()
//
apicall_is_occupied(x, y, z)
{
let target_bot_index = this.get_3d(x, y, z);
let inactive_bot = this.apicall_get_inactive_bot_by_xyz(x, y, z);

if (target_bot_index != null)
   {
   return({
          ok: true,
          answer: "api_is_occupied",
          position: {
                     x: Number(x),
                     y: Number(y),
                     z: Number(z)
                     },
          occupied: true,
          state: "active",
          id: this.bots[target_bot_index].id,
          orientation: {
                        x: Number(this.bots[target_bot_index].vector_x),
                        y: Number(this.bots[target_bot_index].vector_y),
                        z: Number(this.bots[target_bot_index].vector_z)
                        },
          adress: this.apicall_get_safe_adress(this.bots[target_bot_index])
          });
   } // if

if (inactive_bot != null)
   {
   return({
          ok: true,
          answer: "api_is_occupied",
          position: {
                     x: Number(x),
                     y: Number(y),
                     z: Number(z)
                     },
          occupied: true,
          state: "inactive",
          id: inactive_bot.id,
          color: inactive_bot.col,
          source_bot_id: inactive_bot.source_bot_id,
          source_slot: inactive_bot.source_slot
          });
   } // if

return({
       ok: true,
       answer: "api_is_occupied",
       position: {
                  x: Number(x),
                  y: Number(y),
                  z: Number(z)
                  },
       occupied: false,
       state: "empty"
       });
} // apicall_is_occupied()


apicall_is_occupied_excluding_ids(x, y, z, excluded_bot_ids = [])
{
let normalized_excluded_ids = new Set(
                                      (Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [])
                                      .map((id) => String(id ?? "").trim())
                                      .filter((id) => id != "")
                                      );
let occupancy = this.apicall_is_occupied(x, y, z);

if (occupancy.occupied !== true)
   {
   return(occupancy);
   } // if

if (normalized_excluded_ids.has(String(occupancy.id ?? "")))
   {
   return({
          ok: true,
          answer: "api_is_occupied",
          position: {
                     x: Number(x),
                     y: Number(y),
                     z: Number(z)
                     },
          occupied: false,
          state: "excluded",
          excluded_id: occupancy.id
          });
   } // if

return(occupancy);
} // apicall_is_occupied_excluding_ids()


//
// apicall_get_slot_status()
//
apicall_get_slot_status(bot_id, slot)
{
let botindex = this.get_bot_by_id(bot_id, this.bots);
let normalized_slot = String(slot ?? "").trim().toUpperCase();
const valid_slots = ['F','R','B','L','T','D'];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_get_slot_status",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if (!valid_slots.includes(normalized_slot))
   {
   return({
          ok: false,
          answer: "api_get_slot_status",
          error: "INVALID_SLOT",
          bot_id: bot_id,
          slot: normalized_slot
          });
   } // if

let target_xyz = this.get_next_target_coor(
                                      this.bots[botindex].x,
                                      this.bots[botindex].y,
                                      this.bots[botindex].z,
                                      this.bots[botindex].vector_x,
                                      this.bots[botindex].vector_y,
                                      this.bots[botindex].vector_z,
                                      normalized_slot
                                      );

let occupancy = this.apicall_is_occupied(target_xyz.x, target_xyz.y, target_xyz.z);

return({
       ok: true,
       answer: "api_get_slot_status",
       bot_id: bot_id,
       slot: normalized_slot,
       center: {
                position: {
                           x: Number(this.bots[botindex].x),
                           y: Number(this.bots[botindex].y),
                           z: Number(this.bots[botindex].z)
                           },
                orientation: {
                              x: Number(this.bots[botindex].vector_x),
                              y: Number(this.bots[botindex].vector_y),
                              z: Number(this.bots[botindex].vector_z)
                              }
                },
       target: occupancy
       });
} // apicall_get_slot_status()


//
// apicall_probe_move_bot()
//
apicall_probe_move_bot(bot_id, move)
{
let botindex = this.get_bot_by_id(bot_id, this.bots);
let normalized_move = String(move ?? "").trim().toUpperCase();
const valid_slots = ['F','R','B','L','T','D'];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if (normalized_move == "")
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "EMPTY_MOVE",
          bot_id: bot_id
          });
   } // if

if (normalized_move.includes(";"))
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "MOVE_SEQUENCES_ARE_NOT_YET_SUPPORTED",
          bot_id: bot_id,
          move: normalized_move
          });
   } // if

if (/[0-9]+$/g.test(normalized_move))
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "MOVE_REPETITIONS_CANNOT_CURRENTLY_BE_VALIDATED",
          bot_id: bot_id,
          move: normalized_move
          });
   } // if

let moveparts = normalized_move.split("_");

if (moveparts.length != 3)
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "INVALID_MOVE_FORMAT",
          bot_id: bot_id,
          move: normalized_move
          });
   } // if

let start_slot = moveparts[0];
let move_path = moveparts[1];
let end_slot = moveparts[2];

if (!valid_slots.includes(start_slot) || !valid_slots.includes(end_slot))
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "UNSUPPORTED_MOVE_ANCHOR",
          bot_id: bot_id,
          move: normalized_move
          });
   } // if

if (!/^[FRBLTD]+$/g.test(move_path))
   {
   return({
          ok: false,
          answer: "api_probe_move_bot",
          error: "MOVE_PATH_CANNOT_CURRENTLY_BE_VALIDATED",
          bot_id: bot_id,
          move: normalized_move
          });
   } // if

let bot = this.bots[botindex];
let start_status = this.apicall_get_slot_status(bot_id, start_slot);
let predicted_x = Number(bot.x);
let predicted_y = Number(bot.y);
let predicted_z = Number(bot.z);

for (let i=0; i<move_path.length; i++)
    {
    let step_slot = move_path.charAt(i);
    let target_xyz = this.get_next_target_coor(
                                          predicted_x,
                                          predicted_y,
                                          predicted_z,
                                          Number(bot.vector_x),
                                          Number(bot.vector_y),
                                          Number(bot.vector_z),
                                          step_slot
                                          );

    predicted_x = Number(target_xyz.x);
    predicted_y = Number(target_xyz.y);
    predicted_z = Number(target_xyz.z);
    } // for

let target_occupancy = this.apicall_is_occupied(predicted_x, predicted_y, predicted_z);
let end_anchor_xyz = this.get_next_target_coor(
                                          predicted_x,
                                          predicted_y,
                                          predicted_z,
                                          Number(bot.vector_x),
                                          Number(bot.vector_y),
                                          Number(bot.vector_z),
                                          end_slot
                                          );
let end_anchor_occupancy = this.apicall_is_occupied(end_anchor_xyz.x, end_anchor_xyz.y, end_anchor_xyz.z);
let possible = true;
let reasons = [];

if (start_status.target.occupied !== true)
   {
   possible = false;
   reasons.push("Start anchor is not occupied.");
   } // if

if (target_occupancy.occupied === true)
   {
   possible = false;
   reasons.push("Predicted target position is already occupied.");
   } // if

if (end_anchor_occupancy.occupied !== true)
   {
   possible = false;
   reasons.push("End anchor is not occupied.");
   } // if

if (reasons.length == 0)
   {
   reasons.push("Local occupancy check passed.");
   } // if

return({
       ok: true,
       answer: "api_probe_move_bot",
       bot_id: bot_id,
       move: normalized_move,
       possible: possible,
       center: {
                position: {
                           x: Number(bot.x),
                           y: Number(bot.y),
                           z: Number(bot.z)
                           },
                orientation: {
                              x: Number(bot.vector_x),
                              y: Number(bot.vector_y),
                              z: Number(bot.vector_z)
                              }
                },
       predicted_target: {
                          x: predicted_x,
                          y: predicted_y,
                          z: predicted_z
                          },
       start_anchor: start_status.target,
       target_status: target_occupancy,
       end_anchor: end_anchor_occupancy,
       notes: reasons
       });
} // apicall_probe_move_bot()


//
// apicall_can_reach_position()
//
apicall_can_reach_position(bot_id, x, y, z)
{
let botindex = this.get_bot_by_id(bot_id, this.bots);
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
const target_neighbor_offsets = [
                                { x: 1,  y: 0,  z: 0 },
                                { x: -1, y: 0,  z: 0 },
                                { x: 0,  y: 1,  z: 0 },
                                { x: 0,  y: -1, z: 0 },
                                { x: 0,  y: 0,  z: 1 },
                                { x: 0,  y: 0,  z: -1 }
                                ];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_can_reach_position",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if ( Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z) )
   {
   return({
          ok: false,
          answer: "api_can_reach_position",
          error: "INVALID_TARGET_POSITION",
          bot_id: bot_id
          });
   } // if

let bot = this.bots[botindex];
let dx = target_x - Number(bot.x);
let dy = target_y - Number(bot.y);
let dz = target_z - Number(bot.z);
let manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
let target_status = this.apicall_is_occupied(target_x, target_y, target_z);
let target_local_contacts = 0;
let reachable = false;
let reason = "COMPLEX_PATH_SEARCH_NOT_YET_IMPLEMENTED";
let notes = [];

for (let i=0; i<target_neighbor_offsets.length; i++)
    {
    let nx = target_x + target_neighbor_offsets[i].x;
    let ny = target_y + target_neighbor_offsets[i].y;
    let nz = target_z + target_neighbor_offsets[i].z;
    let neighbor_status = this.apicall_is_occupied(nx, ny, nz);

    if (neighbor_status.occupied === true)
       {
       target_local_contacts++;
       } // if
    } // for

if (target_status.occupied === true)
   {
   reachable = false;
   reason = "TARGET_POSITION_IS_OCCUPIED";
   notes.push("The requested target coordinate is already occupied.");
   } // if
else if (dx == 0 && dy == 0 && dz == 0)
   {
   reachable = true;
   reason = "ALREADY_AT_TARGET";
   notes.push("Bot is already located at the requested target position.");
   } // if
else if (manhattan == 1)
   {
   reachable = true;
   reason = "DIRECT_NEIGHBOR_TARGET";
   notes.push("Target is one orthogonal step away.");
   } // if
else if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && Math.abs(dz) <= 1 && manhattan <= 2)
   {
   reachable = false;
   reason = "LOCAL_TARGET_REQUIRES_PATH_SEARCH";
   notes.push("Target is local, but a path search is still required.");
   } // if
else
   {
   reachable = false;
   reason = "COMPLEX_PATH_SEARCH_NOT_YET_IMPLEMENTED";
   notes.push("Current implementation only performs a conservative surface check.");
   } // else

if (target_local_contacts == 0)
   {
   notes.push("Target coordinate currently has no occupied orthogonal neighbors.");
   } // if
else
   {
   notes.push("Target coordinate has " + target_local_contacts + " occupied orthogonal neighbor(s).");
   } // else

return({
       ok: true,
       answer: "api_can_reach_position",
       evaluation_mode: "surface-check",
       bot_id: bot_id,
       center: {
                position: {
                           x: Number(bot.x),
                           y: Number(bot.y),
                           z: Number(bot.z)
                           },
                orientation: {
                              x: Number(bot.vector_x),
                              y: Number(bot.vector_y),
                              z: Number(bot.vector_z)
                              }
                },
       target: {
                x: target_x,
                y: target_y,
                z: target_z
                },
       distance: {
                  dx: dx,
                  dy: dy,
                  dz: dz,
                  manhattan: manhattan
                  },
       target_status: target_status,
       target_local_contacts: target_local_contacts,
       reachable: reachable,
       reason: reason,
       notes: notes
       });
} // apicall_can_reach_position()


apicall_create_sparse_grid()
{
const store = new Map();

return({
       set(x, y, z, value = 1) {
         store.set(`${x},${y},${z}`, value);
         return(true);
       }, // set()
       get(x, y, z) {
         const key = `${x},${y},${z}`;
         return store.has(key) ? store.get(key) : null;
       }, // get()
       keys() {
         return Array.from(store.keys());
       } // keys()
       });
} // apicall_create_sparse_grid()


apicall_build_structure_grid_without_bot(bot_id, excluded_bot_ids = [])
{
let grid = this.apicall_create_sparse_grid();
let excluded_ids = new Set(
                          (Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [])
                          .map((id) => String(id ?? "").trim())
                          .filter((id) => id != "")
                          );

for (let i=0; i<this.bots.length; i++)
    {
    if (this.bots[i].id == "masterbot") continue;
    if (this.bots[i].id == bot_id) continue;
    if (excluded_ids.has(String(this.bots[i].id ?? ""))) continue;

    grid.set(
             Number(this.bots[i].x),
             Number(this.bots[i].y),
             Number(this.bots[i].z),
             this.bots[i].id
             );
    } // for

return(grid);
} // apicall_build_structure_grid_without_bot()


apicall_would_split_cluster(bot_id)
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "BOT_ID_MISSING"
          });
   } // if

if (normalized_bot_id == "masterbot")
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "MASTERBOT_REMOVAL_UNSUPPORTED"
          });
   } // if

let target_index = this.get_bot_by_id(normalized_bot_id, this.bots);

if (target_index === null)
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "BOT_NOT_FOUND"
          });
   } // if

let remaining_bots = [];
let position_map = {};
let root_bot = null;

for (let i=0; i<this.bots.length; i++)
    {
    let bot = this.bots[i];

    if (!bot)
       {
       continue;
       } // if

    if (bot.id == normalized_bot_id)
       {
       continue;
       } // if

    remaining_bots.push(bot);
    position_map[`${Number(bot.x)},${Number(bot.y)},${Number(bot.z)}`] = bot;

    if (bot.id == "masterbot")
       {
       root_bot = bot;
       } // if
    } // for

if (remaining_bots.length == 0)
   {
   return({
          ok: true,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          removed_bot: this.apicall_get_bot_snapshot(normalized_bot_id),
          root_bot_id: "masterbot",
          would_split_cluster: false,
          remains_connected: true,
          visited_count: 0,
          remaining_count: 0,
          disconnected_count: 0,
          disconnected_bots: []
          });
   } // if

if (root_bot === null)
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "MASTERBOT_NOT_FOUND"
          });
   } // if

const key_for_bot = (bot) => `${Number(bot.x)},${Number(bot.y)},${Number(bot.z)}`;
const neighbor_offsets = [
                          { x: 1, y: 0, z: 0 },
                          { x: -1, y: 0, z: 0 },
                          { x: 0, y: 1, z: 0 },
                          { x: 0, y: -1, z: 0 },
                          { x: 0, y: 0, z: 1 },
                          { x: 0, y: 0, z: -1 }
                          ];

let visited = new Set();
let queue = [root_bot];
visited.add(key_for_bot(root_bot));

while (queue.length > 0)
      {
      let current = queue.shift();

      for (let i=0; i<neighbor_offsets.length; i++)
          {
          let offset = neighbor_offsets[i];
          let neighbor_key = `${Number(current.x) + offset.x},${Number(current.y) + offset.y},${Number(current.z) + offset.z}`;

          if (visited.has(neighbor_key))
             {
             continue;
             } // if

          if (!position_map[neighbor_key])
             {
             continue;
             } // if

          visited.add(neighbor_key);
          queue.push(position_map[neighbor_key]);
          } // for
      } // while

let disconnected_bots = [];

for (let i=0; i<remaining_bots.length; i++)
    {
    let bot = remaining_bots[i];
    let bot_key = key_for_bot(bot);

    if (!visited.has(bot_key))
       {
       disconnected_bots.push({
                              id: bot.id,
                              x: bot.x,
                              y: bot.y,
                              z: bot.z,
                              adress: this.apicall_get_safe_adress(bot)
                              });
       } // if
    } // for

let would_split_cluster = (disconnected_bots.length > 0);

return({
       ok: true,
       answer: "api_would_split_cluster",
       bot_id: normalized_bot_id,
       removed_bot: this.apicall_get_bot_snapshot(normalized_bot_id),
       root_bot_id: root_bot.id,
       would_split_cluster: would_split_cluster,
       remains_connected: !would_split_cluster,
       visited_count: visited.size,
       remaining_count: remaining_bots.length,
       disconnected_count: disconnected_bots.length,
       disconnected_bots: disconnected_bots
       });
} // apicall_would_split_cluster()


apicall_build_forbidden_grid()
{
let grid = this.apicall_create_sparse_grid();

for (let i=0; i<this.detected_inactive_bots.length; i++)
    {
    grid.set(
             Number(this.detected_inactive_bots[i].x),
             Number(this.detected_inactive_bots[i].y),
             Number(this.detected_inactive_bots[i].z),
             this.detected_inactive_bots[i].id
             );
    } // for

return(grid);
} // apicall_build_forbidden_grid()


apicall_get_wrapped_cell_for_double_step(from_pos, to_pos)
{
if (!from_pos || !to_pos)
   {
   return(null);
   } // if

let dx = Number(to_pos.x) - Number(from_pos.x);
let dy = Number(to_pos.y) - Number(from_pos.y);
let dz = Number(to_pos.z) - Number(from_pos.z);
let non_zero_axes = 0;

if (dx !== 0) non_zero_axes++;
if (dy !== 0) non_zero_axes++;
if (dz !== 0) non_zero_axes++;

if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 2)
   {
   return(null);
   } // if

if (non_zero_axes !== 2)
   {
   return(null);
   } // if

if (dy === 0)
   {
   return(null);
   } // if

return({
       x: Number(from_pos.x) + Number(dx),
       y: Number(from_pos.y),
       z: Number(from_pos.z) + Number(dz)
       });
} // apicall_get_wrapped_cell_for_double_step()


apicall_is_valid_wrapped_double_step(from_pos, to_pos, bots_s)
{
if (!bots_s)
   {
   return(false);
   } // if

let wrapped_cell = this.apicall_get_wrapped_cell_for_double_step(from_pos, to_pos);

if (!wrapped_cell)
   {
   return(false);
   } // if

return(
       bots_s.get(
                  Number(wrapped_cell.x),
                  Number(wrapped_cell.y),
                  Number(wrapped_cell.z)
                  ) !== null
       );
} // apicall_is_valid_wrapped_double_step()


apicall_calc_single_path(src, dest, bots_s, bots_f)
{
const key = (x, y, z) => `${x},${y},${z}`;
const visited = new Set();
const parent = new Map();
const queue = [];
let debug_rejections = [];

const is_structure = (x, y, z) => {
  return bots_s.get(Number(x), Number(y), Number(z)) !== null;
}; // is_structure()

const is_forbidden = (x, y, z) => {
  if (!bots_f) return(false);
  return bots_f.get(Number(x), Number(y), Number(z)) !== null;
}; // is_forbidden()

const is_empty = (x, y, z) => {
  return(!is_structure(x, y, z) && !is_forbidden(x, y, z));
}; // is_empty()

const has_contact = (x, y, z) => {
  const neighbors6 = [
                     { dx:  1, dy:  0, dz:  0 },
                     { dx: -1, dy:  0, dz:  0 },
                     { dx:  0, dy:  1, dz:  0 },
                     { dx:  0, dy: -1, dz:  0 },
                     { dx:  0, dy:  0, dz:  1 },
                     { dx:  0, dy:  0, dz: -1 }
                     ];

  for (let i = 0; i < neighbors6.length; i++)
      {
      const n = neighbors6[i];
      if (is_structure(Number(x) + Number(n.dx), Number(y) + Number(n.dy), Number(z) + Number(n.dz)))
         {
         return(true);
         } // if
      } // for

  return(false);
}; // has_contact()

const has_axis_lateral_anchor = (target_x, target_y, target_z, axis) => {
  if (axis === "x")
     {
     return(
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "y")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "z")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z)
            );
     } // if

  return(false);
}; // has_axis_lateral_anchor()

const movement_rules = [
  {
    name: "G_F",
    final: { dx:  1, dy:  0, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x")
  },
  {
    name: "G_B",
    final: { dx: -1, dy:  0, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x")
  },
  {
    name: "G_R",
    final: { dx:  0, dy:  0, dz: -1 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z")
  },
  {
    name: "G_L",
    final: { dx:  0, dy:  0, dz:  1 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z")
  },
  {
    name: "G_T",
    final: { dx:  0, dy:  1, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y")
  },
  {
    name: "G_D",
    final: { dx:  0, dy: -1, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y")
  },
  {
    name: "K_TF",
    final: { dx:  1, dy:  1, dz:  0 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx:  1, dy:  0, dz:  0 }
  },
  {
    name: "K_TB",
    final: { dx: -1, dy:  1, dz:  0 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx: -1, dy:  0, dz:  0 }
  },
  {
    name: "K_DF",
    final: { dx:  1, dy: -1, dz:  0 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx:  1, dy:  0, dz:  0 }
  },
  {
    name: "K_DB",
    final: { dx: -1, dy: -1, dz:  0 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx: -1, dy:  0, dz:  0 }
  },
  {
    name: "K_TR",
    final: { dx:  0, dy:  1, dz: -1 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz: -1 }
  },
  {
    name: "K_TL",
    final: { dx:  0, dy:  1, dz:  1 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz:  1 }
  },
  {
    name: "K_DR",
    final: { dx:  0, dy: -1, dz: -1 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz: -1 }
  },
  {
    name: "K_DL",
    final: { dx:  0, dy: -1, dz:  1 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz:  1 }
  },
  {
    name: "K_FT",
    final: { dx:  1, dy:  1, dz:  0 },
    intermediate: { dx:  1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_FD",
    final: { dx:  1, dy: -1, dz:  0 },
    intermediate: { dx:  1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  },
  {
    name: "K_BT",
    final: { dx: -1, dy:  1, dz:  0 },
    intermediate: { dx: -1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_BD",
    final: { dx: -1, dy: -1, dz:  0 },
    intermediate: { dx: -1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  },
  {
    name: "K_LT",
    final: { dx:  0, dy:  1, dz:  1 },
    intermediate: { dx:  0, dy:  0, dz:  1 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_LD",
    final: { dx:  0, dy: -1, dz:  1 },
    intermediate: { dx:  0, dy:  0, dz:  1 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  },
  {
    name: "K_RT",
    final: { dx:  0, dy:  1, dz: -1 },
    intermediate: { dx:  0, dy:  0, dz: -1 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_RD",
    final: { dx:  0, dy: -1, dz: -1 },
    intermediate: { dx:  0, dy:  0, dz: -1 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  }
]; // movement_rules

const getAllowedMoves3D = (startX, startY, startZ) => {
  const allowed = [];

  for (let i = 0; i < movement_rules.length; i++)
      {
      const rule = movement_rules[i];
      const final_x = Number(startX) + Number(rule.final.dx);
      const final_y = Number(startY) + Number(rule.final.dy);
      const final_z = Number(startZ) + Number(rule.final.dz);
      let rejection_reason = null;

      if (!is_empty(final_x, final_y, final_z))
         {
         rejection_reason = "TARGET_NOT_EMPTY";
         } // if
      else if (!has_contact(final_x, final_y, final_z))
         {
         rejection_reason = "NO_SURFACE_CONTACT";
         } // else if

      if (!rejection_reason && rule.anchor)
         {
         const anchor_x = Number(startX) + Number(rule.anchor.dx);
         const anchor_y = Number(startY) + Number(rule.anchor.dy);
         const anchor_z = Number(startZ) + Number(rule.anchor.dz);

         if (!is_structure(anchor_x, anchor_y, anchor_z))
            {
            rejection_reason = "RULE_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate)
         {
         const intermediate_x = Number(startX) + Number(rule.intermediate.dx);
         const intermediate_y = Number(startY) + Number(rule.intermediate.dy);
         const intermediate_z = Number(startZ) + Number(rule.intermediate.dz);

         if (!is_empty(intermediate_x, intermediate_y, intermediate_z))
            {
            rejection_reason = "INTERMEDIATE_NOT_EMPTY";
            } // if
         } // if

      if (!rejection_reason && typeof rule.validator == "function")
         {
         if (rule.validator(final_x, final_y, final_z) !== true)
            {
            rejection_reason = "AXIS_LATERAL_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate && Number(rule.final.dy) !== 0 && Number(rule.final.dx) + Number(rule.final.dz) !== 0)
         {
         if (this.apicall_is_valid_wrapped_double_step(
                                                     { x: Number(startX), y: Number(startY), z: Number(startZ) },
                                                     { x: Number(final_x), y: Number(final_y), z: Number(final_z) },
                                                     bots_s
                                                     ) !== true)
            {
            rejection_reason = "WRAPPED_CELL_MISSING";
            } // if
         } // if

      if (rejection_reason)
         {
         debug_rejections.push({
                                stage: "path_rule",
                                rule: rule.name,
                                from: {
                                       x: Number(startX),
                                       y: Number(startY),
                                       z: Number(startZ)
                                       },
                                to: {
                                     x: Number(final_x),
                                     y: Number(final_y),
                                     z: Number(final_z)
                                     },
                                reason: rejection_reason
                                });
         continue;
         } // if

      let path = [];

      if (rule.intermediate)
         {
         path.push([
                    Number(startX) + Number(rule.intermediate.dx),
                    Number(startY) + Number(rule.intermediate.dy),
                    Number(startZ) + Number(rule.intermediate.dz)
                    ]);
         } // if

      path.push([final_x, final_y, final_z]);

      allowed.push({
                    typ: rule.name,
                    path: path
                    });
      } // for

  return(allowed);
}; // getAllowedMoves3D()

if (!has_contact(src.x, src.y, src.z) || !is_empty(src.x, src.y, src.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!has_contact(dest.x, dest.y, dest.z) || !is_empty(dest.x, dest.y, dest.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

queue.push({
           x: Number(src.x),
           y: Number(src.y),
           z: Number(src.z),
           path: [[Number(src.x), Number(src.y), Number(src.z)]]
           });
visited.add(key(src.x, src.y, src.z));

while (queue.length > 0)
      {
      const current = queue.shift();

      if (
          Number(current.x) === Number(dest.x) &&
          Number(current.y) === Number(dest.y) &&
         Number(current.z) === Number(dest.z)
         )
         {
         return({
                path: current.path.map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                debug_rejections: debug_rejections
                });
         } // if

      const allowed = getAllowedMoves3D(current.x, current.y, current.z);

      for (let i = 0; i < allowed.length; i++)
          {
          const move = allowed[i];
          if (!move.path || move.path.length === 0) continue;

          const coords = move.path;
          let partial_coords = [];

          for (let c = 0; c < coords.length; c++)
              {
              const [coordX, coordY, coordZ] = coords[c];
              partial_coords.push([Number(coordX), Number(coordY), Number(coordZ)]);

              if (
                  Number(coordX) === Number(dest.x) &&
                  Number(coordY) === Number(dest.y) &&
                 Number(coordZ) === Number(dest.z)
                 )
                 {
                 return({
                        path: [
                              ...current.path,
                              ...partial_coords
                              ].map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                        debug_rejections: debug_rejections
                        });
                 } // if
              } // for

          const [lastX, lastY, lastZ] = coords[coords.length - 1];
          const k = key(lastX, lastY, lastZ);

          if (visited.has(k)) continue;

          visited.add(k);
          parent.set(k, key(current.x, current.y, current.z));

          queue.push({
                     x: Number(lastX),
                     y: Number(lastY),
                     z: Number(lastZ),
                     path: [
                           ...current.path,
                           ...coords.map(([x, y, z]) => [Number(x), Number(y), Number(z)])
                           ]
                     });
          } // for
      } // while

return({
       path: null,
       debug_rejections: debug_rejections
       });
} // apicall_calc_single_path()


apicall_calc_single_path_payload(src, dest, bots_s, bots_f, payload_options = {})
{
const key = (x, y, z) => `${x},${y},${z}`;
const visited = new Set();
const queue = [];
let debug_rejections = [];
const carrier_orientation = {
                            x: Number(payload_options?.orientation?.x ?? 0),
                            y: Number(payload_options?.orientation?.y ?? 0),
                            z: Number(payload_options?.orientation?.z ?? 0)
                            };

const is_structure = (x, y, z) => {
  return bots_s.get(Number(x), Number(y), Number(z)) !== null;
}; // is_structure()

const is_forbidden = (x, y, z) => {
  if (!bots_f) return(false);
  return bots_f.get(Number(x), Number(y), Number(z)) !== null;
}; // is_forbidden()

const is_empty = (x, y, z) => {
  return(!is_structure(x, y, z) && !is_forbidden(x, y, z));
}; // is_empty()

const has_contact = (x, y, z) => {
  const neighbors6 = [
                     { dx:  1, dy:  0, dz:  0 },
                     { dx: -1, dy:  0, dz:  0 },
                     { dx:  0, dy:  1, dz:  0 },
                     { dx:  0, dy: -1, dz:  0 },
                     { dx:  0, dy:  0, dz:  1 },
                     { dx:  0, dy:  0, dz: -1 }
                     ];

  for (let i = 0; i < neighbors6.length; i++)
      {
      const n = neighbors6[i];
      if (is_structure(Number(x) + Number(n.dx), Number(y) + Number(n.dy), Number(z) + Number(n.dz)))
         {
         return(true);
         } // if
      } // for

  return(false);
}; // has_contact()

const has_axis_lateral_anchor = (target_x, target_y, target_z, axis) => {
  if (axis === "x")
     {
     return(
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "y")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "z")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z)
            );
     } // if

  return(false);
}; // has_axis_lateral_anchor()

const movement_rules = [
  { name: "G_F", final: { dx:  1, dy:  0, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x") },
  { name: "G_B", final: { dx: -1, dy:  0, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x") },
  { name: "G_R", final: { dx:  0, dy:  0, dz: -1 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z") },
  { name: "G_L", final: { dx:  0, dy:  0, dz:  1 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z") },
  { name: "G_T", final: { dx:  0, dy:  1, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y") },
  { name: "G_D", final: { dx:  0, dy: -1, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y") },
  { name: "K_TF", final: { dx:  1, dy:  1, dz:  0 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx:  1, dy:  0, dz:  0 } },
  { name: "K_TB", final: { dx: -1, dy:  1, dz:  0 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx: -1, dy:  0, dz:  0 } },
  { name: "K_DF", final: { dx:  1, dy: -1, dz:  0 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx:  1, dy:  0, dz:  0 } },
  { name: "K_DB", final: { dx: -1, dy: -1, dz:  0 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx: -1, dy:  0, dz:  0 } },
  { name: "K_TR", final: { dx:  0, dy:  1, dz: -1 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx:  0, dy:  0, dz: -1 } },
  { name: "K_TL", final: { dx:  0, dy:  1, dz:  1 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx:  0, dy:  0, dz:  1 } },
  { name: "K_DR", final: { dx:  0, dy: -1, dz: -1 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx:  0, dy:  0, dz: -1 } },
  { name: "K_DL", final: { dx:  0, dy: -1, dz:  1 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx:  0, dy:  0, dz:  1 } },
  { name: "K_FT", final: { dx:  1, dy:  1, dz:  0 }, intermediate: { dx:  1, dy:  0, dz:  0 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_FD", final: { dx:  1, dy: -1, dz:  0 }, intermediate: { dx:  1, dy:  0, dz:  0 }, anchor: { dx:  0, dy: -1, dz:  0 } },
  { name: "K_BT", final: { dx: -1, dy:  1, dz:  0 }, intermediate: { dx: -1, dy:  0, dz:  0 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_BD", final: { dx: -1, dy: -1, dz:  0 }, intermediate: { dx: -1, dy:  0, dz:  0 }, anchor: { dx:  0, dy: -1, dz:  0 } },
  { name: "K_LT", final: { dx:  0, dy:  1, dz:  1 }, intermediate: { dx:  0, dy:  0, dz:  1 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_LD", final: { dx:  0, dy: -1, dz:  1 }, intermediate: { dx:  0, dy:  0, dz:  1 }, anchor: { dx:  0, dy: -1, dz:  0 } },
  { name: "K_RT", final: { dx:  0, dy:  1, dz: -1 }, intermediate: { dx:  0, dy:  0, dz: -1 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_RD", final: { dx:  0, dy: -1, dz: -1 }, intermediate: { dx:  0, dy:  0, dz: -1 }, anchor: { dx:  0, dy: -1, dz:  0 } }
]; // movement_rules

const get_payload_position_for_carrier = (carrier_position) => {
  return this.apicall_get_payload_target_from_carrier_state(
                                                            {
                                                            x: Number(carrier_position.x),
                                                            y: Number(carrier_position.y),
                                                            z: Number(carrier_position.z)
                                                            },
                                                            carrier_orientation
                                                            );
}; // get_payload_position_for_carrier()

const has_payload_wrapped_support = (startX, startY, startZ, rule, final_x, final_y, final_z) => {
  if (!rule || !rule.intermediate)
     {
     return(false);
     } // if

  if (!(rule.name === "K_RD" || rule.name === "K_LD"))
     {
     return(
            this.apicall_is_valid_wrapped_double_step(
                                                    { x: Number(startX), y: Number(startY), z: Number(startZ) },
                                                    { x: Number(final_x), y: Number(final_y), z: Number(final_z) },
                                                    bots_s
                                                    ) === true
            );
     } // if

  let anchor_x = Number(startX) + Number(rule.anchor?.dx ?? 0);
  let anchor_y = Number(startY) + Number(rule.anchor?.dy ?? 0);
  let anchor_z = Number(startZ) + Number(rule.anchor?.dz ?? 0);

  if (is_structure(anchor_x, anchor_y, anchor_z))
     {
     return(true);
     } // if

  return(
         this.apicall_is_valid_wrapped_double_step(
                                                 { x: Number(startX), y: Number(startY), z: Number(startZ) },
                                                 { x: Number(final_x), y: Number(final_y), z: Number(final_z) },
                                                 bots_s
                                                 ) === true
         );
}; // has_payload_wrapped_support()

const has_payload_collision_for_path = (carrier_path_positions) => {
  for (let i = 0; i < carrier_path_positions.length; i++)
      {
      let carrier_position = carrier_path_positions[i];
      let payload_position = get_payload_position_for_carrier(carrier_position);

      if (!payload_position)
         {
         return(true);
         } // if

      if (!is_empty(payload_position.x, payload_position.y, payload_position.z))
         {
         return(true);
         } // if
      } // for

  return(false);
}; // has_payload_collision_for_path()

const getAllowedMoves3D = (startX, startY, startZ) => {
  const allowed = [];

  for (let i = 0; i < movement_rules.length; i++)
      {
      const rule = movement_rules[i];
      const final_x = Number(startX) + Number(rule.final.dx);
      const final_y = Number(startY) + Number(rule.final.dy);
      const final_z = Number(startZ) + Number(rule.final.dz);
      let rejection_reason = null;

      if (!is_empty(final_x, final_y, final_z))
         {
         rejection_reason = "TARGET_NOT_EMPTY";
         } // if
      else if (!has_contact(final_x, final_y, final_z))
         {
         rejection_reason = "NO_SURFACE_CONTACT";
         } // else if

      if (!rejection_reason && rule.anchor)
         {
         const anchor_x = Number(startX) + Number(rule.anchor.dx);
         const anchor_y = Number(startY) + Number(rule.anchor.dy);
         const anchor_z = Number(startZ) + Number(rule.anchor.dz);

         if (!is_structure(anchor_x, anchor_y, anchor_z))
            {
            rejection_reason = "RULE_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate)
         {
         const intermediate_x = Number(startX) + Number(rule.intermediate.dx);
         const intermediate_y = Number(startY) + Number(rule.intermediate.dy);
         const intermediate_z = Number(startZ) + Number(rule.intermediate.dz);

         if (!is_empty(intermediate_x, intermediate_y, intermediate_z))
            {
            rejection_reason = "INTERMEDIATE_NOT_EMPTY";
            } // if
         } // if

      if (!rejection_reason && typeof rule.validator == "function")
         {
         if (rule.validator(final_x, final_y, final_z) !== true)
            {
            rejection_reason = "AXIS_LATERAL_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate && Number(rule.final.dy) !== 0 && Number(rule.final.dx) + Number(rule.final.dz) !== 0)
         {
         if (has_payload_wrapped_support(startX, startY, startZ, rule, final_x, final_y, final_z) !== true)
            {
            rejection_reason = "WRAPPED_CELL_MISSING";
            } // if
         } // if

      let path = [];
      let carrier_positions = [];

      if (!rejection_reason && rule.intermediate)
         {
         let intermediate_position = {
                                     x: Number(startX) + Number(rule.intermediate.dx),
                                     y: Number(startY) + Number(rule.intermediate.dy),
                                     z: Number(startZ) + Number(rule.intermediate.dz)
                                     };
         path.push([intermediate_position.x, intermediate_position.y, intermediate_position.z]);
         carrier_positions.push(intermediate_position);
         } // if

      path.push([final_x, final_y, final_z]);
      carrier_positions.push({ x: final_x, y: final_y, z: final_z });

      if (!rejection_reason && has_payload_collision_for_path(carrier_positions))
         {
         rejection_reason = "PAYLOAD_COLLISION";
         } // if

      if (rejection_reason)
         {
         debug_rejections.push({
                                stage: "path_rule_payload",
                                rule: rule.name,
                                from: {
                                       x: Number(startX),
                                       y: Number(startY),
                                       z: Number(startZ)
                                       },
                                to: {
                                     x: Number(final_x),
                                     y: Number(final_y),
                                     z: Number(final_z)
                                     },
                                reason: rejection_reason
                                });
         continue;
         } // if

      allowed.push({
                    typ: rule.name,
                    path: path
                    });
      } // for

  return(allowed);
}; // getAllowedMoves3D()

if (!has_contact(src.x, src.y, src.z) || !is_empty(src.x, src.y, src.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!has_contact(dest.x, dest.y, dest.z) || !is_empty(dest.x, dest.y, dest.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

let payload_src = get_payload_position_for_carrier(src);
let payload_dest = get_payload_position_for_carrier(dest);

if (!payload_src || !payload_dest)
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!is_empty(payload_src.x, payload_src.y, payload_src.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!is_empty(payload_dest.x, payload_dest.y, payload_dest.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

queue.push({
           x: Number(src.x),
           y: Number(src.y),
           z: Number(src.z),
           path: [[Number(src.x), Number(src.y), Number(src.z)]]
           });
visited.add(key(src.x, src.y, src.z));

while (queue.length > 0)
      {
      const current = queue.shift();

      if (
          Number(current.x) === Number(dest.x) &&
          Number(current.y) === Number(dest.y) &&
         Number(current.z) === Number(dest.z)
         )
         {
         return({
                path: current.path.map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                debug_rejections: debug_rejections
                });
         } // if

      const allowed = getAllowedMoves3D(current.x, current.y, current.z);

      for (let i = 0; i < allowed.length; i++)
          {
          const move = allowed[i];
          if (!move.path || move.path.length === 0) continue;

          const coords = move.path;
          let partial_coords = [];

          for (let c = 0; c < coords.length; c++)
              {
              const [coordX, coordY, coordZ] = coords[c];
              partial_coords.push([Number(coordX), Number(coordY), Number(coordZ)]);

              if (
                  Number(coordX) === Number(dest.x) &&
                  Number(coordY) === Number(dest.y) &&
                  Number(coordZ) === Number(dest.z)
                 )
                 {
                 return({
                        path: [
                              ...current.path,
                              ...partial_coords
                              ].map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                        debug_rejections: debug_rejections
                        });
                 } // if
              } // for

          const [lastX, lastY, lastZ] = coords[coords.length - 1];
          const k = key(lastX, lastY, lastZ);

          if (visited.has(k)) continue;

          visited.add(k);

          queue.push({
                     x: Number(lastX),
                     y: Number(lastY),
                     z: Number(lastZ),
                     path: [
                           ...current.path,
                           ...coords.map(([x, y, z]) => [Number(x), Number(y), Number(z)])
                           ]
                     });
          } // for
      } // while

return({
       path: null,
       debug_rejections: debug_rejections
       });
} // apicall_calc_single_path_payload()


apicall_find_path_for_bot(bot_id, x, y, z, show = false, planning_options = {})
{
let botindex = this.get_bot_by_id(bot_id, this.bots);
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let show_path = (show === true || show === "true" || show === "show" || show === 1 || show === "1");
let excluded_bot_ids = Array.isArray(planning_options?.excluded_bot_ids) ? planning_options.excluded_bot_ids : [];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if ( Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z) )
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot",
          error: "INVALID_TARGET_POSITION",
          bot_id: bot_id
          });
   } // if

let bot = this.bots[botindex];
let bots_s = this.apicall_build_structure_grid_without_bot(bot_id, excluded_bot_ids);
let bots_f = this.apicall_build_forbidden_grid();
let carried_payload_bot_id = String(planning_options?.carried_payload_bot_id ?? "").trim();
let bot_snapshot = this.apicall_get_bot_snapshot(bot_id);
let src = {
          x: Number(bot.x),
          y: Number(bot.y),
          z: Number(bot.z)
          };
let dest = {
           x: target_x,
           y: target_y,
           z: target_z
           };
let path_result = null;
let path = null;
let path_debug_rejections = [];

if (carried_payload_bot_id != "")
   {
   path_result = this.apicall_calc_single_path_payload(
                                                      src,
                                                      dest,
                                                      bots_s,
                                                      bots_f,
                                                      {
                                                      carrier_bot_id: bot_id,
                                                      payload_bot_id: carried_payload_bot_id,
                                                      orientation: bot_snapshot?.orientation ?? null
                                                      }
                                                      );
   } // if
else
   {
   path_result = this.apicall_calc_single_path(src, dest, bots_s, bots_f);
   } // else

if (Array.isArray(path_result))
   {
   path = path_result;
   } // if
else if (path_result && typeof path_result == "object")
   {
   path = Array.isArray(path_result.path) ? path_result.path : null;
   path_debug_rejections = Array.isArray(path_result.debug_rejections) ? path_result.debug_rejections : [];
   } // else if

if (!path)
   {
   return({
          ok: true,
          answer: "api_find_path_for_bot",
          bot_id: bot_id,
          target: dest,
          path_found: false,
          reason: "NO_SURFACE_PATH_FOUND",
          show_requested: show_path,
          carried_payload_bot_id: (carried_payload_bot_id != "" ? carried_payload_bot_id : null),
          path_debug_rejections: path_debug_rejections,
          path: []
          });
   } // if

let path_visualized = false;
let marker_count = 0;

if (show_path)
   {
   for (let i = 0; i < path.length; i++)
       {
       let marker_ret = this.apicall_gui_set_marker(path[i].x, path[i].y, path[i].z, 0.3, "green");

       if (marker_ret.accepted === true)
          {
          marker_count++;
          } // if

       if (marker_ret.frontend_attached === true)
          {
          path_visualized = true;
          } // if
       } // for
   } // if

return({
       ok: true,
       answer: "api_find_path_for_bot",
       bot_id: bot_id,
       target: dest,
       path_found: true,
       reason: "PATH_FOUND",
       show_requested: show_path,
       carried_payload_bot_id: (carried_payload_bot_id != "" ? carried_payload_bot_id : null),
       excluded_bot_ids: excluded_bot_ids,
       path_debug_rejections: path_debug_rejections,
       path_visualized: path_visualized,
       marker_count: marker_count,
       path_length: path.length,
       path: path
       });
} // apicall_find_path_for_bot()


apicall_find_path_for_bot_payload(bot_id, payload_bot_id, x, y, z, show = false)
{
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();

if (normalized_payload_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot_payload",
          error: "PAYLOAD_BOT_ID_MISSING",
          bot_id: bot_id
          });
   } // if

let payload_snapshot = this.apicall_get_bot_snapshot(normalized_payload_bot_id);

if (!payload_snapshot)
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot_payload",
          error: "PAYLOAD_BOT_NOT_FOUND",
          bot_id: bot_id,
          payload_bot_id: normalized_payload_bot_id
          });
   } // if

let ret = this.apicall_find_path_for_bot(
                                        bot_id,
                                        x,
                                        y,
                                        z,
                                        show,
                                        {
                                        excluded_bot_ids: [normalized_payload_bot_id],
                                        carried_payload_bot_id: normalized_payload_bot_id
                                        }
                                        );

return({
       ...ret,
       answer: "api_find_path_for_bot_payload",
       payload_bot_id: normalized_payload_bot_id
       });
} // apicall_find_path_for_bot_payload()


apicall_build_active_bots_tmp(include_masterbot = false, excluded_bot_ids = [])
{
let bots_tmp = [];
let excluded_ids = new Set(
                          (Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [])
                          .map((id) => String(id ?? "").trim())
                          .filter((id) => id != "")
                          );

for (let i = 0; i < this.bots.length; i++)
    {
    let bot = this.bots[i];

    if (!bot)
       {
       continue;
       } // if

    if (bot.id == "masterbot" && include_masterbot !== true)
       {
       continue;
       } // if

    if (excluded_ids.has(String(bot.id ?? "")))
       {
       continue;
       } // if

    bots_tmp.push({
                   id: bot.id,
                   x: Number(bot.x),
                   y: Number(bot.y),
                   z: Number(bot.z),
                   vector_x: Number(bot.vector_x),
                   vector_y: Number(bot.vector_y),
                   vector_z: Number(bot.vector_z),
                   adress: bot.adress,
                   color: bot.color
                   });
    } // for

return(bots_tmp);
} // apicall_build_active_bots_tmp()


apicall_build_botindex_map_for_bots(bots_tmp)
{
let botindex_map = {};

if (!Array.isArray(bots_tmp))
   {
   return(botindex_map);
   } // if

for (let i = 0; i < bots_tmp.length; i++)
    {
    let bot = bots_tmp[i];

    if (!bot)
       {
       continue;
       } // if

    let key = this.getKey_3d(Number(bot.x), Number(bot.y), Number(bot.z));
    botindex_map[key] = i;
    } // for

return(botindex_map);
} // apicall_build_botindex_map_for_bots()


apicall_get_inverse_address_for_bots(firstindex_xyz, addr, bots_tmp, botindex_map = null)
{
let ret = "";
let normalized_addr = String(addr ?? "").trim();
let index_map = botindex_map ?? this.apicall_build_botindex_map_for_bots(bots_tmp);

if (normalized_addr == "")
   {
   return(ret);
   } // if

if (!Array.isArray(bots_tmp) || bots_tmp.length == 0)
   {
   return(ret);
   } // if

if (index_map[firstindex_xyz] === undefined)
   {
   return(ret);
   } // if

let pathindexarray = [];
pathindexarray[0] = firstindex_xyz;

let size = normalized_addr.length;
for (let i = 0; i < size; i++)
    {
    let slot = normalized_addr[i];
    let keyindex = index_map[pathindexarray[i]];

    if (keyindex === undefined)
       {
       return("");
       } // if

    let vx = Number(bots_tmp[keyindex].vector_x);
    let vy = Number(bots_tmp[keyindex].vector_y);
    let vz = Number(bots_tmp[keyindex].vector_z);
    let rel_vector = this.get_cell_relation_vector_byslot(slot, vx, vy, vz);

    let cb_x = Number(bots_tmp[keyindex].x) + Number(rel_vector.x);
    let cb_y = Number(bots_tmp[keyindex].y) + Number(rel_vector.y);
    let cb_z = Number(bots_tmp[keyindex].z) + Number(rel_vector.z);

    let nextindex_xyz = this.getKey_3d(cb_x, cb_y, cb_z);
    pathindexarray[i + 1] = nextindex_xyz;
    } // for

size = pathindexarray.length;

for (let i = (size - 1); i > 0; i--)
    {
    let index1 = index_map[pathindexarray[i]];
    let index2 = index_map[pathindexarray[i - 1]];

    if (index1 === undefined || index2 === undefined)
       {
       return("");
       } // if

    let tx = Number(bots_tmp[index2].x) - Number(bots_tmp[index1].x);
    let ty = Number(bots_tmp[index2].y) - Number(bots_tmp[index1].y);
    let tz = Number(bots_tmp[index2].z) - Number(bots_tmp[index1].z);

    let slot2 = this.get_cell_slot_byvector(
                                           tx,
                                           ty,
                                           tz,
                                           Number(bots_tmp[index1].vector_x),
                                           Number(bots_tmp[index1].vector_y),
                                           Number(bots_tmp[index1].vector_z)
                                           );

    if (!slot2)
       {
       return("");
       } // if

    ret += slot2;
    } // for

return(ret);
} // apicall_get_inverse_address_for_bots()


apicall_derive_target_address_from_neighbours(target_pos, bots_tmp)
{
let ret = "";

if (!target_pos || !Array.isArray(bots_tmp) || bots_tmp.length == 0)
   {
   return(ret);
   } // if

let neighbours = this.get_valid_neighbours(
                                          {
                                           x: Number(target_pos.x),
                                           y: Number(target_pos.y),
                                           z: Number(target_pos.z)
                                           },
                                          null,
                                          bots_tmp
                                          );

for (let i = 0; i < neighbours.length; i++)
    {
    let nbot = neighbours[i];
    let neighbour_addr = String(nbot.adress ?? "").trim();

    if (neighbour_addr == "")
       {
       continue;
       } // if

    let dx = Number(target_pos.x) - Number(nbot.x);
    let dy = Number(target_pos.y) - Number(nbot.y);
    let dz = Number(target_pos.z) - Number(nbot.z);

    let slot = this.get_cell_slot_byvector(
                                          dx,
                                          dy,
                                          dz,
                                          Number(nbot.vector_x),
                                          Number(nbot.vector_y),
                                          Number(nbot.vector_z)
                                          );

    if (!slot)
       {
       continue;
       } // if

    ret = neighbour_addr + slot;
    return(ret);
    } // for

return(ret);
} // apicall_derive_target_address_from_neighbours()


apicall_derive_ack_returnaddr_from_neighbours(target_bot, bots_tmp)
{
let ret = "";

if (!target_bot || !Array.isArray(bots_tmp) || bots_tmp.length == 0)
   {
   return(ret);
   } // if

let neighbours = this.get_valid_neighbours(
                                          {
                                           x: Number(target_bot.x),
                                           y: Number(target_bot.y),
                                           z: Number(target_bot.z)
                                           },
                                          null,
                                          bots_tmp
                                          );
let botindex_map = this.apicall_build_botindex_map_for_bots(bots_tmp);
let masterbot_key = this.getKey_3d(Number(this.mb.x), Number(this.mb.y), Number(this.mb.z));

for (let i = 0; i < neighbours.length; i++)
    {
    let nbot = neighbours[i];
    let neighbour_addr = String(nbot.adress ?? "").trim();

    if (neighbour_addr == "")
       {
       continue;
       } // if

    let entry_slot = this.get_cell_slot_byvector(
                                               Number(nbot.x) - Number(target_bot.x),
                                               Number(nbot.y) - Number(target_bot.y),
                                               Number(nbot.z) - Number(target_bot.z),
                                               Number(target_bot.vector_x),
                                               Number(target_bot.vector_y),
                                               Number(target_bot.vector_z)
                                               );

    if (!entry_slot)
       {
       continue;
       } // if

    let neighbour_retaddr = this.apicall_get_inverse_address_for_bots(
                                                                  masterbot_key,
                                                                  neighbour_addr,
                                                                  bots_tmp,
                                                                  botindex_map
                                                                  );

    if (neighbour_retaddr == "")
       {
       let live_inverse = this.get_inverse_address(masterbot_key, neighbour_addr);

       if (typeof live_inverse == "string" && live_inverse.trim() != "")
          {
          neighbour_retaddr = live_inverse.replace(/^S/i, "");
          } // if
       } // if

    if (neighbour_retaddr == "")
       {
       continue;
       } // if

    ret = entry_slot + neighbour_retaddr;
    return(ret);
    } // for

return(ret);
} // apicall_derive_ack_returnaddr_from_neighbours()


apicall_diagnose_ack_route(bot_id, x, y, z, vx = null, vy = null, vz = null)
{
let normalized_bot_id = String(bot_id ?? "").trim();
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let target_vx = (vx === null || vx === undefined || vx === "") ? null : Number(vx);
let target_vy = (vy === null || vy === undefined || vy === "") ? null : Number(vy);
let target_vz = (vz === null || vz === undefined || vz === "") ? null : Number(vz);
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(normalized_bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(normalized_bot_id);
let target_orientation = null;
let bots_tmp_ack = [];
let ack_botindex = null;
let ack_target_addr = "";
let ack_retaddr = "";
let ack_target_neighbors_debug = [];
let ack_target_neighbors_live_debug = [];
let ack_stl_debug = null;
let botindex_map_ack = null;
let carried_payload_bot_id = this.apicall_get_carried_payload_bot_id(normalized_bot_id);
let excluded_bot_ids = [];
let tmp_unreachable_bots = [];

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: normalized_bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: "BOT_NOT_FOUND",
          bot_id: normalized_bot_id
          });
   } // if

if (Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z))
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: "INVALID_TARGET_POSITION",
          bot_id: normalized_bot_id
          });
   } // if

if (String(carried_payload_bot_id ?? "").trim() != "")
   {
   excluded_bot_ids.push(String(carried_payload_bot_id));
   } // if

if (target_vx !== null || target_vy !== null || target_vz !== null)
   {
   if (
      Number.isNaN(target_vx) ||
      Number.isNaN(target_vy) ||
      Number.isNaN(target_vz)
      )
      {
      return({
             ok: false,
             answer: "api_diagnose_ack_route",
             error: "INVALID_TARGET_ORIENTATION",
             bot_id: normalized_bot_id
             });
      } // if

   target_orientation = {
                        x: Number(target_vx),
                        y: Number(target_vy),
                        z: Number(target_vz)
                        };
   } else
     {
     target_orientation = {
                          x: Number(bot_snapshot.orientation.x),
                          y: Number(bot_snapshot.orientation.y),
                          z: Number(bot_snapshot.orientation.z)
                          };
     } // else

bots_tmp_ack = this.apicall_build_active_bots_tmp(true, excluded_bot_ids);
ack_botindex = this.get_bot_by_id(normalized_bot_id, bots_tmp_ack);

if (ack_botindex == null)
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: "BOT_NOT_FOUND_IN_TMP",
          bot_id: normalized_bot_id
          });
   } // if

bots_tmp_ack[ack_botindex].x = target_x;
bots_tmp_ack[ack_botindex].y = target_y;
bots_tmp_ack[ack_botindex].z = target_z;
bots_tmp_ack[ack_botindex].vector_x = Number(target_orientation.x);
bots_tmp_ack[ack_botindex].vector_y = Number(target_orientation.y);
bots_tmp_ack[ack_botindex].vector_z = Number(target_orientation.z);

for (let i = 0; i < bots_tmp_ack.length; i++)
    {
    if (bots_tmp_ack[i].id == "masterbot")
       {
       continue;
       } // if

    bots_tmp_ack[i].adress = this.get_mb_returnaddr(
                                                {x: this.mb.x, y: this.mb.y, z: this.mb.z},
                                                {
                                                x: Number(bots_tmp_ack[i].x),
                                                y: Number(bots_tmp_ack[i].y),
                                                z: Number(bots_tmp_ack[i].z)
                                                },
                                                bots_tmp_ack,
                                                []
                                                );

    if (String(bots_tmp_ack[i].adress ?? "").trim() == "")
       {
       tmp_unreachable_bots.push({
                                 id: bots_tmp_ack[i].id,
                                 x: Number(bots_tmp_ack[i].x),
                                 y: Number(bots_tmp_ack[i].y),
                                 z: Number(bots_tmp_ack[i].z)
                                 });
       } // if
    } // for

ack_target_neighbors_debug = this.get_valid_neighbours(
                                                      {x: target_x, y: target_y, z: target_z},
                                                      null,
                                                      bots_tmp_ack
                                                      ).map((bot) => ({
                                                                     id: bot.id,
                                                                     x: Number(bot.x),
                                                                     y: Number(bot.y),
                                                                     z: Number(bot.z),
                                                                     adress: String(bot.adress ?? "")
                                                                     })); // for

ack_target_addr = String(bots_tmp_ack[ack_botindex].adress ?? "").trim();

if (ack_target_addr == "")
   {
   ack_target_addr = this.apicall_derive_target_address_from_neighbours(
                                                                     {x: target_x, y: target_y, z: target_z},
                                                                     bots_tmp_ack
                                                                     );
   } // if

if (ack_target_addr == "")
   {
   ack_target_neighbors_live_debug = this.get_valid_neighbours(
                                                             {x: target_x, y: target_y, z: target_z},
                                                             null,
                                                             this.bots
                                                             ).map((bot) => ({
                                                                            id: bot.id,
                                                                            x: Number(bot.x),
                                                                            y: Number(bot.y),
                                                                            z: Number(bot.z),
                                                                            adress: String(bot.adress ?? "")
                                                                            })); // for

   ack_target_addr = this.apicall_derive_target_address_from_neighbours(
                                                                     {x: target_x, y: target_y, z: target_z},
                                                                     this.bots
                                                                     );
   } // if

botindex_map_ack = this.apicall_build_botindex_map_for_bots(bots_tmp_ack);

if (ack_target_neighbors_debug.length > 0)
   {
   let preferred_neighbour = ack_target_neighbors_debug[0];
   let stl_key = this.getKey_3d(
                              Number(preferred_neighbour.x),
                              Number(preferred_neighbour.y),
                              Number(preferred_neighbour.z)
                              );
   let stl_index = botindex_map_ack[stl_key];

   ack_stl_debug = {
                    neighbour: {
                               x: Number(preferred_neighbour.x),
                               y: Number(preferred_neighbour.y),
                               z: Number(preferred_neighbour.z)
                               },
                    stl_id: preferred_neighbour.id,
                    stl_addr: String(preferred_neighbour.adress ?? "")
                    };

   if (stl_index !== undefined)
      {
      let masterbot_key = this.getKey_3d(Number(this.mb.x), Number(this.mb.y), Number(this.mb.z));
      let stl_retaddr = this.apicall_get_inverse_address_for_bots(
                                                             masterbot_key,
                                                             String(bots_tmp_ack[stl_index].adress ?? ""),
                                                             bots_tmp_ack,
                                                             botindex_map_ack
                                                             );

      ack_stl_debug.stl_retaddr = stl_retaddr;
      } // if
   } // if

ack_retaddr = this.apicall_derive_ack_returnaddr_from_neighbours(
                                                                 {
                                                                 x: Number(target_x),
                                                                 y: Number(target_y),
                                                                 z: Number(target_z),
                                                                 vector_x: Number(target_orientation.x),
                                                                 vector_y: Number(target_orientation.y),
                                                                 vector_z: Number(target_orientation.z)
                                                                 },
                                                                 bots_tmp_ack
                                                                 );

if (ack_retaddr == "" && ack_target_addr != "")
   {
   let masterbot_key = this.getKey_3d(Number(this.mb.x), Number(this.mb.y), Number(this.mb.z));
   ack_retaddr = this.apicall_get_inverse_address_for_bots(
                                                           masterbot_key,
                                                           ack_target_addr,
                                                           bots_tmp_ack,
                                                           botindex_map_ack
                                                           );
   } // if

return({
       ok: true,
       answer: "api_diagnose_ack_route",
       bot_id: normalized_bot_id,
       safe_mode: Number(this.safe_mode),
       current_state: bot_snapshot,
       target: {
                x: Number(target_x),
                y: Number(target_y),
                z: Number(target_z)
                },
       target_orientation: target_orientation,
       carried_payload_bot_id: carried_payload_bot_id,
       excluded_bot_ids: excluded_bot_ids,
       ack_target_addr: ack_target_addr,
       ack_retaddr: ack_retaddr,
       ack_target_neighbors_debug: ack_target_neighbors_debug,
       ack_target_neighbors_live_debug: ack_target_neighbors_live_debug,
       ack_stl_debug: ack_stl_debug,
       tmp_unreachable_count: tmp_unreachable_bots.length,
       tmp_unreachable_bots: tmp_unreachable_bots
       });
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
let ret = null;
let normalized_direction = String(direction ?? "").trim().toUpperCase();
let x = Number(vx);
let y = Number(vy);
let z = Number(vz);

if (normalized_direction == "R")
   {
   if (x ==  1 && y == 0 && z ==  0) ret = { x:  0, y: 0, z: -1 };
   if (x ==  0 && y == 0 && z == -1) ret = { x: -1, y: 0, z:  0 };
   if (x == -1 && y == 0 && z ==  0) ret = { x:  0, y: 0, z:  1 };
   if (x ==  0 && y == 0 && z ==  1) ret = { x:  1, y: 0, z:  0 };
   } // if

if (normalized_direction == "L")
   {
   if (x ==  1 && y == 0 && z ==  0) ret = { x:  0, y: 0, z:  1 };
   if (x ==  0 && y == 0 && z == -1) ret = { x:  1, y: 0, z:  0 };
   if (x == -1 && y == 0 && z ==  0) ret = { x:  0, y: 0, z: -1 };
   if (x ==  0 && y == 0 && z ==  1) ret = { x: -1, y: 0, z:  0 };
   } // if

return(ret);
} // apicall_rotate_orientation()


apicall_rotate_bot(bot_id, direction)
{
let normalized_direction = String(direction ?? "").trim().toUpperCase();
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(bot_id);

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_rotate_bot",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_rotate_bot",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if (normalized_direction != "L" && normalized_direction != "R")
   {
   return({
          ok: false,
          answer: "api_rotate_bot",
          error: "INVALID_DIRECTION",
          bot_id: bot_id,
          direction: normalized_direction
          });
   } // if

let target_orientation = this.apicall_rotate_orientation(
                                                       Number(bot_snapshot.orientation.x),
                                                       Number(bot_snapshot.orientation.y),
                                                       Number(bot_snapshot.orientation.z),
                                                       normalized_direction
                                                       );

if (!target_orientation)
   {
   return({
          ok: false,
          answer: "api_rotate_bot",
          error: "ROTATION_NOT_SUPPORTED_FOR_ORIENTATION",
          bot_id: bot_id,
          direction: normalized_direction,
          current_state: bot_snapshot
          });
   } // if

let planned_spin_cmd = "D_S" + normalized_direction + "_D";
let ack_target_addr = String(bot_snapshot.adress ?? "").trim();
let ack_retaddr = "";
let payload_bot_id = this.apicall_get_carried_payload_bot_id(bot_id);
let ack_excluded_bot_ids = [];
let ack_id = null;
let planned_raw_cmd = null;
let raw_ret = null;

if (String(payload_bot_id ?? "").trim() != "")
   {
   ack_excluded_bot_ids.push(String(payload_bot_id));
   } // if

ack_retaddr = this.apicall_build_stationary_ack_returnaddr(
                                                           bot_snapshot,
                                                           target_orientation,
                                                           ack_excluded_bot_ids
                                                           );

if (ack_retaddr != "")
   {
   ack_id = this.apicall_generate_ack_id(bot_id);
   planned_raw_cmd = bot_snapshot.adress + "#MOVE#" + planned_spin_cmd + ";ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = bot_snapshot.adress + "#MOVE#" + planned_spin_cmd;
     } // else

if (planned_raw_cmd)
   {
   if (ack_id !== null)
      {
      this.apicall_register_ack(
                               ack_id,
                               {
                               bot_id: bot_id,
                               mode: "spin",
                               to: {
                                   x: Number(bot_snapshot.position.x),
                                   y: Number(bot_snapshot.position.y),
                                   z: Number(bot_snapshot.position.z)
                                   },
                               orientation: target_orientation,
                               planned_raw_cmd: planned_raw_cmd,
                               retaddr: ack_retaddr,
                               status: "pending"
                               }
                               );
      } // if

   raw_ret = this.apicall_raw_cmd(planned_raw_cmd);
   this.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
   this.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

   if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
      {
      this.apicall_mark_ack_received(ack_id, "send_failed");
      } // if
   } // if

return({
       ok: true,
       answer: "api_rotate_bot",
       bot_id: bot_id,
       direction: normalized_direction,
       executable: (planned_raw_cmd !== null),
       executed: (raw_ret?.accepted ?? false) === true,
       current_state: bot_snapshot,
       target_orientation: target_orientation,
       ack_target_addr: ack_target_addr,
       ack_id: ack_id,
       ack_retaddr: ack_retaddr,
       planned_spin_cmd: planned_spin_cmd,
       planned_raw_cmd: planned_raw_cmd,
       raw_cmd_result: raw_ret
       });
} // apicall_rotate_bot()


apicall_execute_rotation_plan(bot_id, rotation_plan, target_orientation = null)
{
let normalized_bot_id = String(bot_id ?? "").trim();
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(normalized_bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(normalized_bot_id);
let normalized_plan = Array.isArray(rotation_plan) ? rotation_plan.map((entry) => String(entry ?? "").trim().toUpperCase()).filter((entry) => entry != "") : [];
let payload_bot_id = this.apicall_get_carried_payload_bot_id(normalized_bot_id);
let ack_excluded_bot_ids = [];
let planned_spin_cmds = [];
let planned_spin_cmd = "";
let ack_retaddr = "";
let ack_id = null;
let planned_raw_cmd = null;
let raw_ret = null;

if (String(payload_bot_id ?? "").trim() != "")
   {
   ack_excluded_bot_ids.push(String(payload_bot_id));
   } // if

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_execute_rotation_plan",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: normalized_bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_execute_rotation_plan",
          error: "BOT_NOT_FOUND",
          bot_id: normalized_bot_id
          });
   } // if

if (!Array.isArray(rotation_plan) || normalized_plan.length == 0)
   {
   return({
          ok: false,
          answer: "api_execute_rotation_plan",
          error: "ROTATION_PLAN_EMPTY",
          bot_id: normalized_bot_id
          });
   } // if

for (let i = 0; i < normalized_plan.length; i++)
    {
    if (normalized_plan[i] != "L" && normalized_plan[i] != "R")
       {
       return({
              ok: false,
              answer: "api_execute_rotation_plan",
              error: "INVALID_ROTATION_STEP",
              bot_id: normalized_bot_id,
              invalid_step: normalized_plan[i],
              rotation_plan: normalized_plan
              });
       } // if

    planned_spin_cmds.push("D_S" + normalized_plan[i] + "_D");
    } // for

planned_spin_cmd = planned_spin_cmds.join(";");
ack_retaddr = this.apicall_build_stationary_ack_returnaddr(bot_snapshot, target_orientation, ack_excluded_bot_ids);

if (ack_retaddr != "")
   {
   ack_id = this.apicall_generate_ack_id(normalized_bot_id);
   planned_raw_cmd = bot_snapshot.adress + "#MOVE#" + planned_spin_cmd + ";ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = bot_snapshot.adress + "#MOVE#" + planned_spin_cmd;
     } // else

if (planned_raw_cmd)
   {
   if (ack_id !== null)
      {
      this.apicall_register_ack(
                               ack_id,
                               {
                               bot_id: normalized_bot_id,
                               mode: "spin",
                               to: {
                                   x: Number(bot_snapshot.position.x),
                                   y: Number(bot_snapshot.position.y),
                                   z: Number(bot_snapshot.position.z)
                                   },
                               orientation: target_orientation,
                               planned_raw_cmd: planned_raw_cmd,
                               retaddr: ack_retaddr,
                               status: "pending"
                               }
                               );
      } // if

   raw_ret = this.apicall_raw_cmd(planned_raw_cmd);
   this.append_api_raw_cmd_log(planned_raw_cmd, normalized_bot_id, raw_ret.accepted ?? false);
   this.append_api_bot_history(normalized_bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

   if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
      {
      this.apicall_mark_ack_received(ack_id, "send_failed");
      } // if
   } // if

return({
       ok: true,
       answer: "api_execute_rotation_plan",
       bot_id: normalized_bot_id,
       executable: (planned_raw_cmd !== null),
       executed: (raw_ret?.accepted ?? false) === true,
       current_state: bot_snapshot,
       target_orientation: target_orientation,
       rotation_plan: normalized_plan,
       planned_spin_cmds: planned_spin_cmds,
       planned_spin_cmd: planned_spin_cmd,
       ack_id: ack_id,
       ack_retaddr: ack_retaddr,
       planned_raw_cmd: planned_raw_cmd,
       raw_cmd_result: raw_ret
       });
} // apicall_execute_rotation_plan()


apicall_rotate_bot_to(bot_id, x, y, z)
{
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(bot_id);
let allowed_vectors = [
                      { x:  1, y: 0, z:  0 },
                      { x: -1, y: 0, z:  0 },
                      { x:  0, y: 0, z:  1 },
                      { x:  0, y: 0, z: -1 }
                      ];
let matched_target = null;

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_rotate_bot_to",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_rotate_bot_to",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if (
   Number.isNaN(target_x) ||
   Number.isNaN(target_y) ||
   Number.isNaN(target_z)
   )
   {
   return({
          ok: false,
          answer: "api_rotate_bot_to",
          error: "INVALID_TARGET_ORIENTATION",
          bot_id: bot_id
          });
   } // if

for (let i = 0; i < allowed_vectors.length; i++)
    {
    if (
       Number(allowed_vectors[i].x) === target_x &&
       Number(allowed_vectors[i].y) === target_y &&
       Number(allowed_vectors[i].z) === target_z
       )
       {
       matched_target = {
                        x: Number(allowed_vectors[i].x),
                        y: Number(allowed_vectors[i].y),
                        z: Number(allowed_vectors[i].z)
                        };
       break;
       } // if
    } // for

if (!matched_target)
   {
   return({
          ok: false,
          answer: "api_rotate_bot_to",
          error: "TARGET_ORIENTATION_NOT_SUPPORTED",
          bot_id: bot_id,
          target_orientation: { x: target_x, y: target_y, z: target_z }
          });
   } // if

let current_orientation = {
                          x: Number(bot_snapshot.orientation.x),
                          y: Number(bot_snapshot.orientation.y),
                          z: Number(bot_snapshot.orientation.z)
                          };
let rotate_right_once = this.apicall_rotate_orientation(
                                                       current_orientation.x,
                                                       current_orientation.y,
                                                       current_orientation.z,
                                                       "R"
                                                       );
let rotate_left_once = this.apicall_rotate_orientation(
                                                      current_orientation.x,
                                                      current_orientation.y,
                                                      current_orientation.z,
                                                      "L"
                                                      );
if (
   Number(current_orientation.x) === matched_target.x &&
   Number(current_orientation.y) === matched_target.y &&
   Number(current_orientation.z) === matched_target.z
   )
   {
   return({
          ok: true,
          answer: "api_rotate_bot_to",
          bot_id: bot_id,
          executable: true,
          executed: true,
          current_state: bot_snapshot,
          target_orientation: matched_target,
          rotation_plan: [],
          reason: "ALREADY_ALIGNED",
          ack_received: true
          });
   } // if

let rotate_right_twice = this.apicall_rotate_orientation(
                                                    Number(rotate_right_once?.x ?? NaN),
                                                    Number(rotate_right_once?.y ?? NaN),
                                                    Number(rotate_right_once?.z ?? NaN),
                                                    "R"
                                                    );

if (
   rotate_right_once &&
   Number(rotate_right_once.x) === matched_target.x &&
   Number(rotate_right_once.y) === matched_target.y &&
   Number(rotate_right_once.z) === matched_target.z
   )
   {
   return({
          ok: true,
          answer: "api_rotate_bot_to",
          bot_id: bot_id,
          executable: true,
          executed: false,
          current_state: bot_snapshot,
          target_orientation: matched_target,
          rotation_plan: ["R"],
          reason: "ROTATION_PLAN_READY"
          });
   } // if

if (
   rotate_left_once &&
   Number(rotate_left_once.x) === matched_target.x &&
   Number(rotate_left_once.y) === matched_target.y &&
   Number(rotate_left_once.z) === matched_target.z
   )
   {
   return({
          ok: true,
          answer: "api_rotate_bot_to",
          bot_id: bot_id,
          executable: true,
          executed: false,
          current_state: bot_snapshot,
          target_orientation: matched_target,
          rotation_plan: ["L"],
          reason: "ROTATION_PLAN_READY"
          });
   } // if

if (
   rotate_right_twice &&
   Number(rotate_right_twice.x) === matched_target.x &&
   Number(rotate_right_twice.y) === matched_target.y &&
   Number(rotate_right_twice.z) === matched_target.z
   )
   {
   return({
          ok: true,
          answer: "api_rotate_bot_to",
          bot_id: bot_id,
          executable: true,
          executed: false,
          current_state: bot_snapshot,
          target_orientation: matched_target,
          rotation_plan: ["R", "R"],
          reason: "ROTATION_PLAN_READY"
          });
   } // if

return({
       ok: false,
       answer: "api_rotate_bot_to",
       error: "NO_VALID_ROTATION_PLAN",
       bot_id: bot_id,
       current_state: bot_snapshot,
       target_orientation: matched_target
       });
} // apicall_rotate_bot_to()


apicall_build_stationary_ack_returnaddr(bot_snapshot, target_orientation = null, excluded_bot_ids = [])
{
let ack_retaddr = "";
let bots_tmp_ack = this.apicall_build_active_bots_tmp(true, excluded_bot_ids);
let ack_botindex = this.get_bot_by_id(bot_snapshot.id, bots_tmp_ack);

if (ack_botindex == null)
   {
   return(ack_retaddr);
   } // if

if (target_orientation)
   {
   bots_tmp_ack[ack_botindex].vector_x = Number(target_orientation.x);
   bots_tmp_ack[ack_botindex].vector_y = Number(target_orientation.y);
   bots_tmp_ack[ack_botindex].vector_z = Number(target_orientation.z);
   } // if

ack_retaddr = this.apicall_derive_ack_returnaddr_from_neighbours(
                                                             {
                                                             x: Number(bot_snapshot.position.x),
                                                             y: Number(bot_snapshot.position.y),
                                                             z: Number(bot_snapshot.position.z),
                                                             vector_x: Number(bots_tmp_ack[ack_botindex].vector_x),
                                                             vector_y: Number(bots_tmp_ack[ack_botindex].vector_y),
                                                             vector_z: Number(bots_tmp_ack[ack_botindex].vector_z)
                                                             },
                                                             bots_tmp_ack
                                                             );

if (ack_retaddr == "")
   {
   ack_retaddr = this.apicall_derive_ack_returnaddr_from_neighbours(
                                                                    {
                                                                    x: Number(bot_snapshot.position.x),
                                                                    y: Number(bot_snapshot.position.y),
                                                                    z: Number(bot_snapshot.position.z),
                                                                    vector_x: Number(bots_tmp_ack[ack_botindex].vector_x),
                                                                    vector_y: Number(bots_tmp_ack[ack_botindex].vector_y),
                                                                    vector_z: Number(bots_tmp_ack[ack_botindex].vector_z)
                                                                    },
                                                                    bots_tmp_ack
                                                                    );
   } // if

return(ack_retaddr);
} // apicall_build_stationary_ack_returnaddr()


apicall_grab_bot(bot_id)
{
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(bot_id);
let planned_raw_cmd = null;
let raw_ret = null;
let ack_id = null;
let ack_retaddr = "";
let payload_bot_id = null;
let front_rel_vector = null;
let front_target = null;

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_grab_bot",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_grab_bot",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

ack_retaddr = this.apicall_build_stationary_ack_returnaddr(bot_snapshot, null);
front_rel_vector = this.get_cell_relation_vector_byslot(
                                                    "F",
                                                    Number(bot_snapshot.orientation.x),
                                                    Number(bot_snapshot.orientation.y),
                                                    Number(bot_snapshot.orientation.z)
                                                    );
if (front_rel_vector)
   {
   front_target = {
                  x: Number(bot_snapshot.position.x) + Number(front_rel_vector.x),
                  y: Number(bot_snapshot.position.y) + Number(front_rel_vector.y),
                  z: Number(bot_snapshot.position.z) + Number(front_rel_vector.z)
                  };
   } // if
payload_bot_id = this.apicall_get_front_neighbor_bot_id(bot_snapshot);

if (ack_retaddr != "")
   {
   ack_id = this.apicall_generate_ack_id(bot_id);
   planned_raw_cmd = bot_snapshot.adress + "#MOVE#GF;ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = bot_snapshot.adress + "#MOVE#GF";
     } // else

if (ack_id !== null)
   {
   this.apicall_register_ack(
                            ack_id,
                            {
                            bot_id: bot_id,
                            mode: "grab",
                            payload_bot_id: payload_bot_id,
                            to: {
                                x: Number(bot_snapshot.position.x),
                                y: Number(bot_snapshot.position.y),
                                z: Number(bot_snapshot.position.z)
                                },
                            orientation: {
                                          x: Number(bot_snapshot.orientation.x),
                                          y: Number(bot_snapshot.orientation.y),
                                          z: Number(bot_snapshot.orientation.z)
                                          },
                            planned_raw_cmd: planned_raw_cmd,
                            retaddr: ack_retaddr,
                            status: "pending"
                            }
                            );
   } // if

raw_ret = this.apicall_raw_cmd(planned_raw_cmd);
this.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
this.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
   {
   this.apicall_mark_ack_received(ack_id, "send_failed");
   } // if

return({
       ok: true,
       answer: "api_grab_bot",
       bot_id: bot_id,
       executable: true,
       executed: (raw_ret?.accepted ?? false) === true,
       current_state: bot_snapshot,
       payload_bot_id: payload_bot_id,
       front_debug: {
                     rel_vector: front_rel_vector,
                     target: front_target
                     },
       ack_id: ack_id,
       ack_retaddr: ack_retaddr,
       planned_raw_cmd: planned_raw_cmd,
       raw_cmd_result: raw_ret
       });
} // apicall_grab_bot()


apicall_release_bot(bot_id)
{
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(bot_id);
let planned_raw_cmd = null;
let raw_ret = null;
let ack_id = null;
let ack_retaddr = "";
let payload_bot_id = this.apicall_get_carried_payload_bot_id(bot_id);

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_release_bot",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_release_bot",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

ack_retaddr = this.apicall_build_stationary_ack_returnaddr(bot_snapshot, null);

if (ack_retaddr != "")
   {
   ack_id = this.apicall_generate_ack_id(bot_id);
   planned_raw_cmd = bot_snapshot.adress + "#MOVE#G;ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = bot_snapshot.adress + "#MOVE#G";
     } // else

if (ack_id !== null)
   {
   this.apicall_register_ack(
                            ack_id,
                            {
                            bot_id: bot_id,
                            mode: "release",
                            payload_bot_id: payload_bot_id,
                            to: {
                                x: Number(bot_snapshot.position.x),
                                y: Number(bot_snapshot.position.y),
                                z: Number(bot_snapshot.position.z)
                                },
                            orientation: {
                                          x: Number(bot_snapshot.orientation.x),
                                          y: Number(bot_snapshot.orientation.y),
                                          z: Number(bot_snapshot.orientation.z)
                                          },
                            planned_raw_cmd: planned_raw_cmd,
                            retaddr: ack_retaddr,
                            status: "pending"
                            }
                            );
   } // if

raw_ret = this.apicall_raw_cmd(planned_raw_cmd);
this.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
this.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
   {
   this.apicall_mark_ack_received(ack_id, "send_failed");
   } // if

return({
       ok: true,
       answer: "api_release_bot",
       bot_id: bot_id,
       executable: true,
       executed: (raw_ret?.accepted ?? false) === true,
       current_state: bot_snapshot,
       payload_bot_id: payload_bot_id,
       ack_id: ack_id,
       ack_retaddr: ack_retaddr,
       planned_raw_cmd: planned_raw_cmd,
       raw_cmd_result: raw_ret
       });
} // apicall_release_bot()


async apicall_move_payload_to(carrier_bot_id, payload_bot_id, x, y, z, release_after = false)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let should_release_after = (
                           release_after === true ||
                           release_after === "true" ||
                           release_after === "1" ||
                           release_after === 1 ||
                           release_after === "release"
                           );
let carrier_snapshot = this.apicall_get_bot_snapshot(normalized_carrier_bot_id);
let payload_snapshot = this.apicall_get_bot_snapshot(normalized_payload_bot_id);
let current_payload_bot_id = this.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id);
let current_front_payload_bot_id = null;
let grab_ret = null;
let move_ret = null;
let release_ret = null;
let steps = [];

if (normalized_carrier_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "CARRIER_BOT_ID_MISSING"
          });
   } // if

if (normalized_payload_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "PAYLOAD_BOT_ID_MISSING",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

if (!carrier_snapshot)
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "CARRIER_BOT_NOT_FOUND",
          carrier_bot_id: normalized_carrier_bot_id,
          payload_bot_id: normalized_payload_bot_id
          });
   } // if

if (!payload_snapshot)
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "PAYLOAD_BOT_NOT_FOUND",
          carrier_bot_id: normalized_carrier_bot_id,
          payload_bot_id: normalized_payload_bot_id
          });
   } // if

if (
   Number.isNaN(target_x) ||
   Number.isNaN(target_y) ||
   Number.isNaN(target_z)
   )
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "INVALID_TARGET_POSITION",
          carrier_bot_id: normalized_carrier_bot_id,
          payload_bot_id: normalized_payload_bot_id
          });
   } // if

if (current_payload_bot_id && String(current_payload_bot_id) != normalized_payload_bot_id)
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "CARRIER_ALREADY_CARRYING_OTHER_PAYLOAD",
          carrier_bot_id: normalized_carrier_bot_id,
          payload_bot_id: normalized_payload_bot_id,
          current_payload_bot_id: String(current_payload_bot_id)
          });
   } // if

if (!current_payload_bot_id)
   {
   current_front_payload_bot_id = this.apicall_get_front_neighbor_bot_id(carrier_snapshot);

   if (String(current_front_payload_bot_id ?? "") != normalized_payload_bot_id)
      {
      return({
             ok: false,
             answer: "api_move_payload_to",
             error: "PAYLOAD_NOT_DIRECTLY_IN_FRONT",
             carrier_bot_id: normalized_carrier_bot_id,
             payload_bot_id: normalized_payload_bot_id,
             current_front_payload_bot_id: current_front_payload_bot_id
             });
      } // if

   grab_ret = this.apicall_grab_bot(normalized_carrier_bot_id);
   grab_ret = await this.apicall_attach_ack_wait_and_recovery(grab_ret);
   steps.push({
              step: "grab_bot",
              ok: grab_ret?.ok === true,
              ack_received: grab_ret?.ack_received ?? false,
              payload_bot_id: grab_ret?.payload_bot_id ?? null,
              planned_raw_cmd: grab_ret?.planned_raw_cmd ?? null
              });

   if (grab_ret?.ok !== true)
      {
      return({
             ok: false,
             answer: "api_move_payload_to",
             error: "GRAB_FAILED",
             carrier_bot_id: normalized_carrier_bot_id,
             payload_bot_id: normalized_payload_bot_id,
             target: { x: target_x, y: target_y, z: target_z },
             steps: steps,
             grab_result: grab_ret
             });
      } // if

   if (
      (grab_ret?.ack_received ?? false) !== true ||
      String(this.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id) ?? "") != normalized_payload_bot_id
      )
      {
      return({
             ok: false,
             answer: "api_move_payload_to",
             error: "GRAB_NOT_CONFIRMED",
             carrier_bot_id: normalized_carrier_bot_id,
             payload_bot_id: normalized_payload_bot_id,
             target: { x: target_x, y: target_y, z: target_z },
             steps: steps,
             grab_result: grab_ret,
             current_payload_bot_id: this.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id) ?? null
             });
      } // if
   } // if

move_ret = this.apicall_move_bot_to(normalized_carrier_bot_id, target_x, target_y, target_z);
move_ret = await this.apicall_attach_ack_wait_and_recovery(move_ret);
steps.push({
           step: "move_bot_to",
           ok: move_ret?.ok === true,
           ack_received: move_ret?.ack_received ?? false,
           executable: move_ret?.executable ?? false,
           executed: move_ret?.executed ?? false,
           planned_raw_cmd: move_ret?.planned_raw_cmd ?? null
           });

if (
   move_ret?.ok !== true ||
   move_ret?.path_found !== true ||
   move_ret?.executable !== true ||
   move_ret?.executed !== true ||
   (move_ret?.ack_received ?? false) !== true
   )
   {
   return({
          ok: false,
          answer: "api_move_payload_to",
          error: "PAYLOAD_MOVE_FAILED",
          carrier_bot_id: normalized_carrier_bot_id,
          payload_bot_id: normalized_payload_bot_id,
          target: { x: target_x, y: target_y, z: target_z },
          release_after: should_release_after,
          steps: steps,
          grab_result: grab_ret,
          move_result: move_ret
          });
   } // if

if (should_release_after)
   {
   release_ret = this.apicall_release_bot(normalized_carrier_bot_id);
   release_ret = await this.apicall_attach_ack_wait_and_recovery(release_ret);
   steps.push({
              step: "release_bot",
              ok: release_ret?.ok === true,
              ack_received: release_ret?.ack_received ?? false,
              payload_bot_id: release_ret?.payload_bot_id ?? null,
              planned_raw_cmd: release_ret?.planned_raw_cmd ?? null
              });

   if (
      release_ret?.ok !== true ||
      (release_ret?.ack_received ?? false) !== true
      )
      {
      return({
             ok: false,
             answer: "api_move_payload_to",
             error: "RELEASE_FAILED",
             carrier_bot_id: normalized_carrier_bot_id,
             payload_bot_id: normalized_payload_bot_id,
             target: { x: target_x, y: target_y, z: target_z },
             release_after: should_release_after,
             steps: steps,
             grab_result: grab_ret,
             move_result: move_ret,
             release_result: release_ret
             });
      } // if
   } // if

return({
       ok: true,
       answer: "api_move_payload_to",
       carrier_bot_id: normalized_carrier_bot_id,
       payload_bot_id: normalized_payload_bot_id,
       target: { x: target_x, y: target_y, z: target_z },
       release_after: should_release_after,
       already_carrying_payload: (current_payload_bot_id !== null),
       steps: steps,
       grab_result: grab_ret,
       move_result: move_ret,
       release_result: release_ret
       });
} // apicall_move_payload_to()


async apicall_move_carrier_to(carrier_bot_id, x, y, z, vx, vy, vz, release_after = false)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let target_vx = Number(vx);
let target_vy = Number(vy);
let target_vz = Number(vz);
let should_release_after = (
                           release_after === true ||
                           release_after === "true" ||
                           release_after === "1" ||
                           release_after === 1 ||
                           release_after === "release"
                           );
let carrier_snapshot = this.apicall_get_bot_snapshot(normalized_carrier_bot_id);
let carried_payload_bot_id = this.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id);
let orientation_any = false;
let move_ret = null;
let rotate_ret = null;
let release_ret = null;
let steps = [];
let allowed_orientations = [
                           { x:  1, y: 0, z:  0 },
                           { x: -1, y: 0, z:  0 },
                           { x:  0, y: 0, z:  1 },
                           { x:  0, y: 0, z: -1 }
                           ];
let orientation_supported = false;

if (normalized_carrier_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_move_carrier_to",
          error: "CARRIER_BOT_ID_MISSING"
          });
   } // if

if (!carrier_snapshot)
   {
   return({
          ok: false,
          answer: "api_move_carrier_to",
          error: "CARRIER_BOT_NOT_FOUND",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

if (
   Number.isNaN(target_x) ||
   Number.isNaN(target_y) ||
   Number.isNaN(target_z)
   )
   {
   return({
          ok: false,
          answer: "api_move_carrier_to",
          error: "INVALID_TARGET_POSITION",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

if (
   Number.isNaN(target_vx) ||
   Number.isNaN(target_vy) ||
   Number.isNaN(target_vz)
   )
   {
   return({
          ok: false,
          answer: "api_move_carrier_to",
          error: "INVALID_TARGET_ORIENTATION",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

orientation_any = (
                  Number(target_vx) === 0 &&
                  Number(target_vy) === 0 &&
                  Number(target_vz) === 0
                  );

if (!orientation_any)
   {
   for (let i = 0; i < allowed_orientations.length; i++)
       {
       if (
          Number(allowed_orientations[i].x) === Number(target_vx) &&
          Number(allowed_orientations[i].y) === Number(target_vy) &&
          Number(allowed_orientations[i].z) === Number(target_vz)
          )
          {
          orientation_supported = true;
          break;
          } // if
       } // for

   if (!orientation_supported)
      {
      return({
             ok: false,
             answer: "api_move_carrier_to",
             error: "TARGET_ORIENTATION_NOT_SUPPORTED",
             carrier_bot_id: normalized_carrier_bot_id,
             target_orientation: { x: target_vx, y: target_vy, z: target_vz }
             });
      } // if
   } // if

move_ret = this.apicall_move_bot_to(normalized_carrier_bot_id, target_x, target_y, target_z);
move_ret = await this.apicall_attach_ack_wait_and_recovery(move_ret);
steps.push({
           step: "move_bot_to",
           ok: move_ret?.ok === true,
           ack_received: move_ret?.ack_received ?? false,
           executable: move_ret?.executable ?? false,
           executed: move_ret?.executed ?? false,
           planned_raw_cmd: move_ret?.planned_raw_cmd ?? null
           });

if (
   move_ret?.ok !== true ||
   move_ret?.path_found !== true ||
   move_ret?.executable !== true ||
   move_ret?.executed !== true ||
   (move_ret?.ack_received ?? false) !== true
   )
   {
   return({
          ok: false,
          answer: "api_move_carrier_to",
          error: "CARRIER_MOVE_FAILED",
          carrier_bot_id: normalized_carrier_bot_id,
          carried_payload_bot_id: carried_payload_bot_id,
          target: { x: target_x, y: target_y, z: target_z },
          target_orientation: { x: target_vx, y: target_vy, z: target_vz },
          orientation_any: orientation_any,
          release_after: should_release_after,
          steps: steps,
          move_result: move_ret
          });
   } // if

if (!orientation_any)
   {
   rotate_ret = this.apicall_rotate_bot_to(normalized_carrier_bot_id, target_vx, target_vy, target_vz);

   if (rotate_ret?.ok === true && Array.isArray(rotate_ret.rotation_plan) && rotate_ret.rotation_plan.length > 0)
      {
      let execute_ret = this.apicall_execute_rotation_plan(
                                                         normalized_carrier_bot_id,
                                                         rotate_ret.rotation_plan,
                                                         rotate_ret.target_orientation ?? null
                                                         );
      execute_ret = await this.apicall_attach_ack_wait_and_recovery(execute_ret);

      rotate_ret = {
                   ...rotate_ret,
                   ack_id: execute_ret?.ack_id ?? null,
                   ack_retaddr: execute_ret?.ack_retaddr ?? "",
                   planned_raw_cmd: execute_ret?.planned_raw_cmd ?? null,
                   raw_cmd_result: execute_ret?.raw_cmd_result ?? null,
                   ack_wait: execute_ret?.ack_wait ?? null,
                   ack_received: execute_ret?.ack_received ?? false,
                   execution_steps: [
                                     {
                                     rotation_plan: rotate_ret.rotation_plan,
                                     ack_id: execute_ret?.ack_id ?? null,
                                     ack_received: execute_ret?.ack_received ?? false,
                                     planned_raw_cmd: execute_ret?.planned_raw_cmd ?? null
                                     }
                                     ],
                   executed: (execute_ret?.ack_received ?? false) === true
                   };

      if ((execute_ret?.ack_received ?? false) !== true)
         {
         rotate_ret.ok = false;
         rotate_ret.error = "ROTATION_PLAN_FAILED";
         rotate_ret.failed_step = 1;
         rotate_ret.failed_direction = (rotate_ret.rotation_plan[0] ?? null);
         rotate_ret.last_step_result = execute_ret;
         } // if
      } // if

   steps.push({
              step: "rotate_bot_to",
              ok: rotate_ret?.ok === true,
              executed: rotate_ret?.executed ?? false,
              rotation_plan: rotate_ret?.rotation_plan ?? [],
              failed_step: rotate_ret?.failed_step ?? null,
              failed_direction: rotate_ret?.failed_direction ?? null
              });

   if (rotate_ret?.ok !== true || rotate_ret?.executed !== true)
      {
      return({
             ok: false,
             answer: "api_move_carrier_to",
             error: "CARRIER_ROTATION_FAILED",
             carrier_bot_id: normalized_carrier_bot_id,
             carried_payload_bot_id: carried_payload_bot_id,
             target: { x: target_x, y: target_y, z: target_z },
             target_orientation: { x: target_vx, y: target_vy, z: target_vz },
             orientation_any: orientation_any,
             release_after: should_release_after,
             steps: steps,
             move_result: move_ret,
             rotate_result: rotate_ret
             });
      } // if
   } // if

if (should_release_after && carried_payload_bot_id)
   {
   release_ret = this.apicall_release_bot(normalized_carrier_bot_id);
   release_ret = await this.apicall_attach_ack_wait_and_recovery(release_ret);
   steps.push({
              step: "release_bot",
              ok: release_ret?.ok === true,
              ack_received: release_ret?.ack_received ?? false,
              payload_bot_id: release_ret?.payload_bot_id ?? null,
              planned_raw_cmd: release_ret?.planned_raw_cmd ?? null
              });

   if (
      release_ret?.ok !== true ||
      (release_ret?.ack_received ?? false) !== true
      )
      {
      return({
             ok: false,
             answer: "api_move_carrier_to",
             error: "RELEASE_FAILED",
             carrier_bot_id: normalized_carrier_bot_id,
             carried_payload_bot_id: carried_payload_bot_id,
             target: { x: target_x, y: target_y, z: target_z },
             target_orientation: { x: target_vx, y: target_vy, z: target_vz },
             orientation_any: orientation_any,
             release_after: should_release_after,
             steps: steps,
             move_result: move_ret,
             rotate_result: rotate_ret,
             release_result: release_ret
             });
      } // if
   } // if

return({
       ok: true,
       answer: "api_move_carrier_to",
       carrier_bot_id: normalized_carrier_bot_id,
       carried_payload_bot_id: carried_payload_bot_id,
       target: { x: target_x, y: target_y, z: target_z },
       target_orientation: { x: target_vx, y: target_vy, z: target_vz },
       orientation_any: orientation_any,
       release_after: should_release_after,
       steps: steps,
       move_result: move_ret,
       rotate_result: rotate_ret,
       release_result: release_ret
       });
} // apicall_move_carrier_to()


apicall_diagnose_move_carrier_to(carrier_bot_id, x, y, z, vx, vy, vz, release_after = false)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let target_vx = Number(vx);
let target_vy = Number(vy);
let target_vz = Number(vz);
let should_release_after = (
                           release_after === true ||
                           release_after === "true" ||
                           release_after === "1" ||
                           release_after === 1 ||
                           release_after === "release"
                           );
let carrier_snapshot = this.apicall_get_bot_snapshot(normalized_carrier_bot_id);
let carried_payload_bot_id = this.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id);
let orientation_any = false;
let move_ret = null;
let rotate_ret = null;
let release_ret = null;
let steps = [];
let allowed_orientations = [
                           { x:  1, y: 0, z:  0 },
                           { x: -1, y: 0, z:  0 },
                           { x:  0, y: 0, z:  1 },
                           { x:  0, y: 0, z: -1 }
                           ];
let orientation_supported = false;

if (normalized_carrier_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_diagnose_move_carrier_to",
          error: "CARRIER_BOT_ID_MISSING"
          });
   } // if

if (!carrier_snapshot)
   {
   return({
          ok: false,
          answer: "api_diagnose_move_carrier_to",
          error: "CARRIER_BOT_NOT_FOUND",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

if (
   Number.isNaN(target_x) ||
   Number.isNaN(target_y) ||
   Number.isNaN(target_z)
   )
   {
   return({
          ok: false,
          answer: "api_diagnose_move_carrier_to",
          error: "INVALID_TARGET_POSITION",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

if (
   Number.isNaN(target_vx) ||
   Number.isNaN(target_vy) ||
   Number.isNaN(target_vz)
   )
   {
   return({
          ok: false,
          answer: "api_diagnose_move_carrier_to",
          error: "INVALID_TARGET_ORIENTATION",
          carrier_bot_id: normalized_carrier_bot_id
          });
   } // if

orientation_any = (
                  Number(target_vx) === 0 &&
                  Number(target_vy) === 0 &&
                  Number(target_vz) === 0
                  );

if (!orientation_any)
   {
   for (let i = 0; i < allowed_orientations.length; i++)
       {
       if (
          Number(allowed_orientations[i].x) === Number(target_vx) &&
          Number(allowed_orientations[i].y) === Number(target_vy) &&
          Number(allowed_orientations[i].z) === Number(target_vz)
          )
          {
          orientation_supported = true;
          break;
          } // if
       } // for

   if (!orientation_supported)
      {
      return({
             ok: false,
             answer: "api_diagnose_move_carrier_to",
             error: "TARGET_ORIENTATION_NOT_SUPPORTED",
             carrier_bot_id: normalized_carrier_bot_id,
             target_orientation: { x: target_vx, y: target_vy, z: target_vz }
             });
      } // if
   } // if

move_ret = this.apicall_diagnose_move_bot_to(normalized_carrier_bot_id, target_x, target_y, target_z);
steps.push({
           step: "move_bot_to",
           ok: move_ret?.ok === true,
           path_found: move_ret?.path_found ?? false,
           executable: move_ret?.executable ?? false,
           planned_raw_cmd: move_ret?.planned_raw_cmd ?? null
           });

if (
   move_ret?.ok !== true ||
   move_ret?.path_found !== true ||
   move_ret?.executable !== true
   )
   {
   return({
          ok: false,
          answer: "api_diagnose_move_carrier_to",
          error: "CARRIER_MOVE_NOT_PLANNABLE",
          carrier_bot_id: normalized_carrier_bot_id,
          carried_payload_bot_id: carried_payload_bot_id,
          target: { x: target_x, y: target_y, z: target_z },
          target_orientation: { x: target_vx, y: target_vy, z: target_vz },
          orientation_any: orientation_any,
          release_after: should_release_after,
          executable: false,
          executed: false,
          steps: steps,
          move_result: move_ret,
          rotate_result: null,
          release_result: null
          });
   } // if

if (!orientation_any)
   {
   rotate_ret = this.apicall_rotate_bot_to(normalized_carrier_bot_id, target_vx, target_vy, target_vz);

   steps.push({
              step: "rotate_bot_to",
              ok: rotate_ret?.ok === true,
              executable: rotate_ret?.ok === true,
              executed: false,
              rotation_plan: rotate_ret?.rotation_plan ?? [],
              target_orientation: rotate_ret?.target_orientation ?? null
              });

   if (rotate_ret?.ok !== true)
      {
      return({
             ok: false,
             answer: "api_diagnose_move_carrier_to",
             error: "CARRIER_ROTATION_NOT_PLANNABLE",
             carrier_bot_id: normalized_carrier_bot_id,
             carried_payload_bot_id: carried_payload_bot_id,
             target: { x: target_x, y: target_y, z: target_z },
             target_orientation: { x: target_vx, y: target_vy, z: target_vz },
             orientation_any: orientation_any,
             release_after: should_release_after,
             executable: false,
             executed: false,
             steps: steps,
             move_result: move_ret,
             rotate_result: rotate_ret,
             release_result: null
             });
      } // if
   } // if

if (should_release_after && carried_payload_bot_id)
   {
   release_ret = {
                 ok: true,
                 answer: "api_release_bot",
                 executable: true,
                 executed: false,
                 bot_id: normalized_carrier_bot_id,
                 payload_bot_id: carried_payload_bot_id,
                 note: "release_planned_only"
                 };

   steps.push({
              step: "release_bot",
              ok: true,
              executable: true,
              executed: false,
              payload_bot_id: carried_payload_bot_id
              });
   } // if

return({
       ok: true,
       answer: "api_diagnose_move_carrier_to",
       carrier_bot_id: normalized_carrier_bot_id,
       carried_payload_bot_id: carried_payload_bot_id,
       target: { x: target_x, y: target_y, z: target_z },
       target_orientation: { x: target_vx, y: target_vy, z: target_vz },
       orientation_any: orientation_any,
       release_after: should_release_after,
       executable: true,
       executed: false,
       steps: steps,
       move_result: move_ret,
       rotate_result: rotate_ret,
       release_result: release_ret
       });
} // apicall_diagnose_move_carrier_to()


apicall_suggest_simple_move(bot_id, x, y, z)
{
let path_ret = this.apicall_find_path_for_bot(bot_id, x, y, z, false);
let move_library = this.apicall_get_simple_move_library();
let tested_candidates = [];
let matching_candidates = [];

if (path_ret.ok !== true)
   {
   return({
          ok: false,
          answer: "api_suggest_simple_move",
          error: path_ret.error ?? "PATH_PRECHECK_FAILED",
          bot_id: bot_id
          });
   } // if

if (path_ret.path_found !== true)
   {
   return({
          ok: true,
          answer: "api_suggest_simple_move",
          bot_id: bot_id,
          target: path_ret.target,
          suggested: false,
          reason: path_ret.reason ?? "NO_SURFACE_PATH_FOUND",
          path_found: false,
          path: path_ret.path ?? []
          });
   } // if

if (!Array.isArray(path_ret.path) || path_ret.path.length < 2)
   {
   return({
          ok: true,
          answer: "api_suggest_simple_move",
          bot_id: bot_id,
          target: path_ret.target,
          suggested: false,
          reason: "ALREADY_AT_TARGET",
          path_found: true,
          path: path_ret.path ?? []
          });
   } // if

for (let i = 0; i < move_library.length; i++)
    {
    let move_candidate = move_library[i];
    let probe_ret = this.apicall_probe_move_bot(bot_id, move_candidate);
    let candidate_info = {
                         move: move_candidate,
                         ok: probe_ret.ok === true,
                         possible: probe_ret.possible === true
                         };

    if (probe_ret.predicted_target)
       {
       candidate_info.predicted_target = probe_ret.predicted_target;
       } // if

    tested_candidates.push(candidate_info);

    if (probe_ret.ok === true && probe_ret.possible === true && probe_ret.predicted_target)
       {
       for (let p = 1; p < path_ret.path.length; p++)
           {
           let pathnode = path_ret.path[p];

           if ( Number(probe_ret.predicted_target.x) === Number(pathnode.x) &&
                Number(probe_ret.predicted_target.y) === Number(pathnode.y) &&
                Number(probe_ret.predicted_target.z) === Number(pathnode.z) )
              {
              matching_candidates.push({
                                       move: move_candidate,
                                       path_index: p,
                                       predicted_target: probe_ret.predicted_target,
                                       notes: probe_ret.notes ?? []
                                       });
              break;
              } // if
           } // for
       } // if
    } // for

if (matching_candidates.length == 0)
   {
   return({
          ok: true,
          answer: "api_suggest_simple_move",
          bot_id: bot_id,
          target: path_ret.target,
          suggested: false,
          reason: "NO_SIMPLE_MOVE_CANDIDATE_FOR_PATH_HEAD",
          path_found: true,
          path: path_ret.path,
          tested_candidates: tested_candidates
          });
   } // if

matching_candidates.sort((a, b) => b.path_index - a.path_index);

return({
       ok: true,
       answer: "api_suggest_simple_move",
       bot_id: bot_id,
       target: path_ret.target,
       suggested: true,
       reason: "SIMPLE_MOVE_FOUND",
       path_found: true,
       path: path_ret.path,
       move_candidate: matching_candidates[0].move,
       predicted_target: matching_candidates[0].predicted_target,
       matched_path_index: matching_candidates[0].path_index,
       matching_candidates: matching_candidates,
       tested_candidates: tested_candidates
       });
} // apicall_suggest_simple_move()


apicall_move_bot_to(bot_id, x, y, z, execute_move = true)
{
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let safe_prepare_ret = this.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = this.apicall_get_bot_snapshot(bot_id);
let carried_payload_bot_id = this.apicall_get_carried_payload_bot_id(bot_id);
let excluded_bot_ids = [];
let should_execute_move = (execute_move === true);

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_move_bot_to",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(this.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_move_bot_to",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if (Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z))
   {
   return({
          ok: false,
          answer: "api_move_bot_to",
          error: "INVALID_TARGET_POSITION",
          bot_id: bot_id
          });
   } // if

if (carried_payload_bot_id)
   {
   excluded_bot_ids.push(String(carried_payload_bot_id));
   } // if

let path_ret = this.apicall_find_path_for_bot(
                                             bot_id,
                                             target_x,
                                             target_y,
                                             target_z,
                                             false,
                                             {
                                             excluded_bot_ids: excluded_bot_ids,
                                             carried_payload_bot_id: carried_payload_bot_id
                                             }
                                             );

if (path_ret.ok !== true)
   {
   return({
          ok: false,
          answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
          error: path_ret.error ?? "PATH_PRECHECK_FAILED",
          bot_id: bot_id
          });
   } // if

if (path_ret.path_found !== true)
   {
   return({
          ok: true,
          answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
          bot_id: bot_id,
          execution_mode: "plan-only",
          target: {
                   x: target_x,
                   y: target_y,
                   z: target_z
                   },
          executable: false,
          executed: false,
          reason: path_ret.reason ?? "NO_SURFACE_PATH_FOUND",
          current_state: bot_snapshot,
          carried_payload_bot_id: carried_payload_bot_id,
          planning_excluded_bot_ids: excluded_bot_ids,
          path_found: false,
          path_length: 0,
          planned_moves: [],
          planned_primitives: [],
          planned_movecmds_legacy: "",
          planned_raw_cmd: null,
          path: []
          });
   } // if

let bots_tmp_translate = this.apicall_build_active_bots_tmp(false, excluded_bot_ids);
let planned_moves = this.apicall_translate_path_to_primitive_paths(
                                                             path_ret.path ?? [],
                                                             Number(bot_snapshot.orientation.x),
                                                             Number(bot_snapshot.orientation.y),
                                                             Number(bot_snapshot.orientation.z),
                                                             bots_tmp_translate
                                                             );
let planned_primitives = this.apicall_add_anchors_to_primitive_paths(
                                                                   planned_moves,
                                                                   Number(bot_snapshot.orientation.x),
                                                                   Number(bot_snapshot.orientation.y),
                                                                   Number(bot_snapshot.orientation.z),
                                                                   excluded_bot_ids
                                                                   );
let bots_tmp = this.apicall_build_active_bots_tmp(false, excluded_bot_ids);
let legacy_move_ret = this.calc_move_cmds(
                                         path_ret.path ?? [],
                                         Number(bot_snapshot.orientation.x),
                                         Number(bot_snapshot.orientation.y),
                                         Number(bot_snapshot.orientation.z),
                                         bots_tmp
                                         );
let planned_movecmds_legacy = legacy_move_ret?.movecmds ?? "";
let planned_raw_cmd = null;
let raw_ret = null;
let ack_id = null;
let ack_retaddr = "";
let ack_target_addr = "";
let ack_target_neighbors_debug = [];
let ack_target_neighbors_live_debug = [];
let ack_stl_debug = null;
let move_diagnostic_summary = null;

if (typeof planned_movecmds_legacy == "string" && planned_movecmds_legacy.trim() != "")
   {
   let bots_tmp_ack = this.apicall_build_active_bots_tmp(true, excluded_bot_ids);
   let ack_botindex = this.get_bot_by_id(bot_id, bots_tmp_ack);

   if (ack_botindex != null)
      {
      bots_tmp_ack[ack_botindex].x = target_x;
      bots_tmp_ack[ack_botindex].y = target_y;
      bots_tmp_ack[ack_botindex].z = target_z;

      for (let b = 0; b < bots_tmp_ack.length; b++)
          {
          let cleanedBlockedBots = [];

          if (bots_tmp_ack[b].id == "masterbot")
             {
             continue;
             } // if

          bots_tmp_ack[b].adress = this.get_mb_returnaddr(
                                                      {x: this.mb.x, y: this.mb.y, z: this.mb.z},
                                                      {x: bots_tmp_ack[b].x, y: bots_tmp_ack[b].y, z: bots_tmp_ack[b].z},
                                                      bots_tmp_ack,
                                                      cleanedBlockedBots
                                                      );
          } // for

      let ack_target_neighbors = this.get_valid_neighbours(
                                                          {x: target_x, y: target_y, z: target_z},
                                                          null,
                                                          bots_tmp_ack
                                                          );
      ack_target_neighbors_debug = ack_target_neighbors.map((bot) => ({
                                                                     id: bot.id,
                                                                     x: Number(bot.x),
                                                                     y: Number(bot.y),
                                                                     z: Number(bot.z),
                                                                     adress: bot.adress ?? ""
                                                                     }));

      ack_target_addr = String(bots_tmp_ack[ack_botindex].adress ?? "").trim();
      if (ack_target_addr == "")
         {
         ack_target_addr = this.apicall_derive_target_address_from_neighbours(
                                                                           {x: target_x, y: target_y, z: target_z},
                                                                           bots_tmp_ack
                                                                           );
         } // if

      if (ack_target_addr == "")
         {
         let ack_target_neighbors_live = this.get_valid_neighbours(
                                                                  {x: target_x, y: target_y, z: target_z},
                                                                  null,
                                                                  this.bots
                                                                  );
         ack_target_neighbors_live_debug = ack_target_neighbors_live.map((bot) => ({
                                                                               id: bot.id,
                                                                               x: Number(bot.x),
                                                                               y: Number(bot.y),
                                                                               z: Number(bot.z),
                                                                               adress: bot.adress ?? ""
                                                                               }));

         ack_target_addr = this.apicall_derive_target_address_from_neighbours(
                                                                           {x: target_x, y: target_y, z: target_z},
                                                                           this.bots
                                                                           );
         } // if

      if (
          legacy_move_ret &&
          typeof legacy_move_ret.final_lastanchor == "string" &&
          legacy_move_ret.final_lastanchor != "" &&
          legacy_move_ret.final_lastanchorneighbour &&
          legacy_move_ret.final_lastanchorneighbour.x !== undefined
         )
         {
         let stl_key = this.getKey_3d(
                                    Number(legacy_move_ret.final_lastanchorneighbour.x),
                                    Number(legacy_move_ret.final_lastanchorneighbour.y),
                                    Number(legacy_move_ret.final_lastanchorneighbour.z)
                                    );
         let botindex_map_ack = this.apicall_build_botindex_map_for_bots(bots_tmp_ack);
         let stl_index = botindex_map_ack[stl_key];

         ack_stl_debug = {
                          entry_slot: legacy_move_ret.final_lastanchor,
                          neighbour: legacy_move_ret.final_lastanchorneighbour
                          };

         if (stl_index !== undefined)
            {
            let stl_addr = String(bots_tmp_ack[stl_index].adress ?? "").trim();
            let masterbot_key = this.getKey_3d(Number(this.mb.x), Number(this.mb.y), Number(this.mb.z));

            ack_stl_debug.stl_id = bots_tmp_ack[stl_index].id ?? "";
            ack_stl_debug.stl_addr = stl_addr;

            if (stl_addr == "")
               {
               let live_stl_index = this.get_bot_by_id(String(bots_tmp_ack[stl_index].id ?? ""), this.bots);

               if (live_stl_index !== null)
                  {
                  stl_addr = String(this.bots[live_stl_index].adress ?? "").trim();
                  ack_stl_debug.stl_addr_live = stl_addr;
                  } // if
               } // if

            if (stl_addr != "")
               {
               let stl_retaddr = this.apicall_get_inverse_address_for_bots(
                                                                          masterbot_key,
                                                                          stl_addr,
                                                                          bots_tmp_ack,
                                                                          botindex_map_ack
                                                                          );

               ack_stl_debug.stl_retaddr = stl_retaddr;

               if (stl_retaddr != "")
                  {
                  ack_retaddr = String(legacy_move_ret.final_lastanchor) + String(stl_retaddr);
                  } // if
               } // if
            } // if
         } // if

      if (ack_retaddr == "")
         {
         ack_retaddr = this.apicall_derive_ack_returnaddr_from_neighbours(
                                                                      bots_tmp_ack[ack_botindex],
                                                                      bots_tmp_ack
                                                                      );
         } // if

      if (ack_retaddr == "")
         {
         ack_retaddr = this.get_mb_returnaddr(
                                             {x: target_x, y: target_y, z: target_z},
                                             {x: this.mb.x, y: this.mb.y, z: this.mb.z},
                                             bots_tmp_ack,
                                             []
                                             );
         } // if

      if (ack_retaddr == "" && ack_target_addr != "")
         {
         let botindex_map_ack = this.apicall_build_botindex_map_for_bots(bots_tmp_ack);
         let masterbot_key = this.getKey_3d(Number(this.mb.x), Number(this.mb.y), Number(this.mb.z));

         ack_retaddr = this.apicall_get_inverse_address_for_bots(
                                                              masterbot_key,
                                                              ack_target_addr,
                                                              bots_tmp_ack,
                                                              botindex_map_ack
                                                              );
         } // if
      } // if
   } // if

if (typeof planned_movecmds_legacy == "string" && planned_movecmds_legacy.trim() != "")
   {
   if (ack_retaddr != "")
      {
      ack_id = this.apicall_generate_ack_id(bot_id);
      planned_raw_cmd = bot_snapshot.adress + "#MOVE#" + planned_movecmds_legacy.trim() + ";ALIFE;" + ack_id + "#" + ack_retaddr;
      } else
        {
        planned_raw_cmd = bot_snapshot.adress + "#MOVE#" + planned_movecmds_legacy.trim();
        } // else
   } else
     {
     planned_raw_cmd = this.apicall_build_raw_move_cmd(bot_snapshot.adress, planned_primitives);
     } // else

if (should_execute_move === true && planned_raw_cmd)
   {
   if (ack_id !== null)
      {
      this.apicall_register_ack(
                               ack_id,
                               {
                               bot_id: bot_id,
                               to: { x: target_x, y: target_y, z: target_z },
                               planned_raw_cmd: planned_raw_cmd,
                               retaddr: ack_retaddr,
                               status: "pending"
                               }
                               );
      } // if

   raw_ret = this.apicall_raw_cmd(planned_raw_cmd);
   this.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
   this.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

   if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
      {
      this.apicall_mark_ack_received(ack_id, "send_failed");
      } // if
   } // if

move_diagnostic_summary = this.apicall_build_move_diagnostic_summary(
                                                                   planned_primitives,
                                                                   planned_movecmds_legacy,
                                                                   planned_raw_cmd,
                                                                   path_ret.path_debug_rejections ?? []
                                                                   );

return({
       ok: true,
       answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
       bot_id: bot_id,
       execution_mode: (should_execute_move ? "batched-raw-cmd" : "diagnostic-plan"),
       target: {
                x: target_x,
                y: target_y,
                z: target_z
                },
       executable: (planned_raw_cmd !== null),
       executed: (should_execute_move ? ((raw_ret?.accepted ?? false) === true) : false),
       reason: "PATH_READY_FOR_MOVE_TRANSLATION",
       current_state: bot_snapshot,
       carried_payload_bot_id: carried_payload_bot_id,
       planning_excluded_bot_ids: excluded_bot_ids,
       path_found: path_ret.path_found === true,
       path_length: path_ret.path_length ?? ((path_ret.path ?? []).length),
       path: path_ret.path ?? [],
       planned_moves: planned_moves,
       planned_primitives: planned_primitives,
       path_debug_rejections: path_ret.path_debug_rejections ?? [],
       invalid_primitive_count: move_diagnostic_summary?.invalid_primitive_count ?? 0,
       invalid_primitive_indices: move_diagnostic_summary?.invalid_primitive_indices ?? [],
       path_debug_rejection_count: move_diagnostic_summary?.path_debug_rejection_count ?? 0,
       path_debug_rejection_reasons: move_diagnostic_summary?.path_debug_rejection_reasons ?? [],
       legacy_translation_status: move_diagnostic_summary?.legacy_translation_status ?? "not_attempted",
       legacy_translation_warning: move_diagnostic_summary?.legacy_translation_warning ?? "",
       final_diagnostic_reason: move_diagnostic_summary?.final_diagnostic_reason ?? "MOVE_TRANSLATION_FAILED",
       planned_movecmds_legacy: planned_movecmds_legacy,
       ack_target_addr: ack_target_addr,
       ack_target_neighbors_debug: ack_target_neighbors_debug,
       ack_target_neighbors_live_debug: ack_target_neighbors_live_debug,
       ack_stl_debug: ack_stl_debug,
       ack_id: ack_id,
       ack_retaddr: ack_retaddr,
       planned_raw_cmd: planned_raw_cmd,
       raw_cmd_result: raw_ret,
       notes: [
               "Primitive middle paths are already derived from the coordinate path.",
               "Anchors are now selected for each primitive where possible.",
               "A complete MOVE raw command is preferably built via the legacy calc_move_cmds() translator.",
               "API move commands now append ALIFE with an API-specific acknowledgement id when a return address is available.",
               (should_execute_move ? "The command is executed immediately in this version if all primitives are valid." : "Diagnostic mode stops before raw command execution and only returns the planned translation.")
               ]
       });
} // apicall_move_bot_to()


apicall_diagnose_move_bot_to(bot_id, x, y, z)
{
return(this.apicall_move_bot_to(bot_id, x, y, z, false));
} // apicall_diagnose_move_bot_to()


apicall_build_move_diagnostic_summary(planned_primitives, planned_movecmds_legacy, planned_raw_cmd, path_debug_rejections = [])
{
let invalid_primitive_indices = [];
let invalid_primitive_count = 0;
let path_debug_rejection_count = 0;
let path_debug_rejection_reasons = [];
let legacy_translation_status = "not_attempted";
let legacy_translation_warning = "";
let final_diagnostic_reason = "MOVE_READY";

if (Array.isArray(planned_primitives))
   {
   for (let i = 0; i < planned_primitives.length; i++)
       {
       if (planned_primitives[i].valid !== true)
          {
          invalid_primitive_indices.push(i);
          invalid_primitive_count++;
          } // if
       } // for
   } // if

if (Array.isArray(path_debug_rejections))
   {
   path_debug_rejection_count = path_debug_rejections.length;
   path_debug_rejection_reasons = [...new Set(
                                          path_debug_rejections
                                          .map((entry) => String(entry?.reason ?? "").trim())
                                          .filter((reason) => reason != "")
                                          )];
   } // if

if (typeof planned_movecmds_legacy == "string" && planned_movecmds_legacy.trim() != "")
   {
   if (invalid_primitive_count > 0)
      {
      legacy_translation_status = "warning_invalid_primitives_but_legacy_present";
      legacy_translation_warning = "Legacy translation produced a MOVE string although one or more anchored primitives are invalid.";
      final_diagnostic_reason = "LEGACY_TRANSLATION_CONFLICT";
      } // if
   else
      {
      legacy_translation_status = "legacy_ready";
      final_diagnostic_reason = "MOVE_READY";
      } // else
   } // if
else if (invalid_primitive_count > 0)
   {
   legacy_translation_status = "legacy_not_available_due_to_invalid_primitives";
   final_diagnostic_reason = "ANCHOR_FAILURE";
   } // else if
else if (typeof planned_raw_cmd == "string" && planned_raw_cmd.trim() != "")
   {
   legacy_translation_status = "raw_fallback_ready";
   final_diagnostic_reason = "MOVE_READY";
   } // else if
else
   {
   legacy_translation_status = "no_move_translation";
   final_diagnostic_reason = "MOVE_TRANSLATION_FAILED";
   } // else

return({
       invalid_primitive_count: invalid_primitive_count,
       invalid_primitive_indices: invalid_primitive_indices,
       path_debug_rejection_count: path_debug_rejection_count,
       path_debug_rejection_reasons: path_debug_rejection_reasons,
       legacy_translation_status: legacy_translation_status,
       legacy_translation_warning: legacy_translation_warning,
       final_diagnostic_reason: final_diagnostic_reason
       });
} // apicall_build_move_diagnostic_summary()


apicall_get_valid_double_primitives()
{
return([
        "TF", "FT", "FD", "DF",
        "DB", "BD", "BT", "TB",
        "TL", "LT", "LD", "DL",
        "DR", "RD", "RT", "TR"
        ]);
} // apicall_get_valid_double_primitives()


apicall_is_valid_double_primitive(slot1, slot2)
{
if (typeof slot1 != "string" || typeof slot2 != "string")
   {
   return(false);
   } // if

let pair = slot1 + slot2;
let valid_pairs = this.apicall_get_valid_double_primitives();

return(valid_pairs.includes(pair));
} // apicall_is_valid_double_primitive()


apicall_translate_path_to_primitive_paths(path, vx, vy, vz, bots_tmp = null)
{
let planned_moves = [];
let raw_slots = [];

if (!Array.isArray(path) || path.length < 2)
   {
   return(planned_moves);
   } // if

for (let i = 0; i < path.length - 1; i++)
    {
    let current_node = path[i];
    let next_node = path[i + 1];
    let dx1 = Number(next_node.x) - Number(current_node.x);
    let dy1 = Number(next_node.y) - Number(current_node.y);
    let dz1 = Number(next_node.z) - Number(current_node.z);
    let slot1 = this.get_cell_slot_byvector(dx1, dy1, dz1, vx, vy, vz);
    if (slot1 != "")
       {
       raw_slots.push(slot1);
       } // if
    } // for

if (!Array.isArray(bots_tmp) || bots_tmp.length === 0)
   {
   let raw_index = 0;

   for (let i = 0; i < path.length - 1 && raw_index < raw_slots.length; i++, raw_index++)
       {
       planned_moves.push({
                          from: {
                                 x: Number(path[i].x),
                                 y: Number(path[i].y),
                                 z: Number(path[i].z)
                                 },
                          to: {
                               x: Number(path[i + 1].x),
                               y: Number(path[i + 1].y),
                               z: Number(path[i + 1].z)
                               },
                          primitive_path: raw_slots[raw_index]
                          });
       } // for

   return(planned_moves);
   } // if

let bot_x = Number(path[0].x);
let bot_y = Number(path[0].y);
let bot_z = Number(path[0].z);
let path_cursor = 0;

for (let i = 0; i < raw_slots.length; i++)
    {
    let from_pos = {
                   x: Number(path[path_cursor].x),
                   y: Number(path[path_cursor].y),
                   z: Number(path[path_cursor].z)
                   };
    let primitive_path = raw_slots[i];
    let step_count = 1;
    let teststruct = this.test_virtual_botmove(
                                          { x: bot_x, y: bot_y, z: bot_z },
                                          primitive_path,
                                          bots_tmp
                                          );

    if (teststruct?.check !== true && i + 1 < raw_slots.length)
       {
       let candidate_double = raw_slots[i] + raw_slots[i + 1];

       if (this.apicall_is_valid_double_primitive(raw_slots[i], raw_slots[i + 1]) === true)
          {
          let double_teststruct = this.test_virtual_botmove(
                                                       { x: bot_x, y: bot_y, z: bot_z },
                                                       candidate_double,
                                                       bots_tmp
                                                       );

          if (double_teststruct?.check === true)
             {
             primitive_path = candidate_double;
             step_count = 2;
             teststruct = double_teststruct;
             } // if
          } // if
       } // if

    let to_pos = null;

    if (teststruct?.check === true && teststruct?.lastpos != null)
       {
       to_pos = {
                x: Number(teststruct.lastpos.x),
                y: Number(teststruct.lastpos.y),
                z: Number(teststruct.lastpos.z)
                };

       let botindex = this.get_botindex_by_xyz({ x: bot_x, y: bot_y, z: bot_z }, bots_tmp);

       if (botindex != null)
          {
          bots_tmp[botindex].x = Number(teststruct.lastpos.x);
          bots_tmp[botindex].y = Number(teststruct.lastpos.y);
          bots_tmp[botindex].z = Number(teststruct.lastpos.z);
          } // if

       bot_x = Number(teststruct.lastpos.x);
       bot_y = Number(teststruct.lastpos.y);
       bot_z = Number(teststruct.lastpos.z);
       } else
         {
         let fallback_index = Math.min(path.length - 1, path_cursor + step_count);
         to_pos = {
                  x: Number(path[fallback_index].x),
                  y: Number(path[fallback_index].y),
                  z: Number(path[fallback_index].z)
                  };
         bot_x = Number(to_pos.x);
         bot_y = Number(to_pos.y);
         bot_z = Number(to_pos.z);
         } // else

    planned_moves.push({
                       from: from_pos,
                       to: to_pos,
                       primitive_path: primitive_path
                       });

    path_cursor += step_count;
    i += (step_count - 1);
    } // for

return(planned_moves);
} // apicall_translate_path_to_primitive_paths()


apicall_select_anchor_slot(x, y, z, vx, vy, vz, excluded_slots = [], excluded_bot_ids = [])
{
const slotnames = ['D', 'R', 'L', 'B', 'F', 'T'];

for (let i = 0; i < slotnames.length; i++)
    {
    let slot = slotnames[i];

    if (excluded_slots.includes(slot))
       {
       continue;
       } // if

    let target_xyz = this.get_next_target_coor(x, y, z, vx, vy, vz, slot);
    let occupancy = this.apicall_is_occupied_excluding_ids(
                                                          target_xyz.x,
                                                          target_xyz.y,
                                                          target_xyz.z,
                                                          excluded_bot_ids
                                                          );

    if (occupancy.occupied === true)
       {
       return({
              slot: slot,
              occupancy: occupancy
              });
       } // if
    } // for

return(null);
} // apicall_select_anchor_slot()


apicall_collect_anchor_candidates(x, y, z, vx, vy, vz, excluded_slots = [], excluded_bot_ids = [])
{
const slotnames = ['D', 'R', 'L', 'B', 'F', 'T'];
let candidates = [];

for (let i = 0; i < slotnames.length; i++)
    {
    let slot = slotnames[i];

    if (excluded_slots.includes(slot))
       {
       continue;
       } // if

    let target_xyz = this.get_next_target_coor(x, y, z, vx, vy, vz, slot);
    let occupancy = this.apicall_is_occupied_excluding_ids(
                                                          target_xyz.x,
                                                          target_xyz.y,
                                                          target_xyz.z,
                                                          excluded_bot_ids
                                                          );

    candidates.push({
                     slot: slot,
                     position: {
                                x: Number(target_xyz.x),
                                y: Number(target_xyz.y),
                                z: Number(target_xyz.z)
                                },
                     occupied: (occupancy.occupied === true),
                     state: occupancy.state ?? (occupancy.occupied === true ? "active" : "empty"),
                     id: occupancy.id ?? null
                     });
    } // for

return(candidates);
} // apicall_collect_anchor_candidates()


apicall_add_anchors_to_primitive_paths(planned_moves, vx, vy, vz, excluded_bot_ids = [])
{
let planned_primitives = [];

if (!Array.isArray(planned_moves))
   {
   return(planned_primitives);
   } // if

for (let i = 0; i < planned_moves.length; i++)
    {
    let primitive = planned_moves[i];
    let excluded_start_slots = [];
    let excluded_end_slots = [];

    if (typeof primitive.primitive_path === "string" && primitive.primitive_path.length > 0)
       {
       excluded_start_slots.push(primitive.primitive_path.charAt(0));
       excluded_end_slots.push(primitive.primitive_path.charAt(primitive.primitive_path.length - 1));
       } // if

    let start_anchor = this.apicall_select_anchor_slot(
                                                       primitive.from.x,
                                                       primitive.from.y,
                                                       primitive.from.z,
                                                       vx,
                                                       vy,
                                                       vz,
                                                       excluded_start_slots,
                                                       excluded_bot_ids
                                                       );
    let start_anchor_candidates = this.apicall_collect_anchor_candidates(
                                                                       primitive.from.x,
                                                                       primitive.from.y,
                                                                       primitive.from.z,
                                                                       vx,
                                                                       vy,
                                                                       vz,
                                                                       excluded_start_slots,
                                                                       excluded_bot_ids
                                                                       );
    let end_anchor = this.apicall_select_anchor_slot(
                                                     primitive.to.x,
                                                     primitive.to.y,
                                                     primitive.to.z,
                                                     vx,
                                                     vy,
                                                     vz,
                                                     excluded_end_slots,
                                                     excluded_bot_ids
                                                     );
    let end_anchor_candidates = this.apicall_collect_anchor_candidates(
                                                                     primitive.to.x,
                                                                     primitive.to.y,
                                                                     primitive.to.z,
                                                                     vx,
                                                                     vy,
                                                                     vz,
                                                                     excluded_end_slots,
                                                                     excluded_bot_ids
                                                                     );
    let primitive_with_anchor = null;
    let rejection_reasons = [];

    if (start_anchor && end_anchor)
       {
       primitive_with_anchor = start_anchor.slot + "_" + primitive.primitive_path + "_" + end_anchor.slot;
       } // if

    if (!start_anchor)
       {
       rejection_reasons.push("NO_VALID_START_ANCHOR");
       } // if

    if (!end_anchor)
       {
       rejection_reasons.push("NO_VALID_END_ANCHOR");
       } // if

    planned_primitives.push({
                            from: primitive.from,
                            to: primitive.to,
                            primitive_path: primitive.primitive_path,
                            excluded_start_slots: excluded_start_slots,
                            excluded_end_slots: excluded_end_slots,
                            start_anchor_candidates: start_anchor_candidates,
                            end_anchor_candidates: end_anchor_candidates,
                            start_anchor: start_anchor ? start_anchor.slot : null,
                            end_anchor: end_anchor ? end_anchor.slot : null,
                            primitive_with_anchor: primitive_with_anchor,
                            valid: (primitive_with_anchor !== null),
                            rejection_reasons: rejection_reasons
                            });
    } // for

return(planned_primitives);
} // apicall_add_anchors_to_primitive_paths()


apicall_build_raw_move_cmd(address, planned_primitives)
{
let normalized_address = String(address ?? "").trim();
let primitive_strings = [];

if (normalized_address == "")
   {
   return(null);
   } // if

if (!Array.isArray(planned_primitives) || planned_primitives.length == 0)
   {
   return(null);
   } // if

for (let i = 0; i < planned_primitives.length; i++)
    {
    let entry = planned_primitives[i];

    if (entry.valid !== true || typeof entry.primitive_with_anchor !== "string" || entry.primitive_with_anchor.trim() == "")
       {
       return(null);
       } // if

    primitive_strings.push(entry.primitive_with_anchor.trim());
    } // for

return(normalized_address + "#MOVE#" + primitive_strings.join(";"));
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
   
    
   this.scan_waiting_info[bottmpid].status = 1;
   
   
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
        bot_class_mini_obj.setvalues( msgarray.botid, target_x,target_y,target_z,  target_vectorx,target_vectory,target_vectorz,  target_color, target_addr); 
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
      
      

      this.bots[tmpbotid].adress = this.get_mb_returnaddr( {x:this.mb.x, y:this.mb.y, z:this.mb.z }, {x:new_x, y:new_y, z:new_z }, this.bots );

      let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                               this.signal_botids[ msgarray.bottmpid ].thebotid,
                                                                               "signal_move"
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

               let new_x = Number(api_ack_entry.to.x);
               let new_y = Number(api_ack_entry.to.y);
               let new_z = Number(api_ack_entry.to.z);

               this.update_keyindex( oldx, oldy, oldz, new_x, new_y, new_z );
               this.bots[tmpbotid].x = new_x;
               this.bots[tmpbotid].y = new_y;
               this.bots[tmpbotid].z = new_z;

               this.bots[tmpbotid].adress = this.get_mb_returnaddr(
                                                                  {x:this.mb.x, y:this.mb.y, z:this.mb.z },
                                                                  {x:new_x, y:new_y, z:new_z },
                                                                  this.bots
                                                                  );

               if (api_ack_entry.mode == "move")
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
                                                                                }
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
                                                                                        "move"
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
                     this.apicall_register_payload_link(
                                                       api_ack_entry.bot_id,
                                                       api_ack_entry.payload_bot_id,
                                                       "F",
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
                  this.apicall_clear_payload_link(api_ack_entry.bot_id);

                  let safe_mode_after_ret = this.apicall_apply_safe_mode_after_structure_change(
                                                                                           api_ack_entry.bot_id,
                                                                                           "release"
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
                  this.append_api_bot_history(
                                             api_ack_entry.bot_id,
                                             "api_ack",
                                             { ack_id: msgarray.bottmpid },
                                             {
                                             ok: true,
                                             answer: "api_ack_applied",
                                             payload_bot_id: api_ack_entry.payload_bot_id ?? null,
                                             mode: "release"
                                             }
                                             );
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
if (this.scan_targets_lvl2_index < this.scan_targets_lvl2.length)
   {
   let target_bot_id = this.scan_targets_lvl2[this.scan_targets_lvl2_index];
   let target_bot_index = this.get_bot_by_id( target_bot_id, this.bots );

   if (target_bot_index != null)
      {
      let firstindex = this.getKey_3d(this.mb['x'], this.mb['y'], this.mb['z']);
      let target_addr = this.bots[target_bot_index].adress;
      let retaddr = this.get_inverse_address(firstindex, target_addr);
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

                await this.handleAPIMessage(message, socket);
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
} // start_api_service()


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

            const filepath = path.join(__dirname, 'structures', decodedobject.structure + '.json');
            const data = fs.readFileSync(filepath, 'utf8');
            const targetBots = JSON.parse(data);

            answer = JSON.stringify({
                answer: "answer_getpreviewtarget",
                target: targetBots
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
    let answer = null;

    try {
        const decodedobject = JSON.parse(message);

        if (decodedobject.cmd === 'describe') {
            answer = JSON.stringify({
                ok: true,
                answer: "api_description",
                api_name: "SP-CellBots BotController API",
                version: this.version,
                transport: "json-over-tcp",
                mode: "atomic-request",
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
                            loaded_bots: "number"
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
                            z: "number"
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
                            path_found: "boolean"
                        },
                        description: "Plans and executes one complete translated MOVE command for a bot, including ALIFE/RALIFE handling when a return route is available."
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
                            z: "number"
                        },
                        returns: {
                            answer: "api_diagnose_move_bot_to",
                            path_found: "boolean",
                            planned_moves: "list",
                            planned_primitives: "list"
                        },
                        description: "Plans a move like move_bot_to but stops before execution and returns path, primitives and MOVE translation for diagnostics."
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
                        description: "Sends a direct G command for one bot and appends ALIFE when a return route is available."
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

        if (decodedobject.cmd === 'version') {
            answer = JSON.stringify({
                ok: true,
                answer: "api_version",
                version: this.version
            }) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_status') {
            let l = this.bots.length;

            answer = JSON.stringify({
                ok: true,
                answer: "api_status",
                loaded_bots: l
            }) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_status_extended') {
            let ret = this.apicall_get_status_extended();
            this.append_api_action_log("get_status_extended", {}, { ok: ret.ok, answer: ret.answer, loaded_cluster_bots: ret.loaded_cluster_bots ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_masterbot') {
            let ret = this.apicall_get_masterbot();
            this.append_api_action_log("get_masterbot", {}, { ok: ret.ok, answer: ret.answer, connected: ret.connected });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_scan_state') {
            let ret = this.apicall_get_scan_state();
            this.append_api_action_log("get_scan_state", {}, { ok: ret.ok, answer: ret.answer, level1_running: ret.level1.running, level2_running: ret.level2.running });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'gui_set_marker') {
            let ret = this.apicall_gui_set_marker(decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.size, decodedobject.color);
            this.append_api_action_log("gui_set_marker", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, size: decodedobject.size, color: decodedobject.color }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, frontend_attached: ret.frontend_attached ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'gui_clear_markers') {
            let ret = this.apicall_gui_clear_markers();
            this.append_api_action_log("gui_clear_markers", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, frontend_attached: ret.frontend_attached ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'gui_refresh') {
            let ret = this.apicall_gui_refresh();
            this.append_api_action_log("gui_refresh", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, frontend_attached: ret.frontend_attached ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'debug_move') {
            let ret = this.apicall_set_debug_move(decodedobject.mode);
            this.append_api_action_log("debug_move", { mode: decodedobject.mode }, { ok: ret.ok, answer: ret.answer, debug_move_enabled: ret.debug_move_enabled ?? null });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'safe_mode') {
            let ret = this.apicall_set_safe_mode(decodedobject.mode);
            this.append_api_action_log("safe_mode", { mode: decodedobject.mode }, { ok: ret.ok, answer: ret.answer, safe_mode: ret.safe_mode ?? null, error: ret.error ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'recalibrate_bot_address') {
            let ret = this.apicall_recalibrate_bot_address(decodedobject.bot_id, decodedobject.mode ?? "standard");
            this.append_api_action_log("recalibrate_bot_address", { bot_id: decodedobject.bot_id, mode: decodedobject.mode ?? "standard" }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, error: ret.error ?? "" });
            this.append_api_bot_history(decodedobject.bot_id, "recalibrate_bot_address", { bot_id: decodedobject.bot_id, mode: decodedobject.mode ?? "standard" }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, old_adress: ret.old_adress ?? "", new_adress: ret.new_adress ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'recalibrate_bot_addresses') {
            let ret = this.apicall_recalibrate_bot_addresses(decodedobject.mode ?? "standard");
            this.append_api_action_log("recalibrate_bot_addresses", { mode: decodedobject.mode ?? "standard" }, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, changed_count: ret.changed_count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'diagnose_ack_route') {
            let ret = this.apicall_diagnose_ack_route(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.vx, decodedobject.vy, decodedobject.vz);
            this.append_api_action_log("diagnose_ack_route", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx ?? null, vy: decodedobject.vy ?? null, vz: decodedobject.vz ?? null }, { ok: ret.ok, answer: ret.answer, ack_target_addr: ret.ack_target_addr ?? "", ack_retaddr: ret.ack_retaddr ?? "", error: ret.error ?? "" });
            this.append_api_bot_history(decodedobject.bot_id, "diagnose_ack_route", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx ?? null, vy: decodedobject.vy ?? null, vz: decodedobject.vz ?? null }, { ok: ret.ok, answer: ret.answer, ack_target_addr: ret.ack_target_addr ?? "", ack_retaddr: ret.ack_retaddr ?? "", error: ret.error ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'structurescan') {
            this.start_scan(1);
            this.append_api_action_log("structurescan", {}, { ok: true, answer: "api_structurescan_started", accepted: true });

            answer = JSON.stringify({
                ok: true,
                answer: "api_structurescan_started",
                accepted: true
            }) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'structurescan_lvl2') {
            this.start_scan_lvl2(1);
            this.append_api_action_log("structurescan_lvl2", {}, { ok: true, answer: "api_structurescan_lvl2_started", accepted: true });

            answer = JSON.stringify({
                ok: true,
                answer: "api_structurescan_lvl2_started",
                accepted: true
            }) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'morph_get_structures') {
            let ret = this.apicall_morph_get_structures();
            this.append_api_action_log("morph_get_structures", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, error: ret.error ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'morph_get_algos') {
            let ret = this.apicall_morph_get_algos();
            this.append_api_action_log("morph_get_algos", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'morph_start') {
            let ret = this.apicall_morph_start(decodedobject.algo, decodedobject.structure);
            this.append_api_action_log("morph_start", { algo: decodedobject.algo, structure: decodedobject.structure }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, error: ret.error ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'morph_check_progress') {
            let ret = this.apicall_get_morph_status();
            this.append_api_action_log("morph_check_progress", {}, { ok: ret.ok, answer: ret.answer, running: ret.running ?? false, phase: ret.phase ?? "", progress: ret.progress ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_bot_by_id') {
            let ret = this.apicall_get_bot_by_id(decodedobject.bot_id);
            this.append_api_action_log("get_bot_by_id", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, bot_id: decodedobject.bot_id });
            this.append_api_bot_history(decodedobject.bot_id, "get_bot_by_id", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_bots') {
            let ret = this.apicall_get_bots(
                                          decodedobject.x,
                                          decodedobject.y,
                                          decodedobject.z,
                                          decodedobject.mode,
                                          decodedobject.radius
                                          );
            this.append_api_action_log("get_bots", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, mode: decodedobject.mode, radius: decodedobject.radius }, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_inactive_bots') {
            let ret = this.apicall_get_inactive_bots();
            this.append_api_action_log("get_inactive_bots", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_neighbors') {
            let ret = this.apicall_get_neighbors(decodedobject.bot_id);
            this.append_api_action_log("get_neighbors", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer });
            this.append_api_bot_history(decodedobject.bot_id, "get_neighbors", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'is_occupied') {
            let ret = this.apicall_is_occupied(decodedobject.x, decodedobject.y, decodedobject.z);
            this.append_api_action_log("is_occupied", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, occupied: ret.occupied });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_slot_status') {
            let ret = this.apicall_get_slot_status(decodedobject.bot_id, decodedobject.slot);
            this.append_api_action_log("get_slot_status", { bot_id: decodedobject.bot_id, slot: decodedobject.slot }, { ok: ret.ok, answer: ret.answer });
            this.append_api_bot_history(decodedobject.bot_id, "get_slot_status", { bot_id: decodedobject.bot_id, slot: decodedobject.slot }, { ok: ret.ok, answer: ret.answer });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'probe_move_bot') {
            let ret = this.apicall_probe_move_bot(decodedobject.bot_id, decodedobject.move);
            this.append_api_action_log("probe_move_bot", { bot_id: decodedobject.bot_id, move: decodedobject.move }, { ok: ret.ok, answer: ret.answer, possible: ret.possible ?? false });
            this.append_api_bot_history(decodedobject.bot_id, "probe_move_bot", { bot_id: decodedobject.bot_id, move: decodedobject.move }, { ok: ret.ok, answer: ret.answer, possible: ret.possible ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'can_reach_position') {
            let ret = this.apicall_can_reach_position(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
            this.append_api_action_log("can_reach_position", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, reachable: ret.reachable ?? false, reason: ret.reason ?? "" });
            this.append_api_bot_history(decodedobject.bot_id, "can_reach_position", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, reachable: ret.reachable ?? false, reason: ret.reason ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'find_path_for_bot') {
            let ret = this.apicall_find_path_for_bot(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.show);
            this.append_api_action_log("find_path_for_bot", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0, path_visualized: ret.path_visualized ?? false });
            this.append_api_bot_history(decodedobject.bot_id, "find_path_for_bot", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'find_path_for_bot_payload') {
            let ret = this.apicall_find_path_for_bot_payload(decodedobject.bot_id, decodedobject.payload_bot_id, decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.show);
            this.append_api_action_log("find_path_for_bot_payload", { bot_id: decodedobject.bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0, path_visualized: ret.path_visualized ?? false });
            this.append_api_bot_history(decodedobject.bot_id, "find_path_for_bot_payload", { bot_id: decodedobject.bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'suggest_simple_move') {
            let ret = this.apicall_suggest_simple_move(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
            this.append_api_action_log("suggest_simple_move", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, suggested: ret.suggested ?? false, move_candidate: ret.move_candidate ?? "" });
            this.append_api_bot_history(decodedobject.bot_id, "suggest_simple_move", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, suggested: ret.suggested ?? false, move_candidate: ret.move_candidate ?? "" });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'move_bot_to') {
            let ret = this.apicall_move_bot_to(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);

            if (ret?.ack_id)
               {
               let ack_wait_ret = await this.apicall_wait_for_ack(ret.ack_id, 6, 500);
               ret.ack_wait = ack_wait_ret;
               ret.ack_received = ack_wait_ret.ack_received;

               if (ack_wait_ret.ack_received !== true)
                  {
                  ret.ack_recovery = await this.apicall_recover_after_ack_timeout(ret.ack_id);
                  } // if
               } // if

            this.append_api_action_log("move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            this.append_api_bot_history(decodedobject.bot_id, "move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'diagnose_move_bot_to') {
            let ret = this.apicall_diagnose_move_bot_to(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
            this.append_api_action_log("diagnose_move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, path_found: ret.path_found ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            this.append_api_bot_history(decodedobject.bot_id, "diagnose_move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, path_found: ret.path_found ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'would_split_cluster') {
            let ret = this.apicall_would_split_cluster(decodedobject.bot_id);
            this.append_api_action_log("would_split_cluster", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, would_split_cluster: ret.would_split_cluster ?? null, disconnected_count: ret.disconnected_count ?? 0 });
            this.append_api_bot_history(decodedobject.bot_id, "would_split_cluster", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, would_split_cluster: ret.would_split_cluster ?? null, disconnected_count: ret.disconnected_count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'rotate_bot') {
            let ret = this.apicall_rotate_bot(decodedobject.bot_id, decodedobject.direction);

            if (ret?.ack_id)
               {
               let ack_wait_ret = await this.apicall_wait_for_ack(ret.ack_id, 6, 500);
               ret.ack_wait = ack_wait_ret;
               ret.ack_received = ack_wait_ret.ack_received;

               if (ack_wait_ret.ack_received !== true)
                  {
                  ret.ack_recovery = await this.apicall_recover_after_ack_timeout(ret.ack_id);
                  } // if
               } // if

            this.append_api_action_log("rotate_bot", { bot_id: decodedobject.bot_id, direction: decodedobject.direction }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            this.append_api_bot_history(decodedobject.bot_id, "rotate_bot", { bot_id: decodedobject.bot_id, direction: decodedobject.direction }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'rotate_bot_to') {
            let ret = this.apicall_rotate_bot_to(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);

            if (ret?.ok === true && Array.isArray(ret.rotation_plan) && ret.rotation_plan.length > 0)
               {
               let execute_ret = this.apicall_execute_rotation_plan(
                                                                  decodedobject.bot_id,
                                                                  ret.rotation_plan,
                                                                  ret.target_orientation ?? null
                                                                  );
               execute_ret = await this.apicall_attach_ack_wait_and_recovery(execute_ret);

               ret.executed = (execute_ret?.ack_received ?? false) === true;
               ret.execution_steps = [
                                     {
                                     rotation_plan: ret.rotation_plan,
                                     ack_id: execute_ret?.ack_id ?? null,
                                     ack_received: execute_ret?.ack_received ?? false,
                                     planned_raw_cmd: execute_ret?.planned_raw_cmd ?? null
                                     }
                                     ];
               ret.ack_id = execute_ret?.ack_id ?? null;
               ret.ack_retaddr = execute_ret?.ack_retaddr ?? "";
               ret.planned_raw_cmd = execute_ret?.planned_raw_cmd ?? null;
               ret.raw_cmd_result = execute_ret?.raw_cmd_result ?? null;
               ret.ack_wait = execute_ret?.ack_wait ?? null;
               ret.ack_received = execute_ret?.ack_received ?? false;
               ret.ack_recovery = execute_ret?.ack_recovery ?? null;

               if ((execute_ret?.ack_received ?? false) !== true)
                  {
                  ret.ok = false;
                  ret.error = "ROTATION_PLAN_FAILED";
                  ret.failed_step = 1;
                  ret.failed_direction = (ret.rotation_plan[0] ?? null);
                  answer = JSON.stringify(ret) + "\n";

                  socket.write(answer, () => {
                      socket.end();
                  });
                  return;
                  } // if
               } // if

            this.append_api_action_log("rotate_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, rotation_plan: ret.rotation_plan ?? [] });
            this.append_api_bot_history(decodedobject.bot_id, "rotate_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, rotation_plan: ret.rotation_plan ?? [] });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'grab_bot') {
            let ret = this.apicall_grab_bot(decodedobject.bot_id);

            if (ret?.ack_id)
               {
               let ack_wait_ret = await this.apicall_wait_for_ack(ret.ack_id, 6, 500);
               ret.ack_wait = ack_wait_ret;
               ret.ack_received = ack_wait_ret.ack_received;

               if (ack_wait_ret.ack_received !== true)
                  {
                  ret.ack_recovery = await this.apicall_recover_after_ack_timeout(ret.ack_id);
                  } // if
               } // if

            this.append_api_action_log("grab_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            this.append_api_bot_history(decodedobject.bot_id, "grab_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'release_bot') {
            let ret = this.apicall_release_bot(decodedobject.bot_id);

            if (ret?.ack_id)
               {
               let ack_wait_ret = await this.apicall_wait_for_ack(ret.ack_id, 6, 500);
               ret.ack_wait = ack_wait_ret;
               ret.ack_received = ack_wait_ret.ack_received;

               if (ack_wait_ret.ack_received !== true)
                  {
                  ret.ack_recovery = await this.apicall_recover_after_ack_timeout(ret.ack_id);
                  } // if
               } // if

            this.append_api_action_log("release_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            this.append_api_bot_history(decodedobject.bot_id, "release_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'move_payload_to') {
            let ret = await this.apicall_move_payload_to(
                                                        decodedobject.carrier_bot_id,
                                                        decodedobject.payload_bot_id,
                                                        decodedobject.x,
                                                        decodedobject.y,
                                                        decodedobject.z,
                                                        decodedobject.release_after
                                                        );

            this.append_api_action_log("move_payload_to", { carrier_bot_id: decodedobject.carrier_bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
            this.append_api_bot_history(decodedobject.carrier_bot_id, "move_payload_to", { carrier_bot_id: decodedobject.carrier_bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'move_carrier_to') {
            let ret = await this.apicall_move_carrier_to(
                                                        decodedobject.carrier_bot_id,
                                                        decodedobject.x,
                                                        decodedobject.y,
                                                        decodedobject.z,
                                                        decodedobject.vx,
                                                        decodedobject.vy,
                                                        decodedobject.vz,
                                                        decodedobject.release_after
                                                        );

            this.append_api_action_log("move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
            this.append_api_bot_history(decodedobject.carrier_bot_id, "move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'diagnose_move_carrier_to') {
            let ret = this.apicall_diagnose_move_carrier_to(
                                                            decodedobject.carrier_bot_id,
                                                            decodedobject.x,
                                                            decodedobject.y,
                                                            decodedobject.z,
                                                            decodedobject.vx,
                                                            decodedobject.vy,
                                                            decodedobject.vz,
                                                            decodedobject.release_after
                                                            );

            this.append_api_action_log("diagnose_move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", executable: ret.executable ?? false });
            this.append_api_bot_history(decodedobject.carrier_bot_id, "diagnose_move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", executable: ret.executable ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_last_moves') {
            answer = JSON.stringify(
                this.apicall_get_last_moves(decodedobject.limit)
            ) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_bot_history') {
            let ret = this.apicall_get_bot_history(decodedobject.bot_id, decodedobject.limit);
            this.append_api_action_log("get_bot_history", { bot_id: decodedobject.bot_id, limit: decodedobject.limit }, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_last_raw_cmds') {
            let ret = this.apicall_get_last_raw_cmds(decodedobject.limit);
            this.append_api_action_log("get_last_raw_cmds", { limit: decodedobject.limit }, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0 });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'raw_cmd') {
            let ret = this.apicall_raw_cmd(decodedobject.value);
            let raw_parts = String(decodedobject.value ?? "").split("#");
            let raw_target_bot_id = this.apicall_resolve_bot_id_by_address(raw_parts[0] ?? "");
            this.append_api_action_log("raw_cmd", { value: decodedobject.value }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false });
            this.append_api_raw_cmd_log(decodedobject.value, raw_target_bot_id, ret.accepted ?? false);

            if (raw_target_bot_id)
               {
               this.append_api_bot_history(raw_target_bot_id, "raw_cmd", { value: decodedobject.value }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false });
               } // if

            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'poll_masterbot_queue') {
            let ret = this.apicall_poll_masterbot_queue();
            this.append_api_action_log("poll_masterbot_queue", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'reset_api_message_log') {
            this.reset_api_message_log();
            this.append_api_action_log("reset_api_message_log", {}, { ok: true, answer: "api_reset_api_message_log", accepted: true });

            answer = JSON.stringify({
                ok: true,
                answer: "api_reset_api_message_log",
                accepted: true,
                cleared: true
            }) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
            return;
        } // if

        if (decodedobject.cmd === 'get_api_messages') {
            let ret = this.apicall_get_api_messages(decodedobject.cmd_filter, decodedobject.limit);
            this.append_api_action_log("get_api_messages", { cmd_filter: decodedobject.cmd_filter, limit: decodedobject.limit }, { ok: ret.ok, answer: ret.answer, count: ret.count });
            answer = JSON.stringify(ret) + "\n";

            socket.write(answer, () => {
                socket.end();
            });
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
        answer = JSON.stringify({
            ok: false,
            error: "INVALID_JSON",
            message: err.message
        }) + "\n";

        socket.write(answer, () => {
            socket.end();
        });
    } // try
} // handleAPIMessage()

  
  
} // botcontroller_class


module.exports = botcontroller_class;

 
