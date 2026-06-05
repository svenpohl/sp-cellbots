function apicall_get_bots(controller, center_x, center_y, center_z, mode, radius)
{
let retbots = [];

center_x = Number(center_x);
center_y = Number(center_y);
center_z = Number(center_z);
radius   = Number(radius);

if ( Number.isNaN(center_x) || Number.isNaN(center_y) || Number.isNaN(center_z) || Number.isNaN(radius) )
   {
   return({
          ok: false,
          answer: "api_get_bots",
          error: "INVALID_PARAMETERS"
          });
   } // if

if ( mode != "cube" )
   {
   return({
          ok: false,
          answer: "api_get_bots",
          error: "UNSUPPORTED_MODE",
          mode: mode
          });
   } // if

for (let i=0; i<controller.bots.length; i++)
    {
    let dx = Math.abs( Number(controller.bots[i].x) - center_x );
    let dy = Math.abs( Number(controller.bots[i].y) - center_y );
    let dz = Math.abs( Number(controller.bots[i].z) - center_z );

    if ( dx <= radius && dy <= radius && dz <= radius )
       {
       retbots.push({
                    id: controller.bots[i].id,
                    position: {
                               x: Number(controller.bots[i].x),
                               y: Number(controller.bots[i].y),
                               z: Number(controller.bots[i].z)
                               },
                    orientation: {
                                 x: Number(controller.bots[i].vector_x),
                                 y: Number(controller.bots[i].vector_y),
                                 z: Number(controller.bots[i].vector_z)
                                 },
                    adress: controller.apicall_get_safe_adress(controller.bots[i])
                    });
       } // if
    } // for

return({
       ok: true,
       answer: "api_get_bots",
       mode: "cube",
       center: {
                x: center_x,
                y: center_y,
                z: center_z
                },
       radius: radius,
       count: retbots.length,
       bots: retbots
       });
} // apicall_get_bots()


function apicall_get_bots_by_prefix(controller, prefix = "")
{
let normalized_prefix = String(prefix ?? "").trim();
let retbots = [];

if (normalized_prefix.length < 1)
   {
   return({
          ok: false,
          answer: "api_get_bots_by_prefix",
          error: "EMPTY_PREFIX"
          });
   } // if

for (let i=0; i<controller.bots.length; i++)
    {
    let bot_id = String(controller.bots[i].id ?? "");

    if (bot_id.startsWith(normalized_prefix))
       {
       retbots.push({
                    id: bot_id,
                    position: {
                               x: Number(controller.bots[i].x),
                               y: Number(controller.bots[i].y),
                               z: Number(controller.bots[i].z)
                               },
                    orientation: {
                                 x: Number(controller.bots[i].vector_x),
                                 y: Number(controller.bots[i].vector_y),
                                 z: Number(controller.bots[i].vector_z)
                                 },
                    adress: controller.apicall_get_safe_adress(controller.bots[i])
                    });
       } // if
    } // for

return({
       ok: true,
       answer: "api_get_bots_by_prefix",
       prefix: normalized_prefix,
       count: retbots.length,
       bots: retbots
       });
} // apicall_get_bots_by_prefix()


function apicall_get_inactive_bots(controller)
{
let retbots = [];
let size = controller.detected_inactive_bots.length;

for (let i=0; i<size; i++)
    {
    retbots.push(
                {
                id: controller.detected_inactive_bots[i].id,
                position: {
                           x: Number(controller.detected_inactive_bots[i].x),
                           y: Number(controller.detected_inactive_bots[i].y),
                           z: Number(controller.detected_inactive_bots[i].z)
                           },
                orientation: {
                             x: Number(controller.detected_inactive_bots[i].vx),
                             y: Number(controller.detected_inactive_bots[i].vy),
                             z: Number(controller.detected_inactive_bots[i].vz)
                             },
                color: controller.detected_inactive_bots[i].col,
                source_bot_id: controller.detected_inactive_bots[i].source_bot_id,
                source_slot: controller.detected_inactive_bots[i].source_slot
                }
                );
    } // for

return({
       ok: true,
       answer: "api_get_inactive_bots",
       count: retbots.length,
       bots: retbots
       });
} // apicall_get_inactive_bots()


function apicall_get_inactive_bot_by_xyz(controller, x, y, z)
{
let size = controller.detected_inactive_bots.length;

for (let i=0; i<size; i++)
    {
    if (
        Number(controller.detected_inactive_bots[i].x) == Number(x) &&
        Number(controller.detected_inactive_bots[i].y) == Number(y) &&
        Number(controller.detected_inactive_bots[i].z) == Number(z)
       )
       {
       return controller.detected_inactive_bots[i];
       } // if
    } // for

return null;
} // apicall_get_inactive_bot_by_xyz()


function apicall_get_neighbors(controller, bot_id)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);
const slotnames = ['F','R','B','L','T','D'];
let neighbors = {};

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_get_neighbors",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

