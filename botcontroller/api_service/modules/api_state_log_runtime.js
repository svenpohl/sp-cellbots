const cmd_parser_class = require('../../../common/cmd_parser_class');


function apicall_get_cmd_name(controller, cmd)
{
const cmd_parser_class_obj = new cmd_parser_class();

if (cmd == cmd_parser_class_obj.CMD_INFO)   return("INFO");
if (cmd == cmd_parser_class_obj.CMD_RINFO)  return("RINFO");
if (cmd == cmd_parser_class_obj.CMD_RNBH)   return("RNBH");
if (cmd == cmd_parser_class_obj.CMD_CHECK)  return("CHECK");
if (cmd == cmd_parser_class_obj.CMD_RCHECK) return("RCHECK");
if (cmd == cmd_parser_class_obj.CMD_ALIFE)  return("ALIFE");
if (cmd == cmd_parser_class_obj.CMD_RALIFE) return("RALIFE");
if (cmd == cmd_parser_class_obj.CMD_MOVE)   return("MOVE");
if (cmd == cmd_parser_class_obj.CMD_SYS)    return("SYS");

if (cmd == null || cmd == "") return("");

return(String(cmd));
} // apicall_get_cmd_name()


function apicall_get_bot_snapshot(controller, bot_id)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);

if (botindex == null)
   {
   return(null);
   } // if

return({
       id: controller.bots[botindex].id,
       position: {
                  x: Number(controller.bots[botindex].x),
                  y: Number(controller.bots[botindex].y),
                  z: Number(controller.bots[botindex].z)
                  },
       orientation: {
                     x: Number(controller.bots[botindex].vector_x),
                     y: Number(controller.bots[botindex].vector_y),
                     z: Number(controller.bots[botindex].vector_z)
                     },
       adress: controller.apicall_get_safe_adress(controller.bots[botindex])
       });
} // apicall_get_bot_snapshot()


function apicall_get_bot_history(controller, bot_id, limit)
{
let normalized_limit = Number(limit);
let history = controller.api_bot_history_log.filter((entry) => entry.bot_id === bot_id);

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


function apicall_generate_ack_id(controller, bot_id = "")
{
controller.api_ack_counter++;

let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return("API" + controller.api_ack_counter);
   } // if

return("API_" + normalized_bot_id + "_" + controller.api_ack_counter);
} // apicall_generate_ack_id()


function apicall_register_ack(controller, ack_id, ack_payload = {})
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return(false);
   } // if

controller.api_ack_map[normalized_ack_id] = {
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


function apicall_get_ack(controller, ack_id)
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return(null);
   } // if

if (controller.api_ack_map[normalized_ack_id] === undefined)
   {
   return(null);
   } // if

return(controller.api_ack_map[normalized_ack_id]);
} // apicall_get_ack()


function apicall_mark_ack_received(controller, ack_id, ack_status = "ack")
{
let ack_entry = controller.apicall_get_ack(ack_id);

if (!ack_entry)
   {
   return(false);
   } // if

ack_entry.status = ack_status;
ack_entry.ack_ts = new Date().toISOString();

return(true);
} // apicall_mark_ack_received()


function apicall_mark_ack_recovered(controller, ack_id)
{
return(controller.apicall_mark_ack_received(ack_id, "recovered"));
} // apicall_mark_ack_recovered()


function apicall_remove_ack(controller, ack_id)
{
let normalized_ack_id = String(ack_id ?? "").trim();

if (normalized_ack_id == "")
   {
   return(false);
   } // if

if (controller.api_ack_map[normalized_ack_id] === undefined)
   {
   return(false);
   } // if

delete controller.api_ack_map[normalized_ack_id];
return(true);
} // apicall_remove_ack()


function apicall_sleep(controller, ms)
{
return(new Promise((resolve) => setTimeout(resolve, ms)));
} // apicall_sleep()


function apicall_positions_equal(controller, pos1, pos2)
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


function apicall_orientations_equal(controller, ori1, ori2)
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


function apicall_resolve_bot_id_by_address(controller, address)
{
let normalized_address = String(address ?? "").trim();

if (normalized_address == "")
   {
   return(null);
   } // if

for (let i = 0; i < controller.bots.length; i++)
    {
    if (controller.bots[i].id == "masterbot")
       {
       continue;
       } // if

    if (String(controller.apicall_get_safe_adress(controller.bots[i])) === normalized_address)
       {
       return(controller.bots[i].id);
       } // if
    } // for

for (let i = controller.api_bot_history_log.length - 1; i >= 0; i--)
    {
    let entry = controller.api_bot_history_log[i];

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


function apicall_get_last_moves(controller, limit)
{
let normalized_limit = Number(limit);
if (!Number.isFinite(normalized_limit) || normalized_limit <= 0)
   {
   normalized_limit = 10;
   } // if

let moves = controller.api_action_log;

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


function apicall_get_last_raw_cmds(controller, limit)
{
let normalized_limit = Number(limit);
let raw_cmds = controller.api_raw_cmd_log;

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


function apicall_get_api_messages(controller, filter_cmd, limit)
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

let filtered_messages = controller.api_message_log.filter((entry) =>
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


module.exports = {
                  apicall_get_cmd_name,
                  apicall_get_bot_snapshot,
                  apicall_get_bot_history,
                  apicall_generate_ack_id,
                  apicall_register_ack,
                  apicall_get_ack,
                  apicall_mark_ack_received,
                  apicall_mark_ack_recovered,
                  apicall_remove_ack,
                  apicall_sleep,
                  apicall_positions_equal,
                  apicall_orientations_equal,
                  apicall_resolve_bot_id_by_address,
                  apicall_get_last_moves,
                  apicall_get_last_raw_cmds,
                  apicall_get_api_messages
                 };
