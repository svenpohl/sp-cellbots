function apicall_can_reach_position(controller, bot_id, x, y, z)
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
const target_neighbor_offsets = [
                                { x: 1,  y: 0,  z: 0 },
                                { x: -1, y: 0,  z: 0 },
                                { x: 0,  y: 1,  z: 0 },
                                { x: 0,  y: -1, z: 0 },
                                { x: 0,  y: 0,  z: 1 },
                                { x: 0,  y: 0,  z: -1 }
                                ];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_can_reach_position",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if ( Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z) )
   {
   return({
          ok: false,
          answer: "api_can_reach_position",
          error: "INVALID_TARGET_POSITION",
          bot_id: bot_id
          });
   } // if

let bot = controller.bots[botindex];
let dx = target_x - Number(bot.x);
let dy = target_y - Number(bot.y);
let dz = target_z - Number(bot.z);
let manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
let target_status = controller.apicall_is_occupied(target_x, target_y, target_z);
let target_forbidden = controller.apicall_is_forbidden_cell(target_x, target_y, target_z);
let target_local_contacts = 0;
let reachable = false;
let reason = "COMPLEX_PATH_SEARCH_NOT_YET_IMPLEMENTED";
let notes = [];

for (let i=0; i<target_neighbor_offsets.length; i++)
    {
    let nx = target_x + target_neighbor_offsets[i].x;
    let ny = target_y + target_neighbor_offsets[i].y;
    let nz = target_z + target_neighbor_offsets[i].z;
    let neighbor_status = controller.apicall_is_occupied(nx, ny, nz);

    if (neighbor_status.occupied === true)
       {
       target_local_contacts++;
       } // if
    } // for

if (target_forbidden === true)
   {
   reachable = false;
   reason = "TARGET_POSITION_IS_FORBIDDEN";
   notes.push("The requested target coordinate is marked as forbidden.");
   } // if
else if (target_status.occupied === true)
   {
   reachable = false;
   reason = "TARGET_POSITION_IS_OCCUPIED";
   notes.push("The requested target coordinate is already occupied.");
   } // if
else if (dx == 0 && dy == 0 && dz == 0)
   {
   reachable = true;
   reason = "ALREADY_AT_TARGET";
   notes.push("Bot is already located at the requested target position.");
   } // if
else if (manhattan == 1)
   {
   reachable = true;
   reason = "DIRECT_NEIGHBOR_TARGET";
   notes.push("Target is one orthogonal step away.");
   } // if
else if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && Math.abs(dz) <= 1 && manhattan <= 2)
   {
   reachable = false;
   reason = "LOCAL_TARGET_REQUIRES_PATH_SEARCH";
   notes.push("Target is local, but a path search is still required.");
   } // if
else
   {
   reachable = false;
   reason = "COMPLEX_PATH_SEARCH_NOT_YET_IMPLEMENTED";
   notes.push("Current implementation only performs a conservative surface check.");
   } // else

if (target_local_contacts == 0)
   {
   notes.push("Target coordinate currently has no occupied orthogonal neighbors.");
   } // if
else
   {
   notes.push("Target coordinate has " + target_local_contacts + " occupied orthogonal neighbor(s).");
   } // else

return({
       ok: true,
       answer: "api_can_reach_position",
       evaluation_mode: "surface-check",
       bot_id: bot_id,
       center: {
                position: {
                           x: Number(bot.x),
                           y: Number(bot.y),
                           z: Number(bot.z)
                           },
                orientation: {
                              x: Number(bot.vector_x),
                              y: Number(bot.vector_y),
                              z: Number(bot.vector_z)
                              }
                },
       target: {
                x: target_x,
                y: target_y,
                z: target_z
                },
       distance: {
                  dx: dx,
                  dy: dy,
                  dz: dz,
                  manhattan: manhattan
                  },
       target_status: target_status,
       target_forbidden: target_forbidden,
       target_local_contacts: target_local_contacts,
       reachable: reachable,
       reason: reason,
       notes: notes
       });
} // apicall_can_reach_position()


function apicall_find_path_for_bot(controller, bot_id, x, y, z, show = false, planning_options = {})
{
let botindex = controller.get_bot_by_id(bot_id, controller.bots);
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let show_path = (show === true || show === "true" || show === "show" || show === 1 || show === "1");
let excluded_bot_ids = Array.isArray(planning_options?.excluded_bot_ids) ? planning_options.excluded_bot_ids : [];

if (botindex == null)
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

if ( Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z) )
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot",
          error: "INVALID_TARGET_POSITION",
          bot_id: bot_id
          });
   } // if

let bot = controller.bots[botindex];
let bots_s = controller.apicall_build_structure_grid_without_bot(bot_id, excluded_bot_ids);
let bots_f = controller.apicall_build_forbidden_grid();
let carried_payload_bot_id = String(planning_options?.carried_payload_bot_id ?? "").trim();
if (typeof Logger !== "undefined") Logger.log("[DEBUG find_path_for_bot] bot_id=" + bot_id + " carried_payload_bot_id='" + carried_payload_bot_id + "' mobility_mode=" + String(controller?.config?.mobility_mode ?? "?").trim().toLowerCase() + " target=" + x + "," + y + "," + z);
let goal_orientation = planning_options?.goal_orientation ?? null;
let bot_snapshot = controller.apicall_get_bot_snapshot(bot_id);
let src = {
          x: Number(bot.x),
          y: Number(bot.y),
          z: Number(bot.z)
          };
let dest = {
           x: target_x,
           y: target_y,
           z: target_z
           };
let path_result = null;
let path = null;
let path_debug_rejections = [];
let path_vehicle_dry_run = null;
let src_is_forbidden = controller.apicall_is_forbidden_cell(src.x, src.y, src.z, bots_f);
let dest_is_forbidden = controller.apicall_is_forbidden_cell(dest.x, dest.y, dest.z, bots_f);
let mobility_mode = String(controller?.config?.mobility_mode ?? "full_edge").trim().toLowerCase();

if (src_is_forbidden === true)
   {
   return({
          ok: true,
          answer: "api_find_path_for_bot",
          bot_id: bot_id,
          target: dest,
          path_found: false,
          reason: "BOT_POSITION_IS_FORBIDDEN",
          show_requested: show_path,
          carried_payload_bot_id: (carried_payload_bot_id != "" ? carried_payload_bot_id : null),
          path_debug_rejections: path_debug_rejections,
          path: []
          });
   } // if

if (dest_is_forbidden === true)
   {
   return({
          ok: true,
          answer: "api_find_path_for_bot",
          bot_id: bot_id,
          target: dest,
          path_found: false,
          reason: "TARGET_POSITION_IS_FORBIDDEN",
          show_requested: show_path,
          carried_payload_bot_id: (carried_payload_bot_id != "" ? carried_payload_bot_id : null),
          path_debug_rejections: path_debug_rejections,
          path: []
          });
   } // if

if (carried_payload_bot_id != "")
   {
   let payload_target = controller.apicall_get_payload_target_from_carrier_state(
                                                                              dest,
                                                                              bot_snapshot?.orientation ?? null
                                                                              );

   if (payload_target && controller.apicall_is_forbidden_cell(payload_target.x, payload_target.y, payload_target.z, bots_f))
      {
      return({
             ok: true,
             answer: "api_find_path_for_bot",
             bot_id: bot_id,
             target: dest,
             payload_target: {
                              x: Number(payload_target.x),
                              y: Number(payload_target.y),
                              z: Number(payload_target.z)
                              },
             path_found: false,
             reason: "PAYLOAD_TARGET_POSITION_IS_FORBIDDEN",
             show_requested: show_path,
             carried_payload_bot_id: carried_payload_bot_id,
             path_debug_rejections: path_debug_rejections,
             path: []
             });
      } // if
   } // if

