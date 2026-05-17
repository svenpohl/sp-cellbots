function apicall_get_neighbor_bot_id_by_slot(controller, bot_snapshot, slot = "F")
{
if (!bot_snapshot)
   {
   return(null);
   } // if

let normalized_slot = String(slot ?? "F").trim().toUpperCase();
let rel_vector = controller.get_cell_relation_vector_byslot(
                                                      normalized_slot,
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
let target_index = controller.get_3d(target_x, target_y, target_z);

if (target_index != null && controller.bots[target_index] !== undefined)
   {
   if (controller.bots[target_index].id == "masterbot")
      {
      return(null);
      } // if

   return(String(controller.bots[target_index].id));
   } // if

for (let i = 0; i < controller.bots.length; i++)
    {
    if (controller.bots[i] === undefined || controller.bots[i] === null)
       {
       continue;
       } // if

    if (String(controller.bots[i].id) == "masterbot")
       {
       continue;
       } // if

    if (
       Number(controller.bots[i].x) == Number(target_x) &&
       Number(controller.bots[i].y) == Number(target_y) &&
       Number(controller.bots[i].z) == Number(target_z)
       )
       {
       return(String(controller.bots[i].id));
       } // if
    } // for

return(null);
} // apicall_get_front_neighbor_bot_id()


function apicall_get_payload_target_from_carrier_state(controller, position, orientation, relative_slot = "F")
{
if (!position || !orientation)
   {
   return(null);
   } // if

let normalized_slot = String(relative_slot ?? "F").trim().toUpperCase();
let rel_vector = controller.get_cell_relation_vector_byslot(
                                                     normalized_slot,
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


function apicall_register_payload_link(controller, carrier_bot_id, payload_bot_id, relative_slot = "F", attached = true)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();

if (normalized_carrier_bot_id == "" || normalized_payload_bot_id == "")
   {
   return(null);
   } // if

let normalized_slot = String(relative_slot ?? "F").trim().toUpperCase();
// console.log("[DEBUG] apicall_register_payload_link carrier=" + normalized_carrier_bot_id + " payload=" + normalized_payload_bot_id + " slot=" + normalized_slot + " attached=" + attached);

let payload_link = {
                   carrier_bot_id: normalized_carrier_bot_id,
                   payload_bot_id: normalized_payload_bot_id,
                   relative_slot: normalized_slot,
                   attached: attached === true
                   };

controller.api_payload_links[normalized_carrier_bot_id] = payload_link;
controller.api_grab_state_map[normalized_carrier_bot_id] = normalized_payload_bot_id;

if (payload_link.attached === true)
   {
   controller.apicall_clear_pending_servicebay_recycle(normalized_payload_bot_id);
   } // if

return(payload_link);
} // apicall_register_payload_link()


function apicall_clear_payload_link(controller, carrier_bot_id)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();

if (normalized_carrier_bot_id == "")
   {
   return(false);
   } // if

delete controller.api_payload_links[normalized_carrier_bot_id];
delete controller.api_grab_state_map[normalized_carrier_bot_id];

return(true);
} // apicall_clear_payload_link()


function apicall_mark_pending_servicebay_recycle(controller, payload_bot_id, carrier_bot_id = "", source = "payload_sync", position = null)
{
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let normalized_position = null;

if (normalized_payload_bot_id == "")
   {
   return(null);
   } // if

if (position && typeof position == "object")
   {
   normalized_position = {
                         x: Number(position.x ?? 0),
                         y: Number(position.y ?? 0),
                         z: Number(position.z ?? 0)
                         };
   } // if

controller.api_servicebay_pending_recycle[normalized_payload_bot_id] = {
                                                                        payload_bot_id: normalized_payload_bot_id,
                                                                        carrier_bot_id: normalized_carrier_bot_id,
                                                                        source: String(source ?? "payload_sync"),
                                                                        position: normalized_position,
                                                                        marked_at: new Date().toISOString()
                                                                        };

return(controller.api_servicebay_pending_recycle[normalized_payload_bot_id]);
} // apicall_mark_pending_servicebay_recycle()


function apicall_get_pending_servicebay_recycle(controller, payload_bot_id)
{
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();

if (normalized_payload_bot_id == "")
   {
   return(null);
   } // if

return(controller.api_servicebay_pending_recycle[normalized_payload_bot_id] ?? null);
} // apicall_get_pending_servicebay_recycle()


function apicall_clear_pending_servicebay_recycle(controller, payload_bot_id)
{
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();

if (normalized_payload_bot_id == "")
   {
   return(false);
   } // if

if (controller.api_servicebay_pending_recycle[normalized_payload_bot_id] === undefined)
   {
   return(false);
   } // if

delete controller.api_servicebay_pending_recycle[normalized_payload_bot_id];
return(true);
} // apicall_clear_pending_servicebay_recycle()


function apicall_get_payload_link_for_carrier(controller, carrier_bot_id)
{
let normalized_carrier_bot_id = String(carrier_bot_id ?? "").trim();
let payload_link = null;

if (normalized_carrier_bot_id == "")
   {
   return(null);
   } // if

payload_link = controller.api_payload_links[normalized_carrier_bot_id] ?? null;

if (payload_link)
   {
   return(payload_link);
   } // if

// Legacy fallback removed - api_payload_links is always populated by modern code paths.
// The old fallback created incorrect links with hardcoded "F" slot.
return(null);
} // apicall_get_payload_link_for_carrier()


function apicall_get_carried_payload_bot_id(controller, carrier_bot_id)
{
let payload_link = controller.apicall_get_payload_link_for_carrier(carrier_bot_id);

if (!payload_link || payload_link.attached !== true)
   {
   return(null);
   } // if

return(String(payload_link.payload_bot_id ?? "").trim() || null);
} // apicall_get_carried_payload_bot_id()


function apicall_sync_payload_from_carrier(controller, carrier_bot_id, carrier_position, carrier_orientation, payload_rotation_plan = [], carrier_old_orientation = null)
{
let payload_link = controller.apicall_get_payload_link_for_carrier(carrier_bot_id);
let payload_bot_id = payload_link?.payload_bot_id ?? null;

if (!payload_bot_id)
   {
   controller.append_api_bot_history(
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

let relative_slot = payload_link?.relative_slot ?? "F";
let payload_target = controller.apicall_get_payload_target_from_carrier_state(carrier_position, carrier_orientation, relative_slot);

// console.log("[DEBUG] apicall_sync_payload_from_carrier carrier=" + carrier_bot_id + " payload=" + payload_bot_id + " relative_slot=" + relative_slot + " target=" + JSON.stringify(payload_target) + " carrier_pos=" + JSON.stringify(carrier_position) + " carrier_ori=" + JSON.stringify(carrier_orientation));

if (!payload_target)
   {
   controller.append_api_bot_history(
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

let payload_index = controller.get_bot_by_id(payload_bot_id, controller.bots);

if (payload_index == null)
   {
   controller.append_api_bot_history(
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

let oldx = Number(controller.bots[payload_index].x);
let oldy = Number(controller.bots[payload_index].y);
let oldz = Number(controller.bots[payload_index].z);
let old_vx = Number(controller.bots[payload_index].vector_x);
let old_vy = Number(controller.bots[payload_index].vector_y);
let old_vz = Number(controller.bots[payload_index].vector_z);
let normalized_rotation_plan = Array.isArray(payload_rotation_plan) ? payload_rotation_plan : [];
let payload_orientation_target = {
                                 x: old_vx,
                                 y: old_vy,
                                 z: old_vz
                                 };

// Apply rotation plan if provided (for multi-step/incremental rotations)
for (let i = 0; i < normalized_rotation_plan.length; i++)
    {
    let next_orientation = controller.apicall_rotate_orientation(
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

// If no rotation plan was applied and the payload orientation hasn't changed yet,
// apply the carrier's rotation to the payload's old orientation.
// This correctly handles cases where the payload started with a different orientation
// than the carrier (e.g. B38 grabbed with (0,0,-1) while carrier had (1,0,0)).
if (
    normalized_rotation_plan.length === 0 &&
    carrier_orientation &&
    carrier_old_orientation &&
    (
     Number(payload_orientation_target.x) === old_vx &&
     Number(payload_orientation_target.y) === old_vy &&
     Number(payload_orientation_target.z) === old_vz
    )
   )
   {
   let rotation_dir = controller.apicall_get_vk_rotation_direction(
                                                              Number(carrier_old_orientation.x ?? 0),
                                                              Number(carrier_old_orientation.y ?? 0),
                                                              Number(carrier_old_orientation.z ?? 0),
                                                              Number(carrier_orientation.x ?? 0),
                                                              Number(carrier_orientation.y ?? 0),
                                                              Number(carrier_orientation.z ?? 0)
                                                              );

   if (rotation_dir !== null)
      {
      // 90-degree rotation: apply once
      let rotated = controller.apicall_rotate_orientation(
                                                    Number(old_vx),
                                                    Number(old_vy),
                                                    Number(old_vz),
                                                    rotation_dir
                                                    );

      if (rotated)
         {
         payload_orientation_target = {
                                      x: Number(rotated.x),
                                      y: Number(rotated.y),
                                      z: Number(rotated.z)
                                      };
         } // if
      }
   else
      {
      // rotation_dir is null -> either 180-degree rotation or no rotation.
      // Check if the carrier flipped 180 degrees: old == -new
      let cox = Number(carrier_old_orientation.x ?? 0);
      let coy = Number(carrier_old_orientation.y ?? 0);
      let coz = Number(carrier_old_orientation.z ?? 0);
      let cnx = Number(carrier_orientation.x ?? 0);
      let cny = Number(carrier_orientation.y ?? 0);
      let cnz = Number(carrier_orientation.z ?? 0);

      if (
          cox === -cnx && coy === -cny && coz === -cnz
         )
         {
         // 180-degree rotation: apply "R" twice to the payload's old orientation
         let rotated1 = controller.apicall_rotate_orientation(
                                                       Number(old_vx),
                                                       Number(old_vy),
                                                       Number(old_vz),
                                                       "R"
                                                       );

         if (rotated1)
            {
            let rotated2 = controller.apicall_rotate_orientation(
                                                          Number(rotated1.x),
                                                          Number(rotated1.y),
                                                          Number(rotated1.z),
                                                          "R"
                                                          );

            if (rotated2)
               {
               payload_orientation_target = {
                                            x: Number(rotated2.x),
                                            y: Number(rotated2.y),
                                            z: Number(rotated2.z)
                                            };
               } // if
            } // if
         } // if
      } // else
   } // if

controller.update_keyindex(oldx, oldy, oldz, payload_target.x, payload_target.y, payload_target.z);
controller.bots[payload_index].x = Number(payload_target.x);
controller.bots[payload_index].y = Number(payload_target.y);
controller.bots[payload_index].z = Number(payload_target.z);
controller.bots[payload_index].vector_x = Number(payload_orientation_target.x);
controller.bots[payload_index].vector_y = Number(payload_orientation_target.y);
controller.bots[payload_index].vector_z = Number(payload_orientation_target.z);
controller.bots[payload_index].adress = controller.get_mb_returnaddr(
                                                               {x:controller.mb.x, y:controller.mb.y, z:controller.mb.z },
                                                               {x:payload_target.x, y:payload_target.y, z:payload_target.z },
                                                               controller.bots
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

controller.notify_frontend(events);

if (
   payload_link?.attached === true &&
   controller.apicall_is_servicebay_cell(
                                         Number(payload_target.x),
                                         Number(payload_target.y),
                                         Number(payload_target.z)
                                         ) === true
   )
   {
   let pending_entry = controller.apicall_mark_pending_servicebay_recycle(
                                                                          payload_bot_id,
                                                                          carrier_bot_id,
                                                                          "payload_sync_on_servicebay",
                                                                          {
                                                                          x: Number(payload_target.x),
                                                                          y: Number(payload_target.y),
                                                                          z: Number(payload_target.z)
                                                                          }
                                                                          );

   controller.append_api_bot_history(
                                     payload_bot_id,
                                     "servicebay_pending_recycle",
                                     {
                                     carrier_bot_id: carrier_bot_id,
                                     source: "payload_sync_on_servicebay"
                                     },
                                     {
                                     ok: true,
                                     answer: "api_servicebay_pending_recycle",
                                     pending: true,
                                     pending_entry: pending_entry
                                     }
                                     );

   controller.append_api_bot_history(
                                     carrier_bot_id,
                                     "servicebay_pending_recycle",
                                     {
                                     payload_bot_id: payload_bot_id,
                                     source: "payload_sync_on_servicebay"
                                     },
                                     {
                                     ok: true,
                                     answer: "api_servicebay_pending_recycle",
                                     pending: true,
                                     pending_entry: pending_entry
                                     }
                                     );
   } // if

controller.append_api_bot_history(
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

controller.append_api_bot_history(
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


function apicall_is_servicebay_cell(controller, x, y, z)
{
return(controller.apicall_role_point_index("x", Number(x), Number(y), Number(z)) >= 0);
} // apicall_is_servicebay_cell()


function apicall_rebuild_botindex(controller)
{
controller.botindex = [];

for (let i = 0; i < controller.bots.length; i++)
    {
    controller.set_3d(
                      Number(controller.bots[i].x),
                      Number(controller.bots[i].y),
                      Number(controller.bots[i].z),
                      i
                      );
    } // for

return(true);
} // apicall_rebuild_botindex()


function apicall_recycle_bot_if_in_servicebay(controller, bot_id, source = "move")
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_servicebay_autorecycle",
          recycled: false,
          reason: "INVALID_BOT_ID"
          });
   } // if

let botindex = controller.get_bot_by_id(normalized_bot_id, controller.bots);

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_servicebay_autorecycle",
          recycled: false,
          reason: "BOT_NOT_FOUND",
          bot_id: normalized_bot_id
          });
   } // if

let bot = controller.bots[botindex];
let pos_x = Number(bot.x);
let pos_y = Number(bot.y);
let pos_z = Number(bot.z);

if (controller.apicall_is_servicebay_cell(pos_x, pos_y, pos_z) !== true)
   {
   return({
          ok: true,
          answer: "api_servicebay_autorecycle",
          recycled: false,
          reason: "BOT_NOT_IN_SERVICEBAY",
          bot_id: normalized_bot_id,
          position: {
                     x: pos_x,
                     y: pos_y,
                     z: pos_z
                     }
          });
   } // if

if (normalized_bot_id == "masterbot")
   {
   return({
          ok: false,
          answer: "api_servicebay_autorecycle",
          recycled: false,
          reason: "MASTERBOT_NOT_ALLOWED",
          bot_id: normalized_bot_id
          });
   } // if

let old_key = controller.getKey_3d(pos_x, pos_y, pos_z);
delete controller.botindex[old_key];

controller.apicall_clear_pending_servicebay_recycle(normalized_bot_id);
controller.apicall_clear_payload_link(normalized_bot_id);

let carrier_ids = Object.keys(controller.api_payload_links ?? {});
for (let i = 0; i < carrier_ids.length; i++)
    {
    let carrier_id = carrier_ids[i];
    let payload_id = String(controller.api_payload_links[carrier_id]?.payload_bot_id ?? "").trim();

    if (payload_id == normalized_bot_id)
       {
       controller.apicall_clear_payload_link(carrier_id);
       } // if
    } // for

let grab_carrier_ids = Object.keys(controller.api_grab_state_map ?? {});
for (let i = 0; i < grab_carrier_ids.length; i++)
    {
    let carrier_id = grab_carrier_ids[i];
    let payload_id = String(controller.api_grab_state_map[carrier_id] ?? "").trim();

    if (payload_id == normalized_bot_id)
       {
       delete controller.api_grab_state_map[carrier_id];
       } // if
    } // for

controller.bots.splice(botindex, 1);
controller.apicall_rebuild_botindex();

const events = [];
events.push({
            event: "removebot",
            botid: normalized_bot_id
            });
events.push({
            event: "console",
            msg: "Servicebay auto-recycle: " + normalized_bot_id + " @ (" + pos_x + "," + pos_y + "," + pos_z + ")"
            });
controller.notify_frontend(events);

return({
       ok: true,
       answer: "api_servicebay_autorecycle",
       recycled: true,
       reason: "RECYCLED_AT_SERVICEBAY",
       source: String(source ?? "move"),
       bot_id: normalized_bot_id,
       position: {
                  x: pos_x,
                  y: pos_y,
                  z: pos_z
                  }
       });
} // apicall_recycle_bot_if_in_servicebay()


function apicall_recycle_bot_force(controller, bot_id, source = "ack_timeout_servicebay")
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_servicebay_autorecycle",
          recycled: false,
          reason: "INVALID_BOT_ID"
          });
   } // if

if (normalized_bot_id == "masterbot")
   {
   return({
          ok: false,
          answer: "api_servicebay_autorecycle",
          recycled: false,
          reason: "MASTERBOT_NOT_ALLOWED",
          bot_id: normalized_bot_id
          });
   } // if

let botindex = controller.get_bot_by_id(normalized_bot_id, controller.bots);

if (botindex == null)
   {
   return({
          ok: true,
          answer: "api_servicebay_autorecycle",
          recycled: true,
          reason: "BOT_ALREADY_ABSENT",
          source: String(source ?? "ack_timeout_servicebay"),
          bot_id: normalized_bot_id
          });
   } // if

let bot = controller.bots[botindex];
let pos_x = Number(bot.x);
let pos_y = Number(bot.y);
let pos_z = Number(bot.z);

let old_key = controller.getKey_3d(pos_x, pos_y, pos_z);
delete controller.botindex[old_key];

controller.apicall_clear_pending_servicebay_recycle(normalized_bot_id);
controller.apicall_clear_payload_link(normalized_bot_id);

let carrier_ids = Object.keys(controller.api_payload_links ?? {});
for (let i = 0; i < carrier_ids.length; i++)
    {
    let carrier_id = carrier_ids[i];
    let payload_id = String(controller.api_payload_links[carrier_id]?.payload_bot_id ?? "").trim();

    if (payload_id == normalized_bot_id)
       {
       controller.apicall_clear_payload_link(carrier_id);
       } // if
    } // for

let grab_carrier_ids = Object.keys(controller.api_grab_state_map ?? {});
for (let i = 0; i < grab_carrier_ids.length; i++)
    {
    let carrier_id = grab_carrier_ids[i];
    let payload_id = String(controller.api_grab_state_map[carrier_id] ?? "").trim();

    if (payload_id == normalized_bot_id)
       {
       delete controller.api_grab_state_map[carrier_id];
       } // if
    } // for

controller.bots.splice(botindex, 1);
controller.apicall_rebuild_botindex();

const events = [];
events.push({
            event: "removebot",
            botid: normalized_bot_id
            });
events.push({
            event: "console",
            msg: "Servicebay timeout-recycle: " + normalized_bot_id + " @ (" + pos_x + "," + pos_y + "," + pos_z + ")"
            });
controller.notify_frontend(events);

return({
       ok: true,
       answer: "api_servicebay_autorecycle",
       recycled: true,
       reason: "RECYCLED_AT_SERVICEBAY_TIMEOUT",
       source: String(source ?? "ack_timeout_servicebay"),
       bot_id: normalized_bot_id,
       position: {
                  x: pos_x,
                  y: pos_y,
                  z: pos_z
                  }
       });
} // apicall_recycle_bot_force()


module.exports = {
                  apicall_get_neighbor_bot_id_by_slot,
                  apicall_get_payload_target_from_carrier_state,
                  apicall_register_payload_link,
                  apicall_clear_payload_link,
                  apicall_mark_pending_servicebay_recycle,
                  apicall_get_pending_servicebay_recycle,
                  apicall_clear_pending_servicebay_recycle,
                  apicall_get_payload_link_for_carrier,
                  apicall_get_carried_payload_bot_id,
                  apicall_sync_payload_from_carrier,
                  apicall_is_servicebay_cell,
                  apicall_rebuild_botindex,
                  apicall_recycle_bot_if_in_servicebay,
                  apicall_recycle_bot_force
                 };
