function apicall_build_active_bots_tmp(controller, include_masterbot = false, excluded_bot_ids = [])
{
let bots_tmp = [];
let excluded_ids = new Set(
                            (Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [])
                            .map((id) => String(id ?? "").trim())
                            .filter((id) => id != "")
                            );

for (let i = 0; i < controller.bots.length; i++)
    {
    let bot = controller.bots[i];

    if (!bot)
       {
       continue;
       } // if

    if (bot.id == "masterbot" && include_masterbot !== true)
       {
       continue;
       } // if

    if (excluded_ids.has(String(bot.id ?? "")))
       {
       continue;
       } // if

    // Skip inactive bots entirely (cannot route through them)
    if (bot.inactive == 'true' || bot.inactive === true || bot.inactive == 1) continue;

    bots_tmp.push({
                   id: bot.id,
                   x: Number(bot.x),
                   y: Number(bot.y),
                   z: Number(bot.z),
                   vector_x: Number(bot.vector_x),
                   vector_y: Number(bot.vector_y),
                   vector_z: Number(bot.vector_z),
                   adress: bot.adress,
                   color: bot.color,
                   masterbot: Number(bot.masterbot ?? 0)
                   });
    } // for

return(bots_tmp);
} // apicall_build_active_bots_tmp()


function apicall_build_botindex_map_for_bots(controller, bots_tmp)
{
let botindex_map = {};

if (!Array.isArray(bots_tmp))
   {
   return(botindex_map);
   } // if

for (let i = 0; i < bots_tmp.length; i++)
    {
    let bot = bots_tmp[i];

    if (!bot)
       {
       continue;
       } // if

    let key = controller.getKey_3d(Number(bot.x), Number(bot.y), Number(bot.z));
    botindex_map[key] = i;
    } // for

return(botindex_map);
} // apicall_build_botindex_map_for_bots()


function apicall_get_inverse_address_for_bots(controller, firstindex_xyz, addr, bots_tmp, botindex_map = null)
{
let ret = "";
let normalized_addr = String(addr ?? "").trim();
let index_map = botindex_map ?? apicall_build_botindex_map_for_bots(controller, bots_tmp);

if (normalized_addr == "")
   {
   return(ret);
   } // if

if (!Array.isArray(bots_tmp) || bots_tmp.length == 0)
   {
   return(ret);
   } // if

if (index_map[firstindex_xyz] === undefined)
   {
   return(ret);
   } // if

let pathindexarray = [];
pathindexarray[0] = firstindex_xyz;

let size = normalized_addr.length;
for (let i = 0; i < size; i++)
    {
    let slot = normalized_addr[i];
    let keyindex = index_map[pathindexarray[i]];

    if (keyindex === undefined)
       {
       return("");
       } // if

    let vx = Number(bots_tmp[keyindex].vector_x);
    let vy = Number(bots_tmp[keyindex].vector_y);
    let vz = Number(bots_tmp[keyindex].vector_z);
    let rel_vector = controller.get_cell_relation_vector_byslot(slot, vx, vy, vz);

    let cb_x = Number(bots_tmp[keyindex].x) + Number(rel_vector.x);
    let cb_y = Number(bots_tmp[keyindex].y) + Number(rel_vector.y);
    let cb_z = Number(bots_tmp[keyindex].z) + Number(rel_vector.z);

    let nextindex_xyz = controller.getKey_3d(cb_x, cb_y, cb_z);
    pathindexarray[i + 1] = nextindex_xyz;
    } // for

size = pathindexarray.length;

for (let i = (size - 1); i > 0; i--)
    {
    let index1 = index_map[pathindexarray[i]];
    let index2 = index_map[pathindexarray[i - 1]];

    if (index1 === undefined || index2 === undefined)
       {
       return("");
       } // if

    let tx = Number(bots_tmp[index2].x) - Number(bots_tmp[index1].x);
    let ty = Number(bots_tmp[index2].y) - Number(bots_tmp[index1].y);
    let tz = Number(bots_tmp[index2].z) - Number(bots_tmp[index1].z);

    let slot2 = controller.get_cell_slot_byvector(
                                                   tx,
                                                   ty,
                                                   tz,
                                                   Number(bots_tmp[index1].vector_x),
                                                   Number(bots_tmp[index1].vector_y),
                                                   Number(bots_tmp[index1].vector_z)
                                                   );

    if (!slot2)
       {
       return("");
       } // if

    ret += slot2;
    } // for

return(ret);
} // apicall_get_inverse_address_for_bots()