for (let i=0; i<slotnames.length; i++)
    {
    let slotname = slotnames[i];
    let target_xyz = controller.get_next_target_coor(
                                                     controller.bots[botindex].x,
                                                     controller.bots[botindex].y,
                                                     controller.bots[botindex].z,
                                                     controller.bots[botindex].vector_x,
                                                     controller.bots[botindex].vector_y,
                                                     controller.bots[botindex].vector_z,
                                                     slotname
                                                     );

    let target_bot_index = controller.get_3d(target_xyz.x, target_xyz.y, target_xyz.z);
    let inactive_bot = controller.apicall_get_inactive_bot_by_xyz(target_xyz.x, target_xyz.y, target_xyz.z);

    neighbors[slotname] = {
                           position: {
                                      x: Number(target_xyz.x),
                                      y: Number(target_xyz.y),
                                      z: Number(target_xyz.z)
                                      },
                           state: "empty"
                           };

    if (inactive_bot != null)
       {
       neighbors[slotname] = {
                             position: {
                                        x: Number(target_xyz.x),
                                        y: Number(target_xyz.y),
                                        z: Number(target_xyz.z)
                                        },
                             state: "inactive",
                             id: inactive_bot.id,
                             color: inactive_bot.col,
                             source_bot_id: inactive_bot.source_bot_id,
                             source_slot: inactive_bot.source_slot
                             };
       } // if

    if (target_bot_index != null)
       {
       neighbors[slotname] = {
                             position: {
                                        x: Number(target_xyz.x),
                                        y: Number(target_xyz.y),
                                        z: Number(target_xyz.z)
                                        },
                             state: "active",
                             id: controller.bots[target_bot_index].id,
                             orientation: {
                                           x: Number(controller.bots[target_bot_index].vector_x),
                                           y: Number(controller.bots[target_bot_index].vector_y),
                                           z: Number(controller.bots[target_bot_index].vector_z)
                                           },
                             adress: controller.apicall_get_safe_adress(controller.bots[target_bot_index])
                             };
       } // if
    } // for

return({
       ok: true,
       answer: "api_get_neighbors",
       bot_id: bot_id,
       center: {
                position: {
                           x: Number(controller.bots[botindex].x),
                           y: Number(controller.bots[botindex].y),
                           z: Number(controller.bots[botindex].z)
                           },
                orientation: {
                             x: Number(controller.bots[botindex].vector_x),
                             y: Number(controller.bots[botindex].vector_y),
                             z: Number(controller.bots[botindex].vector_z)
                             }
                },
       neighbors: neighbors
       });
} // apicall_get_neighbors()


function apicall_get_bots_in_region(controller, x1, y1, z1, x2, y2, z2)
{
let x_min = Math.min(x1, x2);
let x_max = Math.max(x1, x2);
let y_min = Math.min(y1, y2);
let y_max = Math.max(y1, y2);
let z_min = Math.min(z1, z2);
let z_max = Math.max(z1, z2);

let retbots = [];

for (let i=0; i<controller.bots.length; i++)
    {
    let bx = Number(controller.bots[i].x);
    let by = Number(controller.bots[i].y);
    let bz = Number(controller.bots[i].z);

    if ( bx >= x_min && bx <= x_max &&
         by >= y_min && by <= y_max &&
         bz >= z_min && bz <= z_max )
       {
       retbots.push({
                    id: controller.bots[i].id,
                    position: {
                               x: bx,
                               y: by,
                               z: bz
                               }
                    });
       } // if
    } // for

return({
       ok: true,
       answer: "api_get_bots_in_region",
       region: {
                x1: x_min,
                y1: y_min,
                z1: z_min,
                x2: x_max,
                y2: y_max,
                z2: z_max
                },
       count: retbots.length,
       bots: retbots
       });
} // apicall_get_bots_in_region()


function apicall_get_bot_info(controller, bot_id)
{
let bot = null;
let bot_index = -1;

for (let i=0; i<controller.bots.length; i++)
    {
    if (String(controller.bots[i].id ?? "") === String(bot_id).trim())
       {
       bot = controller.bots[i];
       bot_index = i;
       break;
       }
    } // for

if (!bot)
   {
   return({
          ok: false,
          answer: "api_get_bot_info",
          error: "BOT_NOT_FOUND",
          bot_id: String(bot_id).trim()
          });
   } // if

let carried_payload = null;
try {
    let payload_id = controller.apicall_get_carried_payload_bot_id(bot.id);
    if (payload_id) carried_payload = String(payload_id);
    } catch(e) { /* ignore */ }

let neighbors = {};
try {
    let neigh_ret = controller.apicall_get_neighbors(bot.id);
    if (neigh_ret && neigh_ret.neighbors) neighbors = neigh_ret.neighbors;
    } catch(e) { /* ignore */ }

return({
       ok: true,
       answer: "api_get_bot_info",
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
       adress: controller.apicall_get_safe_adress(bot),
       adress_first: String(bot.adress_first ?? ""),
       adress_short: String(bot.adress_short ?? ""),
       adress_detour: String(bot.adress_detour ?? ""),
       carried_payload_bot_id: carried_payload,
       neighbors: neighbors
       });
} // apicall_get_bot_info()


