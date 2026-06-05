async function write_and_close(socket, payload)
{
const answer = JSON.stringify(payload) + "\n";

socket.write(answer, () =>
             {
             socket.end();
             });
} // write_and_close()


async function handle_ack_api_command(controller, decodedobject, socket)
{
const cmd = decodedobject?.cmd ?? "";

if (cmd === "recalibrate_bot_address")
   {
   let mode = decodedobject.mode ?? "standard";
   let ret = controller.apicall_recalibrate_bot_address(decodedobject.bot_id, mode);
   controller.append_api_action_log("recalibrate_bot_address", { bot_id: decodedobject.bot_id, mode: mode }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, error: ret.error ?? "" });
   controller.append_api_bot_history(decodedobject.bot_id, "recalibrate_bot_address", { bot_id: decodedobject.bot_id, mode: mode }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, old_adress: ret.old_adress ?? "", new_adress: ret.new_adress ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "recalibrate_bot_addresses")
   {
   let mode = decodedobject.mode ?? "standard";
   let ret = controller.apicall_recalibrate_bot_addresses(mode);
   controller.append_api_action_log("recalibrate_bot_addresses", { mode: mode }, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, changed_count: ret.changed_count ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "switch_bot_address")
   {
   let target = decodedobject.target ?? "first";
   let ret = controller.apicall_switch_bot_address(decodedobject.bot_id, target);
   controller.append_api_action_log("switch_bot_address", { bot_id: decodedobject.bot_id, target: target }, { ok: ret.ok, answer: ret.answer });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "diagnose_ack_route")
   {
   let ret = controller.apicall_diagnose_ack_route(decodedobject.bot_id, decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.vx, decodedobject.vy, decodedobject.vz);
   controller.append_api_action_log("diagnose_ack_route", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx ?? null, vy: decodedobject.vy ?? null, vz: decodedobject.vz ?? null }, { ok: ret.ok, answer: ret.answer, ack_target_addr: ret.ack_target_addr ?? "", ack_retaddr: ret.ack_retaddr ?? "", error: ret.error ?? "" });
   controller.append_api_bot_history(decodedobject.bot_id, "diagnose_ack_route", { bot_id: decodedobject.bot_id, x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, vx: decodedobject.vx ?? null, vy: decodedobject.vy ?? null, vz: decodedobject.vz ?? null }, { ok: ret.ok, answer: ret.answer, ack_target_addr: ret.ack_target_addr ?? "", ack_retaddr: ret.ack_retaddr ?? "", error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "poll_masterbot_queue")
   {
   let ret = controller.apicall_poll_masterbot_queue();
   controller.append_api_action_log("poll_masterbot_queue", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "reset_api_message_log")
   {
   controller.reset_api_message_log();
   controller.append_api_action_log("reset_api_message_log", {}, { ok: true, answer: "api_reset_api_message_log", accepted: true });

   await write_and_close(
                        socket,
                        {
                        ok: true,
                        answer: "api_reset_api_message_log",
                        accepted: true,
                        cleared: true
                        }
                        );
   return(true);
   } // if

return(false);
} // handle_ack_api_command()

module.exports = { handle_ack_api_command };
