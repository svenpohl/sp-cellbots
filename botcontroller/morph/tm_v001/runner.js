#!/usr/bin/env node
/**
 * runner.js - TransformerMorph v001
 *
 * Reference implementation of a file-based morph module (Morph Plugin API v1).
 *
 * Stage 4:
 *   - delegates the frozen, sequential TransformerMorph inference to Python
 *   - remains the SOLE owner of the atomic morph_output.json publication
 *   - preserves the file-based Morph Plugin API v1 protocol
 *
 * Contract (see codex/morphinterface/morph_algo_interface.md):
 *   MORPH_STATUS {json}            progress/status line (one JSON object per line)
 *   MORPH_RESULT_READY <file>      output file is complete and ready to be read
 *   MORPH_ERROR {json}             error reporting (code + message)
 *
 * Hand-crafted plan: 2-bot tower plus B56 moving around it.
 *   wave 1 (parallel): B57 (3,0,0)->(3,1,2) and B55 (5,0,0)->(5,1,2)
 *   wave 2 (single):   B55 (5,1,2)->(3,2,2)   climb onto B57 (tower middle)
 *   wave 3 (single):   B56 (4,0,0)->(3,3,2)   around the tower (z+1) and up on the left side
 *
 * fullPath convention:
 *   - one entry per step
 *   - 'dir' = ORIENTATION key of that step: ZP (+Z), ZN (-Z), PX (+X), XN (-X)
 *     (the generator derives the rotation primitive D_SL_D / D_SR_D from the
 *      orientation change between two steps - a wrong key means no SPIN!)
 *   - a step with the same position but a new orientation is a rotation in place
 *   - 'support_mode' = floor (walking) or wall (climbing)
 */

const fs   = require('fs');
const path = require('path');
const childProcess = require('child_process');
const AStarFillPlanner = require('./node/astar_fill_planner');

const OUTPUT_FILE = 'morph_output.json';
const INPUT_FILE = 'morph_input.json';
const PYTHON_RUNNER = path.join(__dirname, 'python', 'tm_infer.py');
const DEFAULT_CHECKPOINT = path.join(__dirname, 'models', 'morph_s2_consolidation_v9_stage15000_inference.pt');


// Remove a stale output file from a previous run BEFORE doing anything else,
// so the controller can never execute an old morph plan.
function removeStaleOutput()
{
const output_path = path.join(__dirname, OUTPUT_FILE);

try
   {
   if (fs.existsSync(output_path))
      {
      fs.unlinkSync(output_path);
      }
   } catch (e)
     {
     // Non-fatal: report as diagnostic, keep the run alive
     emitLine('MORPH_ERROR ' + JSON.stringify({ code: "STALE_OUTPUT_REMOVE_FAILED", message: String(e?.message ?? e) }));
     } // catch
} // removeStaleOutput()


// Emit one protocol line to stdout (the BotController reads stdout line by line).
function emitLine(line)
{
process.stdout.write(String(line) + "\n");
} // emitLine()


// Promise-based delay so the status sequence stays readable.
function delay(ms)
{
return(new Promise(resolve => setTimeout(resolve, ms)));
} // delay()


// Read morph_input.json (written by the BotController for this module).
// Returns null when the file is missing or unreadable (non-fatal).
function readMorphInput()
{
const input_path = path.join(__dirname, 'morph_input.json');

try
   {
   if (!fs.existsSync(input_path)) return(null);
   return(JSON.parse(fs.readFileSync(input_path, 'utf8')));
   } catch (e)
     {
     emitLine('MORPH_ERROR ' + JSON.stringify({ code: "MORPH_INPUT_INVALID", message: String(e?.message ?? e) }));
     return(null);
     } // catch
} // readMorphInput()


