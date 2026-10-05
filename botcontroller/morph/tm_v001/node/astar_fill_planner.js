"use strict";

/**
 * Atomic, sequential A* fallback for the TransformerMorph module.
 *
 * The proven vehicle-kinematics planner remains the source of truth for the
 * primitives.  This adapter intentionally exposes only one operation: move
 * one available donor to one open target.  It neither schedules pairs nor
 * creates parallel waves.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Vendored locally so tm_v001 remains copyable as one self-contained module.
const LEGACY_PLANNER = path.join(__dirname, "vk_legacy_planner.js");


function isLegacyDebugPath(filePath)
{
const name = String(filePath || "");
return(name.endsWith("morph_vehicle_kinematics_parallel2.log") ||
       name.endsWith("morph_vehicle_kinematics_parallel2_morphplan.txt") ||
       name.endsWith("morph_vehicle_kinematics_parallel2_validpath.log") ||
       name.endsWith("wouldsplit_debug.log"));
} // isLegacyDebugPath()


function legacyPlannerClass()
{
if (!fs.existsSync(LEGACY_PLANNER))
   {
   throw new Error("ASTAR_PLANNER_MISSING: " + LEGACY_PLANNER);
   }

class MinimalMorphBase
{
constructor()
{
} // constructor()
} // class MinimalMorphBase

const silentFs = new Proxy(fs,
   {
   get(target, property)
      {
      if (property === "writeFileSync" || property === "appendFileSync")
         {
         return function (filePath, ...args)
            {
            if (isLegacyDebugPath(filePath)) return(undefined);
            return(target[property](filePath, ...args));
            };
         }
      return(target[property]);
      } // get()
   });

const legacyRequire = function (requested)
{
if (requested === "./morph_base") return(MinimalMorphBase);
if (requested === "../../common/config_parser.js")
   {
   return({ parse_config_file: function () { return({}); } });
   }
if (requested === "../logger") return({});
if (requested === "fs") return(silentFs);
if (requested === "path") return(path);
return(require(requested));
}; // legacyRequire()

const source = fs.readFileSync(LEGACY_PLANNER, "utf8");
const legacyModule = { exports: {} };
const context = vm.createContext(
   {
   module: legacyModule,
   exports: legacyModule.exports,
   require: legacyRequire,
   __dirname: path.dirname(LEGACY_PLANNER),
   __filename: LEGACY_PLANNER,
   console,
   Map,
   Set,
   Object,
   Array,
   Number,
   String,
   Boolean,
   Math,
   Date,
   JSON,
   Error,
   Infinity,
   process
   });
vm.runInContext(source, context, { filename: LEGACY_PLANNER, displayErrors: true });
return(legacyModule.exports);
} // legacyPlannerClass()


function cloneBot(bot)
{
return({ ...bot,
         x: Number(bot.x), y: Number(bot.y), z: Number(bot.z),
         vx: Number(bot.vx ?? 0), vy: Number(bot.vy ?? 0), vz: Number(bot.vz ?? 1) });
} // cloneBot()


// A target without a supplied heading must remain unoriented (0, 0, 0).
// The legacy planner then derives its final heading from the target structure.
function cloneTarget(target)
{
return({ ...target,
         x: Number(target.x), y: Number(target.y), z: Number(target.z),
         vx: Number(target.vx ?? 0), vy: Number(target.vy ?? 0), vz: Number(target.vz ?? 0) });
} // cloneTarget()


function manhattan(a, b)
{
return(Math.abs(Number(a.x) - Number(b.x)) +
       Math.abs(Number(a.y) - Number(b.y)) +
       Math.abs(Number(a.z) - Number(b.z)));
} // manhattan()


class AStarFillPlanner
{
constructor({ targetStructure, params = {} })
{
this.targetStructure = targetStructure.map(cloneTarget);
this.params = { ...params, max_paths_in_wave: 1, vk_max_search_steps: Number(params.vk_max_search_steps ?? 100000) };
this.LegacyPlanner = legacyPlannerClass();
} // constructor()


planOneWave({ worldState, target, donorCandidates })
{
const targetState = cloneTarget(target);
const planner = new this.LegacyPlanner(worldState.map(cloneBot), this.targetStructure.map(cloneTarget), this.params);
const candidates = donorCandidates.map(cloneBot).sort((left, right) => manhattan(right, targetState) - manhattan(left, targetState));
const rejected = [];

for (let index = 0; index < candidates.length; index++)
   {
   const donor = candidates[index];
   const actualDonor = worldState.find(item => String(item.id) === String(donor.id));
   if (!actualDonor) continue;
   const result = planner._buildWorldAndPlanPath(actualDonor, targetState, worldState, actualDonor,
                                                  Array.isArray(this.params.forbiddenCells) ? this.params.forbiddenCells : null);
   if (result?.ok && Array.isArray(result.states) && result.states.length >= 2)
      {
      const states = result.states.map(cloneBot);
      return({ ok: true,
               donorId: String(actualDonor.id),
               from: cloneBot(actualDonor),
               to: cloneBot(states[states.length - 1]),
               fullPath: states,
               actions: Array.isArray(result.actions) ? result.actions.slice() : [],
               diagnostics: { expanded_nodes: Number(result.expanded_nodes ?? 0),
                              generated_nodes: Number(result.generated_nodes ?? 0),
                              candidates_rejected: rejected } });
      }
   rejected.push({ donor_id: String(actualDonor.id),
                   error: String(result?.error_code || result?.error || "PATH_NOT_FOUND"),
                   dominant_block_reason: result?.dominant_block_reason || null });
   } // for candidates

return({ ok: false,
         code: "ASTAR_NO_PATH",
         message: "No valid sequential vehicle-kinematics path for the remaining target",
         diagnostics: { candidates_rejected: rejected } });
} // planOneWave()
} // class AStarFillPlanner


module.exports = AStarFillPlanner;