function apicall_derive_target_address_from_neighbours(controller, target_pos, bots_tmp)
{
let ret = "";

if (!target_pos || !Array.isArray(bots_tmp) || bots_tmp.length == 0)
   {
   return(ret);
   } // if

let neighbours = controller.get_valid_neighbours(
                                                {
                                                x: Number(target_pos.x),
                                                y: Number(target_pos.y),
                                                z: Number(target_pos.z)
                                                },
                                                null,
                                                bots_tmp
                                                );

for (let i = 0; i < neighbours.length; i++)
    {
    let nbot = neighbours[i];
    let neighbour_addr = String(nbot.adress ?? "").trim();

    if (neighbour_addr == "")
       {
       continue;
       } // if

    let dx = Number(target_pos.x) - Number(nbot.x);
    let dy = Number(target_pos.y) - Number(nbot.y);
    let dz = Number(target_pos.z) - Number(nbot.z);

    let slot = controller.get_cell_slot_byvector(
                                                 dx,
                                                 dy,
                                                 dz,
                                                 Number(nbot.vector_x),
                                                 Number(nbot.vector_y),
                                                 Number(nbot.vector_z)
                                                 );

    if (!slot)
       {
       continue;
       } // if

    ret = neighbour_addr + slot;
    return(ret);
    } // for

return(ret);
} // apicall_derive_target_address_from_neighbours()


function apicall_derive_ack_returnaddr_from_neighbours(controller, target_bot, bots_tmp)
{
let ret = "";

if (!target_bot || !Array.isArray(bots_tmp) || bots_tmp.length == 0)
   {
   return(ret);
   } // if

let neighbours = controller.get_valid_neighbours(
                                                {
                                                x: Number(target_bot.x),
                                                y: Number(target_bot.y),
                                                z: Number(target_bot.z)
                                                },
                                                null,
                                                bots_tmp
                                                );
let botindex_map = apicall_build_botindex_map_for_bots(controller, bots_tmp);
let masterbot_key = controller.getKey_3d(Number(controller.mb.x), Number(controller.mb.y), Number(controller.mb.z));

for (let i = 0; i < neighbours.length; i++)
    {
    let nbot = neighbours[i];
    let neighbour_addr = String(nbot.adress ?? "").trim();

    if (neighbour_addr == "")
       {
       continue;
       } // if

    let entry_slot = controller.get_cell_slot_byvector(
                                                        Number(nbot.x) - Number(target_bot.x),
                                                        Number(nbot.y) - Number(target_bot.y),
                                                        Number(nbot.z) - Number(target_bot.z),
                                                        Number(target_bot.vector_x),
                                                        Number(target_bot.vector_y),
                                                        Number(target_bot.vector_z)
                                                        );

    if (!entry_slot)
       {
       continue;
       } // if

    let neighbour_retaddr = apicall_get_inverse_address_for_bots(
                                                                  controller,
                                                                  masterbot_key,
                                                                  neighbour_addr,
                                                                  bots_tmp,
                                                                  botindex_map
                                                                  );

    if (neighbour_retaddr == "")
       {
       let live_inverse = controller.get_inverse_address(masterbot_key, neighbour_addr);

       if (typeof live_inverse == "string" && live_inverse.trim() != "")
          {
          neighbour_retaddr = live_inverse.replace(/^S/i, "");
          } // if
       } // if

    if (neighbour_retaddr == "")
       {
       continue;
       } // if

    ret = entry_slot + neighbour_retaddr;
    return(ret);
    } // for

return(ret);
} // apicall_derive_ack_returnaddr_from_neighbours()


function apicall_diagnose_ack_route(controller, bot_id, x, y, z, vx = null, vy = null, vz = null)
{
let normalized_bot_id = String(bot_id ?? "").trim();
let communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let target_vx = (vx === null || vx === undefined || vx === "") ? null : Number(vx);
let target_vy = (vy === null || vy === undefined || vy === "") ? null : Number(vy);
let target_vz = (vz === null || vz === undefined || vz === "") ? null : Number(vz);
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(normalized_bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(normalized_bot_id);
let target_orientation = null;
let bots_tmp_ack = [];
let ack_botindex = null;
let ack_target_addr = "";
let ack_retaddr = "";
let ack_target_neighbors_debug = [];
let ack_target_neighbors_live_debug = [];
let ack_stl_debug = null;
let botindex_map_ack = null;
let carried_payload_bot_id = controller.apicall_get_carried_payload_bot_id(normalized_bot_id);
let excluded_bot_ids = [];
let tmp_unreachable_bots = [];

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: normalized_bot_id,
          safe_mode: Number(controller.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: "BOT_NOT_FOUND",
          bot_id: normalized_bot_id
          });
   } // if