if (carried_payload_bot_id != "")
   {
   if (mobility_mode == "vehicle_kinematics")
      {
      path_vehicle_dry_run = controller.apicall_calc_vehicle_kinematics_payload_path(
                                                                               src,
                                                                               dest,
                                                                               bots_s,
                                                                               bots_f,
                                                                               {
                                                                               orientation: bot_snapshot?.orientation ?? null,
                                                                               goal_orientation: goal_orientation,
                                                                               include_start: true,
                                                                               carrier_bot_id: bot_id,
                                                                               payload_bot_id: carried_payload_bot_id
                                                                               }
                                                                               );
      path_result = path_vehicle_dry_run;
      } // if
   else
      {
      path_result = controller.apicall_calc_single_path_payload(
                                                                src,
                                                                dest,
                                                                bots_s,
                                                                bots_f,
                                                                {
                                                                carrier_bot_id: bot_id,
                                                                payload_bot_id: carried_payload_bot_id,
                                                                orientation: bot_snapshot?.orientation ?? null
                                                                }
                                                                );
      } // else
   } // if
else if (mobility_mode == "vehicle_kinematics")
   {
   path_vehicle_dry_run = controller.apicall_calc_vehicle_kinematics_path(
                                                                    src,
                                                                    dest,
                                                                    bots_s,
                                                                    bots_f,
                                                                    {
                                                                    orientation: bot_snapshot?.orientation ?? null,
                                                                    goal_orientation: goal_orientation,
                                                                    include_start: true
                                                                    }
                                                                    );
   path_result = path_vehicle_dry_run;
   } // if
else if (mobility_mode == "hybrid_kinematics")
   {
   path_vehicle_dry_run = controller.apicall_calc_hybrid_kinematics_path(
                                                                    src,
                                                                    dest,
                                                                    bots_s,
                                                                    bots_f,
                                                                    {
                                                                    orientation: bot_snapshot?.orientation ?? null,
                                                                    goal_orientation: goal_orientation,
                                                                    include_start: true
                                                                    }
                                                                    );
   path_result = path_vehicle_dry_run;
   } // if
else
   {
   path_result = controller.apicall_calc_single_path(src, dest, bots_s, bots_f);
   } // else

if (Array.isArray(path_result))
   {
   path = path_result;
   } // if
else if (path_result && typeof path_result == "object")
   {
   // Prefer states/states_full over path for vehicle_kinematics/hybrid_kinematics
   // because the VK planner stores the full path with orientation in states.
   path = Array.isArray(path_result.states) ? path_result.states : null;
   if (!path && Array.isArray(path_result.states_full))
      {
      path = path_result.states_full;
      } // if
   if (!path && Array.isArray(path_result.path))
      {
      path = path_result.path;
      } // if
   path_debug_rejections = Array.isArray(path_result.debug_rejections) ? path_result.debug_rejections : [];
   if (path_vehicle_dry_run == null && (mobility_mode == "vehicle_kinematics" || mobility_mode == "hybrid_kinematics"))
      {
      path_vehicle_dry_run = path_result;
      } // if
   } // else if

if (!path || (Array.isArray(path) && path.length === 0))
   {
   return({
          ok: true,
          answer: "api_find_path_for_bot",
          bot_id: bot_id,
          target: dest,
          path_found: false,
          reason: "NO_SURFACE_PATH_FOUND",
          mobility_mode: mobility_mode,
          show_requested: show_path,
          carried_payload_bot_id: (carried_payload_bot_id != "" ? carried_payload_bot_id : null),
          goal_orientation: goal_orientation,
          vehicle_path_dry_run: path_vehicle_dry_run,
          path_debug_rejections: path_debug_rejections,
          path: []
          });
   } // if

let path_visualized = false;
let marker_count = 0;

if (show_path)
   {
   for (let i = 0; i < path.length; i++)
       {
       let marker_ret = controller.apicall_gui_set_marker(path[i].x, path[i].y, path[i].z, 0.3, "green");

       if (marker_ret.accepted === true)
          {
          marker_count++;
          } // if

       if (marker_ret.frontend_attached === true)
          {
          path_visualized = true;
          } // if
       } // for
   } // if

return({
       ok: true,
       answer: "api_find_path_for_bot",
       bot_id: bot_id,
       target: dest,
       path_found: true,
       reason: "PATH_FOUND",
       mobility_mode: mobility_mode,
       show_requested: show_path,
       carried_payload_bot_id: (carried_payload_bot_id != "" ? carried_payload_bot_id : null),
       goal_orientation: goal_orientation,
       excluded_bot_ids: excluded_bot_ids,
       vehicle_path_dry_run: path_vehicle_dry_run,
       path_debug_rejections: path_debug_rejections,
        path_visualized: path_visualized,
        marker_count: marker_count,
        path_length: path.length,
        path: path,
        actions: (path_result && typeof path_result == "object" && Array.isArray(path_result.actions)) ? path_result.actions : []
        });
} // apicall_find_path_for_bot()


function apicall_find_path_for_bot_payload(controller, bot_id, payload_bot_id, x, y, z, show = false)
{
let normalized_payload_bot_id = String(payload_bot_id ?? "").trim();

if (normalized_payload_bot_id == "")
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot_payload",
          error: "PAYLOAD_BOT_ID_MISSING",
          bot_id: bot_id
          });
   } // if

let payload_snapshot = controller.apicall_get_bot_snapshot(normalized_payload_bot_id);

if (!payload_snapshot)
   {
   return({
          ok: false,
          answer: "api_find_path_for_bot_payload",
          error: "PAYLOAD_BOT_NOT_FOUND",
          bot_id: bot_id,
          payload_bot_id: normalized_payload_bot_id
          });
   } // if

let ret = apicall_find_path_for_bot(
                                   controller,
                                   bot_id,
                                   x,
                                   y,
                                   z,
                                   show,
                                   {
                                   excluded_bot_ids: [normalized_payload_bot_id],
                                   carried_payload_bot_id: normalized_payload_bot_id
                                   }
                                   );

return({
       ...ret,
       answer: "api_find_path_for_bot_payload",
       payload_bot_id: normalized_payload_bot_id
       });
} // apicall_find_path_for_bot_payload()


