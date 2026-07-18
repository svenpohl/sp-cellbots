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

// Masterbot-Rolle bestimmen
const mbRole = Number(bot.masterbot ?? 0);
const masterbotStr = mbRole === 0 ? "no" : (mbRole === 1 ? "MasterBot" : "helperMasterbot");

// Determine connector from ADC (two ways):
// 1. Bot is itself an hMB → connector from helper_masterbots
// 2. Bot is assigned to an hMB → connector from botMap
let connectorId = "";
if (controller.accessDomainController) {
    // Check if the bot itself is a MasterBot (for MB/hMB1/hMB2)
    if (controller.accessDomainController.helper_masterbots) {
        let hmb = controller.accessDomainController.helper_masterbots[String(bot.id).trim()];
        if (hmb && hmb.type === "masterbot" && hmb.connector_id) {
            connectorId = hmb.connector_id;
        }
    }
    // Check if the bot is assigned to an hMB (for assigned bots like SB1)
    if (!connectorId && controller.accessDomainController.botMap) {
        let assignment = controller.accessDomainController.botMap[String(bot.id).trim()];
        if (assignment && assignment.connector_id) {
            connectorId = assignment.connector_id;
        }
    }
}

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
       neighbors: neighbors,
       masterbot: masterbotStr,
       connector: connectorId,
       inactive: (bot.inactive === true || bot.inactive === 'true' || bot.inactive == 1) ? true :
                 (Array.isArray(controller.detected_inactive_bots) ? controller.detected_inactive_bots.some(d =>
                     Number(d.x) === Number(bot.x) && Number(d.y) === Number(bot.y) && Number(d.z) === Number(bot.z)
                 ) : false),
       type: Number(bot.type ?? 0),
       mobility: (bot.mobility === false || bot.mobility === 'false' || bot.mobility == 0) ? false : true,
       resilience_scores: controller.resilienceController
           ? controller.resilienceController.get_bot_scores(bot.id)
           : {}
       });
} // apicall_get_bot_info()


