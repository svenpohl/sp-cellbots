const CalcCraterHelper = require('../../morph/calc_crater_helper');


function apicall_get_normalized_crater_id(controller, crater_id = "")
{
let normalized_crater_id = String(crater_id ?? "").trim();

if (normalized_crater_id == "")
   {
   normalized_crater_id = String(controller.api_crater_default_id ?? "crater_default");
   } // if

return(normalized_crater_id);
} // apicall_get_normalized_crater_id()


function apicall_has_running_crater_session(controller)
{
let crater_ids = Object.keys(controller.api_crater_runs ?? {});

for (let i = 0; i < crater_ids.length; i++)
    {
    let crater_id = crater_ids[i];
    let session = controller.api_crater_runs[crater_id];

    if (session?.status?.running === true)
       {
       return(true);
       } // if
    } // for

return(false);
} // apicall_has_running_crater_session()


function apicall_ensure_crater_session(controller, crater_id = "")
{
let normalized_crater_id = apicall_get_normalized_crater_id(controller, crater_id);

if (!controller.api_crater_runs[normalized_crater_id])
   {
   let now_iso = new Date().toISOString();
   controller.api_crater_runs[normalized_crater_id] = {
                                                      crater_id: normalized_crater_id,
                                                      request: null,
                                                      last_dig_plan: null,
                                                      last_fill_plan: null,
                                                      last_dig_result: null,
                                                      last_fill_result: null,
                                                      status: {
                                                               crater_id: normalized_crater_id,
                                                               mode: null,
                                                               running: false,
                                                               phase: "idle",
                                                               progress: 0,
                                                               success: null,
                                                               started_at: null,
                                                               finished_at: null,
                                                               last_update: now_iso,
                                                               message: "",
                                                               session_id: null,
                                                               total_steps: 0,
                                                               completed_steps: 0,
                                                               current_step: null,
                                                               last_result: null,
                                                               last_error: null,
                                                               failed_step: null
                                                               }
                                                      };
   } // if

return(controller.api_crater_runs[normalized_crater_id]);
} // apicall_ensure_crater_session()


function apicall_update_crater_status(controller, patch = {}, crater_id = "")
{
let normalized_crater_id = apicall_get_normalized_crater_id(controller, crater_id || controller.crater_active_id);
let crater_session = apicall_ensure_crater_session(controller, normalized_crater_id);
let now_iso = new Date().toISOString();

crater_session.status = {
                        ...crater_session.status,
                        ...(patch ?? {}),
                        crater_id: normalized_crater_id,
                        last_update: now_iso
                        };

controller.crater_active_id = normalized_crater_id;
controller.crater_status = crater_session.status;

return(crater_session.status);
} // apicall_update_crater_status()


function apicall_get_crater_status(controller, crater_id = "")
{
let normalized_crater_id = apicall_get_normalized_crater_id(controller, crater_id || controller.crater_active_id);
let crater_session = controller.api_crater_runs[normalized_crater_id];

if (!crater_session)
   {
   return({
          ok: true,
          answer: "api_crater_check_progress",
          crater_id: normalized_crater_id,
          mode: null,
          running: false,
          phase: "idle",
          progress: 0,
          success: null,
          started_at: null,
          finished_at: null,
          session_id: null,
          total_steps: 0,
          completed_steps: 0,
          current_step: null,
          message: "",
          last_result: null,
          last_error: null,
          failed_step: null,
          has_dig_plan: false,
          has_fill_plan: false
          });
   } // if

let status = crater_session.status ?? {};

return({
       ok: true,
       answer: "api_crater_check_progress",
       crater_id: normalized_crater_id,
       mode: status.mode ?? null,
       running: Boolean(status.running),
       phase: status.phase ?? "idle",
       progress: Number(status.progress ?? 0),
       success: status.success ?? null,
       started_at: status.started_at ?? null,
       finished_at: status.finished_at ?? null,
       session_id: status.session_id ?? null,
       total_steps: Number(status.total_steps ?? 0),
       completed_steps: Number(status.completed_steps ?? 0),
       current_step: status.current_step ?? null,
       message: status.message ?? "",
       last_result: status.last_result ?? null,
       last_error: status.last_error ?? null,
       failed_step: status.failed_step ?? null,
       has_dig_plan: !!crater_session.last_dig_plan,
       has_fill_plan: !!crater_session.last_fill_plan
       });
} // apicall_get_crater_status()