function apicall_suggest_simple_move(controller, bot_id, x, y, z)
{
let path_ret = controller.apicall_find_path_for_bot(bot_id, x, y, z, false);
let move_library = controller.apicall_get_simple_move_library();
let tested_candidates = [];
let matching_candidates = [];

if (path_ret.ok !== true)
   {
   return({
          ok: false,
          answer: "api_suggest_simple_move",
          error: path_ret.error ?? "PATH_PRECHECK_FAILED",
          bot_id: bot_id
          });
   } // if

if (path_ret.path_found !== true)
   {
   return({
          ok: true,
          answer: "api_suggest_simple_move",
          bot_id: bot_id,
          target: path_ret.target,
          suggested: false,
          reason: path_ret.reason ?? "NO_SURFACE_PATH_FOUND",
          path_found: false,
          path: path_ret.path ?? []
          });
   } // if

if (!Array.isArray(path_ret.path) || path_ret.path.length < 2)
   {
   return({
          ok: true,
          answer: "api_suggest_simple_move",
          bot_id: bot_id,
          target: path_ret.target,
          suggested: false,
          reason: "ALREADY_AT_TARGET",
          path_found: true,
          path: path_ret.path ?? []
          });
   } // if

for (let i = 0; i < move_library.length; i++)
    {
    let move_candidate = move_library[i];
    let probe_ret = controller.apicall_probe_move_bot(bot_id, move_candidate);
    let candidate_info = {
                         move: move_candidate,
                         ok: probe_ret.ok === true,
                         possible: probe_ret.possible === true
                         };

    if (probe_ret.predicted_target)
       {
       candidate_info.predicted_target = probe_ret.predicted_target;
       } // if

    tested_candidates.push(candidate_info);

    if (probe_ret.ok === true && probe_ret.possible === true && probe_ret.predicted_target)
       {
       for (let p = 1; p < path_ret.path.length; p++)
           {
           let pathnode = path_ret.path[p];

           if ( Number(probe_ret.predicted_target.x) === Number(pathnode.x) &&
                Number(probe_ret.predicted_target.y) === Number(pathnode.y) &&
                Number(probe_ret.predicted_target.z) === Number(pathnode.z) )
              {
              matching_candidates.push({
                                       move: move_candidate,
                                       path_index: p,
                                       predicted_target: probe_ret.predicted_target,
                                       notes: probe_ret.notes ?? []
                                       });
              break;
              } // if
           } // for
       } // if
    } // for

if (matching_candidates.length == 0)
   {
   return({
          ok: true,
          answer: "api_suggest_simple_move",
          bot_id: bot_id,
          target: path_ret.target,
          suggested: false,
          reason: "NO_SIMPLE_MOVE_CANDIDATE_FOR_PATH_HEAD",
          path_found: true,
          path: path_ret.path,
          tested_candidates: tested_candidates
          });
   } // if

matching_candidates.sort((a, b) => b.path_index - a.path_index);

return({
       ok: true,
       answer: "api_suggest_simple_move",
       bot_id: bot_id,
       target: path_ret.target,
       suggested: true,
       reason: "SIMPLE_MOVE_FOUND",
       path_found: true,
       path: path_ret.path,
       move_candidate: matching_candidates[0].move,
       predicted_target: matching_candidates[0].predicted_target,
       matched_path_index: matching_candidates[0].path_index,
       matching_candidates: matching_candidates,
       tested_candidates: tested_candidates
       });
} // apicall_suggest_simple_move()


