function apicall_get_bot_by_id(controller, bot_id)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);

if ( botindex == null )
   {
   return({
          ok: false,
          answer: "api_get_bot_by_id",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

let bot = controller.bots[botindex];

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
       adress: apicall_get_safe_adress(controller, bot)
       });
} // apicall_get_bot_by_id()


function apicall_get_safe_adress(controller, bot)
{
if ( !bot || bot.id == "masterbot" )
   {
   return("");
   } // if

const communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim();

if (communication_mode == "direct_radio")
   {
   let rid = "";

   if (typeof bot.rid == "string")
      {
      rid = String(bot.rid).trim();
      } // if

   if (rid == "")
      {
      rid = String(controller.get_direct_radio_rid_by_id(bot.id) ?? "").trim();
      } // if

   return(rid);
   } // if

let adress = bot.adress ?? "";

if ( typeof adress != "string" )
   {
   return("");
   } // if

adress = adress.replace(/^undefined/gi, "");

return(adress);
} // apicall_get_safe_adress()


function apicall_recalibrate_bot_address(controller, bot_id, mode = "standard")
{
let normalized_bot_id = String(bot_id ?? "").trim();
let normalized_mode = String(mode ?? "standard").trim().toLowerCase();
let communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();
let botindex = controller.get_bot_by_id(normalized_bot_id, controller.bots);
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

if (controller.bots[botindex].id == "masterbot")
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

if (communication_mode == "direct_radio")
   {
   old_adress = apicall_get_safe_adress(controller, controller.bots[botindex]);
   new_adress = String(controller.get_direct_radio_rid_by_id(normalized_bot_id) ?? "").trim();

   if (new_adress != "")
      {
      controller.bots[botindex].rid = new_adress;
      } // if

   return({
          ok: true,
          answer: "api_recalibrate_bot_address",
          bot_id: normalized_bot_id,
          mode: normalized_mode,
          skipped: true,
          reason: "DIRECT_RADIO_STATIC_RID",
          old_adress: old_adress,
          new_adress: new_adress,
          changed: (String(old_adress) !== String(new_adress)),
          position: {
                     x: Number(controller.bots[botindex].x),
                     y: Number(controller.bots[botindex].y),
                     z: Number(controller.bots[botindex].z)
                     }
          });
   } // if

old_adress = apicall_get_safe_adress(controller, controller.bots[botindex]);
new_adress = controller.get_mb_returnaddr(
                                          {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
                                          {
                                          x: Number(controller.bots[botindex].x),
                                          y: Number(controller.bots[botindex].y),
                                          z: Number(controller.bots[botindex].z)
                                          },
                                          controller.bots,
                                          [],
                                          { routing_mode: normalized_mode }
                                          );

controller.bots[botindex].adress_short = new_adress;

// Also generate detour address (alternative route)
let detour_adress = controller.get_mb_returnaddr_detour(
                                          {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
                                          {
                                          x: Number(controller.bots[botindex].x),
                                          y: Number(controller.bots[botindex].y),
                                          z: Number(controller.bots[botindex].z)
                                          },
                                          controller.bots,
                                          [],
                                          { routing_mode: normalized_mode }
                                          );
controller.bots[botindex].adress_detour = detour_adress;

return({
       ok: true,
       answer: "api_recalibrate_bot_address",
       bot_id: normalized_bot_id,
       mode: normalized_mode,
       old_adress: old_adress,
       new_adress: new_adress,
       changed: (String(old_adress) !== String(new_adress)),
       position: {
                  x: Number(controller.bots[botindex].x),
                  y: Number(controller.bots[botindex].y),
                  z: Number(controller.bots[botindex].z)
                  }
       });
} // apicall_recalibrate_bot_address()


function apicall_recalibrate_bot_addresses(controller, mode = "standard")
{
let recalibrated = [];
let changed_count = 0;
let normalized_mode = String(mode ?? "standard").trim().toLowerCase();
let communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();

for (let i = 0; i < controller.bots.length; i++)
    {
    if (controller.bots[i].id == "masterbot")
       {
       continue;
       } // if

    let ret = apicall_recalibrate_bot_address(controller, controller.bots[i].id, normalized_mode);
    recalibrated.push(ret);

    if (ret?.changed === true)
       {
       changed_count++;
       } // if
    } // for

if (communication_mode == "direct_radio")
   {
   return({
          ok: true,
          answer: "api_recalibrate_bot_addresses",
          mode: normalized_mode,
          count: recalibrated.length,
          changed_count: changed_count,
          skipped: true,
          reason: "DIRECT_RADIO_STATIC_RID",
          recalibrated: recalibrated
          });
   } // if

return({
       ok: true,
       answer: "api_recalibrate_bot_addresses",
       mode: normalized_mode,
       count: recalibrated.length,
       changed_count: changed_count,
       recalibrated: recalibrated
       });
} // apicall_recalibrate_bot_addresses()


function apicall_apply_safe_mode_for_bot(controller, bot_id)
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (Number(controller.safe_mode) < 1)
   {
   return({
          ok: true,
          answer: "api_safe_mode_prepare",
          bot_id: normalized_bot_id,
          safe_mode: Number(controller.safe_mode),
          recalibrated: false
          });
   } // if

if (Number(controller.safe_mode) >= 2)
   {
   return({
          ok: true,
          answer: "api_safe_mode_prepare",
          bot_id: normalized_bot_id,
          safe_mode: Number(controller.safe_mode),
          recalibrated: false,
          deferred_global_recalibration: true
          });
   } // if

let ret = apicall_recalibrate_bot_address(controller, normalized_bot_id);

return({
       ok: ret.ok,
       answer: "api_safe_mode_prepare",
       bot_id: normalized_bot_id,
       safe_mode: Number(controller.safe_mode),
       recalibrated: (ret.ok === true),
       recalibration: ret
       });
} // apicall_apply_safe_mode_for_bot()


function apicall_apply_safe_mode_after_structure_change(controller, trigger_bot_id, change_type = "structure_change")
{
let normalized_bot_id = String(trigger_bot_id ?? "").trim();

if (Number(controller.safe_mode) < 2)
   {
   return({
          ok: true,
          answer: "api_safe_mode_after_change",
          bot_id: normalized_bot_id,
          safe_mode: Number(controller.safe_mode),
          recalibrated: false,
          change_type: String(change_type ?? "structure_change")
          });
   } // if

let recalibration_ret = apicall_recalibrate_bot_addresses(controller);

return({
       ok: recalibration_ret.ok,
       answer: "api_safe_mode_after_change",
       bot_id: normalized_bot_id,
       safe_mode: Number(controller.safe_mode),
       recalibrated: (recalibration_ret.ok === true),
       change_type: String(change_type ?? "structure_change"),
       recalibration: recalibration_ret
       });
} // apicall_apply_safe_mode_after_structure_change()


function apicall_set_safe_mode(controller, mode)
{
let normalized_mode = String(mode ?? "status").trim().toLowerCase();

if (normalized_mode == "status")
   {
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(controller.safe_mode)
          });
   } // if

