async function write_and_close(socket, payload)
{
const answer = JSON.stringify(payload) + "\n";

socket.write(answer, () =>
             {
             socket.end();
             });
} // write_and_close()


async function handle_readonly_api_command(controller, decodedobject, socket)
{
const cmd = decodedobject?.cmd ?? "";

if (cmd === "get_status_extended")
   {
   let ret = controller.apicall_get_status_extended();
   controller.append_api_action_log("get_status_extended", {}, { ok: ret.ok, answer: ret.answer, loaded_bots_total: ret.loaded_bots_total });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_masterbot")
   {
   let ret = controller.apicall_get_masterbot();
   controller.append_api_action_log("get_masterbot", {}, { ok: ret.ok, answer: ret.answer, connected: ret.connected });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_scan_state")
   {
   let ret = controller.apicall_get_scan_state();
   controller.append_api_action_log("get_scan_state", {}, { ok: ret.ok, answer: ret.answer, level1_running: ret.level1?.running, level2_running: ret.level2?.running });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_bot_by_id")
   {
   let ret = controller.apicall_get_bot_by_id(decodedobject.bot_id);
   controller.append_api_action_log("get_bot_by_id", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer, bot_id: ret.bot_id ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_bots")
   {
   let ret = controller.apicall_get_bots(
                                     decodedobject.x,
                                     decodedobject.y,
                                     decodedobject.z,
                                     decodedobject.mode,
                                     decodedobject.radius
                                     );
   controller.append_api_action_log(
                                    "get_bots",
                                    {
                                     mode: decodedobject.mode,
                                     x: decodedobject.x,
                                     y: decodedobject.y,
                                     z: decodedobject.z,
                                     radius: decodedobject.radius
                                    },
                                    { ok: ret.ok, answer: ret.answer, count: ret.count }
                                    );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_bots_by_prefix")
   {
   let ret = controller.apicall_get_bots_by_prefix(decodedobject.prefix);
   controller.append_api_action_log("get_bots_by_prefix", { prefix: decodedobject.prefix }, { ok: ret.ok, answer: ret.answer, count: ret.count });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_inactive_bots")
   {
   let ret = controller.apicall_get_inactive_bots();
   controller.append_api_action_log("get_inactive_bots", {}, { ok: ret.ok, answer: ret.answer, count: ret.count });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_neighbors")
   {
   let ret = controller.apicall_get_neighbors(decodedobject.bot_id);
   controller.append_api_action_log("get_neighbors", { bot_id: decodedobject.bot_id }, { ok: ret.ok, answer: ret.answer });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_grab_positions")
   {
   let ret = controller.apicall_get_grab_positions(decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log(
                                    "get_grab_positions",
                                    { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z },
                                    { ok: ret.ok, answer: ret.answer, count: ret.count ?? null }
                                    );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_turn_positions")
   {
   let ret = controller.apicall_get_turn_positions(decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.radius);
   controller.append_api_action_log(
                                    "get_turn_positions",
                                    { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, radius: decodedobject.radius },
                                    { ok: ret.ok, answer: ret.answer, count: ret.count ?? null }
                                    );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "is_occupied")
   {
   let ret = controller.apicall_is_occupied(decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("is_occupied", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, occupied: ret.occupied });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_slot_status")
   {
   let ret = controller.apicall_get_slot_status(decodedobject.bot_id, decodedobject.slot);
   controller.append_api_action_log("get_slot_status", { bot_id: decodedobject.bot_id, slot: decodedobject.slot }, { ok: ret.ok, answer: ret.answer, occupied: ret.occupied ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_last_moves")
   {
   let ret = { ok: true, ...controller.apicall_get_last_moves(decodedobject.limit) };
   controller.append_api_action_log("get_last_moves", { limit: decodedobject.limit }, { ok: ret.ok, answer: ret.answer, count: ret.count });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_bot_history")
   {
   let ret = controller.apicall_get_bot_history(decodedobject.bot_id, decodedobject.limit);
   controller.append_api_action_log(
                                    "get_bot_history",
                                    { bot_id: decodedobject.bot_id, limit: decodedobject.limit },
                                    { ok: ret.ok, answer: ret.answer, count: ret.count ?? null }
                                    );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_last_raw_cmds")
   {
   let ret = { ok: true, ...controller.apicall_get_last_raw_cmds(decodedobject.limit) };
   controller.append_api_action_log("get_last_raw_cmds", { limit: decodedobject.limit }, { ok: ret.ok, answer: ret.answer, count: ret.count });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_api_messages")
   {
   let ret = controller.apicall_get_api_messages(decodedobject.cmd_filter, decodedobject.limit);
   controller.append_api_action_log("get_api_messages", { cmd_filter: decodedobject.cmd_filter, limit: decodedobject.limit }, { ok: ret.ok, answer: ret.answer, count: ret.count });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_payload_link")
   {
   let payload_link = controller.apicall_get_payload_link_for_carrier(decodedobject.carrier_bot_id);
   let carried_payload_bot_id = controller.apicall_get_carried_payload_bot_id(decodedobject.carrier_bot_id);
   controller.append_api_action_log("get_payload_link", { carrier_bot_id: decodedobject.carrier_bot_id }, { ok: true, answer: "api_get_payload_link", has_link: payload_link !== null });
   await write_and_close(socket, {
                                  ok: true,
                                  answer: "api_get_payload_link",
                                  carrier_bot_id: decodedobject.carrier_bot_id,
                                  has_link: payload_link !== null,
                                  payload_link: payload_link,
                                  carried_payload_bot_id: carried_payload_bot_id
                                  });
   return(true);
   } // if

return(false);
} // handle_readonly_api_command()

module.exports = { handle_readonly_api_command };
