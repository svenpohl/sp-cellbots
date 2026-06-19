const { calc_vehicle_kinematics_path } = require('./api_vehicle_kinematics_path_runtime');
const { calc_vehicle_kinematics_payload_path } = require('./api_vehicle_kinematics_payload_path_runtime');
const { calc_hybrid_kinematics_path } = require('./api_hybrid_kinematics_path_runtime');


function apicall_create_sparse_grid(controller)
{
const store = new Map();

return({
       set(x, y, z, value = 1) {
         store.set(`${x},${y},${z}`, value);
         return(true);
       }, // set()
       get(x, y, z) {
         const key = `${x},${y},${z}`;
         return store.has(key) ? store.get(key) : null;
       }, // get()
       keys() {
         return Array.from(store.keys());
       } // keys()
       });
} // apicall_create_sparse_grid()


function apicall_build_structure_grid_without_bot(controller, bot_id, excluded_bot_ids = [])
{
let grid = apicall_create_sparse_grid(controller);
let excluded_ids = new Set(
                          (Array.isArray(excluded_bot_ids) ? excluded_bot_ids : [])
                          .map((id) => String(id ?? "").trim())
                          .filter((id) => id != "")
                          );

for (let i=0; i<controller.bots.length; i++)
    {
    if (controller.bots[i].id == "masterbot") continue;
    if (controller.bots[i].id == bot_id) continue;
    if (excluded_ids.has(String(controller.bots[i].id ?? ""))) continue;

    grid.set(
             Number(controller.bots[i].x),
             Number(controller.bots[i].y),
             Number(controller.bots[i].z),
             controller.bots[i].id
             );
    } // for

return(grid);
} // apicall_build_structure_grid_without_bot()


function apicall_would_split_cluster(controller, bot_id)
{
let normalized_bot_id = String(bot_id ?? "").trim();

if (normalized_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "BOT_ID_MISSING"
          });
   } // if

if (normalized_bot_id == "masterbot")
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "MASTERBOT_REMOVAL_UNSUPPORTED"
          });
   } // if

let target_index = controller.get_bot_by_id(normalized_bot_id, controller.bots);

if (target_index === null)
   {
   return({
          ok: false,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          error: "BOT_NOT_FOUND"
          });
   } // if

let remaining_bots = [];
let position_map = {};
let root_bot = null;

for (let i=0; i<controller.bots.length; i++)
    {
    let bot = controller.bots[i];

    if (!bot)
       {
       continue;
       } // if

    if (bot.id == normalized_bot_id)
       {
       continue;
       } // if

    remaining_bots.push(bot);
    position_map[`${Number(bot.x)},${Number(bot.y)},${Number(bot.z)}`] = bot;

    // ADC: Wurzel ist der primary MB (masterbot == 1), nicht der legacy "masterbot"
    if ((bot.masterbot ?? 0) == 1)
       {
       root_bot = bot;
       } // if
    } // for

if (remaining_bots.length == 0)
   {
   return({
          ok: true,
          answer: "api_would_split_cluster",
          bot_id: normalized_bot_id,
          removed_bot: controller.apicall_get_bot_snapshot(normalized_bot_id),
          root_bot_id: "masterbot",
          would_split_cluster: false,
          remains_connected: true,
          visited_count: 0,
          remaining_count: 0,
          disconnected_count: 0,
          disconnected_bots: []
          });
   } // if

if (root_bot === null)
   {
   // Fallback: ersten verbleibenden Bot als Wurzel verwenden
   if (remaining_bots.length > 0)
      {
      root_bot = remaining_bots[0];
      console.log("[SPLIT] No primary MB found – using bot '" + root_bot.id + "' as root fallback.");
      } else
        {
        return({
               ok: false,
               answer: "api_would_split_cluster",
               bot_id: normalized_bot_id,
               error: "NO_BOTS_REMAINING"
               });
        }
   } // if

const key_for_bot = (bot) => `${Number(bot.x)},${Number(bot.y)},${Number(bot.z)}`;
const neighbor_offsets = [
                          { x: 1, y: 0, z: 0 },
                          { x: -1, y: 0, z: 0 },
                          { x: 0, y: 1, z: 0 },
                          { x: 0, y: -1, z: 0 },
                          { x: 0, y: 0, z: 1 },
                          { x: 0, y: 0, z: -1 }
                          ];

let visited = new Set();
let queue = [root_bot];
visited.add(key_for_bot(root_bot));

while (queue.length > 0)
      {
      let current = queue.shift();

      for (let i=0; i<neighbor_offsets.length; i++)
          {
          let offset = neighbor_offsets[i];
          let neighbor_key = `${Number(current.x) + offset.x},${Number(current.y) + offset.y},${Number(current.z) + offset.z}`;

          if (visited.has(neighbor_key))
             {
             continue;
             } // if

          if (!position_map[neighbor_key])
             {
             continue;
             } // if

          visited.add(neighbor_key);
          queue.push(position_map[neighbor_key]);
          } // for
      } // while