if (Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z))
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: "INVALID_TARGET_POSITION",
          bot_id: normalized_bot_id
          });
   } // if

if (String(carried_payload_bot_id ?? "").trim() != "")
   {
   excluded_bot_ids.push(String(carried_payload_bot_id));
   } // if

if (target_vx !== null || target_vy !== null || target_vz !== null)
   {
   if (
      Number.isNaN(target_vx) ||
      Number.isNaN(target_vy) ||
      Number.isNaN(target_vz)
      )
      {
      return({
             ok: false,
             answer: "api_diagnose_ack_route",
             error: "INVALID_TARGET_ORIENTATION",
             bot_id: normalized_bot_id
             });
      } // if

   target_orientation = {
                        x: Number(target_vx),
                        y: Number(target_vy),
                        z: Number(target_vz)
                        };
   } else
     {
     target_orientation = {
                          x: Number(bot_snapshot.orientation.x),
                          y: Number(bot_snapshot.orientation.y),
                          z: Number(bot_snapshot.orientation.z)
                          };
     } // else

if (communication_mode == "direct_radio")
   {
   let target_rid = String(controller.get_direct_radio_rid_by_id(normalized_bot_id) ?? "").trim();
   let masterbot_rid = String(controller?.mb?.rid ?? "").trim();

   if (masterbot_rid == "")
      {
      masterbot_rid = "00:00:00:00:00:00";
      } // if

   return({
          ok: true,
          answer: "api_diagnose_ack_route",
          mode: "direct_radio",
          bot_id: normalized_bot_id,
          safe_mode: Number(controller.safe_mode),
          current_state: bot_snapshot,
          target: {
                   x: Number(target_x),
                   y: Number(target_y),
                   z: Number(target_z)
                   },
          target_orientation: target_orientation,
          carried_payload_bot_id: carried_payload_bot_id,
          excluded_bot_ids: excluded_bot_ids,
          ack_target_addr: target_rid,
          ack_retaddr: masterbot_rid,
          ack_target_neighbors_debug: [],
          ack_target_neighbors_live_debug: [],
          ack_stl_debug: null,
          tmp_unreachable_count: 0,
          tmp_unreachable_bots: [],
          routing_note: "Direct radio does not require mesh return-route derivation."
          });
   } // if

bots_tmp_ack = apicall_build_active_bots_tmp(controller, true, excluded_bot_ids);
ack_botindex = controller.get_bot_by_id(normalized_bot_id, bots_tmp_ack);

if (ack_botindex == null)
   {
   return({
          ok: false,
          answer: "api_diagnose_ack_route",
          error: "BOT_NOT_FOUND_IN_TMP",
          bot_id: normalized_bot_id
          });
   } // if

bots_tmp_ack[ack_botindex].x = target_x;
bots_tmp_ack[ack_botindex].y = target_y;
bots_tmp_ack[ack_botindex].z = target_z;
bots_tmp_ack[ack_botindex].vector_x = Number(target_orientation.x);
bots_tmp_ack[ack_botindex].vector_y = Number(target_orientation.y);
bots_tmp_ack[ack_botindex].vector_z = Number(target_orientation.z);