function apicall_list_craters(controller)
{
let crater_ids = Object.keys(controller.api_crater_runs ?? {}).sort();
let crater_list = [];

for (let i = 0; i < crater_ids.length; i++)
    {
    let crater_id = crater_ids[i];
    let crater_session = controller.api_crater_runs[crater_id] ?? {};
    let status = crater_session.status ?? {};

    crater_list.push(
                    {
                    crater_id: crater_id,
                    mode: status.mode ?? null,
                    running: Boolean(status.running),
                    phase: status.phase ?? "idle",
                    progress: Number(status.progress ?? 0),
                    success: status.success ?? null,
                    started_at: status.started_at ?? null,
                    finished_at: status.finished_at ?? null,
                    total_steps: Number(status.total_steps ?? 0),
                    completed_steps: Number(status.completed_steps ?? 0),
                    has_dig_plan: !!crater_session.last_dig_plan,
                    has_fill_plan: !!crater_session.last_fill_plan
                    }
                    );
    } // for

return({
       ok: true,
       answer: "api_crater_list",
       count: crater_list.length,
       active_crater_id: controller.crater_active_id ?? null,
       craters: crater_list
       });
} // apicall_list_craters()


function apicall_build_fill_plan_from_crater(controller, crater_id = "")
{
let normalized_crater_id = apicall_get_normalized_crater_id(controller, crater_id);
let crater_session = controller.api_crater_runs[normalized_crater_id];

if (!crater_session)
   {
   return({
          ok: false,
          answer: "api_crater_fill",
          error: "CRATER_NOT_FOUND",
          crater_id: normalized_crater_id
          });
   } // if

let dig_pair_order = Array.isArray(crater_session?.last_dig_plan?.pair_order) ? crater_session.last_dig_plan.pair_order : [];
if (dig_pair_order.length == 0)
   {
   return({
          ok: false,
          answer: "api_crater_fill",
          error: "CRATER_FILL_SOURCE_MISSING",
          crater_id: normalized_crater_id
          });
   } // if

let fill_pair_order = [];

for (let i = dig_pair_order.length - 1; i >= 0; i--)
    {
    let dig_pair = dig_pair_order[i] ?? {};
    let remove_bot = dig_pair.remove_bot ?? {};
    let crater_target = dig_pair.crater_target ?? {};

    fill_pair_order.push(
                        {
                        step: fill_pair_order.length + 1,
                        remove_bot: {
                                    id: String(remove_bot.id ?? "").trim(),
                                    x: Number(crater_target.x),
                                    y: Number(crater_target.y),
                                    z: Number(crater_target.z)
                                    },
                        crater_target: {
                                        x: Number(remove_bot.x),
                                        y: Number(remove_bot.y),
                                        z: Number(remove_bot.z)
                                        },
                        reason: "reverse_pair_order"
                        }
                        );
    } // for

let precheck_steps = [];
let blocked_steps = [];

for (let i = 0; i < fill_pair_order.length; i++)
    {
    let fill_step = fill_pair_order[i];
    let bot_id = String(fill_step?.remove_bot?.id ?? "").trim();
    let expected_from = {
                        x: Number(fill_step?.remove_bot?.x),
                        y: Number(fill_step?.remove_bot?.y),
                        z: Number(fill_step?.remove_bot?.z)
                        };
    let target_restore = {
                         x: Number(fill_step?.crater_target?.x),
                         y: Number(fill_step?.crater_target?.y),
                         z: Number(fill_step?.crater_target?.z)
                         };
    let bot_state = controller.apicall_get_bot_by_id(bot_id);
    let at_expected_position = false;
    let diagnose_ret = null;
    let executable = false;
    let blocked_reason = "";

    if (bot_state?.ok === true)
       {
       at_expected_position = (
                               Number(bot_state?.position?.x) === expected_from.x &&
                               Number(bot_state?.position?.y) === expected_from.y &&
                               Number(bot_state?.position?.z) === expected_from.z
                               );

       diagnose_ret = controller.apicall_diagnose_move_bot_to(
                                                               bot_id,
                                                               target_restore.x,
                                                               target_restore.y,
                                                               target_restore.z
                                                               );
       executable = (diagnose_ret?.ok === true && diagnose_ret?.executable === true && diagnose_ret?.path_found === true);
       } // if
    else
       {
       blocked_reason = "BOT_NOT_FOUND";
       } // else

    if (blocked_reason == "" && executable !== true)
       {
       blocked_reason = diagnose_ret?.final_diagnostic_reason ?? diagnose_ret?.reason ?? diagnose_ret?.error ?? "FILL_STEP_NOT_EXECUTABLE";
       } // if

    let precheck_entry = {
                         step: Number(fill_step?.step ?? (i + 1)),
                         bot_id: bot_id,
                         expected_from: expected_from,
                         target_restore: target_restore,
                         bot_found: (bot_state?.ok === true),
                         at_expected_position: at_expected_position,
                         executable: executable,
                         blocked_reason: (blocked_reason == "" ? null : blocked_reason)
                         };

    precheck_steps.push(precheck_entry);

    if (precheck_entry.executable !== true)
       {
       blocked_steps.push(precheck_entry);
       } // if
    } // for

return({
       ok: true,
       answer: "api_crater_fill_plan",
       crater_id: normalized_crater_id,
       fillable: (blocked_steps.length == 0),
       total_steps: fill_pair_order.length,
       pair_order: fill_pair_order,
       precheck_steps: precheck_steps,
       blocked_steps: blocked_steps
       });
} // apicall_build_fill_plan_from_crater()