let disconnected_bots = [];

for (let i=0; i<remaining_bots.length; i++)
    {
    let bot = remaining_bots[i];
    let bot_key = key_for_bot(bot);

    if (!visited.has(bot_key))
       {
       disconnected_bots.push({
                              id: bot.id,
                              x: bot.x,
                              y: bot.y,
                              z: bot.z,
                              adress: controller.apicall_get_safe_adress(bot),
                              masterbot: bot.masterbot ?? 0
                              });
       } // if
    } // for

// ADC: Check if an MB/hMB would be disconnected
let disconnected_mbs = disconnected_bots.filter(b => (b.masterbot ?? 0) > 0);
if (disconnected_mbs.length > 0)
   {
   let mb_list = disconnected_mbs.map(b => b.id + "@(" + b.x + "," + b.y + "," + b.z + ")").join(", ");
   console.log("[SPLIT] WARNING: " + disconnected_mbs.length + " MB(s) would be disconnected: " + mb_list);
   }

let would_split_cluster = (disconnected_bots.length > 0);

return({
       ok: true,
       answer: "api_would_split_cluster",
       bot_id: normalized_bot_id,
       removed_bot: controller.apicall_get_bot_snapshot(normalized_bot_id),
       root_bot_id: root_bot.id,
       would_split_cluster: would_split_cluster,
       remains_connected: !would_split_cluster,
       visited_count: visited.size,
       remaining_count: remaining_bots.length,
       disconnected_count: disconnected_bots.length,
       disconnected_bots: disconnected_bots
       });
} // apicall_would_split_cluster()


function apicall_build_forbidden_grid(controller)
{
let grid = apicall_create_sparse_grid(controller);
let role_forbidden = controller.apicall_get_structure_role_list("forbidden");

for (let i=0; i<controller.detected_inactive_bots.length; i++)
    {
    grid.set(
             Number(controller.detected_inactive_bots[i].x),
             Number(controller.detected_inactive_bots[i].y),
             Number(controller.detected_inactive_bots[i].z),
             controller.detected_inactive_bots[i].id
             );
    } // for

for (let i=0; i<role_forbidden.length; i++)
    {
    grid.set(
             Number(role_forbidden[i].x),
             Number(role_forbidden[i].y),
             Number(role_forbidden[i].z),
             "forbidden"
             );
    } // for

return(grid);
} // apicall_build_forbidden_grid()


function apicall_is_forbidden_cell(controller, x, y, z, forbidden_grid = null)
{
let grid = forbidden_grid ?? apicall_build_forbidden_grid(controller);

if (!grid)
   {
   return(false);
   } // if

return(grid.get(Number(x), Number(y), Number(z)) !== null);
} // apicall_is_forbidden_cell()


function apicall_get_wrapped_cell_for_double_step(controller, from_pos, to_pos)
{
if (!from_pos || !to_pos)
   {
   return(null);
   } // if

let dx = Number(to_pos.x) - Number(from_pos.x);
let dy = Number(to_pos.y) - Number(from_pos.y);
let dz = Number(to_pos.z) - Number(from_pos.z);
let non_zero_axes = 0;

if (dx !== 0) non_zero_axes++;
if (dy !== 0) non_zero_axes++;
if (dz !== 0) non_zero_axes++;

if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 2)
   {
   return(null);
   } // if

if (non_zero_axes !== 2)
   {
   return(null);
   } // if

if (dy === 0)
   {
   return(null);
   } // if

return({
       x: Number(from_pos.x) + Number(dx),
       y: Number(from_pos.y),
       z: Number(from_pos.z) + Number(dz)
       });
} // apicall_get_wrapped_cell_for_double_step()


function apicall_is_valid_wrapped_double_step(controller, from_pos, to_pos, bots_s)
{
if (!bots_s)
   {
   return(false);
   } // if

let wrapped_cell = apicall_get_wrapped_cell_for_double_step(controller, from_pos, to_pos);

if (!wrapped_cell)
   {
   return(false);
   } // if

return(
       bots_s.get(
                  Number(wrapped_cell.x),
                  Number(wrapped_cell.y),
                  Number(wrapped_cell.z)
                  ) !== null
       );
} // apicall_is_valid_wrapped_double_step()