for (let i = 0; i < bots_tmp_ack.length; i++)
    {
    if (bots_tmp_ack[i].id == "masterbot")
       {
       continue;
       } // if

    bots_tmp_ack[i].adress = controller.get_mb_returnaddr(
                                                        {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
                                                        {
                                                        x: Number(bots_tmp_ack[i].x),
                                                        y: Number(bots_tmp_ack[i].y),
                                                        z: Number(bots_tmp_ack[i].z)
                                                        },
                                                        bots_tmp_ack,
                                                        [],
                                                        { exclude_masterbots: true }
                                                        );

    if (String(bots_tmp_ack[i].adress ?? "").trim() == "")
       {
       tmp_unreachable_bots.push({
                                 id: bots_tmp_ack[i].id,
                                 x: Number(bots_tmp_ack[i].x),
                                 y: Number(bots_tmp_ack[i].y),
                                 z: Number(bots_tmp_ack[i].z)
                                 });
       } // if
    } // for

ack_target_neighbors_debug = controller.get_valid_neighbours(
                                                           {x: target_x, y: target_y, z: target_z},
                                                           null,
                                                           bots_tmp_ack
                                                           ).map((bot) => ({
                                                                          id: bot.id,
                                                                          x: Number(bot.x),
                                                                          y: Number(bot.y),
                                                                          z: Number(bot.z),
                                                                          adress: String(bot.adress ?? "")
                                                                          })); // for

ack_target_addr = String(bots_tmp_ack[ack_botindex].adress ?? "").trim();

if (ack_target_addr == "")
   {
   ack_target_addr = apicall_derive_target_address_from_neighbours(
                                                                    controller,
                                                                    {x: target_x, y: target_y, z: target_z},
                                                                    bots_tmp_ack
                                                                    );
   } // if

if (ack_target_addr == "")
   {
   ack_target_neighbors_live_debug = controller.get_valid_neighbours(
                                                                  {x: target_x, y: target_y, z: target_z},
                                                                  null,
                                                                  controller.bots
                                                                  ).map((bot) => ({
                                                                                 id: bot.id,
                                                                                 x: Number(bot.x),
                                                                                 y: Number(bot.y),
                                                                                 z: Number(bot.z),
                                                                                 adress: String(bot.adress ?? "")
                                                                                 })); // for

   ack_target_addr = apicall_derive_target_address_from_neighbours(
                                                                    controller,
                                                                    {x: target_x, y: target_y, z: target_z},
                                                                    controller.bots
                                                                    );
   } // if

botindex_map_ack = apicall_build_botindex_map_for_bots(controller, bots_tmp_ack);

if (ack_target_neighbors_debug.length > 0)
   {
   let preferred_neighbour = ack_target_neighbors_debug[0];
   let stl_key = controller.getKey_3d(
                                      Number(preferred_neighbour.x),
                                      Number(preferred_neighbour.y),
                                      Number(preferred_neighbour.z)
                                      );
   let stl_index = botindex_map_ack[stl_key];

   ack_stl_debug = {
                    neighbour: {
                               x: Number(preferred_neighbour.x),
                               y: Number(preferred_neighbour.y),
                               z: Number(preferred_neighbour.z)
                               },
                    stl_id: preferred_neighbour.id,
                    stl_addr: String(preferred_neighbour.adress ?? "")
                    };

   if (stl_index !== undefined)
      {
      let masterbot_key = controller.getKey_3d(Number(controller.mb.x), Number(controller.mb.y), Number(controller.mb.z));
      let stl_retaddr = apicall_get_inverse_address_for_bots(
                                                              controller,
                                                              masterbot_key,
                                                              String(bots_tmp_ack[stl_index].adress ?? ""),
                                                              bots_tmp_ack,
                                                              botindex_map_ack
                                                              );

      ack_stl_debug.stl_retaddr = stl_retaddr;
      } // if
   } // if

ack_retaddr = apicall_derive_ack_returnaddr_from_neighbours(
                                                             controller,
                                                             {
                                                             x: Number(target_x),
                                                             y: Number(target_y),
                                                             z: Number(target_z),
                                                             vector_x: Number(target_orientation.x),
                                                             vector_y: Number(target_orientation.y),
                                                             vector_z: Number(target_orientation.z)
                                                             },
                                                             bots_tmp_ack
                                                             );

if (ack_retaddr == "" && ack_target_addr != "")
   {
   let masterbot_key = controller.getKey_3d(Number(controller.mb.x), Number(controller.mb.y), Number(controller.mb.z));
   ack_retaddr = apicall_get_inverse_address_for_bots(
                                                       controller,
                                                       masterbot_key,
                                                       ack_target_addr,
                                                       bots_tmp_ack,
                                                       botindex_map_ack
                                                       );
   } // if

return({
       ok: true,
       answer: "api_diagnose_ack_route",
       bot_id: normalized_bot_id,
       safe_mode: Number(controller.safe_mode),
       current_state: bot_snapshot,
       target: {
                x: Number(target_x),
                y: Number(target_y),
                z: Number(target_z)
                },
       target_orientation: target_orientation,
       carried_payload_bot_id: carried_payload_bot_id,
       excluded_bot_ids: excluded_bot_ids,
       ack_target_addr: ack_target_addr,
       ack_retaddr: ack_retaddr,
       ack_target_neighbors_debug: ack_target_neighbors_debug,
       ack_target_neighbors_live_debug: ack_target_neighbors_live_debug,
       ack_stl_debug: ack_stl_debug,
       tmp_unreachable_count: tmp_unreachable_bots.length,
       tmp_unreachable_bots: tmp_unreachable_bots
       });
} // apicall_diagnose_ack_route()


module.exports = {
                 apicall_build_active_bots_tmp,
                 apicall_build_botindex_map_for_bots,
                 apicall_get_inverse_address_for_bots,
                 apicall_derive_target_address_from_neighbours,
                 apicall_derive_ack_returnaddr_from_neighbours,
                 apicall_diagnose_ack_route
                 };
