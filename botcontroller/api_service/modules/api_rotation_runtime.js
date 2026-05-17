function apicall_rotate_orientation(controller, vx, vy, vz, direction)
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


function apicall_build_stationary_ack_returnaddr(controller, bot_snapshot, target_orientation = null, excluded_bot_ids = [])
{
let ack_retaddr = "";
let bots_tmp_ack = controller.apicall_build_active_bots_tmp(true, excluded_bot_ids);
let ack_botindex = controller.get_bot_by_id(bot_snapshot.id, bots_tmp_ack);

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

ack_retaddr = controller.apicall_derive_ack_returnaddr_from_neighbours(
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
   ack_retaddr = controller.apicall_derive_ack_returnaddr_from_neighbours(
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


function apicall_apply_local_rotation_fallback(controller, bot_id, target_orientation)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);

if (botindex == null)
   {
   return(false);
   } // if

if (!target_orientation)
   {
   return(false);
   } // if

controller.bots[botindex].vector_x = Number(target_orientation.x);
controller.bots[botindex].vector_y = Number(target_orientation.y);
controller.bots[botindex].vector_z = Number(target_orientation.z);

return(true);
} // apicall_apply_local_rotation_fallback()


function apicall_rotate_bot(controller, bot_id, direction)
{
let normalized_direction = String(direction ?? "").trim().toUpperCase();
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(bot_id);

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_rotate_bot",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(controller.safe_mode)
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

let target_orientation = apicall_rotate_orientation(
                                                    controller,
                                                    Number(bot_snapshot.orientation.x),
                                                    Number(bot_snapshot.orientation.y),
                                                    Number(bot_snapshot.orientation.z),
                                                    normalized_direction
                                                    );
let live_botindex = controller.get_bot_by_id(bot_snapshot.id, controller.bots);

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
let ack_target_addr = "";
let ack_retaddr = "";
let payload_bot_id = controller.apicall_get_carried_payload_bot_id(bot_id);
let ack_excluded_bot_ids = [];
let ack_id = null;
let planned_raw_cmd = null;
let raw_ret = null;

if (String(payload_bot_id ?? "").trim() != "")
   {
   ack_excluded_bot_ids.push(String(payload_bot_id));
   } // if

if (live_botindex != null)
   {
   ack_target_addr = String(controller.apicall_get_safe_adress(controller.bots[live_botindex]) ?? "").trim();
   } // if

if (ack_target_addr == "")
   {
   return({
          ok: false,
          answer: "api_rotate_bot",
          error: "TARGET_ADDRESS_NOT_AVAILABLE",
          bot_id: bot_id,
          direction: normalized_direction,
          current_state: bot_snapshot
          });
   } // if

ack_retaddr = apicall_build_stationary_ack_returnaddr(
                                                       controller,
                                                       bot_snapshot,
                                                       target_orientation,
                                                       ack_excluded_bot_ids
                                                       );

if (ack_retaddr != "")
   {
   ack_id = controller.apicall_generate_ack_id(bot_id);
   planned_raw_cmd = ack_target_addr + "#MOVE#" + planned_spin_cmd + ";ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = ack_target_addr + "#MOVE#" + planned_spin_cmd;
     } // else

if (planned_raw_cmd)
   {
   if (ack_id !== null)
      {
      controller.apicall_register_ack(
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

   raw_ret = controller.apicall_raw_cmd(planned_raw_cmd);
   controller.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
   controller.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

   if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
      {
      controller.apicall_mark_ack_received(ack_id, "send_failed");
      } // if

   if ((raw_ret.accepted ?? false) === true && ack_id === null)
      {
      let fallback_applied = apicall_apply_local_rotation_fallback(controller, bot_id, target_orientation);

      if (fallback_applied === true)
         {
         controller.apicall_gui_refresh();
         } // if
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


function apicall_execute_rotation_plan(controller, bot_id, rotation_plan, target_orientation = null)
{
let normalized_bot_id = String(bot_id ?? "").trim();
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(normalized_bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(normalized_bot_id);
let normalized_plan = Array.isArray(rotation_plan) ? rotation_plan.map((entry) => String(entry ?? "").trim().toUpperCase()).filter((entry) => entry != "") : [];
let payload_bot_id = controller.apicall_get_carried_payload_bot_id(normalized_bot_id);
let ack_excluded_bot_ids = [];
let planned_spin_cmds = [];
let planned_spin_cmd = "";
let ack_target_addr = "";
let ack_retaddr = "";
let ack_id = null;
let planned_raw_cmd = null;
let raw_ret = null;
let live_botindex = controller.get_bot_by_id(bot_snapshot.id, controller.bots);

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
          safe_mode: Number(controller.safe_mode)
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
if (live_botindex != null)
   {
   ack_target_addr = String(controller.apicall_get_safe_adress(controller.bots[live_botindex]) ?? "").trim();
   } // if

if (ack_target_addr == "")
   {
   return({
          ok: false,
          answer: "api_execute_rotation_plan",
          error: "TARGET_ADDRESS_NOT_AVAILABLE",
          bot_id: normalized_bot_id,
          rotation_plan: normalized_plan
          });
   } // if

ack_retaddr = apicall_build_stationary_ack_returnaddr(controller, bot_snapshot, target_orientation, ack_excluded_bot_ids);

if (ack_retaddr != "")
   {
   ack_id = controller.apicall_generate_ack_id(normalized_bot_id);
   planned_raw_cmd = ack_target_addr + "#MOVE#" + planned_spin_cmd + ";ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = ack_target_addr + "#MOVE#" + planned_spin_cmd;
     } // else

if (planned_raw_cmd)
   {
   if (ack_id !== null)
      {
      controller.apicall_register_ack(
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

   raw_ret = controller.apicall_raw_cmd(planned_raw_cmd);
   controller.append_api_raw_cmd_log(planned_raw_cmd, normalized_bot_id, raw_ret.accepted ?? false);
   controller.append_api_bot_history(normalized_bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

   if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
      {
      controller.apicall_mark_ack_received(ack_id, "send_failed");
      } // if

   if ((raw_ret.accepted ?? false) === true && ack_id === null)
      {
      let fallback_orientation = target_orientation;

      if (!fallback_orientation)
         {
         fallback_orientation = controller.apicall_get_orientation_after_rotation_plan(
                                                                               {
                                                                               x: Number(bot_snapshot.orientation.x),
                                                                               y: Number(bot_snapshot.orientation.y),
                                                                               z: Number(bot_snapshot.orientation.z)
                                                                               },
                                                                               normalized_plan
                                                                               );
         } // if

      let fallback_applied = apicall_apply_local_rotation_fallback(controller, normalized_bot_id, fallback_orientation);

      if (fallback_applied === true)
         {
         controller.apicall_gui_refresh();
         } // if
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


function apicall_rotate_bot_to(controller, bot_id, x, y, z)
{
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(bot_id);
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
          safe_mode: Number(controller.safe_mode)
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
let rotate_right_once = apicall_rotate_orientation(
                                                   controller,
                                                   current_orientation.x,
                                                   current_orientation.y,
                                                   current_orientation.z,
                                                   "R"
                                                   );
let rotate_left_once = apicall_rotate_orientation(
                                                  controller,
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

let rotate_right_twice = apicall_rotate_orientation(
                                                    controller,
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


//
// Determines the single-step VK rotation direction (R or L) from an old heading
// to a new heading. Returns null if the headings are identical or not a valid
// 90-degree rotation in the XY plane.
//
function apicall_get_vk_rotation_direction(old_vx, old_vy, old_vz, new_vx, new_vy, new_vz)
{
let ox = Number(old_vx ?? 0);
let oy = Number(old_vy ?? 0);
let oz = Number(old_vz ?? 0);
let nx = Number(new_vx ?? 0);
let ny = Number(new_vy ?? 0);
let nz = Number(new_vz ?? 0);

// RIGHT cycle: (1,0,0) → (0,0,-1) → (-1,0,0) → (0,0,1) → back to (1,0,0)
if (
   (ox ==  1 && oz ==  0 && nx ==  0 && nz == -1) ||
   (ox ==  0 && oz == -1 && nx == -1 && nz ==  0) ||
   (ox == -1 && oz ==  0 && nx ==  0 && nz ==  1) ||
   (ox ==  0 && oz ==  1 && nx ==  1 && nz ==  0)
   )
   {
   return("R");
   } // if

// LEFT cycle: (1,0,0) → (0,0,1) → (-1,0,0) → (0,0,-1) → back to (1,0,0)
if (
   (ox ==  1 && oz ==  0 && nx ==  0 && nz ==  1) ||
   (ox ==  0 && oz ==  1 && nx == -1 && nz ==  0) ||
   (ox == -1 && oz ==  0 && nx ==  0 && nz == -1) ||
   (ox ==  0 && oz == -1 && nx ==  1 && nz ==  0)
   )
   {
   return("L");
   } // if

return(null);
} // apicall_get_vk_rotation_direction()


module.exports = {
                 apicall_rotate_orientation,
                 apicall_build_stationary_ack_returnaddr,
                 apicall_rotate_bot,
                 apicall_execute_rotation_plan,
                 apicall_rotate_bot_to,
                 apicall_get_vk_rotation_direction
                 };
