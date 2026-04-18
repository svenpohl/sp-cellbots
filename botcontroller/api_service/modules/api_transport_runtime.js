function apicall_grab_bot(controller, bot_id)
{
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(bot_id);
let live_botindex = null;
let target_address = "";
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
          safe_mode: Number(controller.safe_mode)
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

live_botindex = controller.get_bot_by_id(bot_snapshot.id, controller.bots);

if (live_botindex != null)
   {
   target_address = String(controller.apicall_get_safe_adress(controller.bots[live_botindex]) ?? "").trim();
   } // if

if (target_address == "")
   {
   return({
          ok: false,
          answer: "api_grab_bot",
          error: "TARGET_ADDRESS_NOT_AVAILABLE",
          bot_id: bot_id
          });
   } // if

ack_retaddr = controller.apicall_build_stationary_ack_returnaddr(bot_snapshot, null);
front_rel_vector = controller.get_cell_relation_vector_byslot(
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
payload_bot_id = controller.apicall_get_front_neighbor_bot_id(bot_snapshot);

if (ack_retaddr != "")
   {
   ack_id = controller.apicall_generate_ack_id(bot_id);
   planned_raw_cmd = target_address + "#MOVE#GF;ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = target_address + "#MOVE#GF";
     } // else

if (ack_id !== null)
   {
   controller.apicall_register_ack(
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

raw_ret = controller.apicall_raw_cmd(planned_raw_cmd);
controller.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
controller.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
   {
   controller.apicall_mark_ack_received(ack_id, "send_failed");
   } // if

if ((raw_ret.accepted ?? false) === true && ack_id === null)
   {
   if (payload_bot_id)
      {
      controller.apicall_register_payload_link(
                                               bot_id,
                                               payload_bot_id,
                                               "F",
                                               true
                                               );
      } // if

   controller.apicall_gui_refresh();
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


function apicall_release_bot(controller, bot_id)
{
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(bot_id);
let live_botindex = null;
let target_address = "";
let planned_raw_cmd = null;
let raw_ret = null;
let ack_id = null;
let ack_retaddr = "";
let payload_bot_id = controller.apicall_get_carried_payload_bot_id(bot_id);

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_release_bot",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(controller.safe_mode)
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

live_botindex = controller.get_bot_by_id(bot_snapshot.id, controller.bots);

if (live_botindex != null)
   {
   target_address = String(controller.apicall_get_safe_adress(controller.bots[live_botindex]) ?? "").trim();
   } // if

if (target_address == "")
   {
   return({
          ok: false,
          answer: "api_release_bot",
          error: "TARGET_ADDRESS_NOT_AVAILABLE",
          bot_id: bot_id
          });
   } // if

ack_retaddr = controller.apicall_build_stationary_ack_returnaddr(bot_snapshot, null);

if (ack_retaddr != "")
   {
   ack_id = controller.apicall_generate_ack_id(bot_id);
   planned_raw_cmd = target_address + "#MOVE#G;ALIFE;" + ack_id + "#" + ack_retaddr;
   } else
     {
     planned_raw_cmd = target_address + "#MOVE#G";
     } // else

if (ack_id !== null)
   {
   controller.apicall_register_ack(
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

raw_ret = controller.apicall_raw_cmd(planned_raw_cmd);
controller.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
controller.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
   {
   controller.apicall_mark_ack_received(ack_id, "send_failed");
   } // if

if ((raw_ret.accepted ?? false) === true && ack_id === null)
   {
   let release_payload_bot_id = String(payload_bot_id ?? "").trim();

   if (release_payload_bot_id != "")
      {
      let release_recycle_ret = controller.apicall_recycle_bot_if_in_servicebay(
                                                                        release_payload_bot_id,
                                                                        "release_noack_payload"
                                                                        );

      if (release_recycle_ret?.recycled !== true)
         {
         controller.apicall_clear_pending_servicebay_recycle(release_payload_bot_id);
         } // if
      } // if

   controller.apicall_clear_payload_link(bot_id);
   controller.apicall_gui_refresh();
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


function apicall_is_no_ack_direct_success(ret)
{
if (!ret || typeof ret != "object")
   {
   return(false);
   } // if

return(
       (ret?.ack_id ?? null) == null &&
       (
        (ret?.executed ?? false) === true ||
        (ret?.raw_cmd_result?.accepted ?? false) === true
       )
       );
} // apicall_is_no_ack_direct_success()


async function apicall_move_payload_to(controller, carrier_bot_id, payload_bot_id, x, y, z, release_after = false)
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
let carrier_snapshot = controller.apicall_get_bot_snapshot(normalized_carrier_bot_id);
let payload_snapshot = controller.apicall_get_bot_snapshot(normalized_payload_bot_id);
let current_payload_bot_id = controller.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id);
let current_front_payload_bot_id = null;
let carrier_now = null;
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
   current_front_payload_bot_id = controller.apicall_get_front_neighbor_bot_id(carrier_snapshot);

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

   grab_ret = apicall_grab_bot(controller, normalized_carrier_bot_id);
   grab_ret = await controller.apicall_attach_ack_wait_and_recovery(grab_ret);
   let grab_ack_ok = ((grab_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(grab_ret);
   steps.push({
              step: "grab_bot",
              ok: grab_ret?.ok === true,
              ack_received: grab_ack_ok,
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
      grab_ack_ok !== true ||
      String(controller.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id) ?? "") != normalized_payload_bot_id
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
             current_payload_bot_id: controller.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id) ?? null
             });
      } // if
   } // if

carrier_now = controller.apicall_get_bot_snapshot(normalized_carrier_bot_id);

if (
   carrier_now &&
   Number(carrier_now.position?.x) === target_x &&
   Number(carrier_now.position?.y) === target_y &&
   Number(carrier_now.position?.z) === target_z
   )
   {
   if (should_release_after)
      {
      release_ret = apicall_release_bot(controller, normalized_carrier_bot_id);
      release_ret = await controller.apicall_attach_ack_wait_and_recovery(release_ret);
      let release_ack_ok = ((release_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(release_ret);
      steps.push({
                 step: "release_bot",
                 ok: release_ret?.ok === true,
                 ack_received: release_ack_ok,
                 payload_bot_id: release_ret?.payload_bot_id ?? null,
                 planned_raw_cmd: release_ret?.planned_raw_cmd ?? null
                 });

      if (
         release_ret?.ok !== true ||
         release_ack_ok !== true
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
                move_result: null,
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
          already_at_target: true,
          steps: steps,
          grab_result: grab_ret,
          move_result: null,
          release_result: release_ret
          });
   } // if

move_ret = controller.apicall_move_bot_to(normalized_carrier_bot_id, target_x, target_y, target_z);
move_ret = await controller.apicall_attach_ack_wait_and_recovery(move_ret);
let move_ack_ok = ((move_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(move_ret);
steps.push({
           step: "move_bot_to",
           ok: move_ret?.ok === true,
           ack_received: move_ack_ok,
           executable: move_ret?.executable ?? false,
           executed: move_ret?.executed ?? false,
           planned_raw_cmd: move_ret?.planned_raw_cmd ?? null
           });

if (
   move_ret?.ok !== true ||
   move_ret?.path_found !== true ||
   move_ret?.executable !== true ||
   move_ret?.executed !== true ||
   move_ack_ok !== true
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
   release_ret = apicall_release_bot(controller, normalized_carrier_bot_id);
   release_ret = await controller.apicall_attach_ack_wait_and_recovery(release_ret);
   let release_ack_ok = ((release_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(release_ret);
   steps.push({
              step: "release_bot",
              ok: release_ret?.ok === true,
              ack_received: release_ack_ok,
              payload_bot_id: release_ret?.payload_bot_id ?? null,
              planned_raw_cmd: release_ret?.planned_raw_cmd ?? null
              });

   if (
      release_ret?.ok !== true ||
      release_ack_ok !== true
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


async function apicall_move_carrier_to(controller, carrier_bot_id, x, y, z, vx, vy, vz, release_after = false)
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
let carrier_snapshot = controller.apicall_get_bot_snapshot(normalized_carrier_bot_id);
let carried_payload_bot_id = controller.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id);
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

move_ret = controller.apicall_move_bot_to(normalized_carrier_bot_id, target_x, target_y, target_z);
move_ret = await controller.apicall_attach_ack_wait_and_recovery(move_ret);
let move_ack_ok = ((move_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(move_ret);
steps.push({
           step: "move_bot_to",
           ok: move_ret?.ok === true,
           ack_received: move_ack_ok,
           executable: move_ret?.executable ?? false,
           executed: move_ret?.executed ?? false,
           planned_raw_cmd: move_ret?.planned_raw_cmd ?? null
           });

if (
   move_ret?.ok !== true ||
   move_ret?.path_found !== true ||
   move_ret?.executable !== true ||
   move_ret?.executed !== true ||
   move_ack_ok !== true
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
   rotate_ret = controller.apicall_rotate_bot_to(normalized_carrier_bot_id, target_vx, target_vy, target_vz);

   if (rotate_ret?.ok === true && Array.isArray(rotate_ret.rotation_plan) && rotate_ret.rotation_plan.length > 0)
      {
      let execute_ret = controller.apicall_execute_rotation_plan(
                                                                 normalized_carrier_bot_id,
                                                                 rotate_ret.rotation_plan,
                                                                 rotate_ret.target_orientation ?? null
                                                                 );
      execute_ret = await controller.apicall_attach_ack_wait_and_recovery(execute_ret);
      const rotate_ack_ok = ((execute_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(execute_ret);

      rotate_ret = {
                   ...rotate_ret,
                   ack_id: execute_ret?.ack_id ?? null,
                   ack_retaddr: execute_ret?.ack_retaddr ?? "",
                   planned_raw_cmd: execute_ret?.planned_raw_cmd ?? null,
                   raw_cmd_result: execute_ret?.raw_cmd_result ?? null,
                   ack_wait: execute_ret?.ack_wait ?? null,
                   ack_received: rotate_ack_ok,
                   execution_steps: [
                                     {
                                     rotation_plan: rotate_ret.rotation_plan,
                                     ack_id: execute_ret?.ack_id ?? null,
                                     ack_received: rotate_ack_ok,
                                     planned_raw_cmd: execute_ret?.planned_raw_cmd ?? null
                                     }
                                     ],
                   executed: rotate_ack_ok
                   };

      if (rotate_ack_ok !== true)
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
   release_ret = apicall_release_bot(controller, normalized_carrier_bot_id);
   release_ret = await controller.apicall_attach_ack_wait_and_recovery(release_ret);
   let release_ack_ok = ((release_ret?.ack_received ?? false) === true) || apicall_is_no_ack_direct_success(release_ret);
   steps.push({
              step: "release_bot",
              ok: release_ret?.ok === true,
              ack_received: release_ack_ok,
              payload_bot_id: release_ret?.payload_bot_id ?? null,
              planned_raw_cmd: release_ret?.planned_raw_cmd ?? null
              });

   if (
      release_ret?.ok !== true ||
      release_ack_ok !== true
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


function apicall_diagnose_move_carrier_to(controller, carrier_bot_id, x, y, z, vx, vy, vz, release_after = false)
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
let carrier_snapshot = controller.apicall_get_bot_snapshot(normalized_carrier_bot_id);
let carried_payload_bot_id = controller.apicall_get_carried_payload_bot_id(normalized_carrier_bot_id);
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

move_ret = controller.apicall_diagnose_move_bot_to(normalized_carrier_bot_id, target_x, target_y, target_z);
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
   rotate_ret = controller.apicall_rotate_bot_to(normalized_carrier_bot_id, target_vx, target_vy, target_vz);

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


module.exports = {
                 apicall_grab_bot,
                 apicall_release_bot,
                 apicall_move_payload_to,
                 apicall_move_carrier_to,
                 apicall_diagnose_move_carrier_to
                 };
