function apicall_get_grab_positions(controller, x, y, z)
{
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let target_occupancy = controller.apicall_is_occupied(target_x, target_y, target_z);
let candidates = [];
let feasible_candidates = 0;
const side_vectors = [
                      { side: "PX", dx:  1, dz:  0 },
                      { side: "NX", dx: -1, dz:  0 },
                      { side: "PZ", dx:  0, dz:  1 },
                      { side: "NZ", dx:  0, dz: -1 }
                      ];

if (target_occupancy.occupied !== true)
   {
   return({
          ok: false,
          answer: "api_get_grab_positions",
          error: "TARGET_NOT_OCCUPIED",
          target: {
                   x: target_x,
                   y: target_y,
                   z: target_z
                   }
          });
   } // if

for (let i=0; i<side_vectors.length; i++)
    {
    let side = side_vectors[i];
    let carrier_x = target_x - Number(side.dx);
    let carrier_y = target_y;
    let carrier_z = target_z - Number(side.dz);
    let required_orientation = {
                               x: Number(side.dx),
                               y: 0,
                               z: Number(side.dz)
                               };
    let carrier_cell_forbidden = controller.apicall_is_forbidden_cell(carrier_x, carrier_y, carrier_z);
    let carrier_cell_occupancy = controller.apicall_is_occupied(carrier_x, carrier_y, carrier_z);
    let anchor_down = controller.apicall_is_occupied(carrier_x, carrier_y - 1, carrier_z);
    let anchor_up = controller.apicall_is_occupied(carrier_x, carrier_y + 1, carrier_z);
    let anchor_ok = (anchor_down.occupied === true || anchor_up.occupied === true);
    let feasible = true;
    let blocked_reasons = [];

    if (carrier_cell_forbidden === true)
       {
       feasible = false;
       blocked_reasons.push("CARRIER_POS_FORBIDDEN");
       } // if

    if (carrier_cell_occupancy.occupied === true)
       {
       feasible = false;
       blocked_reasons.push("CARRIER_POS_OCCUPIED");
       } // if

    if (anchor_ok !== true)
       {
       feasible = false;
       blocked_reasons.push("ANCHOR_MISSING");
       } // if

    if (feasible === true)
       {
       feasible_candidates++;
       } // if

    candidates.push(
                    {
                    side: side.side,
                    carrier_pos: {
                                 x: carrier_x,
                                 y: carrier_y,
                                 z: carrier_z
                                 },
                    required_orientation: required_orientation,
                    grab_slot: "F",
                    feasible: feasible,
                    carrier_cell_forbidden: carrier_cell_forbidden,
                    carrier_cell_status: carrier_cell_occupancy,
                    anchor_ok: anchor_ok,
                    anchor_options: {
                                     down: anchor_down,
                                     up: anchor_up
                                     },
                    blocked_reasons: blocked_reasons
                    }
                    );
    } // for

return({
       ok: true,
       answer: "api_get_grab_positions",
       target: {
                position: {
                           x: target_x,
                           y: target_y,
                           z: target_z
                           },
                state: target_occupancy.state,
                id: target_occupancy.id ?? null
                },
       feasible_count: feasible_candidates,
       candidates: candidates
       });
} // apicall_get_grab_positions()