async function apicall_run_crater_plan(controller, session_id, crater_id, request, plan, run_mode = "dig")
{
let normalized_crater_id = apicall_get_normalized_crater_id(controller, crater_id);
let pair_order = Array.isArray(plan?.pair_order) ? plan.pair_order : [];
let total_steps = pair_order.length;
let completed_steps = 0;
let step_results = [];
let retry_max_attempts = 2;
let phase_running = (run_mode == "fill" ? "fill_running" : "running");
let phase_finished = (run_mode == "fill" ? "fill_finished" : "finished");
let phase_failed = (run_mode == "fill" ? "fill_failed" : "failed");
let communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();
let strict_ack_mode = (communication_mode == "direct_radio");

apicall_update_crater_status(
                             controller,
                             {
                             mode: run_mode,
                             phase: phase_running,
                             progress: (total_steps === 0 ? 100 : 0),
                             total_steps: total_steps,
                             completed_steps: 0,
                             current_step: null,
                             message: (run_mode == "fill" ? "Crater fill execution started." : "Crater execution started."),
                             last_error: null,
                             failed_step: null
                             },
                             normalized_crater_id
                             );

for (let i = 0; i < total_steps; i++)
    {
    let crater_session = controller.api_crater_runs[normalized_crater_id];
    if (Number(crater_session?.status?.session_id) !== Number(session_id))
       {
       return({
              ok: false,
              error: "CRATER_SESSION_SUPERSEDED",
              step_results: step_results
              });
       } // if

    let pair_entry = pair_order[i] ?? {};
    let remove_bot = pair_entry.remove_bot ?? {};
    let crater_target = pair_entry.crater_target ?? {};
    let bot_id = String(remove_bot.id ?? "").trim();
    let target_x = Number(crater_target.x);
    let target_y = Number(crater_target.y);
    let target_z = Number(crater_target.z);
    let step_result = {
                      step: Number(pair_entry.step ?? (i + 1)),
                      bot_id: bot_id,
                      target: {
                               x: target_x,
                               y: target_y,
                               z: target_z
                               },
                      attempts: 0
                      };

    apicall_update_crater_status(
                                 controller,
                                 {
                                 current_step: step_result,
                                 phase: phase_running,
                                 message: (run_mode == "fill" ? "Executing crater fill step " : "Executing crater pair step ") + String(i + 1) + " of " + String(total_steps) + "."
                                 },
                                 normalized_crater_id
                                 );

    if (
        bot_id == "" ||
        Number.isNaN(target_x) ||
        Number.isNaN(target_y) ||
        Number.isNaN(target_z)
       )
       {
       step_result.ok = false;
       step_result.error = "INVALID_PAIR_ORDER_STEP";
       step_results.push(step_result);

       apicall_update_crater_status(
                                    controller,
                                    {
                                    running: false,
                                    phase: phase_failed,
                                    success: false,
                                    finished_at: new Date().toISOString(),
                                    progress: (total_steps > 0 ? Math.round((completed_steps / total_steps) * 100) : 0),
                                    completed_steps: completed_steps,
                                    last_result: step_result,
                                    last_error: step_result.error,
                                    failed_step: step_result,
                                    message: (run_mode == "fill" ? "Crater fill failed: invalid pair_order entry." : "Crater execution failed: invalid pair_order entry.")
                                    },
                                    normalized_crater_id
                                    );
       return({
              ok: false,
              error: "INVALID_PAIR_ORDER_STEP",
              step_results: step_results
              });
       } // if

    let bot_state_ret = controller.apicall_get_bot_by_id(bot_id);
    if (bot_state_ret?.ok !== true)
       {
       step_result.ok = false;
       step_result.error = "PAIR_BOT_NOT_FOUND";
       step_result.bot_state = bot_state_ret;
       step_results.push(step_result);

       apicall_update_crater_status(
                                    controller,
                                    {
                                    running: false,
                                    phase: phase_failed,
                                    success: false,
                                    finished_at: new Date().toISOString(),
                                    progress: (total_steps > 0 ? Math.round((completed_steps / total_steps) * 100) : 0),
                                    completed_steps: completed_steps,
                                    last_result: step_result,
                                    last_error: step_result.error,
                                    failed_step: step_result,
                                    message: (run_mode == "fill" ? "Crater fill failed: bot not found." : "Crater execution failed: remove bot not found.")
                                    },
                                    normalized_crater_id
                                    );
       return({
              ok: false,
              error: "PAIR_BOT_NOT_FOUND",
              step_results: step_results
              });
       } // if

    let move_ret = null;
    let move_ok = false;
    let last_error = "MOVE_FAILED";

    for (let attempt = 1; attempt <= retry_max_attempts; attempt++)
        {
        step_result.attempts = attempt;
        move_ret = controller.apicall_move_bot_to(bot_id, target_x, target_y, target_z, true);

        if (move_ret?.ok === true && move_ret?.ack_id)
           {
           move_ret = await controller.apicall_attach_ack_wait_and_recovery(move_ret);
           } // if

        if (strict_ack_mode === true && String(move_ret?.ack_id ?? "").trim() == "")
           {
           last_error = "DIRECT_RADIO_ACK_MISSING";
           if (attempt < retry_max_attempts)
              {
              apicall_update_crater_status(
                                           controller,
                                           {
                                           message: (run_mode == "fill" ? "Crater fill retry " : "Crater step retry ") + String(attempt + 1) + "/" + String(retry_max_attempts) + " for bot " + bot_id + " (missing ACK id)."
                                           },
                                           normalized_crater_id
                                           );
              await controller.apicall_sleep(350);
              } // if
           continue;
           } // if

        if (
            move_ret?.ok === true &&
            move_ret?.executed === true &&
            (
             strict_ack_mode === true
             ? (move_ret?.ack_received === true)
             : (move_ret?.ack_id ? move_ret?.ack_received === true : true)
            )
           )
           {
           move_ok = true;
           break;
           } // if

        if (strict_ack_mode !== true)
           {
           let position_probe = controller.apicall_get_bot_by_id(bot_id);
           if (
               position_probe?.ok === true &&
               Number(position_probe?.position?.x) === target_x &&
               Number(position_probe?.position?.y) === target_y &&
               Number(position_probe?.position?.z) === target_z
              )
              {
              move_ok = true;
              step_result.recovered_by_position_probe = true;
              break;
              } // if
           } // if

        last_error = move_ret?.error ?? (move_ret?.ack_id ? "MOVE_ACK_FAILED" : "MOVE_NOT_EXECUTED");

        if (attempt < retry_max_attempts)
           {
           apicall_update_crater_status(
                                        controller,
                                        {
                                        message: (run_mode == "fill" ? "Crater fill retry " : "Crater step retry ") + String(attempt + 1) + "/" + String(retry_max_attempts) + " for bot " + bot_id + "."
                                        },
                                        normalized_crater_id
                                        );
           await controller.apicall_sleep(350);
           } // if
        } // for

    if (move_ok !== true)
       {
       step_result.ok = false;
       step_result.error = "MOVE_EXECUTION_FAILED_AFTER_RETRY";
       step_result.last_error = last_error;
       step_result.move_result = move_ret;
       step_results.push(step_result);

       apicall_update_crater_status(
                                    controller,
                                    {
                                    running: false,
                                    phase: phase_failed,
                                    success: false,
                                    finished_at: new Date().toISOString(),
                                    progress: (total_steps > 0 ? Math.round((completed_steps / total_steps) * 100) : 0),
                                    completed_steps: completed_steps,
                                    last_result: step_result,
                                    last_error: step_result.error,
                                    failed_step: step_result,
                                    message: (run_mode == "fill" ? "Crater fill failed during move execution." : "Crater execution failed during move execution.")
                                    },
                                    normalized_crater_id
                                    );
       return({
              ok: false,
              error: step_result.error,
              step_results: step_results
              });
       } // if

    completed_steps++;
    step_result.ok = true;
    step_result.move_result = {
                              answer: move_ret?.answer ?? "",
                              ack_id: move_ret?.ack_id ?? null,
                              ack_received: move_ret?.ack_received ?? null
                              };
    step_results.push(step_result);

    apicall_update_crater_status(
                                 controller,
                                 {
                                 completed_steps: completed_steps,
                                 progress: Math.round((completed_steps / total_steps) * 100),
                                 last_result: step_result,
                                 message: (run_mode == "fill" ? "Crater fill step " : "Crater step ") + String(completed_steps) + "/" + String(total_steps) + " completed."
                                 },
                                 normalized_crater_id
                                 );
    } // for

apicall_update_crater_status(
                             controller,
                             {
                             running: false,
                             phase: phase_finished,
                             success: true,
                             finished_at: new Date().toISOString(),
                             progress: 100,
                             completed_steps: completed_steps,
                             current_step: null,
                             message: (run_mode == "fill" ? "Crater fill finished successfully." : "Crater execution finished successfully."),
                             failed_step: null
                             },
                             normalized_crater_id
                             );

let crater_session = apicall_ensure_crater_session(controller, normalized_crater_id);
if (run_mode == "fill")
   {
   crater_session.last_fill_result = {
                                    ok: true,
                                    step_results: step_results
                                    };
   } // if
else
   {
   crater_session.last_dig_result = {
                                   ok: true,
                                   step_results: step_results
                                   };
   } // else

return({
       ok: true,
       step_results: step_results
       });
} // apicall_run_crater_plan()