function apicall_move_bot_to(controller, bot_id, x, y, z, execute_move = true, goal_orientation = null)
{
let target_x = Number(x);
let target_y = Number(y);
let target_z = Number(z);
let safe_prepare_ret = controller.apicall_apply_safe_mode_for_bot(bot_id);
let bot_snapshot = controller.apicall_get_bot_snapshot(bot_id);
let carried_payload_bot_id = controller.apicall_get_carried_payload_bot_id(bot_id);
let excluded_bot_ids = [];
let should_execute_move = (execute_move === true);
let live_botindex = null;
let send_address = "";
let mobility_mode = String(controller?.config?.mobility_mode ?? "full_edge").trim().toLowerCase();
let normalized_goal_orientation = null;

if (goal_orientation && typeof goal_orientation == "object")
   {
   normalized_goal_orientation = {
                                  x: Number(goal_orientation.x ?? 0),
                                  y: Number(goal_orientation.y ?? 0),
                                  z: Number(goal_orientation.z ?? 0)
                                  };
   } // if

if (safe_prepare_ret?.ok !== true)
   {
   return({
          ok: false,
          answer: "api_move_bot_to",
          error: safe_prepare_ret?.recalibration?.error ?? "SAFE_MODE_PREPARE_FAILED",
          bot_id: bot_id,
          safe_mode: Number(controller.safe_mode)
          });
   } // if

if (!bot_snapshot)
   {
   return({
          ok: false,
          answer: "api_move_bot_to",
          error: "BOT_NOT_FOUND",
          bot_id: bot_id
          });
   } // if

live_botindex = controller.get_bot_by_id(bot_snapshot.id, controller.bots);

if (live_botindex != null)
   {
   send_address = String(controller.apicall_get_safe_adress(controller.bots[live_botindex]) ?? "").trim();
   } // if

if (send_address == "")
   {
   return({
          ok: false,
          answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
          error: "TARGET_ADDRESS_NOT_AVAILABLE",
          bot_id: bot_id
          });
   } // if

if (Number.isNaN(target_x) || Number.isNaN(target_y) || Number.isNaN(target_z))
   {
   return({
          ok: false,
          answer: "api_move_bot_to",
          error: "INVALID_TARGET_POSITION",
          bot_id: bot_id
          });
   } // if

if (carried_payload_bot_id)
   {
   excluded_bot_ids.push(String(carried_payload_bot_id));
   } // if

let path_ret = apicall_find_path_for_bot(
                                        controller,
                                        bot_id,
                                        target_x,
                                        target_y,
                                        target_z,
                                        false,
                                       {
                                       excluded_bot_ids: excluded_bot_ids,
                                       carried_payload_bot_id: carried_payload_bot_id,
                                       goal_orientation: normalized_goal_orientation
                                       }
                                       );

if (path_ret.ok !== true)
   {
   return({
          ok: false,
          answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
          error: path_ret.error ?? "PATH_PRECHECK_FAILED",
          bot_id: bot_id
          });
   } // if

if (path_ret.path_found !== true)
   {
   return({
          ok: true,
          answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
          bot_id: bot_id,
          execution_mode: "plan-only",
          target: {
                   x: target_x,
                   y: target_y,
                   z: target_z
                   },
          executable: false,
          executed: false,
          reason: path_ret.reason ?? "NO_SURFACE_PATH_FOUND",
          current_state: bot_snapshot,
          carried_payload_bot_id: carried_payload_bot_id,
          planning_excluded_bot_ids: excluded_bot_ids,
          mobility_mode: mobility_mode,
          goal_orientation: normalized_goal_orientation,
          path_found: false,
          path_length: 0,
          planned_moves: [],
          planned_primitives: [],
          planned_movecmds_legacy: "",
          planned_raw_cmd: null,
          path: []
          });
    } // if

// Sicherheitscheck: path_ret.path muss ein Array mit mindestens 2 Elementen sein,
// sonst können translate_path_to_primitive_paths und calc_move_*_cmds nicht arbeiten.
// (Der path_found-check oben garantiert nicht, dass path_ret.path ein Array ist,
//  da der Path-Planner für hybrid_kinematics/vehicle_kinematics ein Objekt
//  mit .states/.states_full/.path zurückgeben kann.)
if (!Array.isArray(path_ret.path) || path_ret.path.length < 2)
   {
   return({
          ok: true,
          answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
          bot_id: bot_id,
          execution_mode: "plan-only",
          target: {
                   x: target_x,
                   y: target_y,
                   z: target_z
                   },
          executable: false,
          executed: false,
          reason: "PATH_TOO_SHORT_OR_INVALID",
          current_state: bot_snapshot,
          carried_payload_bot_id: carried_payload_bot_id,
          planning_excluded_bot_ids: excluded_bot_ids,
          mobility_mode: mobility_mode,
          goal_orientation: normalized_goal_orientation,
          path_found: false,
          path_length: 0,
          planned_moves: [],
          planned_primitives: [],
          planned_movecmds_legacy: "",
          planned_raw_cmd: null,
          path: []
          });
   } // if

let bots_tmp_translate = controller.apicall_build_active_bots_tmp(false, excluded_bot_ids);
let planned_moves = apicall_translate_path_to_primitive_paths(
                                                               controller,
                                                               path_ret.path,
                                                               Number(bot_snapshot.orientation.x),
                                                               Number(bot_snapshot.orientation.y),
                                                               Number(bot_snapshot.orientation.z),
                                                               bots_tmp_translate
                                                               );
let planned_primitives = apicall_add_anchors_to_primitive_paths(
                                                                controller,
                                                                planned_moves,
                                                                Number(bot_snapshot.orientation.x),
                                                                Number(bot_snapshot.orientation.y),
                                                                Number(bot_snapshot.orientation.z),
                                                                excluded_bot_ids
                                                                );
let bots_tmp = controller.apicall_build_active_bots_tmp(false, excluded_bot_ids);
let legacy_move_ret = null;
let calc_move_debug_payload = {
                               bot_id: bot_id,
                               mobility_mode: mobility_mode,
                               goal_orientation: normalized_goal_orientation,
                               start_orientation: bot_snapshot?.orientation ?? null,
                               path_length: Array.isArray(path_ret.path) ? path_ret.path.length : 0,
                               planned_moves_count: Array.isArray(planned_moves) ? planned_moves.length : 0,
                               planned_primitives_count: Array.isArray(planned_primitives) ? planned_primitives.length : 0,
                               bots_tmp_count: Array.isArray(bots_tmp) ? bots_tmp.length : 0
                               };

// console.log("[calc_move_cmds] args:", JSON.stringify(calc_move_debug_payload));

if (mobility_mode == "vehicle_kinematics" && typeof controller.calc_move_vk_cmds == "function")
   {
   legacy_move_ret = controller.calc_move_vk_cmds(
                                                    path_ret.path ?? [],
                                                    Number(bot_snapshot.orientation.x),
                                                    Number(bot_snapshot.orientation.y),
                                                    Number(bot_snapshot.orientation.z),
                                                    bots_tmp,
                                                    normalized_goal_orientation
                                                    );
   } else if (mobility_mode == "hybrid_kinematics" && typeof controller.calc_move_hybrid_cmds == "function")
      {
      let hybrid_actions = Array.isArray(path_ret?.actions) ? path_ret.actions : [];
      legacy_move_ret = controller.calc_move_hybrid_cmds(
                                                       path_ret.path ?? [],
                                                       Number(bot_snapshot.orientation.x),
                                                       Number(bot_snapshot.orientation.y),
                                                       Number(bot_snapshot.orientation.z),
                                                       bots_tmp,
                                                       normalized_goal_orientation,
                                                       hybrid_actions
                                                       );
      } else
        {
        legacy_move_ret = controller.calc_move_cmds(
                                                    path_ret.path ?? [],
                                                    Number(bot_snapshot.orientation.x),
                                                    Number(bot_snapshot.orientation.y),
                                                    Number(bot_snapshot.orientation.z),
                                                    bots_tmp,
                                                    normalized_goal_orientation
                                                    );
        } // else
let planned_movecmds_legacy = legacy_move_ret?.movecmds ?? "";
let planned_raw_cmd = null;
let raw_ret = null;
let ack_id = null;
let ack_retaddr = "";
let ack_target_addr = "";
let ack_target_orientation = null;
let ack_target_neighbors_debug = [];
let ack_target_neighbors_live_debug = [];
let ack_stl_debug = null;
let move_diagnostic_summary = null;
let turn_positions_on_path = [];
const communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim();
const allow_ack_extension = true;

if (communication_mode == "direct_radio")
   {
   ack_target_addr = String(send_address ?? "").trim();
   ack_retaddr = String(controller.get_direct_radio_master_rid() ?? "").trim();
   } // if

if (normalized_goal_orientation)
   {
   ack_target_orientation = {
                             x: Number(normalized_goal_orientation.x ?? 0),
                             y: Number(normalized_goal_orientation.y ?? 0),
                             z: Number(normalized_goal_orientation.z ?? 0)
                             };
   }
else if ((mobility_mode == "vehicle_kinematics" || mobility_mode == "hybrid_kinematics") && Array.isArray(path_ret.path) && path_ret.path.length > 0)
   {
   let path_goal_stage = path_ret.path[path_ret.path.length - 1];

   if (path_goal_stage && path_goal_stage.vx !== undefined)
      {
      ack_target_orientation = {
                                x: Number(path_goal_stage.vx ?? bot_snapshot.orientation.x ?? 0),
                                y: Number(path_goal_stage.vy ?? bot_snapshot.orientation.y ?? 0),
                                z: Number(path_goal_stage.vz ?? bot_snapshot.orientation.z ?? 0)
                                };
      } // if
   } // else if

if (!ack_target_orientation)
   {
   ack_target_orientation = {
                             x: Number(bot_snapshot.orientation.x),
                             y: Number(bot_snapshot.orientation.y),
                             z: Number(bot_snapshot.orientation.z)
                             };
   } // if

if (typeof planned_movecmds_legacy == "string" && planned_movecmds_legacy.trim() != "")
   {
   let bots_tmp_ack = controller.apicall_build_active_bots_tmp(true, excluded_bot_ids);
   let ack_botindex = controller.get_bot_by_id(bot_id, bots_tmp_ack);

   if (ack_botindex != null)
      {
      try
         {
      bots_tmp_ack[ack_botindex].x = target_x;
      bots_tmp_ack[ack_botindex].y = target_y;
      bots_tmp_ack[ack_botindex].z = target_z;

      for (let b = 0; b < bots_tmp_ack.length; b++)
          {
          let cleanedBlockedBots = [];

          if (bots_tmp_ack[b].id == "masterbot")
             {
             continue;
             } // if

          bots_tmp_ack[b].adress = controller.get_mb_returnaddr(
                                                           {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
                                                           {x: bots_tmp_ack[b].x, y: bots_tmp_ack[b].y, z: bots_tmp_ack[b].z},
                                                           bots_tmp_ack,
                                                           cleanedBlockedBots
                                                           );
          } // for

      let ack_target_neighbors = controller.get_valid_neighbours(
                                                             {x: target_x, y: target_y, z: target_z},
                                                             null,
                                                             bots_tmp_ack
                                                             );
      ack_target_neighbors_debug = ack_target_neighbors.map((bot) => ({
                                                                    id: bot.id,
                                                                    x: Number(bot.x),
                                                                    y: Number(bot.y),
                                                                    z: Number(bot.z),
                                                                    adress: bot.adress ?? ""
                                                                    }));

      ack_target_addr = String(bots_tmp_ack[ack_botindex].adress ?? "").trim();
      if (ack_target_addr == "")
         {
         ack_target_addr = controller.apicall_derive_target_address_from_neighbours(
                                                                                 {x: target_x, y: target_y, z: target_z},
                                                                                 bots_tmp_ack
                                                                                 );
         } // if

      if (ack_target_addr == "")
         {
         let ack_target_neighbors_live = controller.get_valid_neighbours(
                                                                      {x: target_x, y: target_y, z: target_z},
                                                                      null,
                                                                      controller.bots
                                                                      );
         ack_target_neighbors_live_debug = ack_target_neighbors_live.map((bot) => ({
                                                                              id: bot.id,
                                                                              x: Number(bot.x),
                                                                              y: Number(bot.y),
                                                                              z: Number(bot.z),
                                                                              adress: bot.adress ?? ""
                                                                              }));

         ack_target_addr = controller.apicall_derive_target_address_from_neighbours(
                                                                                 {x: target_x, y: target_y, z: target_z},
                                                                                 controller.bots
                                                                                 );
         } // if

      if (
          legacy_move_ret &&
          typeof legacy_move_ret.final_lastanchor == "string" &&
          legacy_move_ret.final_lastanchor != "" &&
          legacy_move_ret.final_lastanchorneighbour &&
          legacy_move_ret.final_lastanchorneighbour.x !== undefined
         )
         {
         let stl_key = controller.getKey_3d(
                                           Number(legacy_move_ret.final_lastanchorneighbour.x),
                                           Number(legacy_move_ret.final_lastanchorneighbour.y),
                                           Number(legacy_move_ret.final_lastanchorneighbour.z)
                                           );
         let botindex_map_ack = controller.apicall_build_botindex_map_for_bots(bots_tmp_ack);
         let stl_index = botindex_map_ack[stl_key];

         ack_stl_debug = {
                          entry_slot: legacy_move_ret.final_lastanchor,
                          neighbour: legacy_move_ret.final_lastanchorneighbour
                          };

         if (stl_index !== undefined)
            {
            let stl_addr = String(bots_tmp_ack[stl_index].adress ?? "").trim();
            let masterbot_key = controller.getKey_3d(Number(controller.mb.x), Number(controller.mb.y), Number(controller.mb.z));

            ack_stl_debug.stl_id = bots_tmp_ack[stl_index].id ?? "";
            ack_stl_debug.stl_addr = stl_addr;

            if (stl_addr == "")
               {
               let live_stl_index = controller.get_bot_by_id(String(bots_tmp_ack[stl_index].id ?? ""), controller.bots);

               if (live_stl_index !== null)
                  {
                  stl_addr = String(controller.bots[live_stl_index].adress ?? "").trim();
                  ack_stl_debug.stl_addr_live = stl_addr;
                  } // if
               } // if

            if (stl_addr != "")
               {
               let stl_retaddr = controller.apicall_get_inverse_address_for_bots(
                                                                                 masterbot_key,
                                                                                 stl_addr,
                                                                                 bots_tmp_ack,
                                                                                 botindex_map_ack
                                                                                 );

               ack_stl_debug.stl_retaddr = stl_retaddr;

               if (stl_retaddr != "")
                  {
                  ack_retaddr = String(legacy_move_ret.final_lastanchor) + String(stl_retaddr);
                  } // if
               } // if
            } // if
         } // if

      if (ack_retaddr == "")
         {
         ack_retaddr = controller.apicall_derive_ack_returnaddr_from_neighbours(
                                                                         bots_tmp_ack[ack_botindex],
                                                                         bots_tmp_ack
                                                                         );
         } // if

      if (ack_retaddr == "")
         {
         ack_retaddr = controller.get_mb_returnaddr(
                                                    {x: target_x, y: target_y, z: target_z},
                                                    {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
                                                    bots_tmp_ack,
                                                    []
                                                    );
         } // if

      if (ack_retaddr == "" && ack_target_addr != "")
         {
         let botindex_map_ack = controller.apicall_build_botindex_map_for_bots(bots_tmp_ack);
         let masterbot_key = controller.getKey_3d(Number(controller.mb.x), Number(controller.mb.y), Number(controller.mb.z));

         ack_retaddr = controller.apicall_get_inverse_address_for_bots(
                                                                       masterbot_key,
                                                                       ack_target_addr,
                                                                       bots_tmp_ack,
                                                                       botindex_map_ack
                                                                       );
         } // if
         } catch (err)
           {
           ack_stl_debug = {
                            error: "ACK_ROUTE_SIMULATION_FAILED",
                            message: err && err.message ? err.message : String(err),
                            mobility_mode: mobility_mode,
                            partial_ack_target_addr: ack_target_addr,
                            partial_ack_retaddr: ack_retaddr
                            };
           Logger.log("move_bot_to ack route simulation failed: " + ack_stl_debug.message);
           } // catch
      } // if
   } // if

if (communication_mode == "direct_radio")
   {
   // Keep direct-radio acknowledgement route stable:
   // target stays RID-based, return always goes to master RID.
   ack_target_addr = String(send_address ?? "").trim();
   ack_retaddr = String(controller.get_direct_radio_master_rid() ?? "").trim();
   } // if

if (typeof planned_movecmds_legacy == "string" && planned_movecmds_legacy.trim() != "")
   {
   if (allow_ack_extension === true && ack_retaddr != "")
      {
      ack_id = controller.apicall_generate_ack_id(bot_id);
      planned_raw_cmd = send_address + "#MOVE#" + planned_movecmds_legacy.trim() + ";ALIFE;" + ack_id + "#" + ack_retaddr;
      } else
        {
        planned_raw_cmd = send_address + "#MOVE#" + planned_movecmds_legacy.trim();
        } // else
   } else
     {
     planned_raw_cmd = apicall_build_raw_move_cmd(controller, send_address, planned_primitives);
     } // else

if (should_execute_move === true && planned_raw_cmd)
   {
   if (ack_id !== null)
      {
      controller.apicall_register_ack(
                                      ack_id,
                                      {
                                      bot_id: bot_id,
                                      to: { x: target_x, y: target_y, z: target_z },
                                      orientation: ack_target_orientation,
                                      planned_raw_cmd: planned_raw_cmd,
                                      retaddr: ack_retaddr,
                                      status: "pending"
                                      }
                                      );
      } // if

   raw_ret = controller.apicall_raw_cmd(planned_raw_cmd);
   controller.append_api_raw_cmd_log(planned_raw_cmd, bot_id, raw_ret.accepted ?? false);
   controller.append_api_bot_history(bot_id, "raw_cmd", { value: planned_raw_cmd }, { ok: raw_ret.ok, answer: raw_ret.answer, accepted: raw_ret.accepted ?? false });

   if ((raw_ret.accepted ?? false) !== true && ack_id !== null)
      {
      controller.apicall_mark_ack_received(ack_id, "send_failed");
      } // if

   if ((raw_ret.accepted ?? false) === true && ack_id === null)
      {
         let fallback_botindex = controller.get_bot_by_id(bot_id, controller.bots);

         if (fallback_botindex != null)
            {
            let oldx = Number(controller.bots[fallback_botindex].x);
         let oldy = Number(controller.bots[fallback_botindex].y);
         let oldz = Number(controller.bots[fallback_botindex].z);

            controller.update_keyindex(oldx, oldy, oldz, target_x, target_y, target_z);
            controller.bots[fallback_botindex].x = Number(target_x);
            controller.bots[fallback_botindex].y = Number(target_y);
            controller.bots[fallback_botindex].z = Number(target_z);
            controller.bots[fallback_botindex].vector_x = Number(ack_target_orientation.x);
            controller.bots[fallback_botindex].vector_y = Number(ack_target_orientation.y);
            controller.bots[fallback_botindex].vector_z = Number(ack_target_orientation.z);

            if (String(carried_payload_bot_id ?? "").trim() != "")
               {
               let noack_carrier_old = null;
               if (bot_snapshot && bot_snapshot.orientation)
                  {
                  noack_carrier_old = {
                                      x: Number(bot_snapshot.orientation.x),
                                      y: Number(bot_snapshot.orientation.y),
                                      z: Number(bot_snapshot.orientation.z)
                                      };
                  } // if
               controller.apicall_sync_payload_from_carrier(
                                                          bot_id,
                                                          {
                                                          x: Number(target_x),
                                                          y: Number(target_y),
                                                          z: Number(target_z)
                                                          },
                                                          {
                                                          x: Number(ack_target_orientation.x),
                                                          y: Number(ack_target_orientation.y),
                                                          z: Number(ack_target_orientation.z)
                                                          },
                                                          [],
                                                          noack_carrier_old
                                                          );
               } // if

            controller.apicall_gui_refresh();
         } // if
      } // if

   // When ACK is pending (ack_id !== null), the position update happens in the ACK handler.
   // But we still need to sync the payload position immediately so the BotController world
   // model reflects the correct payload location even before the ACK arrives.
   if (
       (raw_ret.accepted ?? false) === true &&
       ack_id !== null &&
       String(carried_payload_bot_id ?? "").trim() != ""
      )
      {
      let preack_carrier_old = null;
      if (live_botindex !== null)
         {
         preack_carrier_old = {
                              x: Number(controller.bots[live_botindex].vector_x),
                              y: Number(controller.bots[live_botindex].vector_y),
                              z: Number(controller.bots[live_botindex].vector_z)
                              };
         } // if
      controller.apicall_sync_payload_from_carrier(
                                                   bot_id,
                                                   {
                                                   x: Number(target_x),
                                                   y: Number(target_y),
                                                   z: Number(target_z)
                                                   },
                                                   {
                                                   x: Number(ack_target_orientation.x),
                                                   y: Number(ack_target_orientation.y),
                                                   z: Number(ack_target_orientation.z)
                                                   },
                                                   [],
                                                   preack_carrier_old
                                                   );
      } // if

   // After a successful move (with or without ACK), apply the target orientation
   // from ack_target_orientation to the bot's local state.
   // This ensures the BotController world model reflects the final orientation
   // even when no explicit rotation was part of the path (e.g. hybrid_kinematics
   // where the path planner only moves, but the goal_orientation is set separately).
   if (
       should_execute_move === true &&
       (raw_ret?.accepted ?? false) === true &&
       ack_target_orientation &&
       live_botindex != null
      )
      {
      let current_vx = Number(controller.bots[live_botindex].vector_x ?? 0);
      let current_vy = Number(controller.bots[live_botindex].vector_y ?? 0);
      let current_vz = Number(controller.bots[live_botindex].vector_z ?? 0);
      let target_vx = Number(ack_target_orientation.x ?? 0);
      let target_vy = Number(ack_target_orientation.y ?? 0);
      let target_vz = Number(ack_target_orientation.z ?? 0);

      // Only update if the orientation actually differs from the current one.
      // This avoids unnecessary writes when no goal_orientation was specified.
      if (
          current_vx !== target_vx ||
          current_vy !== target_vy ||
          current_vz !== target_vz
         )
         {
         controller.bots[live_botindex].vector_x = target_vx;
         controller.bots[live_botindex].vector_y = target_vy;
         controller.bots[live_botindex].vector_z = target_vz;

         if (String(carried_payload_bot_id ?? "").trim() != "")
            {
            // Pass carrier_old_orientation=null here so the sync does NOT
            // re-apply the rotation (the pre-ACK sync already handled it).
            // It will copy the carrier's new orientation instead, which is
            // correct after the first rotation was applied.
            controller.apicall_sync_payload_from_carrier(
                                                       bot_id,
                                                       {
                                                       x: Number(target_x),
                                                       y: Number(target_y),
                                                       z: Number(target_z)
                                                       },
                                                       {
                                                       x: target_vx,
                                                       y: target_vy,
                                                       z: target_vz
                                                       }
                                                       );
            } // if

          controller.apicall_gui_refresh();
          } // if
       } // if
   } // if (should_execute_move === true && planned_raw_cmd)

move_diagnostic_summary = apicall_build_move_diagnostic_summary(
                                                                controller,
                                                                planned_primitives,
                                                                planned_movecmds_legacy,
                                                                planned_raw_cmd,
                                                                path_ret.path_debug_rejections ?? []
                                                                );

if (Array.isArray(path_ret.path))
   {
   for (let i=0; i<path_ret.path.length; i++)
       {
       let p = path_ret.path[i];
       let turn_eval = controller.apicall_evaluate_turn_position(
                                                                 Number(p.x),
                                                                 Number(p.y),
                                                                 Number(p.z),
                                                                 excluded_bot_ids
                                                                 );

       if (turn_eval.turnable_same_y === true)
          {
          turn_positions_on_path.push({
                                      path_index: i,
                                      ...turn_eval
                                      });
          } // if
       } // for
   } // if

let response = {
               ok: true,
               answer: (should_execute_move ? "api_move_bot_to" : "api_diagnose_move_bot_to"),
               bot_id: bot_id,
               mobility_mode: mobility_mode,
               goal_orientation: normalized_goal_orientation,
               execution_mode: (should_execute_move ? "batched-raw-cmd" : "diagnostic-plan"),
               target: {
                        x: target_x,
                        y: target_y,
                        z: target_z
                        },
               executable: (planned_raw_cmd !== null),
               executed: (should_execute_move ? ((raw_ret?.accepted ?? false) === true) : false),
               reason: "PATH_READY_FOR_MOVE_TRANSLATION",
               current_state: bot_snapshot,
               carried_payload_bot_id: carried_payload_bot_id,
               planning_excluded_bot_ids: excluded_bot_ids,
               path_found: path_ret.path_found === true,
               path_length: path_ret.path_length ?? ((path_ret.path ?? []).length),
               planned_raw_cmd: planned_raw_cmd,
               raw_cmd_result: raw_ret,
               ack_id: ack_id,
               ack_retaddr: ack_retaddr,
               notes: [
                       "Primitive middle paths are already derived from the coordinate path.",
                       "Anchors are now selected for each primitive where possible.",
                       "A complete MOVE raw command is preferably built via the legacy calc_move_cmds() translator.",
                       "API move commands now append ALIFE with an API-specific acknowledgement id when a return address is available.",
                       (should_execute_move ? "The command is executed immediately in this version if all primitives are valid." : "Diagnostic mode stops before raw command execution and only returns the planned translation.")
                       ]
               };

// For normal move_bot_to (execution mode), strip verbose diagnostic fields to keep responses compact.
// Full diagnostic details are only included in diagnose_move_bot_to responses.
if (should_execute_move !== true)
   {
   response.turn_positions_on_path = turn_positions_on_path;
   response.path = path_ret.path ?? [];
   response.planned_moves = planned_moves;
   response.planned_primitives = planned_primitives;
   response.path_debug_rejections = path_ret.path_debug_rejections ?? [];
   response.invalid_primitive_count = move_diagnostic_summary?.invalid_primitive_count ?? 0;
   response.invalid_primitive_indices = move_diagnostic_summary?.invalid_primitive_indices ?? [];
   response.path_debug_rejection_count = move_diagnostic_summary?.path_debug_rejection_count ?? 0;
   response.path_debug_rejection_reasons = move_diagnostic_summary?.path_debug_rejection_reasons ?? [];
   response.legacy_translation_status = move_diagnostic_summary?.legacy_translation_status ?? "not_attempted";
   response.legacy_translation_warning = move_diagnostic_summary?.legacy_translation_warning ?? "";
   response.final_diagnostic_reason = move_diagnostic_summary?.final_diagnostic_reason ?? "MOVE_TRANSLATION_FAILED";
   response.planned_movecmds_legacy = planned_movecmds_legacy;
   response.ack_target_addr = ack_target_addr;
   response.ack_target_neighbors_debug = ack_target_neighbors_debug;
   response.ack_target_neighbors_live_debug = ack_target_neighbors_live_debug;
   response.ack_stl_debug = ack_stl_debug;
   } // if

return(response);
} // apicall_move_bot_to()


function apicall_diagnose_move_bot_to(controller, bot_id, x, y, z, goal_orientation = null)
{
let ret = apicall_move_bot_to(controller, bot_id, x, y, z, false, goal_orientation);

// Prüfe ob der Move den Cluster splitten würde
let split_check = controller.apicall_would_split_cluster(bot_id);
if (split_check && split_check.ok === true)
   {
   ret.would_split_cluster = (split_check.would_split_cluster === true);
   ret.disconnected_bots = Array.isArray(split_check.disconnected_bots) ? split_check.disconnected_bots : [];
   }
else
   {
   ret.would_split_cluster = false;
   ret.disconnected_bots = [];
   }

return(ret);
} // apicall_diagnose_move_bot_to()


function apicall_build_move_diagnostic_summary(controller, planned_primitives, planned_movecmds_legacy, planned_raw_cmd, path_debug_rejections = [])
{
let invalid_primitive_indices = [];
let invalid_primitive_count = 0;
let path_debug_rejection_count = 0;
let path_debug_rejection_reasons = [];
let legacy_translation_status = "not_attempted";
let legacy_translation_warning = "";
let final_diagnostic_reason = "MOVE_READY";

if (Array.isArray(planned_primitives))
   {
   for (let i = 0; i < planned_primitives.length; i++)
       {
       if (planned_primitives[i].valid !== true)
          {
          invalid_primitive_indices.push(i);
          invalid_primitive_count++;
          } // if
       } // for
   } // if

if (Array.isArray(path_debug_rejections))
   {
   path_debug_rejection_count = path_debug_rejections.length;
   path_debug_rejection_reasons = [...new Set(
                                          path_debug_rejections
                                          .map((entry) => String(entry?.reason ?? "").trim())
                                          .filter((reason) => reason != "")
                                          )];
   } // if

if (typeof planned_movecmds_legacy == "string" && planned_movecmds_legacy.trim() != "")
   {
   if (invalid_primitive_count > 0 && planned_raw_cmd == null)
      {
      legacy_translation_status = "warning_invalid_primitives_but_legacy_present";
      legacy_translation_warning = "Legacy translation produced a MOVE string although one or more anchored primitives are invalid and no raw_cmd was built.";
      final_diagnostic_reason = "LEGACY_TRANSLATION_CONFLICT";
      } // if
   else
      {
      legacy_translation_status = "legacy_ready";
      final_diagnostic_reason = "MOVE_READY";
      } // else
   } // if
else if (invalid_primitive_count > 0)
   {
   legacy_translation_status = "legacy_not_available_due_to_invalid_primitives";
   final_diagnostic_reason = "ANCHOR_FAILURE";
   } // else if
else if (typeof planned_raw_cmd == "string" && planned_raw_cmd.trim() != "")
   {
   legacy_translation_status = "raw_fallback_ready";
   final_diagnostic_reason = "MOVE_READY";
   } // else if
else
   {
   legacy_translation_status = "no_move_translation";
   final_diagnostic_reason = "MOVE_TRANSLATION_FAILED";
   } // else

return({
       invalid_primitive_count: invalid_primitive_count,
       invalid_primitive_indices: invalid_primitive_indices,
       path_debug_rejection_count: path_debug_rejection_count,
       path_debug_rejection_reasons: path_debug_rejection_reasons,
       legacy_translation_status: legacy_translation_status,
       legacy_translation_warning: legacy_translation_warning,
       final_diagnostic_reason: final_diagnostic_reason
       });
} // apicall_build_move_diagnostic_summary()


function apicall_get_valid_double_primitives(controller)
{
return([
        "TF", "FT", "FD", "DF",
        "DB", "BD", "BT", "TB",
        "TL", "LT", "LD", "DL",
        "DR", "RD", "RT", "TR"
        ]);
} // apicall_get_valid_double_primitives()


function apicall_is_valid_double_primitive(controller, slot1, slot2)
{
if (typeof slot1 != "string" || typeof slot2 != "string")
   {
   return(false);
   } // if

let pair = slot1 + slot2;
let valid_pairs = apicall_get_valid_double_primitives(controller);

return(valid_pairs.includes(pair));
} // apicall_is_valid_double_primitive()


function apicall_translate_path_to_primitive_paths(controller, path, vx, vy, vz, bots_tmp = null)
{
let planned_moves = [];
let raw_slots = [];

if (!Array.isArray(path) || path.length < 2)
   {
   return(planned_moves);
   } // if

for (let i = 0; i < path.length - 1; i++)
    {
    let current_node = path[i];
    let next_node = path[i + 1];
    let dx1 = Number(next_node.x) - Number(current_node.x);
    let dy1 = Number(next_node.y) - Number(current_node.y);
    let dz1 = Number(next_node.z) - Number(current_node.z);
    let slot1 = controller.get_cell_slot_byvector(dx1, dy1, dz1, vx, vy, vz);
    if (slot1 != "")
       {
       raw_slots.push(slot1);
       } // if
    } // for

if (!Array.isArray(bots_tmp) || bots_tmp.length === 0)
   {
   let raw_index = 0;

   for (let i = 0; i < path.length - 1 && raw_index < raw_slots.length; i++, raw_index++)
       {
       planned_moves.push({
                          from: {
                                 x: Number(path[i].x),
                                 y: Number(path[i].y),
                                 z: Number(path[i].z)
                                 },
                          to: {
                               x: Number(path[i + 1].x),
                               y: Number(path[i + 1].y),
                               z: Number(path[i + 1].z)
                               },
                          primitive_path: raw_slots[raw_index]
                          });
       } // for

   return(planned_moves);
   } // if

let bot_x = Number(path[0].x);
let bot_y = Number(path[0].y);
let bot_z = Number(path[0].z);
let path_cursor = 0;

for (let i = 0; i < raw_slots.length; i++)
    {
    let from_pos = {
                   x: Number(path[path_cursor].x),
                   y: Number(path[path_cursor].y),
                   z: Number(path[path_cursor].z)
                   };
    let primitive_path = raw_slots[i];
    let step_count = 1;
    let teststruct = controller.test_virtual_botmove(
                                                     { x: bot_x, y: bot_y, z: bot_z },
                                                     primitive_path,
                                                     bots_tmp
                                                     );

    if (teststruct?.check !== true && i + 1 < raw_slots.length)
       {
       let candidate_double = raw_slots[i] + raw_slots[i + 1];

       if (apicall_is_valid_double_primitive(controller, raw_slots[i], raw_slots[i + 1]) === true)
          {
          let double_teststruct = controller.test_virtual_botmove(
                                                              { x: bot_x, y: bot_y, z: bot_z },
                                                              candidate_double,
                                                              bots_tmp
                                                              );

          if (double_teststruct?.check === true)
             {
             primitive_path = candidate_double;
             step_count = 2;
             teststruct = double_teststruct;
             } // if
          } // if
       } // if

    let to_pos = null;

    if (teststruct?.check === true && teststruct?.lastpos != null)
       {
       to_pos = {
                x: Number(teststruct.lastpos.x),
                y: Number(teststruct.lastpos.y),
                z: Number(teststruct.lastpos.z)
                };

       let botindex = controller.get_botindex_by_xyz({ x: bot_x, y: bot_y, z: bot_z }, bots_tmp);

       if (botindex != null)
          {
          bots_tmp[botindex].x = Number(teststruct.lastpos.x);
          bots_tmp[botindex].y = Number(teststruct.lastpos.y);
          bots_tmp[botindex].z = Number(teststruct.lastpos.z);
          } // if

       bot_x = Number(teststruct.lastpos.x);
       bot_y = Number(teststruct.lastpos.y);
       bot_z = Number(teststruct.lastpos.z);
       } else
         {
         let fallback_index = Math.min(path.length - 1, path_cursor + step_count);
         to_pos = {
                  x: Number(path[fallback_index].x),
                  y: Number(path[fallback_index].y),
                  z: Number(path[fallback_index].z)
                  };
         bot_x = Number(to_pos.x);
         bot_y = Number(to_pos.y);
         bot_z = Number(to_pos.z);
         } // else

    planned_moves.push({
                       from: from_pos,
                       to: to_pos,
                       primitive_path: primitive_path
                       });

    path_cursor += step_count;
    i += (step_count - 1);
    } // for

return(planned_moves);
} // apicall_translate_path_to_primitive_paths()


function apicall_select_anchor_slot(controller, x, y, z, vx, vy, vz, excluded_slots = [], excluded_bot_ids = [])
{
const slotnames = ['D', 'R', 'L', 'B', 'F', 'T'];

for (let i = 0; i < slotnames.length; i++)
    {
    let slot = slotnames[i];

    if (excluded_slots.includes(slot))
       {
       continue;
       } // if

    let target_xyz = controller.get_next_target_coor(x, y, z, vx, vy, vz, slot);
    let occupancy = controller.apicall_is_occupied_excluding_ids(
                                                                 target_xyz.x,
                                                                 target_xyz.y,
                                                                 target_xyz.z,
                                                                 excluded_bot_ids
                                                                 );

    if (occupancy.occupied === true)
       {
       return({
              slot: slot,
              occupancy: occupancy
              });
       } // if
    } // for

return(null);
} // apicall_select_anchor_slot()


function apicall_collect_anchor_candidates(controller, x, y, z, vx, vy, vz, excluded_slots = [], excluded_bot_ids = [])
{
const slotnames = ['D', 'R', 'L', 'B', 'F', 'T'];
let candidates = [];

for (let i = 0; i < slotnames.length; i++)
    {
    let slot = slotnames[i];

    if (excluded_slots.includes(slot))
       {
       continue;
       } // if

    let target_xyz = controller.get_next_target_coor(x, y, z, vx, vy, vz, slot);
    let occupancy = controller.apicall_is_occupied_excluding_ids(
                                                                 target_xyz.x,
                                                                 target_xyz.y,
                                                                 target_xyz.z,
                                                                 excluded_bot_ids
                                                                 );

    candidates.push({
                     slot: slot,
                     position: {
                                x: Number(target_xyz.x),
                                y: Number(target_xyz.y),
                                z: Number(target_xyz.z)
                                },
                     occupied: (occupancy.occupied === true),
                     state: occupancy.state ?? (occupancy.occupied === true ? "active" : "empty"),
                     id: occupancy.id ?? null
                     });
    } // for

return(candidates);
} // apicall_collect_anchor_candidates()


function apicall_add_anchors_to_primitive_paths(controller, planned_moves, vx, vy, vz, excluded_bot_ids = [])
{
let planned_primitives = [];

if (!Array.isArray(planned_moves))
   {
   return(planned_primitives);
   } // if

for (let i = 0; i < planned_moves.length; i++)
    {
    let primitive = planned_moves[i];
    let excluded_start_slots = [];
    let excluded_end_slots = [];

    if (typeof primitive.primitive_path === "string" && primitive.primitive_path.length > 0)
       {
       excluded_start_slots.push(primitive.primitive_path.charAt(0));
       excluded_end_slots.push(primitive.primitive_path.charAt(primitive.primitive_path.length - 1));
       } // if

    let start_anchor = apicall_select_anchor_slot(
                                                  controller,
                                                  primitive.from.x,
                                                  primitive.from.y,
                                                  primitive.from.z,
                                                  vx,
                                                  vy,
                                                  vz,
                                                  excluded_start_slots,
                                                  excluded_bot_ids
                                                  );
    let start_anchor_candidates = apicall_collect_anchor_candidates(
                                                                  controller,
                                                                  primitive.from.x,
                                                                  primitive.from.y,
                                                                  primitive.from.z,
                                                                  vx,
                                                                  vy,
                                                                  vz,
                                                                  excluded_start_slots,
                                                                  excluded_bot_ids
                                                                  );
    let end_anchor = apicall_select_anchor_slot(
                                                controller,
                                                primitive.to.x,
                                                primitive.to.y,
                                                primitive.to.z,
                                                vx,
                                                vy,
                                                vz,
                                                excluded_end_slots,
                                                excluded_bot_ids
                                                );
    let end_anchor_candidates = apicall_collect_anchor_candidates(
                                                                controller,
                                                                primitive.to.x,
                                                                primitive.to.y,
                                                                primitive.to.z,
                                                                vx,
                                                                vy,
                                                                vz,
                                                                excluded_end_slots,
                                                                excluded_bot_ids
                                                                );
    let primitive_with_anchor = null;
    let rejection_reasons = [];

    if (start_anchor && end_anchor)
       {
       primitive_with_anchor = start_anchor.slot + "_" + primitive.primitive_path + "_" + end_anchor.slot;
       } // if

    if (!start_anchor)
       {
       rejection_reasons.push("NO_VALID_START_ANCHOR");
       } // if

    if (!end_anchor)
       {
       rejection_reasons.push("NO_VALID_END_ANCHOR");
       } // if

    planned_primitives.push({
                            from: primitive.from,
                            to: primitive.to,
                            primitive_path: primitive.primitive_path,
                            excluded_start_slots: excluded_start_slots,
                            excluded_end_slots: excluded_end_slots,
                            start_anchor_candidates: start_anchor_candidates,
                            end_anchor_candidates: end_anchor_candidates,
                            start_anchor: start_anchor ? start_anchor.slot : null,
                            end_anchor: end_anchor ? end_anchor.slot : null,
                            primitive_with_anchor: primitive_with_anchor,
                            valid: (primitive_with_anchor !== null),
                            rejection_reasons: rejection_reasons
                            });
    } // for

return(planned_primitives);
} // apicall_add_anchors_to_primitive_paths()


function apicall_build_raw_move_cmd(controller, address, planned_primitives)
{
let normalized_address = String(address ?? "").trim();
let primitive_strings = [];

if (normalized_address == "")
   {
   return(null);
   } // if

if (!Array.isArray(planned_primitives) || planned_primitives.length == 0)
   {
   return(null);
   } // if

for (let i = 0; i < planned_primitives.length; i++)
    {
    let entry = planned_primitives[i];

    if (entry.valid !== true || typeof entry.primitive_with_anchor !== "string" || entry.primitive_with_anchor.trim() == "")
       {
       return(null);
       } // if

    primitive_strings.push(entry.primitive_with_anchor.trim());
    } // for

return(normalized_address + "#MOVE#" + primitive_strings.join(";"));
} // apicall_build_raw_move_cmd()


module.exports = {
                 apicall_can_reach_position,
                 apicall_find_path_for_bot,
                 apicall_find_path_for_bot_payload,
                 apicall_suggest_simple_move,
                 apicall_move_bot_to,
                 apicall_diagnose_move_bot_to,
                 apicall_build_move_diagnostic_summary,
                 apicall_get_valid_double_primitives,
                 apicall_is_valid_double_primitive,
                 apicall_translate_path_to_primitive_paths,
                 apicall_select_anchor_slot,
                 apicall_collect_anchor_candidates,
                 apicall_add_anchors_to_primitive_paths,
                 apicall_build_raw_move_cmd
                 };
