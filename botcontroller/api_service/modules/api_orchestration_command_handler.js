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
   let resilience_summary = "";
   if (controller.resilienceController && typeof controller.resilienceController.report_summary === "function")
      {
      resilience_summary = controller.resilienceController.report_summary();
      }
   let ret = {
             ok: true,
             answer: "api_status",
             loaded_bots: controller.bots.length,
             mobility_mode: String(controller?.config?.mobility_mode ?? "full_edge").trim(),
             communication_mode: String(controller?.config?.communication_mode ?? "mesh_opcode").trim(),
             resilience: resilience_summary
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
   // console.log("[SCAN-MARKER] structurescan command received");
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

   // Clear GUI (like WebGUI button: removeAllCubes(false) + getclusterdata)
   controller.notify_frontend([{ event: 'clearscene' }]);
   controller.notify_frontend([{ event: 'refreshworld' }]);
   controller.adc_start_scan(1);
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
   let connector = String(decodedobject.connector ?? "").trim();

   // Auto-Routing: No connector set → check if target bot has an ADC assignment
   if (connector === "" && controller.accessDomainController) {
       let raw_parts = String(decodedobject.value ?? "").split("#");
       let targetBotId = controller.apicall_resolve_bot_id_by_address(raw_parts[0] ?? "");
       if (targetBotId) {
           let assignment = controller.accessDomainController.adc_getAssignment(targetBotId);
           if (assignment) {
               connector = assignment.connector_id;
           }
       }
   }

   let ret = controller.apicall_raw_cmd(decodedobject.value, connector);
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

if (cmd === "assign_bot_to_mb")
   {
   let bot_id = String(decodedobject.bot_id ?? "").trim();
   let hmb_id = String(decodedobject.hmb_id ?? "").trim();

   if (!bot_id || !hmb_id)
      {
      let ret = { ok: false, answer: "api_assign_bot_to_mb", error: "MISSING_PARAMETERS" };
      await write_and_close(socket, ret);
      return(true);
      }

   if (!controller.accessDomainController)
      {
      let ret = { ok: false, answer: "api_assign_bot_to_mb", error: "ADC_NOT_AVAILABLE" };
      await write_and_close(socket, ret);
      return(true);
      }

   let ret = controller.accessDomainController.adc_assignBot(hmb_id, bot_id);
   ret.answer = "api_assign_bot_to_mb";
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_assigned_bots")
   {
   let map = {};
   if (controller.accessDomainController) {
       map = controller.accessDomainController.botMap || {};
   }
   let ret = {
       ok: true,
       answer: "api_get_assigned_bots",
       assignments: map,
       count: Object.keys(map).length
   };
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_status_adc")
   {
   let ret = {
       ok: true,
       answer: "api_get_status_adc",
       domains: {},
       total_assigned: 0
   };

   if (controller.accessDomainController && controller.accessDomainController.helper_masterbots)
      {
      let botMap = controller.accessDomainController.botMap || {};
      let assigned_counts = {};

      for (let botId in botMap)
          {
          let hmb_id = botMap[botId].hmb_id || "unknown";
          if (!assigned_counts[hmb_id]) assigned_counts[hmb_id] = 0;
          assigned_counts[hmb_id]++;
          }

      for (let id in controller.accessDomainController.helper_masterbots)
          {
          let mb = controller.accessDomainController.helper_masterbots[id];
          if (mb.type !== "masterbot") continue;
          ret.domains[id] = {
              role: mb.role || "helper",
              connector: mb.connector_id || "",
              position: mb.pos || { x:0, y:0, z:0 },
              assigned_bots: assigned_counts[id] || 0
          };
          ret.total_assigned += assigned_counts[id] || 0;
          }
      }

   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "check_if_inactive")
   {
   let x = Number(decodedobject.x), y = Number(decodedobject.y), z = Number(decodedobject.z);
   let ret = { ok: false, answer: "api_check_if_inactive", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.check_if_inactive === "function")
      {
      ret = await controller.resilienceController.check_if_inactive(x, y, z);
      ret.answer = "api_check_if_inactive";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "diagnose_bot_address")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let ret = { ok: false, answer: "api_diagnose_bot_address", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.diagnose_bot_address === "function")
      {
      ret = await controller.resilienceController.diagnose_bot_address(botId);
      ret.answer = "api_diagnose_bot_address";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "trace_move_path")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let x = Number(decodedobject.x ?? 0);
   let y = Number(decodedobject.y ?? 0);
   let z = Number(decodedobject.z ?? 0);
   let ret = { ok: false, answer: "api_trace_move_path", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.trace_move_path === "function")
      {
      ret = await controller.resilienceController.trace_move_path(botId, x, y, z);
      ret.answer = "api_trace_move_path";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "verify_bot_position")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let x = Number(decodedobject.x ?? 0);
   let y = Number(decodedobject.y ?? 0);
   let z = Number(decodedobject.z ?? 0);
   let ret = { ok: false, answer: "api_verify_bot_position", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.verify_bot_position === "function")
      {
      ret = await controller.resilienceController.verify_bot_position(botId, x, y, z);
      ret.answer = "api_verify_bot_position";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "integrate_bot")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let ret = { ok: false, answer: "api_integrate_bot", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.integrate_bot === "function")
      {
      try {
          ret = await controller.resilienceController.integrate_bot(botId);
          ret.answer = "api_integrate_bot";
      } catch(e) {
          ret = { ok: false, answer: "api_integrate_bot", error: e.message };
      }
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "check_mbs")
   {
   let ret = { ok: false, answer: "api_check_mbs", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.check_mbs === "function")
      {
      ret = await controller.resilienceController.check_mbs();
      ret.answer = "api_check_mbs";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "set_active")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let active = String(decodedobject.active ?? "true").trim().toLowerCase();
   let ret = { ok: false, answer: "api_set_active", error: "BOT_NOT_FOUND" };
   let botIdx = controller.get_bot_by_id(botId, controller.bots);
   if (botIdx !== null && botIdx !== undefined) {
       let bot = controller.bots[botIdx];
       if (active === "false" || active === "0") {
           // Add to detected_inactive_bots
           if (typeof controller.register_inactive_detected === "function") {
               controller.register_inactive_detected(
                   Number(bot.x), Number(bot.y), Number(bot.z),
                   Number(bot.vector_x), Number(bot.vector_y), Number(bot.vector_z),
                   "api", "set_active"
               );
           }
           bot.inactive = true;
           ret = { ok: true, answer: "api_set_active", bot_id: botId, active: false };
           // Trigger recalibrate after state change
           if (typeof controller.apicall_recalibrate_bot_addresses === "function") {
               controller.apicall_recalibrate_bot_addresses("standard");
               ret.recalibrate_triggered = true;
           }
       } else {
           // Remove from detected_inactive_bots
           if (Array.isArray(controller.detected_inactive_bots)) {
               let botKey = controller.getKey_3d(Number(bot.x), Number(bot.y), Number(bot.z));
               controller.detected_inactive_bots = controller.detected_inactive_bots.filter(d => {
                   let dKey = controller.getKey_3d(Number(d.x), Number(d.y), Number(d.z));
                   return dKey !== botKey;
               });
           }
           bot.inactive = false;
           ret = { ok: true, answer: "api_set_active", bot_id: botId, active: true };
           // Trigger recalibrate after state change
           if (typeof controller.apicall_recalibrate_bot_addresses === "function") {
               controller.apicall_recalibrate_bot_addresses("standard");
               ret.recalibrate_triggered = true;
           }
           // Trigger GUI refresh to update bot color
           if (typeof controller.apicall_gui_refresh === "function") {
               controller.apicall_gui_refresh();
           }
       }
   }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "remove_bot")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let ret = { ok: false, answer: "api_remove_bot", error: "BOT_NOT_FOUND" };
   let botIdx = controller.get_bot_by_id(botId, controller.bots);
   if (botIdx !== null && botIdx !== undefined) {
       let bot = controller.bots[botIdx];
       let pos = { x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) };

       // Aus detected_inactive_bots entfernen falls vorhanden
       if (Array.isArray(controller.detected_inactive_bots)) {
           let botKey = controller.getKey_3d(pos.x, pos.y, pos.z);
           controller.detected_inactive_bots = controller.detected_inactive_bots.filter(d => {
               let dKey = controller.getKey_3d(Number(d.x), Number(d.y), Number(d.z));
               return dKey !== botKey;
           });
       }

       // ADC-Zuordnung aufräumen
       if (controller.accessDomainController && controller.accessDomainController.botMap) {
           delete controller.accessDomainController.botMap[botId];
       }

       // Resilience-Score löschen
       if (controller.resilienceController && controller.resilienceController.botScores) {
           delete controller.resilienceController.botScores[botId];
       }

       // Bot aus Weltmodell entfernen
       controller.bots.splice(botIdx, 1);
       // botindex konsistent halten: alten Eintrag löschen, alle Indizes ab botIdx neu setzen
       let botKey = controller.getKey_3d(pos.x, pos.y, pos.z);
       delete controller.botindex[botKey];
       for (let ri = botIdx; ri < controller.bots.length; ri++) {
           if (controller.bots[ri]) {
               controller.set_3d(controller.bots[ri].x, controller.bots[ri].y, controller.bots[ri].z, ri);
           }
       }
       ret = { ok: true, answer: "api_remove_bot", bot_id: botId, removed: true, position: pos };

       // Adress-Neuberechnung (stört den anschliessenden Ping nicht – integrate_bot nutzt Zielkoordinate)
       if (typeof controller.apicall_recalibrate_bot_addresses === "function") {
           controller.apicall_recalibrate_bot_addresses("standard");
           ret.recalibrate_triggered = true;
       }

       // GUI aktualisieren
       if (typeof controller.apicall_gui_refresh === "function") {
           controller.apicall_gui_refresh();
       }

       ret.message = "Bot " + botId + " removed from world model – use ping_position + integrate_bot to re-add";
   }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "set_mobility")
   {
   let botId = String(decodedobject.bot_id ?? "").trim();
   let mobility = String(decodedobject.mobility ?? "true").trim().toLowerCase();
   let ret = { ok: false, answer: "api_set_mobility", error: "BOT_NOT_FOUND" };
   let botIdx = controller.get_bot_by_id(botId, controller.bots);
   if (botIdx !== null && botIdx !== undefined) {
       let bot = controller.bots[botIdx];
       bot.mobility = (mobility !== "false" && mobility !== "0");
       ret = { ok: true, answer: "api_set_mobility", bot_id: botId, mobility: bot.mobility };
       // Trigger recalibrate after mobility change (affects morph donor selection)
       if (typeof controller.apicall_recalibrate_bot_addresses === "function") {
           controller.apicall_recalibrate_bot_addresses("standard");
           ret.recalibrate_triggered = true;
       }
       // Trigger GUI refresh to update bot color
       if (typeof controller.apicall_gui_refresh === "function") {
           controller.apicall_gui_refresh();
       }
   }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "get_resilience_status")
   {
   let ret = { ok: false, answer: "api_get_resilience_status", error: "RESILIENCE_NOT_AVAILABLE" };
   if (controller.resilienceController && typeof controller.resilienceController.report_detailed === "function")
      {
      ret = controller.resilienceController.report_detailed();
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "adc_assign_proximity")
   {
   let ret = { ok: false, answer: "api_adc_assign_proximity", error: "ADC_NOT_AVAILABLE" };
   if (controller.accessDomainController)
      {
      ret = controller.accessDomainController.adc_assign_proximity();
      ret.answer = "api_adc_assign_proximity";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "disable_mb")
   {
   let mb_id = String(decodedobject.mb_id ?? "").trim();
   if (!mb_id)
      {
      let ret = { ok: false, answer: "api_disable_mb", error: "MISSING_MB_ID" };
      await write_and_close(socket, ret);
      return(true);
      }
   let ret = { ok: false, answer: "api_disable_mb", error: "ADC_NOT_AVAILABLE" };
   if (controller.accessDomainController)
      {
      ret = controller.accessDomainController.adc_disable_mb(mb_id);
      ret.answer = "api_disable_mb";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "enable_mb")
   {
   let mb_id = String(decodedobject.mb_id ?? "").trim();
   if (!mb_id)
      {
      let ret = { ok: false, answer: "api_enable_mb", error: "MISSING_MB_ID" };
      await write_and_close(socket, ret);
      return(true);
      }
   let ret = { ok: false, answer: "api_enable_mb", error: "ADC_NOT_AVAILABLE" };
   if (controller.accessDomainController)
      {
      ret = controller.accessDomainController.adc_enable_mb(mb_id);
      ret.answer = "api_enable_mb";
      }
   await write_and_close(socket, ret);
   return(true);
   } // if

if (cmd === "generate_detour_address")
   {
   let bot_id = String(decodedobject.bot_id ?? "").trim();
   if (!bot_id)
      {
      await write_and_close(socket, { ok: false, answer: "api_generate_detour_address", error: "MISSING_BOT_ID" });
      return(true);
      }
   let botindex = controller.get_bot_by_id(bot_id, controller.bots);
   if (botindex == null || botindex === undefined)
      {
      await write_and_close(socket, { ok: false, answer: "api_generate_detour_address", error: "BOT_NOT_FOUND" });
      return(true);
      }
   let detour = controller.get_mb_returnaddr_detour(
      {x: controller.mb.x, y: controller.mb.y, z: controller.mb.z},
      {
         x: Number(controller.bots[botindex].x),
         y: Number(controller.bots[botindex].y),
         z: Number(controller.bots[botindex].z)
      },
      controller.bots,
      [],
      {}
   );
   controller.bots[botindex].adress_detour = detour;
   await write_and_close(socket, {
      ok: true,
      answer: "api_generate_detour_address",
      bot_id: bot_id,
      adress_detour: detour
   });
   return(true);
   } // if

return(false);
} // handle_orchestration_api_command()


module.exports = { handle_orchestration_api_command };