function apicall_ping_position(controller, x, y, z)
{
let tx = Number(x), ty = Number(y), tz = Number(z);

let adr = controller.get_mb_returnaddr(
    {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
    {x: tx, y: ty, z: tz},
    controller.bots, [], { routing_mode: "standard" }
);

if (!adr || adr === "")
   {
   // BFS failed – try to find a known neighbor within ±1 orthogonal
   let neighbor_bot = null;
   let neighbor_slot = "";
   let neighbor_dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
   for (let d of neighbor_dirs)
       {
       let nx = tx + d[0], ny = ty + d[1], nz = tz + d[2];
       let bot = controller.bots.find(b => Number(b.x)===nx && Number(b.y)===ny && Number(b.z)===nz);
       if (!bot) continue;
       neighbor_bot = bot;
       // Slot from neighbor to target
       let slot = controller.get_cell_slot_byvector(-d[0], -d[1], -d[2],
           Number(bot.vector_x), Number(bot.vector_y), Number(bot.vector_z));
       if (slot) { neighbor_slot = slot; break; }
       }
   if (!neighbor_bot || !neighbor_slot)
      {
      return({ ok: false, answer: "api_ping_position", error: "NO_ROUTE_TO_TARGET", target: {x: tx, y: ty, z: tz} });
      } // if
   // Route to neighbor + slot to target
   let neighbor_adr = controller.get_mb_returnaddr(
       {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
       {x: Number(neighbor_bot.x), y: Number(neighbor_bot.y), z: Number(neighbor_bot.z)},
       controller.bots, [], { routing_mode: "standard" });
   if (!neighbor_adr) neighbor_adr = "";
   adr = neighbor_adr + neighbor_slot;
   } // if

controller.ping_seq = (controller.ping_seq || 0) + 1;
let tmpid = "PING" + controller.ping_seq;

// Eintrag in ping_waiting_info (wird vom RINFO-Handler befüllt)
if (!controller.ping_waiting_info) controller.ping_waiting_info = {};

// STL-ID berechnen (second-to-last bot) via get_next_target_coor
let stl_id = "";
let path_to_stl = adr.length > 1 ? adr.slice(0, -1) : "";
if (path_to_stl) {
    let cx = Number(controller.mb.x), cy = Number(controller.mb.y), cz = Number(controller.mb.z);
    for (let s = 0; s < path_to_stl.length; s++) {
        let cur = controller.bots.find(b => Number(b.x)===cx && Number(b.y)===cy && Number(b.z)===cz);
        if (!cur) break;
        let t = controller.get_next_target_coor(cx, cy, cz,
            Number(cur.vector_x), Number(cur.vector_y), Number(cur.vector_z), path_to_stl[s]);
        if (!t) break;
        cx = Number(t.x); cy = Number(t.y); cz = Number(t.z);
    }
    stl_id = controller.getKey_3d(cx, cy, cz);
}

controller.ping_waiting_info[tmpid] = {
    x: tx, y: ty, z: tz,
    addr: adr,
    status: 0,
    stl_id: stl_id,
    timestamp: Date.now()
};

// Rückadresse via get_inverse_address berechnen und senden
let firstindex = controller.getKey_3d(controller.mb.x, controller.mb.y, controller.mb.z);
let retaddr = controller.get_inverse_address(firstindex, adr);
let cmd = adr + "#INFO#" + tmpid + "#" + retaddr;
cmd = controller.sign(cmd);
let cellbot_cmd = '{ "cmd":"push", "param":"' + cmd + '" }\n';
if (controller.client && typeof controller.client.write === "function") {
    controller.client.write(cellbot_cmd);
}

return({
       ok: true,
       answer: "api_ping_position",
       target: {x: tx, y: ty, z: tz},
       tmpid: tmpid,
       adress_used: adr,
       accepted: true
       });
} // apicall_ping_position()



function apicall_ping_status(controller, tmpid)
{
if (!controller.ping_waiting_info) controller.ping_waiting_info = {};
let entry = controller.ping_waiting_info[tmpid];

if (!entry)
   {
   return({ ok: false, answer: "api_ping_status", error: "TMPID_NOT_FOUND", tmpid: tmpid });
   } // if

let bot_found = (entry.status === 1);
let timed_out = (entry.status === -1);

return({
       ok: true,
       answer: "api_ping_status",
       tmpid: tmpid,
       status: entry.status,
       bot_found: bot_found,
       timed_out: timed_out,
       target: {x: entry.x, y: entry.y, z: entry.z},
       response: bot_found ? {
                              bot_id: String(entry.botid ?? ""),
                              position: {x: Number(entry.x ?? entry.x), y: Number(entry.y ?? entry.y), z: Number(entry.z ?? entry.z)},
                              orientation: {x: Number(entry.vector_x ?? 0), y: Number(entry.vector_y ?? 0), z: Number(entry.vector_z ?? 0)}
                              } : null
       });
} // apicall_ping_status()


module.exports = {
                  apicall_get_bots,
                  apicall_get_bots_by_prefix,
                  apicall_get_bots_in_region,
                  apicall_get_bot_info,
                  apicall_ping_position,
                  apicall_ping_status,
                  apicall_get_inactive_bots,
                  apicall_get_inactive_bot_by_xyz,
                  apicall_get_neighbors
                 };