function apicall_crater_start(controller, decodedobject = {})
{
if (apicall_has_running_crater_session(controller) === true)
   {
   return({
          ok: false,
          answer: "api_crater_start",
          accepted: false,
          error: "CRATER_ALREADY_RUNNING",
          crater_status: apicall_get_crater_status(controller)
          });
   } // if

let crater_id = apicall_get_normalized_crater_id(controller, decodedobject.crater_id);
let request = {
              tx: Number(decodedobject.tx),
              ty: Number(decodedobject.ty),
              tz: Number(decodedobject.tz),
              vx: Number(decodedobject.vx),
              vy: Number(decodedobject.vy),
              vz: Number(decodedobject.vz),
              sx: Number(decodedobject.sx),
              sy: Number(decodedobject.sy),
              sz: Number(decodedobject.sz),
              mode: "plan",
              max_depth: (decodedobject.max_depth !== undefined ? decodedobject.max_depth : null)
              };
let plan_ret = apicall_calc_crater_stub(controller, request);
let pair_order = Array.isArray(plan_ret?.plan?.pair_order) ? plan_ret.plan.pair_order : [];
let session_id = (++controller.api_crater_counter);
let now_iso = new Date().toISOString();
let crater_session = apicall_ensure_crater_session(controller, crater_id);

if (plan_ret?.ok !== true || !plan_ret?.plan)
   {
   return({
          ok: false,
          answer: "api_crater_start",
          accepted: false,
          crater_id: crater_id,
          error: plan_ret?.error ?? "CRATER_PLAN_FAILED",
          planning: plan_ret
          });
   } // if

crater_session.request = request;
crater_session.last_dig_plan = plan_ret.plan;

apicall_update_crater_status(
                             controller,
                             {
                             mode: "dig",
                             running: true,
                             phase: "planned",
                             progress: (pair_order.length === 0 ? 100 : 0),
                             success: null,
                             started_at: now_iso,
                             finished_at: null,
                             session_id: session_id,
                             request: request,
                             total_steps: pair_order.length,
                             completed_steps: 0,
                             current_step: null,
                             last_result: null,
                             last_error: null,
                             failed_step: null,
                             message: (pair_order.length === 0 ? "Crater plan has no executable pair_order steps." : "Crater plan accepted; execution queued.")
                             },
                             crater_id
                             );

setTimeout(
           async () => {
             await apicall_run_crater_plan(controller, session_id, crater_id, request, plan_ret.plan, "dig");
           },
           0
           );

return({
       ok: true,
       answer: "api_crater_start",
       accepted: true,
       crater_id: crater_id,
       session_id: session_id,
       request: request,
       planning: {
                 excavation_count: Number(plan_ret?.plan?.stats?.excavation_count ?? 0),
                 crater_count: Number(plan_ret?.plan?.stats?.crater_count ?? 0),
                 pair_count: Number(plan_ret?.plan?.stats?.pair_count ?? pair_order.length)
                 },
       total_steps: pair_order.length,
       crater_status: apicall_get_crater_status(controller, crater_id)
       });
} // apicall_crater_start()


