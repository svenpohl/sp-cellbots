async function write_and_close(socket, payload)
{
const answer = JSON.stringify(payload) + "\n";

socket.write(answer, () =>
             {
             socket.end();
             });
} // write_and_close()


async function attach_ack_wait_if_needed(controller, ret)
{
if (ret?.ack_id)
   {
   let ack_wait_ret = await controller.apicall_wait_for_ack(ret.ack_id, 6, 500);
   ret.ack_wait = ack_wait_ret;
   ret.ack_received = ack_wait_ret.ack_received;

   if (ack_wait_ret.ack_received !== true)
      {
      ret.ack_recovery = await controller.apicall_recover_after_ack_timeout(ret.ack_id);
      } // if
   } // if

return(ret);
} // attach_ack_wait_if_needed()


async function handle_motion_api_command(controller, decodedobject, socket)
{
const cmd = decodedobject?.cmd ?? "";

if (cmd === "probe_move_bot")
   {
   let ret = controller.apicall_probe_move_bot(decodedobject.bot_id, decodedobject.move);
   controller.append_api_action_log("probe_move_bot", { bot_id: decodedobject.bot_id, move: decodedobject.move }, { ok: ret.ok, answer: ret.answer, possible: ret.possible ?? false });
   controller.append_api_bot_history(decodedobject.bot_id, "probe_move_bot", { bot_id: decodedobject.bot_id, move: decodedobject.move }, { ok: ret.ok, answer: ret.answer, possible: ret.possible ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "can_reach_position")
   {
   let ret = controller.apicall_can_reach_position(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("can_reach_position", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, reachable: ret.reachable ?? false, reason: ret.reason ?? "" });
   controller.append_api_bot_history(decodedobject.bot_id, "can_reach_position", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, reachable: ret.reachable ?? false, reason: ret.reason ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "find_path_for_bot")
   {
   let ret = controller.apicall_find_path_for_bot(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.show);
   controller.append_api_action_log("find_path_for_bot", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0, path_visualized: ret.path_visualized ?? false });
   controller.append_api_bot_history(decodedobject.bot_id, "find_path_for_bot", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "find_path_for_bot_payload")
   {
   let ret = controller.apicall_find_path_for_bot_payload(decodedobject.bot_id, decodedobject.payload_bot_id, decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.show);
   controller.append_api_action_log("find_path_for_bot_payload", { bot_id: decodedobject.bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0, path_visualized: ret.path_visualized ?? false });
   controller.append_api_bot_history(decodedobject.bot_id, "find_path_for_bot_payload", { bot_id: decodedobject.bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, show: decodedobject.show ?? false }, { ok: ret.ok, answer: ret.answer, path_found: ret.path_found ?? false, path_length: ret.path_length ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "suggest_simple_move")
   {
   let ret = controller.apicall_suggest_simple_move(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("suggest_simple_move", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, suggested: ret.suggested ?? false, move_candidate: ret.move_candidate ?? "" });
   controller.append_api_bot_history(decodedobject.bot_id, "suggest_simple_move", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, suggested: ret.suggested ?? false, move_candidate: ret.move_candidate ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "move_bot_to")
   {
   let ret = controller.apicall_move_bot_to(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
   ret = await attach_ack_wait_if_needed(controller, ret);
   controller.append_api_action_log("move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   controller.append_api_bot_history(decodedobject.bot_id, "move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "diagnose_move_bot_to")
   {
   let ret = controller.apicall_diagnose_move_bot_to(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("diagnose_move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, path_found: ret.path_found ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   controller.append_api_bot_history(decodedobject.bot_id, "diagnose_move_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executable: ret.executable ?? false, path_found: ret.path_found ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "would_split_cluster")
   {
   let ret = controller.apicall_would_split_cluster(decodedobject.bot_id);
   controller.append_api_action_log("would_split_cluster", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, would_split_cluster: ret.would_split_cluster ?? null, disconnected_count: ret.disconnected_count ?? 0 });
   controller.append_api_bot_history(decodedobject.bot_id, "would_split_cluster", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, would_split_cluster: ret.would_split_cluster ?? null, disconnected_count: ret.disconnected_count ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "rotate_bot")
   {
   let ret = controller.apicall_rotate_bot(decodedobject.bot_id, decodedobject.direction);
   ret = await attach_ack_wait_if_needed(controller, ret);
   controller.append_api_action_log("rotate_bot", { bot_id: decodedobject.bot_id, direction: decodedobject.direction }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   controller.append_api_bot_history(decodedobject.bot_id, "rotate_bot", { bot_id: decodedobject.bot_id, direction: decodedobject.direction }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "rotate_bot_to")
   {
   let ret = controller.apicall_rotate_bot_to(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z);

   if (ret?.ok === true && Array.isArray(ret.rotation_plan) && ret.rotation_plan.length > 0)
      {
      let execute_ret = controller.apicall_execute_rotation_plan(
                                                            decodedobject.bot_id,
                                                            ret.rotation_plan,
                                                            ret.target_orientation ?? null
                                                            );
      execute_ret = await controller.apicall_attach_ack_wait_and_recovery(execute_ret);
      const no_ack_direct_success = (
                                    execute_ret?.ack_id == null &&
                                    (execute_ret?.raw_cmd_result?.accepted ?? false) === true
                                    );

      ret.executed = ((execute_ret?.ack_received ?? false) === true) || no_ack_direct_success;
      ret.execution_steps = [
                            {
                            rotation_plan: ret.rotation_plan,
                            ack_id: execute_ret?.ack_id ?? null,
                            ack_received: (execute_ret?.ack_received ?? false) || no_ack_direct_success,
                            planned_raw_cmd: execute_ret?.planned_raw_cmd ?? null
                            }
                            ];
      ret.ack_id = execute_ret?.ack_id ?? null;
      ret.ack_retaddr = execute_ret?.ack_retaddr ?? "";
      ret.planned_raw_cmd = execute_ret?.planned_raw_cmd ?? null;
      ret.raw_cmd_result = execute_ret?.raw_cmd_result ?? null;
      ret.ack_wait = execute_ret?.ack_wait ?? null;
      ret.ack_received = (execute_ret?.ack_received ?? false) || no_ack_direct_success;
      ret.ack_recovery = execute_ret?.ack_recovery ?? null;

      if (((execute_ret?.ack_received ?? false) !== true) && no_ack_direct_success !== true)
         {
         ret.ok = false;
         ret.error = "ROTATION_PLAN_FAILED";
         ret.failed_step = 1;
         ret.failed_direction = (ret.rotation_plan[0] ?? null);
         await write_and_close(socket, ret);
         return(true);
         } // if
      } // if

   controller.append_api_action_log("rotate_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, rotation_plan: ret.rotation_plan ?? [] });
   controller.append_api_bot_history(decodedobject.bot_id, "rotate_bot_to", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, rotation_plan: ret.rotation_plan ?? [] });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "grab_bot")
   {
   let ret = controller.apicall_grab_bot(decodedobject.bot_id);
   ret = await attach_ack_wait_if_needed(controller, ret);
   controller.append_api_action_log("grab_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   controller.append_api_bot_history(decodedobject.bot_id, "grab_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "release_bot")
   {
   let ret = controller.apicall_release_bot(decodedobject.bot_id);
   ret = await attach_ack_wait_if_needed(controller, ret);
   controller.append_api_action_log("release_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   controller.append_api_bot_history(decodedobject.bot_id, "release_bot", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, executed: ret.executed ?? false, planned_raw_cmd: ret.planned_raw_cmd ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "move_payload_to")
   {
   let ret = await controller.apicall_move_payload_to(
                                                decodedobject.carrier_bot_id,
                                                decodedobject.payload_bot_id,
                                                decodedobject.x,
                                                decodedobject.y,
                                                decodedobject.z,
                                                decodedobject.release_after
                                                );

   controller.append_api_action_log("move_payload_to", { carrier_bot_id: decodedobject.carrier_bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
   controller.append_api_bot_history(decodedobject.carrier_bot_id, "move_payload_to", { carrier_bot_id: decodedobject.carrier_bot_id, payload_bot_id: decodedobject.payload_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "move_carrier_to")
   {
   let ret = await controller.apicall_move_carrier_to(
                                                decodedobject.carrier_bot_id,
                                                decodedobject.x,
                                                decodedobject.y,
                                                decodedobject.z,
                                                decodedobject.vx,
                                                decodedobject.vy,
                                                decodedobject.vz,
                                                decodedobject.release_after
                                                );

   controller.append_api_action_log("move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
   controller.append_api_bot_history(decodedobject.carrier_bot_id, "move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", release_after: ret.release_after ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "diagnose_move_carrier_to")
   {
   let ret = controller.apicall_diagnose_move_carrier_to(
                                                    decodedobject.carrier_bot_id,
                                                    decodedobject.x,
                                                    decodedobject.y,
                                                    decodedobject.z,
                                                    decodedobject.vx,
                                                    decodedobject.vy,
                                                    decodedobject.vz,
                                                    decodedobject.release_after
                                                    );

   controller.append_api_action_log("diagnose_move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", executable: ret.executable ?? false });
   controller.append_api_bot_history(decodedobject.carrier_bot_id, "diagnose_move_carrier_to", { carrier_bot_id: decodedobject.carrier_bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx, vy: decodedobject.vy, vz: decodedobject.vz, release_after: decodedobject.release_after ?? false }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "", executable: ret.executable ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

return(false);
} // handle_motion_api_command()

module.exports = { handle_motion_api_command };