function apicall_evaluate_turn_position(controller, x, y, z, excluded_bot_ids = [])
{
let pos_x = Number(x);
let pos_y = Number(y);
let pos_z = Number(z);
let excluded_ids = Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [];
let center_status = controller.apicall_is_occupied_excluding_ids(pos_x, pos_y, pos_z, excluded_ids);
let center_forbidden = controller.apicall_is_forbidden_cell(pos_x, pos_y, pos_z);
let anchor_down = controller.apicall_is_occupied_excluding_ids(pos_x, pos_y - 1, pos_z, excluded_ids);
let anchor_up = controller.apicall_is_occupied_excluding_ids(pos_x, pos_y + 1, pos_z, excluded_ids);
let anchor_ok = (anchor_down.occupied === true || anchor_up.occupied === true);
let orthogonal = {
                 xp: { x: pos_x + 1, y: pos_y, z: pos_z },
                 xm: { x: pos_x - 1, y: pos_y, z: pos_z },
                 zp: { x: pos_x, y: pos_y, z: pos_z + 1 },
                 zm: { x: pos_x, y: pos_y, z: pos_z - 1 }
                 };
let orthogonal_keys = Object.keys(orthogonal);
let orthogonal_status = {};
let free_orthogonal_same_y_count = 0;
let blocked_orthogonal_same_y = [];

for (let i=0; i<orthogonal_keys.length; i++)
    {
    let key = orthogonal_keys[i];
    let p = orthogonal[key];
    let status = controller.apicall_is_occupied_excluding_ids(p.x, p.y, p.z, excluded_ids);
    let forbidden = controller.apicall_is_forbidden_cell(p.x, p.y, p.z);
    let free = (status.occupied !== true && forbidden !== true);

    if (free === true)
       {
       free_orthogonal_same_y_count++;
       } // if
    else
       {
       blocked_orthogonal_same_y.push({
                                      side: key.toUpperCase(),
                                      position: {
                                                 x: Number(p.x),
                                                 y: Number(p.y),
                                                 z: Number(p.z)
                                                 },
                                      forbidden: forbidden,
                                      state: status.state ?? "unknown",
                                      id: status.id ?? null
                                      });
       } // else

    orthogonal_status[key.toUpperCase()] = {
                                            position: {
                                                       x: Number(p.x),
                                                       y: Number(p.y),
                                                       z: Number(p.z)
                                                       },
                                            free: free,
                                            forbidden: forbidden,
                                            state: status.state ?? "unknown",
                                            id: status.id ?? null
                                            };
    } // for

let turnable_same_y = (free_orthogonal_same_y_count >= 4);
let turnable_strict = (turnable_same_y === true && anchor_ok === true && center_forbidden !== true);

return({
       position: {
                  x: pos_x,
                  y: pos_y,
                  z: pos_z
                  },
       center_status: center_status,
       center_forbidden: center_forbidden,
       anchor_ok: anchor_ok,
       anchor_options: {
                        down: anchor_down,
                        up: anchor_up
                        },
       free_orthogonal_same_y_count: free_orthogonal_same_y_count,
       turnable_same_y: turnable_same_y,
       turnable_strict: turnable_strict,
       orthogonal: orthogonal_status,
       blocked_orthogonal_same_y: blocked_orthogonal_same_y
       });
} // apicall_evaluate_turn_position()


function apicall_get_turn_positions(controller, x, y, z, radius = 1, excluded_bot_ids = [])
{
let center_x = Number(x);
let center_y = Number(y);
let center_z = Number(z);
let r = Number(radius);
let candidates = [];
let turnable_same_y_count = 0;
let turnable_strict_count = 0;

if (
    Number.isNaN(center_x) ||
    Number.isNaN(center_y) ||
    Number.isNaN(center_z) ||
    Number.isNaN(r)
   )
   {
   return({
          ok: false,
          answer: "api_get_turn_positions",
          error: "INVALID_INPUT"
          });
   } // if

r = Math.max(0, Math.min(6, Math.floor(r)));

for (let dx = -r; dx <= r; dx++)
    {
    for (let dy = -r; dy <= r; dy++)
        {
        for (let dz = -r; dz <= r; dz++)
            {
            let eval_ret = controller.apicall_evaluate_turn_position(
                                                                      center_x + dx,
                                                                      center_y + dy,
                                                                      center_z + dz,
                                                                      excluded_bot_ids
                                                                      );

            if (eval_ret.turnable_same_y === true)
               {
               turnable_same_y_count++;
               } // if

            if (eval_ret.turnable_strict === true)
               {
               turnable_strict_count++;
               } // if

            candidates.push(eval_ret);
            } // for
        } // for
    } // for

return({
       ok: true,
       answer: "api_get_turn_positions",
       center: {
                x: center_x,
                y: center_y,
                z: center_z
                },
       radius: r,
       count: candidates.length,
       turnable_same_y_count: turnable_same_y_count,
       turnable_strict_count: turnable_strict_count,
       candidates: candidates
       });
} // apicall_get_turn_positions()