// Python owns inference only. It writes JSON to stdout; Node remains the
// file-contract owner and publishes that JSON atomically below.
function buildMorphLog()
{
const input_path = path.join(__dirname, INPUT_FILE);
const checkpoint = process.env.TM_CHECKPOINT || DEFAULT_CHECKPOINT;
const python = process.env.TM_PYTHON || 'python3';
const seed = process.env.TM_SEED || '45';
const run = childProcess.spawnSync(python, [PYTHON_RUNNER, '--input', input_path,
                                            '--checkpoint', checkpoint, '--seed', seed],
                                   { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (run.error)
   {
   throw(run.error);
   }
let plan;
try
   {
   plan = JSON.parse(run.stdout);
   } catch (error)
     {
     throw(new Error('TM_INFERENCE_OUTPUT_INVALID: ' + String(error.message || error)
                     + ' stderr=' + String(run.stderr || '').trim()));
     } // catch
return(plan);
} // buildMorphLog()


function stateOf(bot)
{
return({ x: Number(bot.x), y: Number(bot.y), z: Number(bot.z),
         vx: Number(bot.vx ?? 0), vy: Number(bot.vy ?? 0), vz: Number(bot.vz ?? 1) });
} // stateOf()


function applyCompletedWaves(startBots, waves)
{
const world = startBots.map(bot => ({ ...bot, ...stateOf(bot) }));
for (const wave of waves)
   {
   for (const move of (wave.moves || []))
      {
      const bot = world.find(item => String(item.id) === String(move.id));
      if (bot && move.to) Object.assign(bot, stateOf(move.to));
      } // for move
   } // for wave
return(world);
} // applyCompletedWaves()


function openTargetIndexes(plan)
{
const completed = Number(plan?.statistics?.targets_completed || 0);
return((plan.targets || []).map((target, index) => ({ target, index: index + 1 })).slice(completed));
} // openTargetIndexes()


function edgeCandidates(bots, usedIds)
{
const movable = bots.filter(bot => bot.mobility === true && !usedIds.has(String(bot.id)));
if (movable.length === 0) return([]);
const xs = movable.map(bot => Number(bot.x));
const zs = movable.map(bot => Number(bot.z));
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minZ = Math.min(...zs);
const maxZ = Math.max(...zs);
const edge = movable.filter(bot => Number(bot.x) === minX || Number(bot.x) === maxX ||
                                  Number(bot.z) === minZ || Number(bot.z) === maxZ);
return(edge.length > 0 ? edge : movable);
} // edgeCandidates()


function appendAStarFill(plan, input)
{
const pending = openTargetIndexes(plan);
if (pending.length === 0) return(plan);

const startBots = Array.isArray(input?.startBots) ? input.startBots : [];
if (startBots.length === 0)
   {
   return(plan);
   }
const targetStructure = (plan.targets || []).map(target => ({ ...target }));
const planner = new AStarFillPlanner({ targetStructure: targetStructure,
                                       params: input.params || {} });
const usedIds = new Set((plan.waves || []).flatMap(wave => (wave.moves || []).map(move => String(move.id))));
let world = applyCompletedWaves(startBots, plan.waves || []);
const diagnostics = [];

for (const pendingTarget of pending)
   {
   const candidates = edgeCandidates(world, usedIds);
   const fill = planner.planOneWave({ worldState: world,
                                      target: pendingTarget.target,
                                      donorCandidates: candidates });
   if (!fill.ok)
      {
      plan.error = { code: fill.code, message: fill.message,
                     prior_error: plan.error || null, diagnostics: fill.diagnostics };
      plan.morph = 'failed';
      break;
      }
   plan.waves.push(
      {
      step: plan.waves.length + 1,
      type: 'astar_fill',
      moves: [{ id: fill.donorId, from: fill.from, to: fill.to, fullPath: fill.fullPath }],
      meta: { target_number: pendingTarget.index,
              target: { x: Number(pendingTarget.target.x), y: Number(pendingTarget.target.y), z: Number(pendingTarget.target.z) },
              source: 'AStarFillPlanner',
              primitives: fill.actions,
              diagnostics: fill.diagnostics }
      });
   const moved = world.find(bot => String(bot.id) === fill.donorId);
   if (moved) Object.assign(moved, stateOf(fill.to));
   usedIds.add(fill.donorId);
   diagnostics.push({ target_number: pendingTarget.index, donor_id: fill.donorId,
                      expanded_nodes: fill.diagnostics.expanded_nodes,
                      generated_nodes: fill.diagnostics.generated_nodes });
   plan.statistics.targets_completed += 1;
   } // for pendingTarget

plan.statistics.astar_fill = { attempted_targets: pending.length,
                               completed_targets: diagnostics.length,
                               waves: diagnostics };
if (Number(plan.statistics.targets_completed) === Number(plan.statistics.targets_total))
   {
   plan.morph = 'success';
   delete plan.error;
   }
return(plan);
} // appendAStarFill()


function coverageOf(plan)
{
const statistics = plan?.statistics || {};
const completed = Number(statistics.targets_completed || 0);
const total = Number(statistics.targets_total || 0);
return({ completed: completed, total: total,
         summary: "covered " + completed + " of " + total + " targets" });
} // coverageOf()


function provenanceOf(plan)
{
const statistics = plan?.statistics || {};
const total = Number(statistics.targets_total || 0);
const astar = statistics.astar_fill || {};
const astarCompleted = Number(astar.completed_targets || 0);
const completed = Number(statistics.targets_completed || 0);
const transformerMorphCompleted = Math.max(0, completed - astarCompleted);
return({ transformermorph: { completed: transformerMorphCompleted, total: total },
         astar_fill: { completed: astarCompleted, attempted: Number(astar.attempted_targets || 0) },
         hybrid: { completed: completed, total: total } });
} // provenanceOf()


function coordinateDistance(first, second)
{
return(Math.abs(Number(first.x) - Number(second.x)) +
       Math.abs(Number(first.y) - Number(second.y)) +
       Math.abs(Number(first.z) - Number(second.z)));
} // coordinateDistance()


// SP-CellBots' existing plan generator composes orthogonal state transitions
// into vehicle primitives itself.  Export one changed position axis per state;
// a rotation in place (distance 0) remains valid and is deliberately retained.
function expandToOrthogonalStates(pathStates)
{
if (!Array.isArray(pathStates) || pathStates.length < 2) return(pathStates || []);
const expanded = [{ ...pathStates[0] }];
for (let index = 1; index < pathStates.length; index++)
   {
   const previous = expanded[expanded.length - 1];
   const current = pathStates[index];
   const deltas = {
      x: Number(current.x) - Number(previous.x),
      y: Number(current.y) - Number(previous.y),
      z: Number(current.z) - Number(previous.z)
      };
   // Vehicle-kinematics merge order is directional: a climb is up followed by
   // horizontal movement, while a descent is horizontal movement followed by
   // down.  The existing SP generator recognizes those two exact sequences.
   const axisOrder = deltas.y > 0 ? ['y', 'x', 'z'] :
                     deltas.y < 0 ? ['x', 'z', 'y'] :
                                     ['x', 'z', 'y'];
   for (const axis of axisOrder)
      {
      const distance = Math.abs(deltas[axis]);
      const direction = Math.sign(deltas[axis]);
      for (let step = 0; step < distance; step++)
         {
         const intermediate = { ...previous, ...current };
         intermediate.x = Number(expanded[expanded.length - 1].x) + (axis === 'x' ? direction : 0);
         intermediate.y = Number(expanded[expanded.length - 1].y) + (axis === 'y' ? direction : 0);
         intermediate.z = Number(expanded[expanded.length - 1].z) + (axis === 'z' ? direction : 0);
         expanded.push(intermediate);
         } // for step
      } // for axis
   if (coordinateDistance(previous, current) === 0)
      {
      expanded.push({ ...current });
      }
   } // for path states
return(expanded);
} // expandToOrthogonalStates()


function normalizePathGeometry(plan)
{
let diagonalsBefore = 0;
let diagonalsAfter = 0;
for (const wave of (plan.waves || []))
   {
   for (const move of (wave.moves || []))
      {
      const originalPath = Array.isArray(move.fullPath) ? move.fullPath : [];
      for (let index = 1; index < originalPath.length; index++)
         {
         if (coordinateDistance(originalPath[index - 1], originalPath[index]) > 1) diagonalsBefore += 1;
         } // for originalPath
      move.fullPath = expandToOrthogonalStates(originalPath);
      for (let index = 1; index < move.fullPath.length; index++)
         {
         if (coordinateDistance(move.fullPath[index - 1], move.fullPath[index]) > 1) diagonalsAfter += 1;
         } // for fullPath
      } // for move
   } // for wave
plan.statistics = plan.statistics || {};
plan.statistics.path_geometry = { diagonal_transitions_before_normalization: diagonalsBefore,
                                  diagonal_transitions_after_normalization: diagonalsAfter };
if (diagonalsAfter !== 0) throw new Error("NON_ORTHOGONAL_FULLPATH_EXPORT");
return(plan);
} // normalizePathGeometry()


// Write the morph plan atomically: first <file>.tmp, then rename to the final name.
// This way the controller never reads a half-written file.
function writeMorphOutput()
{
let morph_log   = normalizePathGeometry(appendAStarFill(buildMorphLog(), readMorphInput()));
let output_path = path.join(__dirname, OUTPUT_FILE);
let tmp_path    = output_path + ".tmp";

fs.writeFileSync(tmp_path, JSON.stringify(morph_log, null, 2));
fs.renameSync(tmp_path, output_path);

return(output_path);
} // writeMorphOutput()


// Main sequence: write exactly one complete plan and announce it only on success.
async function main()
{
removeStaleOutput();

emitLine("MORPH_STATUS " + JSON.stringify({ phase: "frozen TransformerMorph inference", progress: 0 }));
const output = writeMorphOutput();
const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
const provenance = provenanceOf(plan);

emitLine("MORPH_STATUS " + JSON.stringify({ phase: "TransformerMorph coverage: " + provenance.transformermorph.completed + "/" + provenance.transformermorph.total, progress: 100,
                                              completed: provenance.transformermorph.completed,
                                              total: provenance.transformermorph.total }));
emitLine("MORPH_STATUS " + JSON.stringify({ phase: "A* fill coverage: " + provenance.astar_fill.completed + "/" + provenance.astar_fill.attempted, progress: 100,
                                              completed: provenance.astar_fill.completed,
                                              attempted: provenance.astar_fill.attempted }));

if (plan.morph !== 'success')
   {
   emitLine("MORPH_ERROR " + JSON.stringify(
                                             {
                                             code: plan?.error?.code || "MORPH_PARTIAL",
                                             message: plan?.error?.message || "Morph left uncovered targets",
                                             coverage: coverageOf(plan)
                                             }
                                             ));
   process.exitCode = 1;
   return;
   }

emitLine("MORPH_STATUS " + JSON.stringify({ phase: "plan ready: hybrid " + provenance.hybrid.completed + "/" + provenance.hybrid.total, progress: 100,
                                              output: path.basename(output), coverage: coverageOf(plan),
                                              provenance: provenance }));

emitLine("MORPH_RESULT_READY " + OUTPUT_FILE);
} // main()


main().catch(function (err)
{
let coverage = null;
if (err.plan)
   {
   const output_path = path.join(__dirname, OUTPUT_FILE);
   const tmp_path = output_path + '.tmp';
   fs.writeFileSync(tmp_path, JSON.stringify(err.plan, null, 2));
   fs.renameSync(tmp_path, output_path);
   coverage = coverageOf(err.plan);
   }
emitLine("MORPH_ERROR " + JSON.stringify(
                                         {
                                         code: err.code || "RUNNER_FAILED",
                                         message: String(err?.message ?? err),
                                         coverage: coverage
                                         }
                                         ));
process.exit(1);
});