function apicall_crater_fill(controller, crater_id = "", mode = "execute")
{
let normalized_crater_id = apicall_get_normalized_crater_id(controller, crater_id);
let normalized_mode = String(mode ?? "execute").trim().toLowerCase();

if (apicall_has_running_crater_session(controller) === true)
   {
   return({
          ok: false,
          answer: "api_crater_fill",
          crater_id: normalized_crater_id,
          accepted: false,
          error: "CRATER_ALREADY_RUNNING"
          });
   } // if

let fill_plan_ret = apicall_build_fill_plan_from_crater(controller, normalized_crater_id);
if (fill_plan_ret?.ok !== true)
   {
   return(fill_plan_ret);
   } // if

let crater_session = apicall_ensure_crater_session(controller, normalized_crater_id);
crater_session.last_fill_plan = {
                                pair_order: fill_plan_ret.pair_order,
                                precheck_steps: fill_plan_ret.precheck_steps,
                                blocked_steps: fill_plan_ret.blocked_steps
                                };

if (normalized_mode == "plan" || normalized_mode == "check" || normalized_mode == "dry")
   {
   return({
          ok: true,
          answer: "api_crater_fill",
          crater_id: normalized_crater_id,
          mode: "plan",
          accepted: false,
          fillable: fill_plan_ret.fillable,
          total_steps: fill_plan_ret.total_steps,
          precheck_steps: fill_plan_ret.precheck_steps,
          blocked_steps: fill_plan_ret.blocked_steps
          });
   } // if

if (fill_plan_ret.fillable !== true)
   {
   return({
          ok: false,
          answer: "api_crater_fill",
          crater_id: normalized_crater_id,
          accepted: false,
          error: "FILL_NOT_POSSIBLE",
          total_steps: fill_plan_ret.total_steps,
          blocked_steps: fill_plan_ret.blocked_steps
          });
   } // if

let session_id = (++controller.api_crater_counter);
let now_iso = new Date().toISOString();
let fill_request = {
                   crater_id: normalized_crater_id,
                   mode: "fill"
                   };

apicall_update_crater_status(
                             controller,
                             {
                             mode: "fill",
                             running: true,
                             phase: "fill_planned",
                             progress: (fill_plan_ret.total_steps === 0 ? 100 : 0),
                             success: null,
                             started_at: now_iso,
                             finished_at: null,
                             session_id: session_id,
                             request: fill_request,
                             total_steps: fill_plan_ret.total_steps,
                             completed_steps: 0,
                             current_step: null,
                             last_result: null,
                             last_error: null,
                             failed_step: null,
                             message: (fill_plan_ret.total_steps === 0 ? "Crater fill has no executable steps." : "Crater fill accepted; execution queued.")
                             },
                             normalized_crater_id
                             );

setTimeout(
           async () => {
             await apicall_run_crater_plan(
                                           controller,
                                           session_id,
                                           normalized_crater_id,
                                           fill_request,
                                           { pair_order: fill_plan_ret.pair_order },
                                           "fill"
                                           );
           },
           0
           );

return({
       ok: true,
       answer: "api_crater_fill",
       crater_id: normalized_crater_id,
       accepted: true,
       mode: "execute",
       session_id: session_id,
       fillable: true,
       total_steps: fill_plan_ret.total_steps,
       crater_status: apicall_get_crater_status(controller, normalized_crater_id)
       });
} // apicall_crater_fill()


function apicall_calc_crater_stub(controller, decodedobject = {})
{
let context = {
              botcontroller: controller,
              world: {
                     bots: controller.bots,
                     botindex: controller.botindex
                     }
              };

return( CalcCraterHelper.calcCrater(decodedobject, context) );
} // apicall_calc_crater_stub()


module.exports = {
                 apicall_get_normalized_crater_id,
                 apicall_has_running_crater_session,
                 apicall_ensure_crater_session,
                 apicall_update_crater_status,
                 apicall_get_crater_status,
                 apicall_list_craters,
                 apicall_build_fill_plan_from_crater,
                 apicall_run_crater_plan,
                 apicall_crater_start,
                 apicall_crater_fill,
                 apicall_calc_crater_stub
                 };