function apicall_ping_position(controller, x, y, z)
{
let tx = Number(x), ty = Number(y), tz = Number(z);

// ADC-aware origin: find bot at target position and use its assigned hMB
let originPos = { x: Number(controller.mb.x), y: Number(controller.mb.y), z: Number(controller.mb.z) };
let targetBot = controller.bots.find(b =>
    Number(b.x) === tx && Number(b.y) === ty && Number(b.z) === tz
);
if (targetBot && typeof controller.apicall_get_bot_origin === "function") {
    let botOrigin = controller.apicall_get_bot_origin(String(targetBot.id ?? "").trim());
    if (botOrigin) {
        let bx = Number(botOrigin.x), by = Number(botOrigin.y), bz = Number(botOrigin.z);
        if (bx !== 0 || by !== 0 || bz !== 0) {
            originPos = { x: bx, y: by, z: bz };
        }
    }
} else if (!targetBot && controller.accessDomainController && controller.accessDomainController.helper_masterbots) {
    // Bot not in world model – find nearest hMB by Manhattan distance
    let bestDist = Infinity;
    let bestHmb = null;
    for (let mid in controller.accessDomainController.helper_masterbots) {
        let mb = controller.accessDomainController.helper_masterbots[mid];
        if (mb.type !== "masterbot" || mb.active === false) continue;
        let dist = Math.abs(Number(mb.pos.x) - tx) + Math.abs(Number(mb.pos.y) - ty) + Math.abs(Number(mb.pos.z) - tz);
        if (dist < bestDist) {
            bestDist = dist;
            bestHmb = mb;
        }
    }
    if (bestHmb) {
        originPos = { x: Number(bestHmb.pos.x), y: Number(bestHmb.pos.y), z: Number(bestHmb.pos.z) };
    }
}

let adr = controller.get_mb_returnaddr(
    originPos,
    {x: tx, y: ty, z: tz},
    controller.bots, [], { routing_mode: "standard", exclude_masterbots: true }
);

if (!adr || adr === "")
   {
   // BFS failed – find nearest known bot (Manhattan distance) and use its address
   let neighbor_bot = null;
   let neighbor_slot = "";
   let neighbor_dist = Infinity;
   for (let bi = 0; bi < controller.bots.length; bi++) {
       let b = controller.bots[bi];
       if (!b) continue;
       if (b.masterbot > 0) continue; // Skip MBs/hMBs
       let dx = tx - Number(b.x), dy = ty - Number(b.y), dz = tz - Number(b.z);
       let dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
       if (dist === 0) continue; // Skip target position itself
       if (dist < neighbor_dist) {
           // Check if direction maps to a valid slot
           let slot = controller.get_cell_slot_byvector(dx, dy, dz,
               Number(b.vector_x), Number(b.vector_y), Number(b.vector_z));
           if (slot) {
               neighbor_dist = dist;
               neighbor_bot = b;
               neighbor_slot = slot;
           }
       }
   }
   if (!neighbor_bot || !neighbor_slot)
      {
      return({ ok: false, answer: "api_ping_position", error: "NO_ROUTE_TO_TARGET", target: {x: tx, y: ty, z: tz} });
      } // if
   // Use neighbor's ACTUAL address + slot (like structurescan does with this.bots[i].adress + cmd_slot)
   let neighborAdr = String(neighbor_bot.adress ?? "").trim();
   if (!neighborAdr) neighborAdr = "";
   adr = neighborAdr + neighbor_slot;
   } // if

controller.ping_seq = (controller.ping_seq || 0) + 1;
let tmpid = "PING" + controller.ping_seq;

// Entry in ping_waiting_info (filled by RINFO handler)
if (!controller.ping_waiting_info) controller.ping_waiting_info = {};

// Calculate STL-ID (second-to-last bot) via get_next_target_coor
let stl_id = "MB";
if (adr.length > 1) {
    let path_to_stl = adr.slice(0, -1);
    let cx = Number(originPos.x), cy = Number(originPos.y), cz = Number(originPos.z);
    for (let s = 0; s < path_to_stl.length; s++) {
        let cur = controller.bots.find(b => Number(b.x)===cx && Number(b.y)===cy && Number(b.z)===cz);
        if (!cur) break;
        let t = controller.get_next_target_coor(cx, cy, cz,
            Number(cur.vector_x), Number(cur.vector_y), Number(cur.vector_z), path_to_stl[s]);
        if (!t) break;
        cx = Number(t.x); cy = Number(t.y); cz = Number(t.z);
    }
    stl_id = controller.getKey_3d(cx, cy, cz);
} else if (Number(originPos.x) !== Number(controller.mb.x) ||
           Number(originPos.y) !== Number(controller.mb.y) ||
           Number(originPos.z) !== Number(controller.mb.z)) {
    // Single-hop ping from hMB → use hMB position as STL
    stl_id = controller.getKey_3d(Number(originPos.x), Number(originPos.y), Number(originPos.z));
}

controller.ping_waiting_info[tmpid] = {
    x: tx, y: ty, z: tz,
    addr: adr,
    status: 0,
    stl_id: stl_id,
    timestamp: Date.now()
};

// Calculate and send return address via get_inverse_address
let firstindex = controller.getKey_3d(Number(originPos.x), Number(originPos.y), Number(originPos.z));
let retaddr = controller.get_inverse_address(firstindex, adr);
let cmd = adr + "#INFO#" + tmpid + "#" + retaddr;
cmd = controller.sign(cmd);

// ADC-aware send: nutze den Connector des Zielbots (falls vorhanden)
let pingConnector = "";
if (targetBot && controller.accessDomainController) {
    let connInfo = controller.accessDomainController.adc_getConnectorForBot(String(targetBot.id ?? "").trim());
    if (connInfo) {
        pingConnector = connInfo.connector_id;
    }
}
// Fallback: ohne targetBot – nutze Connector des hMB, das originPos entspricht
if (!pingConnector && controller.accessDomainController && controller.accessDomainController.helper_masterbots) {
    for (let mid in controller.accessDomainController.helper_masterbots) {
        let mb = controller.accessDomainController.helper_masterbots[mid];
        if (mb.type === "masterbot" && mb.active !== false &&
            Number(mb.pos.x) === Number(originPos.x) &&
            Number(mb.pos.y) === Number(originPos.y) &&
            Number(mb.pos.z) === Number(originPos.z)) {
            pingConnector = mb.connector_id;
            break;
        }
    }
}

if (pingConnector && controller.accessDomainController && typeof controller.accessDomainController.adc_sendPush === "function") {
    // Senden via ADC (hMB) – korrekter Startpunkt
    controller.accessDomainController.adc_sendPush(pingConnector, cmd);
    // ADC-Queue leeren (RINFO kommt über hMB)
    if (typeof controller.accessDomainController.adc_popAll === "function") {
        controller.accessDomainController.adc_popAll();
    }
} else if (controller.client && typeof controller.client.write === "function") {
    // Fallback: Legacy-MB
    let cellbot_cmd = '{ "cmd":"push", "param":"' + cmd + '" }\n';
    controller.client.write(cellbot_cmd);
    let cmd_pop = '{ "cmd":"pop", "param":"" }\n';
    controller.client.write(cmd_pop);
    // Auch ADC-Queue leeren – RINFO könnte über hMB kommen
    if (controller.accessDomainController && typeof controller.accessDomainController.adc_popAll === "function") {
        controller.accessDomainController.adc_popAll();
    }
}

const Logger = require('../../logger');
Logger.log("Ping sent to (" + tx + "," + ty + "," + tz + ") adr='" + adr + "' tmpid=" + tmpid + " connector=" + (pingConnector || "legacy"));
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
// ADC-Queue leeren, damit ggf. noch ausstehende RINFOs ankommen
if (controller.accessDomainController && typeof controller.accessDomainController.adc_popAll === "function") {
    controller.accessDomainController.adc_popAll();
}
// Auch Legacy-Queue poppen, um handle_answer zu triggern
if (controller.client && typeof controller.client.write === "function") {
    controller.client.write('{ "cmd":"pop", "param":"" }\n');
}
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
       rtt_ms: bot_found ? (Number(entry.responded_at ?? entry.timestamp ?? Date.now()) - Number(entry.timestamp ?? Date.now())) : null,
       target: {x: entry.x, y: entry.y, z: entry.z},
       response: bot_found ? {
                              bot_id: String(entry.botid ?? ""),
                              position: {x: Number(entry.x ?? entry.x), y: Number(entry.y ?? entry.y), z: Number(entry.z ?? entry.z)},
                              orientation: {x: Number(entry.vector_x ?? 0), y: Number(entry.vector_y ?? 0), z: Number(entry.vector_z ?? 0)}
                              } : null
       });
} // apicall_ping_status()


