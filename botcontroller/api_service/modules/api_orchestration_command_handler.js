async function write_and_close(socket, payload)
{
const answer = JSON.stringify(payload) + "\n";

socket.write(answer, () =>
             {
             socket.end();
             });
} // write_and_close()


async function handle_orchestration_api_command(controller, decodedobject, socket)
{
const cmd = decodedobject?.cmd ?? "";
const communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();

if (cmd === "version")
   {
   let ret = {
             ok: true,
             answer: "api_version",
             version: controller.version
             };
   controller.append_api_action_log("version", {}, { ok: ret.ok, answer: ret.answer, version: ret.version });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_status")
   {
   let ret = {
             ok: true,
             answer: "api_status",
             loaded_bots: controller.bots.length,
             mobility_mode: String(controller?.config?.mobility_mode ?? "full_edge").trim(),
             communication_mode: String(controller?.config?.communication_mode ?? "mesh_opcode").trim()
             };
   controller.append_api_action_log(
                                    "get_status",
                                    {},
                                    {
                                     ok: ret.ok,
                                     answer: ret.answer,
                                     loaded_bots: ret.loaded_bots,
                                     mobility_mode: ret.mobility_mode,
                                     communication_mode: ret.communication_mode
                                    }
                                    );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "structurescan")
   {
   if (communication_mode == "direct_radio")
      {
      let ret = {
                ok: false,
                answer: "api_structurescan_rejected",
                error: "STRUCTURESCAN_MESH_ONLY",
                communication_mode: communication_mode,
                hint: "Use structurescan_radio in direct_radio mode."
                };
      controller.append_api_action_log(
                                       "structurescan",
                                       {},
                                       {
                                        ok: ret.ok,
                                        answer: ret.answer,
                                        error: ret.error,
                                        communication_mode: communication_mode
                                        }
                                       );
      await write_and_close(socket, ret);
      return(true);
      } // if

   controller.start_scan(1);
   let ret = {
             ok: true,
             answer: "api_structurescan_started",
             accepted: true
             };
   controller.append_api_action_log("structurescan", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "structurescan_lvl2")
   {
   controller.start_scan_lvl2(1);
   let ret = {
             ok: true,
             answer: "api_structurescan_lvl2_started",
             accepted: true
             };
   controller.append_api_action_log("structurescan_lvl2", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "structurescan_radio")
   {
   controller.start_scan_radio(1);
   let ret = {
             ok: true,
             answer: "api_structurescan_radio_started",
             accepted: true
             };
   controller.append_api_action_log("structurescan_radio", {}, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "search_bot")
   {
   let ret = controller.apicall_search_bot(decodedobject.bot_id, decodedobject.level);
   controller.append_api_action_log(
                                    "search_bot",
                                    { bot_id: decodedobject.bot_id, level: decodedobject.level },
                                    {
                                     ok: ret.ok,
                                     answer: ret.answer,
                                     accepted: ret.accepted ?? false,
                                     bot_id: ret.bot_id ?? "",
                                     level: ret.level ?? null,
                                     error: ret.error ?? ""
                                    }
                                    );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "morph_get_structures")
   {
   let ret = controller.apicall_morph_get_structures();
   controller.append_api_action_log("morph_get_structures", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "morph_get_algos")
   {
   let ret = controller.apicall_morph_get_algos();
   controller.append_api_action_log("morph_get_algos", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "morph_start")
   {
   let ret = controller.apicall_morph_start(decodedobject.algo, decodedobject.structure);
   controller.append_api_action_log("morph_start", { algo: decodedobject.algo, structure: decodedobject.structure }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "headless")
   {
   let ret = controller.apicall_morph_start_headless(decodedobject.algo, decodedobject.structure, decodedobject.output_file ?? "", socket);
   if (ret !== null)
      {
      // Validation error - send response immediately
      controller.append_api_action_log("headless", { algo: decodedobject.algo, structure: decodedobject.structure, output_file: decodedobject.output_file ?? "" }, { ok: ret.ok, answer: ret.answer, error: ret.error ?? "" });
      await write_and_close(socket, ret);
      return(true);
      }
   // null = accepted, response will be sent via callback (socket stays open)
   controller.append_api_action_log("headless", { algo: decodedobject.algo, structure: decodedobject.structure, output_file: decodedobject.output_file ?? "" }, { ok: true, answer: "api_morph_start_headless", accepted: true });
   return(true); // return true to prevent UNKNOWN_API_COMMAND fallthrough; socket is closed by callback
   } // if

if (cmd === "morph_check_progress")
   {
   let ret = controller.apicall_get_morph_status();
   controller.append_api_action_log("morph_check_progress", {}, { ok: ret.ok, answer: ret.answer, running: ret.running ?? false, phase: ret.phase ?? "", progress: ret.progress ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "calc_crater")
   {
   let ret = controller.apicall_calc_crater_stub(decodedobject);
   controller.append_api_action_log(
                                    "calc_crater",
                                    {
                                     tx: decodedobject.tx,
                                     ty: decodedobject.ty,
                                     tz: decodedobject.tz,
                                     vx: decodedobject.vx,
                                     vy: decodedobject.vy,
                                     vz: decodedobject.vz,
                                     sx: decodedobject.sx,
                                     sy: decodedobject.sy,
                                     sz: decodedobject.sz,
                                     mode: decodedobject.mode ?? "plan",
                                     max_depth: decodedobject.max_depth ?? null
                                    },
                                    { ok: ret.ok, answer: ret.answer, implemented: ret.implemented ?? false, error: ret.error ?? "" }
                                    );
   controller.append_api_bot_history(
                                     "",
                                     "calc_crater",
                                     {
                                      tx: decodedobject.tx,
                                      ty: decodedobject.ty,
                                      tz: decodedobject.tz,
                                      vx: decodedobject.vx,
                                      vy: decodedobject.vy,
                                      vz: decodedobject.vz,
                                      sx: decodedobject.sx,
                                      sy: decodedobject.sy,
                                      sz: decodedobject.sz,
                                      mode: decodedobject.mode ?? "plan",
                                      max_depth: decodedobject.max_depth ?? null
                                     },
                                     { ok: ret.ok, answer: ret.answer, implemented: ret.implemented ?? false, error: ret.error ?? "" }
                                     );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "crater_start")
   {
   let ret = controller.apicall_crater_start(decodedobject);
   controller.append_api_action_log(
                                    "crater_start",
                                    {
                                     crater_id: decodedobject.crater_id ?? "crater_default",
                                     tx: decodedobject.tx,
                                     ty: decodedobject.ty,
                                     tz: decodedobject.tz,
                                     vx: decodedobject.vx,
                                     vy: decodedobject.vy,
                                     vz: decodedobject.vz,
                                     sx: decodedobject.sx,
                                     sy: decodedobject.sy,
                                     sz: decodedobject.sz,
                                     max_depth: decodedobject.max_depth ?? null
                                    },
                                    { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, crater_id: ret.crater_id ?? "", error: ret.error ?? "" }
                                    );
   controller.append_api_bot_history(
                                     "",
                                     "crater_start",
                                     {
                                      crater_id: decodedobject.crater_id ?? "crater_default",
                                      tx: decodedobject.tx,
                                      ty: decodedobject.ty,
                                      tz: decodedobject.tz,
                                      vx: decodedobject.vx,
                                      vy: decodedobject.vy,
                                      vz: decodedobject.vz,
                                      sx: decodedobject.sx,
                                      sy: decodedobject.sy,
                                      sz: decodedobject.sz,
                                      max_depth: decodedobject.max_depth ?? null
                                     },
                                     { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false, crater_id: ret.crater_id ?? "", error: ret.error ?? "" }
                                     );
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "crater_check_progress")
   {
   let ret = controller.apicall_get_crater_status(decodedobject.crater_id);
   controller.append_api_action_log("crater_check_progress", { crater_id: decodedobject.crater_id ?? "" }, { ok: ret.ok, answer: ret.answer, crater_id: ret.crater_id ?? "", running: ret.running ?? false, phase: ret.phase ?? "", progress: ret.progress ?? 0 });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "crater_fill")
   {
   let ret = controller.apicall_crater_fill(decodedobject.crater_id, decodedobject.mode);
   controller.append_api_action_log("crater_fill", { crater_id: decodedobject.crater_id ?? "crater_default", mode: decodedobject.mode ?? "execute" }, { ok: ret.ok, answer: ret.answer, crater_id: ret.crater_id ?? "", accepted: ret.accepted ?? false, fillable: ret.fillable ?? null, error: ret.error ?? "" });
   controller.append_api_bot_history("", "crater_fill", { crater_id: decodedobject.crater_id ?? "crater_default", mode: decodedobject.mode ?? "execute" }, { ok: ret.ok, answer: ret.answer, crater_id: ret.crater_id ?? "", accepted: ret.accepted ?? false, fillable: ret.fillable ?? null, error: ret.error ?? "" });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "crater_list")
   {
   let ret = controller.apicall_list_craters();
   controller.append_api_action_log("crater_list", {}, { ok: ret.ok, answer: ret.answer, count: ret.count ?? 0, active_crater_id: ret.active_crater_id ?? null });
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "raw_cmd")
   {
   let ret = controller.apicall_raw_cmd(decodedobject.value);
   let raw_parts = String(decodedobject.value ?? "").split("#");
   let raw_target_bot_id = controller.apicall_resolve_bot_id_by_address(raw_parts[0] ?? "");
   controller.append_api_action_log("raw_cmd", { value: decodedobject.value }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false });
   controller.append_api_raw_cmd_log(decodedobject.value, raw_target_bot_id, ret.accepted ?? false);

   if (raw_target_bot_id)
      {
      controller.append_api_bot_history(raw_target_bot_id, "raw_cmd", { value: decodedobject.value }, { ok: ret.ok, answer: ret.answer, accepted: ret.accepted ?? false });
      } // if

   await write_and_close(socket, ret);
   return(true);
   } // if

return(false);
} // handle_orchestration_api_command()


module.exports = { handle_orchestration_api_command };