function apicall_is_occupied(controller, x, y, z)
{
let target_bot_index = controller.get_3d(x, y, z);
// Fallback: if get_3d finds nothing, search directly in this.bots by position
if (target_bot_index == null && Array.isArray(controller.bots)) {
    for (let i = 0; i < controller.bots.length; i++) {
        if (controller.bots[i] &&
            Number(controller.bots[i].x) === Number(x) &&
            Number(controller.bots[i].y) === Number(y) &&
            Number(controller.bots[i].z) === Number(z)) {
            target_bot_index = i;
            break;
        }
    }
}
let inactive_bot = controller.apicall_get_inactive_bot_by_xyz(x, y, z);

if (target_bot_index != null)
   {
   return({
          ok: true,
          answer: "api_is_occupied",
          position: {
                     x: Number(x),
                     y: Number(y),
                     z: Number(z)
                     },
          occupied: true,
          state: "active",
          id: controller.bots[target_bot_index].id,
          orientation: {
                        x: Number(controller.bots[target_bot_index].vector_x),
                        y: Number(controller.bots[target_bot_index].vector_y),
                        z: Number(controller.bots[target_bot_index].vector_z)
                        },
          adress: controller.apicall_get_safe_adress(controller.bots[target_bot_index])
          });
   } // if

if (inactive_bot != null)
   {
   return({
          ok: true,
          answer: "api_is_occupied",
          position: {
                     x: Number(x),
                     y: Number(y),
                     z: Number(z)
                     },
          occupied: true,
          state: "inactive",
          id: inactive_bot.id,
          color: inactive_bot.col,
          source_bot_id: inactive_bot.source_bot_id,
          source_slot: inactive_bot.source_slot
          });
   } // if

return({
       ok: true,
       answer: "api_is_occupied",
       position: {
                  x: Number(x),
                  y: Number(y),
                  z: Number(z)
                  },
       occupied: false,
       state: "empty"
       });
} // apicall_is_occupied()


function apicall_is_occupied_excluding_ids(controller, x, y, z, excluded_bot_ids = [])
{
let normalized_excluded_ids = new Set(
                                      (Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [])
                                      .map((id) => String(id ?? "").trim())
                                      .filter((id) => id != "")
                                      );
let occupancy = controller.apicall_is_occupied(x, y, z);

if (occupancy.occupied !== true)
   {
   return(occupancy);
   } // if

if (normalized_excluded_ids.has(String(occupancy.id ?? "")))
   {
   return({
          ok: true,
          answer: "api_is_occupied",
          position: {
                     x: Number(x),
                     y: Number(y),
                     z: Number(z)
                     },
          occupied: false,
          state: "excluded",
          excluded_id: occupancy.id
          });
   } // if

return(occupancy);
} // apicall_is_occupied_excluding_ids()


function apicall_get_slot_status(controller, bot_id, slot)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);
let normalized_slot = String(slot ?? "").trim().toUpperCase();
const valid_slots = ['F','R','B','L','T','D'];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_get_slot_status",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if (!valid_slots.includes(normalized_slot))
   {
   return({
          ok: false,
          answer: "api_get_slot_status",
          error: "INVALID_SLOT",
          bot_id: bot_id,
          slot: normalized_slot
          });
   } // if

let target_xyz = controller.get_next_target_coor(
                                                  controller.bots[botindex].x,
                                                  controller.bots[botindex].y,
                                                  controller.bots[botindex].z,
                                                  controller.bots[botindex].vector_x,
                                                  controller.bots[botindex].vector_y,
                                                  controller.bots[botindex].vector_z,
                                                  normalized_slot
                                                  );

let occupancy = controller.apicall_is_occupied(target_xyz.x, target_xyz.y, target_xyz.z);

return({
       ok: true,
       answer: "api_get_slot_status",
       bot_id: bot_id,
       slot: normalized_slot,
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
       target: occupancy
       });
} // apicall_get_slot_status()


module.exports = {
                  apicall_get_grab_positions,
                  apicall_evaluate_turn_position,
                  apicall_get_turn_positions,
                  apicall_is_occupied,
                  apicall_is_occupied_excluding_ids,
                  apicall_get_slot_status
                 };