if (normalized_mode == "0" || normalized_mode == "off")
   {
   controller.safe_mode = 0;
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(controller.safe_mode)
          });
   } // if

if (normalized_mode == "1")
   {
   controller.safe_mode = 1;
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(controller.safe_mode)
          });
   } // if

if (normalized_mode == "2" || normalized_mode == "on")
   {
   controller.safe_mode = 2;
   return({
          ok: true,
          answer: "api_safe_mode",
          safe_mode: Number(controller.safe_mode)
          });
   } // if

return({
       ok: false,
       answer: "api_safe_mode",
       error: "INVALID_SAFE_MODE",
       mode: mode
       });
} // apicall_set_safe_mode()


function apicall_switch_bot_address(controller, bot_id, target = "first")
{
let normalized_id = String(bot_id ?? "").trim();
let normalized_target = String(target ?? "first").trim().toLowerCase();
let botindex = controller.get_bot_by_id(normalized_id, controller.bots);

if (normalized_id === "" || botindex == null)
   {
   return({ ok: false, answer: "api_switch_bot_address", error: "BOT_NOT_FOUND" });
   } // if

let bot = controller.bots[botindex];
let source_field = "adress_first";

if (normalized_target === "short") source_field = "adress_short";
else if (normalized_target === "detour") source_field = "adress_detour";
else if (normalized_target === "first") source_field = "adress_first";
else { return({ ok: false, answer: "api_switch_bot_address", error: "UNKNOWN_TARGET", valid: ["first","short","detour"] }); }

let new_adress = String(bot[source_field] ?? "").trim();
if (new_adress === "")
   {
   return({ ok: false, answer: "api_switch_bot_address", error: "ADDRESS_EMPTY", target: normalized_target });
   } // if

let old_adress = String(bot.adress ?? "");
bot.adress = new_adress;
return({
       ok: true,
       answer: "api_switch_bot_address",
       bot_id: normalized_id,
       target: normalized_target,
       old_adress: old_adress,
       new_adress: new_adress
       });
} // apicall_switch_bot_address()


module.exports = {
                 apicall_get_bot_by_id,
                 apicall_switch_bot_address,
                 apicall_get_safe_adress,
                 apicall_recalibrate_bot_address,
                 apicall_recalibrate_bot_addresses,
                 apicall_apply_safe_mode_for_bot,
                 apicall_apply_safe_mode_after_structure_change,
                 apicall_set_safe_mode
                 };