//
// apicall_build_address()
//
function apicall_build_address(controller, x1, y1, z1, x2, y2, z2)
{
let adr = controller.get_mb_returnaddr(
    {x: Number(x1), y: Number(y1), z: Number(z1)},
    {x: Number(x2), y: Number(y2), z: Number(z2)},
    controller.bots, [], { routing_mode: "standard", exclude_masterbots: true }
);

if (!adr || adr === "")
   {
   return({
          ok: true,
          answer: "api_build_address",
          from: {x: Number(x1), y: Number(y1), z: Number(z1)},
          to: {x: Number(x2), y: Number(y2), z: Number(z2)},
          found: false,
          adress: "",
          hops: 0
          });
   } // if

return({
       ok: true,
       answer: "api_build_address",
       from: {x: Number(x1), y: Number(y1), z: Number(z1)},
       to: {x: Number(x2), y: Number(y2), z: Number(z2)},
       found: true,
       adress: adr,
       hops: adr.length
       });
} // apicall_build_address()


module.exports = {
                  apicall_get_bots,
                  apicall_get_bots_by_prefix,
                  apicall_get_bots_in_region,
                  apicall_get_bot_info,
                  apicall_ping_position,
                  apicall_ping_status,
                  apicall_build_address,
                  apicall_get_inactive_bots,
                  apicall_get_inactive_bot_by_xyz,
                  apicall_get_neighbors
                 };
