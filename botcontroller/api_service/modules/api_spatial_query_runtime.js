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


module.exports = {
                  apicall_get_bots,
                  apicall_get_bots_by_prefix,
                  apicall_get_inactive_bots,
                  apicall_get_inactive_bot_by_xyz,
                  apicall_get_neighbors
                 };