function apicall_calc_single_path(controller, src, dest, bots_s, bots_f)
{
const key = (x, y, z) => `${x},${y},${z}`;
const visited = new Set();
const parent = new Map();
const queue = [];
let debug_rejections = [];

const is_structure = (x, y, z) => {
  return bots_s.get(Number(x), Number(y), Number(z)) !== null;
}; // is_structure()

const is_forbidden = (x, y, z) => {
  if (!bots_f) return(false);
  return bots_f.get(Number(x), Number(y), Number(z)) !== null;
}; // is_forbidden()

const is_empty = (x, y, z) => {
  return(!is_structure(x, y, z) && !is_forbidden(x, y, z));
}; // is_empty()

const has_contact = (x, y, z) => {
  const neighbors6 = [
                     { dx:  1, dy:  0, dz:  0 },
                     { dx: -1, dy:  0, dz:  0 },
                     { dx:  0, dy:  1, dz:  0 },
                     { dx:  0, dy: -1, dz:  0 },
                     { dx:  0, dy:  0, dz:  1 },
                     { dx:  0, dy:  0, dz: -1 }
                     ];

  for (let i = 0; i < neighbors6.length; i++)
      {
      const n = neighbors6[i];
      if (is_structure(Number(x) + Number(n.dx), Number(y) + Number(n.dy), Number(z) + Number(n.dz)))
         {
         return(true);
         } // if
      } // for

  return(false);
}; // has_contact()

const has_axis_lateral_anchor = (target_x, target_y, target_z, axis) => {
  if (axis === "x")
     {
     return(
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "y")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "z")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z)
            );
     } // if

  return(false);
}; // has_axis_lateral_anchor()

