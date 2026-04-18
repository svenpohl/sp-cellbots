async function write_and_close(socket, payload)
{
const answer = JSON.stringify(payload) + "\n";

socket.write(answer, () =>
             {
             socket.end();
             });
} // write_and_close()


async function handle_gui_roles_api_command(controller, decodedobject, socket)
{
const cmd = decodedobject?.cmd ?? "";

if (cmd === "gui_set_marker")
   {
   let ret = controller.apicall_gui_set_marker(decodedobject.x, decodedobject.y, decodedobject.z, decodedobject.size, decodedobject.color);
   controller.append_api_action_log("gui_set_marker", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z, size: decodedobject.size, color: decodedobject.color }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, frontend_attached: ret.frontend_attached ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "gui_clear_markers")
   {
   let ret = controller.apicall_gui_clear_markers();
   controller.append_api_action_log("gui_clear_markers", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, frontend_attached: ret.frontend_attached ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "gui_refresh")
   {
   let ret = controller.apicall_gui_refresh();
   controller.append_api_action_log("gui_refresh", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, frontend_attached: ret.frontend_attached ?? false });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "debug_move")
   {
   let ret = controller.apicall_set_debug_move(decodedobject.mode);
   controller.append_api_action_log("debug_move", { mode: decodedobject.mode }, { ok: ret.ok, answer: ret.answer, debug_move_enabled: ret.debug_move_enabled ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "safe_mode")
   {
   let ret = controller.apicall_set_safe_mode(decodedobject.mode);
   controller.append_api_action_log("safe_mode", { mode: decodedobject.mode }, { ok: ret.ok, answer: ret.answer, safe_mode: ret.safe_mode ?? null, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "forbidden_add")
   {
   let ret = controller.apicall_forbidden_add(decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("forbidden_add", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "forbidden_remove")
   {
   let ret = controller.apicall_forbidden_remove(decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("forbidden_remove", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "forbidden_clear")
   {
   let ret = controller.apicall_forbidden_clear();
   controller.append_api_action_log("forbidden_clear", {}, { ok: ret.ok, answer: ret.answer, removed_count: ret.removed_count ?? 0, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "forbidden_list")
   {
   let ret = controller.apicall_forbidden_list();
   controller.append_api_action_log("forbidden_list", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "servicebay_add")
   {
   let ret = controller.apicall_servicebay_add(decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("servicebay_add", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "servicebay_remove")
   {
   let ret = controller.apicall_servicebay_remove(decodedobject.x, decodedobject.y, decodedobject.z);
   controller.append_api_action_log("servicebay_remove", { x: decodedobject.x, y: decodedobject.y, z: decodedobject.z }, { ok: ret.ok, answer: ret.answer, changed: ret.changed ?? false, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "servicebay_clear")
   {
   let ret = controller.apicall_servicebay_clear();
   controller.append_api_action_log("servicebay_clear", {}, { ok: ret.ok, answer: ret.answer, removed_count: ret.removed_count ?? 0, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "servicebay_list")
   {
   let ret = controller.apicall_servicebay_list();
   controller.append_api_action_log("servicebay_list", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

return(false);
} // handle_gui_roles_api_command()

module.exports = { handle_gui_roles_api_command };
