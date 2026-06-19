function apicall_raw_cmd(controller, raw_value)
{
if ( typeof raw_value != "string" || raw_value.trim() == "" )
   {
   return({
          ok: false,
          answer: "api_raw_cmd",
          error: "EMPTY_RAW_COMMAND"
          });
   } // if

const connectorId = (typeof arguments[2] === "string") ? arguments[2].trim() : "";

// ADC-Weg: Connector-Parameter gesetzt
if (connectorId !== "")
   {
   if (!controller.accessDomainController)
      {
      return({
             ok: false,
             answer: "api_raw_cmd",
             error: "ADC_NOT_AVAILABLE"
             });
      } // if

   let param = controller.sign( raw_value.trim() );
   let sent = controller.accessDomainController.adc_sendPush(connectorId, param);

   if (!sent)
      {
      return({
             ok: false,
             answer: "api_raw_cmd",
             error: "CONNECTOR_NOT_AVAILABLE",
             connector: connectorId
             });
      } // if

   return({
          ok: true,
          answer: "api_raw_cmd",
          accepted: true,
          raw_value: raw_value.trim(),
          connector: connectorId
          });
   } // if (connectorId !== "")

// Legacy-Weg: Connector-Parameter NICHT gesetzt
if (controller.disableLegacy === true)
   {
   const Logger = require('../../logger');
   Logger.log("[LEGACY] BLOCKED: apicall_raw_cmd legacy push – raw_value=\"" + raw_value.trim() + "\"");
   console.log("[LEGACY] BLOCKED – legacy MasterBot push attempted: \"" + raw_value.trim().substring(0, 80) + "...\"");
   return({
          ok: false,
          answer: "api_raw_cmd",
          error: "LEGACY_MASTERBOT_DISABLED"
          });
   } // if

if ( controller.MASTERBOT_CONNECTED != 1 )
   {
   return({
          ok: false,
          answer: "api_raw_cmd",
          error: "MASTERBOT_NOT_CONNECTED"
          });
   } // if

let param = controller.sign( raw_value.trim() );
let cmd = JSON.stringify({ cmd: "push", param }) + "\n";

controller.client.write(cmd);

return({
       ok: true,
       answer: "api_raw_cmd",
       accepted: true,
       raw_value: raw_value.trim()
       });
} // apicall_raw_cmd()


function apicall_poll_masterbot_queue(controller)
{
if ( controller.MASTERBOT_CONNECTED != 1 )
   {
   return({
          ok: false,
          answer: "api_poll_masterbot_queue",
          error: "MASTERBOT_NOT_CONNECTED"
          });
   } // if

let cmd = JSON.stringify({ cmd: "pop", param: "" }) + "\n";
controller.client.write(cmd);

return({
       ok: true,
       answer: "api_poll_masterbot_queue",
       accepted: true
       });
} // apicall_poll_masterbot_queue()


function apicall_search_bot(controller, bot_id, level = 1)
{
if (controller.MASTERBOT_CONNECTED != 1)
   {
   return({
          ok: false,
          answer: "api_search_bot",
          error: "MASTERBOT_NOT_CONNECTED"
          });
   } // if

return(controller.start_search_bot_radio(bot_id, level));
} // apicall_search_bot()


function apicall_collect_neighbor_probe(controller, bot_id, expected_position, snapshot)
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
   let target_bot_index = controller.get_3d(expected_x, expected_y, expected_z);
   let target_inactive_bot = controller.apicall_get_inactive_bot_by_xyz(expected_x, expected_y, expected_z);

   if (target_bot_index != null)
      {
      probe.target_state = "active";
      probe.target_bot_id = controller.bots[target_bot_index].id;
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
       let neighbor_index = controller.get_3d(nx, ny, nz);
       let inactive_neighbor = controller.apicall_get_inactive_bot_by_xyz(nx, ny, nz);
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
                           id: controller.bots[neighbor_index].id
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
   let snapshot_neighbors_ret = controller.apicall_get_neighbors(probe.bot_id);

   if (snapshot_neighbors_ret.ok === true)
      {
      probe.snapshot_neighbors = snapshot_neighbors_ret.neighbors ?? null;
      } // if
   } // if

return(probe);
} // apicall_collect_neighbor_probe()


function apicall_probe_move_bot(controller, bot_id, move)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);
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

let bot = controller.bots[botindex];
let start_status = controller.apicall_get_slot_status(bot_id, start_slot);
let predicted_x = Number(bot.x);
let predicted_y = Number(bot.y);
let predicted_z = Number(bot.z);

for (let i=0; i<move_path.length; i++)
    {
    let step_slot = move_path.charAt(i);
    let target_xyz = controller.get_next_target_coor(
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

let target_occupancy = controller.apicall_is_occupied(predicted_x, predicted_y, predicted_z);
let end_anchor_xyz = controller.get_next_target_coor(
                                              predicted_x,
                                              predicted_y,
                                              predicted_z,
                                              Number(bot.vector_x),
                                              Number(bot.vector_y),
                                              Number(bot.vector_z),
                                              end_slot
                                              );
let end_anchor_occupancy = controller.apicall_is_occupied(end_anchor_xyz.x, end_anchor_xyz.y, end_anchor_xyz.z);
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


module.exports = {
                 apicall_raw_cmd,
                 apicall_poll_masterbot_queue,
                 apicall_search_bot,
                 apicall_collect_neighbor_probe,
                 apicall_probe_move_bot
                 };