const movement_rules = [
  {
    name: "G_F",
    final: { dx:  1, dy:  0, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x")
  },
  {
    name: "G_B",
    final: { dx: -1, dy:  0, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x")
  },
  {
    name: "G_R",
    final: { dx:  0, dy:  0, dz: -1 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z")
  },
  {
    name: "G_L",
    final: { dx:  0, dy:  0, dz:  1 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z")
  },
  {
    name: "G_T",
    final: { dx:  0, dy:  1, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y")
  },
  {
    name: "G_D",
    final: { dx:  0, dy: -1, dz:  0 },
    intermediate: null,
    anchor: null,
    validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y")
  },
  {
    name: "K_TF",
    final: { dx:  1, dy:  1, dz:  0 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx:  1, dy:  0, dz:  0 }
  },
  {
    name: "K_TB",
    final: { dx: -1, dy:  1, dz:  0 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx: -1, dy:  0, dz:  0 }
  },
  {
    name: "K_DF",
    final: { dx:  1, dy: -1, dz:  0 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx:  1, dy:  0, dz:  0 }
  },
  {
    name: "K_DB",
    final: { dx: -1, dy: -1, dz:  0 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx: -1, dy:  0, dz:  0 }
  },
  {
    name: "K_TR",
    final: { dx:  0, dy:  1, dz: -1 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz: -1 }
  },
  {
    name: "K_TL",
    final: { dx:  0, dy:  1, dz:  1 },
    intermediate: { dx:  0, dy:  1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz:  1 }
  },
  {
    name: "K_DR",
    final: { dx:  0, dy: -1, dz: -1 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz: -1 }
  },
  {
    name: "K_DL",
    final: { dx:  0, dy: -1, dz:  1 },
    intermediate: { dx:  0, dy: -1, dz:  0 },
    anchor: { dx:  0, dy:  0, dz:  1 }
  },
  {
    name: "K_FT",
    final: { dx:  1, dy:  1, dz:  0 },
    intermediate: { dx:  1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_FD",
    final: { dx:  1, dy: -1, dz:  0 },
    intermediate: { dx:  1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  },
  {
    name: "K_BT",
    final: { dx: -1, dy:  1, dz:  0 },
    intermediate: { dx: -1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_BD",
    final: { dx: -1, dy: -1, dz:  0 },
    intermediate: { dx: -1, dy:  0, dz:  0 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  },
  {
    name: "K_LT",
    final: { dx:  0, dy:  1, dz:  1 },
    intermediate: { dx:  0, dy:  0, dz:  1 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_LD",
    final: { dx:  0, dy: -1, dz:  1 },
    intermediate: { dx:  0, dy:  0, dz:  1 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  },
  {
    name: "K_RT",
    final: { dx:  0, dy:  1, dz: -1 },
    intermediate: { dx:  0, dy:  0, dz: -1 },
    anchor: { dx:  0, dy:  1, dz:  0 }
  },
  {
    name: "K_RD",
    final: { dx:  0, dy: -1, dz: -1 },
    intermediate: { dx:  0, dy:  0, dz: -1 },
    anchor: { dx:  0, dy: -1, dz:  0 }
  }
]; // movement_rules

const getAllowedMoves3D = (startX, startY, startZ) => {
  const allowed = [];

  for (let i = 0; i < movement_rules.length; i++)
      {
      const rule = movement_rules[i];
      const final_x = Number(startX) + Number(rule.final.dx);
      const final_y = Number(startY) + Number(rule.final.dy);
      const final_z = Number(startZ) + Number(rule.final.dz);
      let rejection_reason = null;

      if (!is_empty(final_x, final_y, final_z))
         {
         rejection_reason = (is_forbidden(final_x, final_y, final_z) ? "TARGET_IS_FORBIDDEN" : "TARGET_NOT_EMPTY");
         } // if
      else if (!has_contact(final_x, final_y, final_z))
         {
         rejection_reason = "NO_SURFACE_CONTACT";
         } // else if

      if (!rejection_reason && rule.anchor)
         {
         const anchor_x = Number(startX) + Number(rule.anchor.dx);
         const anchor_y = Number(startY) + Number(rule.anchor.dy);
         const anchor_z = Number(startZ) + Number(rule.anchor.dz);

         if (!is_structure(anchor_x, anchor_y, anchor_z))
            {
            rejection_reason = "RULE_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate)
         {
         const intermediate_x = Number(startX) + Number(rule.intermediate.dx);
         const intermediate_y = Number(startY) + Number(rule.intermediate.dy);
         const intermediate_z = Number(startZ) + Number(rule.intermediate.dz);

         if (!is_empty(intermediate_x, intermediate_y, intermediate_z))
            {
            rejection_reason = (is_forbidden(intermediate_x, intermediate_y, intermediate_z) ? "INTERMEDIATE_IS_FORBIDDEN" : "INTERMEDIATE_NOT_EMPTY");
            } // if
         } // if

      if (!rejection_reason && typeof rule.validator == "function")
         {
         if (rule.validator(final_x, final_y, final_z) !== true)
            {
            rejection_reason = "AXIS_LATERAL_ANCHOR_MISSING";
            } // if
         } // if

      // For regular bot moves a valid rule anchor is sufficient; an additional wrapped cell constraint
      // would artificially block valid steps like T_RT_L.

      if (rejection_reason)
         {
         debug_rejections.push({
                                stage: "path_rule",
                                rule: rule.name,
                                from: {
                                       x: Number(startX),
                                       y: Number(startY),
                                       z: Number(startZ)
                                       },
                                to: {
                                     x: Number(final_x),
                                     y: Number(final_y),
                                     z: Number(final_z)
                                     },
                                reason: rejection_reason
                                });
         continue;
         } // if

      let path = [];

      if (rule.intermediate)
         {
         path.push([
                    Number(startX) + Number(rule.intermediate.dx),
                    Number(startY) + Number(rule.intermediate.dy),
                    Number(startZ) + Number(rule.intermediate.dz)
                    ]);
         } // if

      path.push([final_x, final_y, final_z]);

      allowed.push({
                    typ: rule.name,
                    path: path
                    });
      } // for

  return(allowed);
}; // getAllowedMoves3D()

if (!has_contact(src.x, src.y, src.z) || !is_empty(src.x, src.y, src.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!has_contact(dest.x, dest.y, dest.z) || !is_empty(dest.x, dest.y, dest.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

queue.push({
           x: Number(src.x),
           y: Number(src.y),
           z: Number(src.z),
           path: [[Number(src.x), Number(src.y), Number(src.z)]]
           });
visited.add(key(src.x, src.y, src.z));

while (queue.length > 0)
      {
      const current = queue.shift();

      if (
          Number(current.x) === Number(dest.x) &&
          Number(current.y) === Number(dest.y) &&
         Number(current.z) === Number(dest.z)
         )
         {
         return({
                path: current.path.map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                debug_rejections: debug_rejections
                });
         } // if

      const allowed = getAllowedMoves3D(current.x, current.y, current.z);

      for (let i = 0; i < allowed.length; i++)
          {
          const move = allowed[i];
          if (!move.path || move.path.length === 0) continue;

          const coords = move.path;
          let partial_coords = [];

          for (let c = 0; c < coords.length; c++)
              {
              const [coordX, coordY, coordZ] = coords[c];
              partial_coords.push([Number(coordX), Number(coordY), Number(coordZ)]);

              if (
                  Number(coordX) === Number(dest.x) &&
                  Number(coordY) === Number(dest.y) &&
                 Number(coordZ) === Number(dest.z)
                 )
                 {
                 return({
                        path: [
                              ...current.path,
                              ...partial_coords
                              ].map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                        debug_rejections: debug_rejections
                        });
                 } // if
              } // for

          const [lastX, lastY, lastZ] = coords[coords.length - 1];
          const k = key(lastX, lastY, lastZ);

          if (visited.has(k)) continue;

          visited.add(k);
          parent.set(k, key(current.x, current.y, current.z));

          queue.push({
                     x: Number(lastX),
                     y: Number(lastY),
                     z: Number(lastZ),
                     path: [
                           ...current.path,
                           ...coords.map(([x, y, z]) => [Number(x), Number(y), Number(z)])
                           ]
                     });
          } // for
      } // while

return({
       path: null,
       debug_rejections: debug_rejections
       });
} // apicall_calc_single_path()


function apicall_calc_single_path_payload(controller, src, dest, bots_s, bots_f, payload_options = {})
{
const key = (x, y, z) => `${x},${y},${z}`;
const visited = new Set();
const queue = [];
let debug_rejections = [];
const carrier_orientation = {
                            x: Number(payload_options?.orientation?.x ?? 0),
                            y: Number(payload_options?.orientation?.y ?? 0),
                            z: Number(payload_options?.orientation?.z ?? 0)
                            };

const is_structure = (x, y, z) => {
  return bots_s.get(Number(x), Number(y), Number(z)) !== null;
}; // is_structure()

const is_forbidden = (x, y, z) => {
  if (!bots_f) return(false);
  return bots_f.get(Number(x), Number(y), Number(z)) !== null;
}; // is_forbidden()

const is_empty = (x, y, z) => {
  return(!is_structure(x, y, z) && !is_forbidden(x, y, z));
}; // is_empty()

const has_contact = (x, y, z) => {
  const neighbors6 = [
                     { dx:  1, dy:  0, dz:  0 },
                     { dx: -1, dy:  0, dz:  0 },
                     { dx:  0, dy:  1, dz:  0 },
                     { dx:  0, dy: -1, dz:  0 },
                     { dx:  0, dy:  0, dz:  1 },
                     { dx:  0, dy:  0, dz: -1 }
                     ];

  for (let i = 0; i < neighbors6.length; i++)
      {
      const n = neighbors6[i];
      if (is_structure(Number(x) + Number(n.dx), Number(y) + Number(n.dy), Number(z) + Number(n.dz)))
         {
         return(true);
         } // if
      } // for

  return(false);
}; // has_contact()

const has_axis_lateral_anchor = (target_x, target_y, target_z, axis) => {
  if (axis === "x")
     {
     return(
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "y")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y, target_z + 1) ||
            is_structure(target_x, target_y, target_z - 1)
            );
     } // if

  if (axis === "z")
     {
     return(
            is_structure(target_x + 1, target_y, target_z) ||
            is_structure(target_x - 1, target_y, target_z) ||
            is_structure(target_x, target_y + 1, target_z) ||
            is_structure(target_x, target_y - 1, target_z)
            );
     } // if

  return(false);
}; // has_axis_lateral_anchor()

const movement_rules = [
  { name: "G_F", final: { dx:  1, dy:  0, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x") },
  { name: "G_B", final: { dx: -1, dy:  0, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "x") },
  { name: "G_R", final: { dx:  0, dy:  0, dz: -1 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z") },
  { name: "G_L", final: { dx:  0, dy:  0, dz:  1 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "z") },
  { name: "G_T", final: { dx:  0, dy:  1, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y") },
  { name: "G_D", final: { dx:  0, dy: -1, dz:  0 }, intermediate: null, anchor: null, validator: (x, y, z) => has_axis_lateral_anchor(x, y, z, "y") },
  { name: "K_TF", final: { dx:  1, dy:  1, dz:  0 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx:  1, dy:  0, dz:  0 } },
  { name: "K_TB", final: { dx: -1, dy:  1, dz:  0 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx: -1, dy:  0, dz:  0 } },
  { name: "K_DF", final: { dx:  1, dy: -1, dz:  0 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx:  1, dy:  0, dz:  0 } },
  { name: "K_DB", final: { dx: -1, dy: -1, dz:  0 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx: -1, dy:  0, dz:  0 } },
  { name: "K_TR", final: { dx:  0, dy:  1, dz: -1 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx:  0, dy:  0, dz: -1 } },
  { name: "K_TL", final: { dx:  0, dy:  1, dz:  1 }, intermediate: { dx:  0, dy:  1, dz:  0 }, anchor: { dx:  0, dy:  0, dz:  1 } },
  { name: "K_DR", final: { dx:  0, dy: -1, dz: -1 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx:  0, dy:  0, dz: -1 } },
  { name: "K_DL", final: { dx:  0, dy: -1, dz:  1 }, intermediate: { dx:  0, dy: -1, dz:  0 }, anchor: { dx:  0, dy:  0, dz:  1 } },
  { name: "K_FT", final: { dx:  1, dy:  1, dz:  0 }, intermediate: { dx:  1, dy:  0, dz:  0 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_FD", final: { dx:  1, dy: -1, dz:  0 }, intermediate: { dx:  1, dy:  0, dz:  0 }, anchor: { dx:  0, dy: -1, dz:  0 } },
  { name: "K_BT", final: { dx: -1, dy:  1, dz:  0 }, intermediate: { dx: -1, dy:  0, dz:  0 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_BD", final: { dx: -1, dy: -1, dz:  0 }, intermediate: { dx: -1, dy:  0, dz:  0 }, anchor: { dx:  0, dy: -1, dz:  0 } },
  { name: "K_LT", final: { dx:  0, dy:  1, dz:  1 }, intermediate: { dx:  0, dy:  0, dz:  1 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_LD", final: { dx:  0, dy: -1, dz:  1 }, intermediate: { dx:  0, dy:  0, dz:  1 }, anchor: { dx:  0, dy: -1, dz:  0 } },
  { name: "K_RT", final: { dx:  0, dy:  1, dz: -1 }, intermediate: { dx:  0, dy:  0, dz: -1 }, anchor: { dx:  0, dy:  1, dz:  0 } },
  { name: "K_RD", final: { dx:  0, dy: -1, dz: -1 }, intermediate: { dx:  0, dy:  0, dz: -1 }, anchor: { dx:  0, dy: -1, dz:  0 } }
]; // movement_rules

const get_payload_position_for_carrier = (carrier_position) => {
  return controller.apicall_get_payload_target_from_carrier_state(
                                                            {
                                                            x: Number(carrier_position.x),
                                                            y: Number(carrier_position.y),
                                                            z: Number(carrier_position.z)
                                                            },
                                                            carrier_orientation
                                                            );
}; // get_payload_position_for_carrier()

const has_payload_wrapped_support = (startX, startY, startZ, rule, final_x, final_y, final_z) => {
  if (!rule || !rule.intermediate)
     {
     return(false);
     } // if

  let anchor_x = Number(startX) + Number(rule.anchor?.dx ?? 0);
  let anchor_y = Number(startY) + Number(rule.anchor?.dy ?? 0);
  let anchor_z = Number(startZ) + Number(rule.anchor?.dz ?? 0);

  if (is_structure(anchor_x, anchor_y, anchor_z))
     {
     return(true);
     } // if

  return(
         apicall_is_valid_wrapped_double_step(
                                              controller,
                                              { x: Number(startX), y: Number(startY), z: Number(startZ) },
                                              { x: Number(final_x), y: Number(final_y), z: Number(final_z) },
                                              bots_s
                                              ) === true
         );
}; // has_payload_wrapped_support()

const has_payload_collision_for_path = (carrier_path_positions) => {
  for (let i = 0; i < carrier_path_positions.length; i++)
      {
      let carrier_position = carrier_path_positions[i];
      let payload_position = get_payload_position_for_carrier(carrier_position);

      if (!payload_position)
         {
         return(true);
         } // if

      if (!is_empty(payload_position.x, payload_position.y, payload_position.z))
         {
         return(true);
         } // if
      } // for

  return(false);
}; // has_payload_collision_for_path()

const getAllowedMoves3D = (startX, startY, startZ) => {
  const allowed = [];

  for (let i = 0; i < movement_rules.length; i++)
      {
      const rule = movement_rules[i];
      const final_x = Number(startX) + Number(rule.final.dx);
      const final_y = Number(startY) + Number(rule.final.dy);
      const final_z = Number(startZ) + Number(rule.final.dz);
      let rejection_reason = null;

      if (!is_empty(final_x, final_y, final_z))
         {
         rejection_reason = (is_forbidden(final_x, final_y, final_z) ? "TARGET_IS_FORBIDDEN" : "TARGET_NOT_EMPTY");
         } // if
      else if (!has_contact(final_x, final_y, final_z))
         {
         rejection_reason = "NO_SURFACE_CONTACT";
         } // else if

      if (!rejection_reason && rule.anchor)
         {
         const anchor_x = Number(startX) + Number(rule.anchor.dx);
         const anchor_y = Number(startY) + Number(rule.anchor.dy);
         const anchor_z = Number(startZ) + Number(rule.anchor.dz);

         if (!is_structure(anchor_x, anchor_y, anchor_z))
            {
            rejection_reason = "RULE_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate)
         {
         const intermediate_x = Number(startX) + Number(rule.intermediate.dx);
         const intermediate_y = Number(startY) + Number(rule.intermediate.dy);
         const intermediate_z = Number(startZ) + Number(rule.intermediate.dz);

         if (!is_empty(intermediate_x, intermediate_y, intermediate_z))
            {
            rejection_reason = (is_forbidden(intermediate_x, intermediate_y, intermediate_z) ? "INTERMEDIATE_IS_FORBIDDEN" : "INTERMEDIATE_NOT_EMPTY");
            } // if
         } // if

      if (!rejection_reason && typeof rule.validator == "function")
         {
         if (rule.validator(final_x, final_y, final_z) !== true)
            {
            rejection_reason = "AXIS_LATERAL_ANCHOR_MISSING";
            } // if
         } // if

      if (!rejection_reason && rule.intermediate && Number(rule.final.dy) !== 0 && Number(rule.final.dx) + Number(rule.final.dz) !== 0)
         {
         if (has_payload_wrapped_support(startX, startY, startZ, rule, final_x, final_y, final_z) !== true)
            {
            rejection_reason = "WRAPPED_CELL_MISSING";
            } // if
         } // if

      let path = [];
      let carrier_positions = [];

      if (!rejection_reason && rule.intermediate)
         {
         let intermediate_position = {
                                     x: Number(startX) + Number(rule.intermediate.dx),
                                     y: Number(startY) + Number(rule.intermediate.dy),
                                     z: Number(startZ) + Number(rule.intermediate.dz)
                                     };
         path.push([intermediate_position.x, intermediate_position.y, intermediate_position.z]);
         carrier_positions.push(intermediate_position);
         } // if

      path.push([final_x, final_y, final_z]);
      carrier_positions.push({ x: final_x, y: final_y, z: final_z });

      if (!rejection_reason && has_payload_collision_for_path(carrier_positions))
         {
         let payload_collision_is_forbidden = false;

         for (let p = 0; p < carrier_positions.length; p++)
             {
             let payload_position = get_payload_position_for_carrier(carrier_positions[p]);

             if (!payload_position)
                {
                continue;
                } // if

             if (is_forbidden(payload_position.x, payload_position.y, payload_position.z))
                {
                payload_collision_is_forbidden = true;
                break;
                } // if
             } // for

         rejection_reason = (payload_collision_is_forbidden ? "PAYLOAD_TARGET_IS_FORBIDDEN" : "PAYLOAD_COLLISION");
         } // if

      if (rejection_reason)
         {
         debug_rejections.push({
                                stage: "path_rule_payload",
                                rule: rule.name,
                                from: {
                                       x: Number(startX),
                                       y: Number(startY),
                                       z: Number(startZ)
                                       },
                                to: {
                                     x: Number(final_x),
                                     y: Number(final_y),
                                     z: Number(final_z)
                                     },
                                reason: rejection_reason
                                });
         continue;
         } // if

      allowed.push({
                    typ: rule.name,
                    path: path
                    });
      } // for

  return(allowed);
}; // getAllowedMoves3D()

if (!has_contact(src.x, src.y, src.z) || !is_empty(src.x, src.y, src.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!has_contact(dest.x, dest.y, dest.z) || !is_empty(dest.x, dest.y, dest.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

let payload_src = get_payload_position_for_carrier(src);
let payload_dest = get_payload_position_for_carrier(dest);

if (!payload_src || !payload_dest)
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!is_empty(payload_src.x, payload_src.y, payload_src.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

if (!is_empty(payload_dest.x, payload_dest.y, payload_dest.z))
   {
   return({
          path: null,
          debug_rejections: debug_rejections
          });
   } // if

queue.push({
           x: Number(src.x),
           y: Number(src.y),
           z: Number(src.z),
           path: [[Number(src.x), Number(src.y), Number(src.z)]]
           });
visited.add(key(src.x, src.y, src.z));

while (queue.length > 0)
      {
      const current = queue.shift();

      if (
          Number(current.x) === Number(dest.x) &&
          Number(current.y) === Number(dest.y) &&
         Number(current.z) === Number(dest.z)
         )
         {
         return({
                path: current.path.map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                debug_rejections: debug_rejections
                });
         } // if

      const allowed = getAllowedMoves3D(current.x, current.y, current.z);

      for (let i = 0; i < allowed.length; i++)
          {
          const move = allowed[i];
          if (!move.path || move.path.length === 0) continue;

          const coords = move.path;
          let partial_coords = [];

          for (let c = 0; c < coords.length; c++)
              {
              const [coordX, coordY, coordZ] = coords[c];
              partial_coords.push([Number(coordX), Number(coordY), Number(coordZ)]);

              if (
                  Number(coordX) === Number(dest.x) &&
                  Number(coordY) === Number(dest.y) &&
                  Number(coordZ) === Number(dest.z)
                 )
                 {
                 return({
                        path: [
                              ...current.path,
                              ...partial_coords
                              ].map(([x, y, z]) => (
                                                     {
                                                     x: Number(x),
                                                     y: Number(y),
                                                     z: Number(z)
                                                     }
                                                     )),
                        debug_rejections: debug_rejections
                        });
                 } // if
              } // for

          const [lastX, lastY, lastZ] = coords[coords.length - 1];
          const k = key(lastX, lastY, lastZ);

          if (visited.has(k)) continue;

          visited.add(k);

          queue.push({
                     x: Number(lastX),
                     y: Number(lastY),
                     z: Number(lastZ),
                     path: [
                           ...current.path,
                           ...coords.map(([x, y, z]) => [Number(x), Number(y), Number(z)])
                           ]
                     });
          } // for
      } // while

return({
       path: null,
       debug_rejections: debug_rejections
       });
} // apicall_calc_single_path_payload()


function apicall_calc_vehicle_kinematics_path(controller, src, dest, bots_s, bots_f, vehicle_options = {})
{
let start_orientation = vehicle_options?.orientation ?? { x: 0, y: 0, z: 1 };
let world = {
            isOccupied: (x, y, z) => (
                                     bots_s.get(Number(x), Number(y), Number(z)) !== null
                                     ),
            isFree: (x, y, z) => {
              let occupied = (bots_s.get(Number(x), Number(y), Number(z)) !== null);
              let forbidden = false;

              if (bots_f)
                 {
                 forbidden = (bots_f.get(Number(x), Number(y), Number(z)) !== null);
                 } // if

              return(!occupied && !forbidden);
            },
            forbidden: bots_f
            };
let start = {
            x: Number(src?.x ?? 0),
            y: Number(src?.y ?? 0),
            z: Number(src?.z ?? 0),
            vx: Number(start_orientation?.x ?? 0),
            vy: Number(start_orientation?.y ?? 0),
            vz: Number(start_orientation?.z ?? 1)
            };
let goal = {
           x: Number(dest?.x ?? 0),
           y: Number(dest?.y ?? 0),
           z: Number(dest?.z ?? 0),
           vx: Number(vehicle_options?.goal_orientation?.x ?? start.vx),
           vy: Number(vehicle_options?.goal_orientation?.y ?? start.vy),
           vz: Number(vehicle_options?.goal_orientation?.z ?? start.vz)
           };
let options = {
              max_search_steps: Number(vehicle_options?.max_search_steps ?? 100000),
               max_debug_rejections: Number(vehicle_options?.max_debug_rejections ?? 5000),
              include_start: vehicle_options?.include_start !== false
              };

return(calc_vehicle_kinematics_path(start, goal, world, options));
} // apicall_calc_vehicle_kinematics_path()


function apicall_calc_vehicle_kinematics_payload_path(controller, src, dest, bots_s, bots_f, vehicle_options = {})
{
let start_orientation = vehicle_options?.orientation ?? { x: 0, y: 0, z: 1 };
let world = {
            isOccupied: (x, y, z) => (
                                     bots_s.get(Number(x), Number(y), Number(z)) !== null
                                     ),
            isFree: (x, y, z) => {
              let occupied = (bots_s.get(Number(x), Number(y), Number(z)) !== null);
              let forbidden = false;

              if (bots_f)
                 {
                 forbidden = (bots_f.get(Number(x), Number(y), Number(z)) !== null);
                 } // if

              return(!occupied && !forbidden);
            },
            forbidden: bots_f
            };
let start = {
            x: Number(src?.x ?? 0),
            y: Number(src?.y ?? 0),
            z: Number(src?.z ?? 0),
            vx: Number(start_orientation?.x ?? 0),
            vy: Number(start_orientation?.y ?? 0),
            vz: Number(start_orientation?.z ?? 1)
            };
let goal = {
           x: Number(dest?.x ?? 0),
           y: Number(dest?.y ?? 0),
           z: Number(dest?.z ?? 0),
           vx: Number(vehicle_options?.goal_orientation?.x ?? start.vx),
           vy: Number(vehicle_options?.goal_orientation?.y ?? start.vy),
           vz: Number(vehicle_options?.goal_orientation?.z ?? start.vz)
           };
let options = {
              max_search_steps: Number(vehicle_options?.max_search_steps ?? 100000),
               max_debug_rejections: Number(vehicle_options?.max_debug_rejections ?? 5000),
              include_start: vehicle_options?.include_start !== false
              };

return(calc_vehicle_kinematics_payload_path(start, goal, world, options));
} // apicall_calc_vehicle_kinematics_payload_path()


function apicall_calc_hybrid_kinematics_path(controller, src, dest, bots_s, bots_f, vehicle_options = {})
{
let start_orientation = vehicle_options?.orientation ?? { x: 0, y: 0, z: 1 };
let world = {
            isOccupied: (x, y, z) => (
                                     bots_s.get(Number(x), Number(y), Number(z)) !== null
                                     ),
            isFree: (x, y, z) => {
              let occupied = (bots_s.get(Number(x), Number(y), Number(z)) !== null);
              let forbidden = false;

              if (bots_f)
                 {
                 forbidden = (bots_f.get(Number(x), Number(y), Number(z)) !== null);
                 } // if

              return(!occupied && !forbidden);
            },
            forbidden: bots_f
            };
let start = {
            x: Number(src?.x ?? 0),
            y: Number(src?.y ?? 0),
            z: Number(src?.z ?? 0),
            vx: Number(start_orientation?.x ?? 0),
            vy: Number(start_orientation?.y ?? 0),
            vz: Number(start_orientation?.z ?? 1)
            };
let goal = {
           x: Number(dest?.x ?? 0),
           y: Number(dest?.y ?? 0),
           z: Number(dest?.z ?? 0),
           vx: Number(vehicle_options?.goal_orientation?.x ?? start.vx),
           vy: Number(vehicle_options?.goal_orientation?.y ?? start.vy),
           vz: Number(vehicle_options?.goal_orientation?.z ?? start.vz)
           };
let options = {
              max_search_steps: Number(vehicle_options?.max_search_steps ?? 100000),
              max_debug_rejections: Number(vehicle_options?.max_debug_rejections ?? 120),
              include_start: vehicle_options?.include_start !== false,
              debug_log: true
              };

return(calc_hybrid_kinematics_path(start, goal, world, options));
} // apicall_calc_hybrid_kinematics_path()


module.exports = {
                 apicall_create_sparse_grid,
                 apicall_build_structure_grid_without_bot,
                 apicall_would_split_cluster,
                 apicall_build_forbidden_grid,
                 apicall_is_forbidden_cell,
                 apicall_get_wrapped_cell_for_double_step,
                 apicall_is_valid_wrapped_double_step,
                 apicall_calc_single_path,
                 apicall_calc_single_path_payload,
                 apicall_calc_vehicle_kinematics_path,
                 apicall_calc_vehicle_kinematics_payload_path,
                 apicall_calc_hybrid_kinematics_path
                 };
