#!/usr/bin/env node
/**
 * runner.js - HelloWorldMorph
 *
 * Reference implementation of a file-based morph module (Morph Plugin API v1).
 *
 * Stage 3 (this version):
 *   - prints MORPH_STATUS lines (machine readable JSON) to stdout
 *   - writes a HAND-CRAFTED morph plan to morph_output.json (atomic write)
 *   - prints MORPH_RESULT_READY at the end
 *   - does NOT read morph_input.json yet
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

const OUTPUT_FILE = 'morph_output.json';


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


// Build the hand-crafted morph plan (morphLog).
// 'bots' and 'targets' are taken from morph_input.json - same shape as the
// built-in algorithms use (bots = startBots, targets without orientation).
function buildMorphLog()
{
const input = readMorphInput();

const bots = (input?.startBots ?? []).map(b => (
             {
             id: b.id,
             x: b.x,
             y: b.y,
             z: b.z,
             vx: Number(b.vx ?? 0),
             vy: Number(b.vy ?? 0),
             vz: Number(b.vz ?? 1)
             }));

const targets = (input?.targetBots ?? []).map(t => (
                {
                id: t.id,
                x: t.x,
                y: t.y,
                z: t.z
                }));

return({
       bots: bots,
       waves: [

              // ── Wave 1: B57 and B55 move in parallel to the tower base level ──
              {
              step: 1,
              moves: [
                     {
                     id: "B57",
                     from: { x: 3, y: 0, z: 0, vx: 0, vy: 0, vz: 1 },
                     to:   { x: 3, y: 1, z: 2, vx: 0, vy: 0, vz: 1 },
                     fullPath: [
                               { x: 3, y: 0, z: 0, vx: 0, vy: 0, vz: 1  },  // climb up
                               { x: 3, y: 1, z: 0, vx: 0, vy: 0, vz: 1 },
                               { x: 3, y: 1, z: 1, vx: 0, vy: 0, vz: 1 },
                               { x: 3, y: 1, z: 2, vx: 0, vy: 0, vz: 1 }   // tower base
                               ]
                     },
                     {
                     id: "B55",
                     from: { x: 5, y: 0, z: 0, vx: 0, vy: 0, vz: 1 },
                     to:   { x: 5, y: 1, z: 2, vx: 0, vy: 0, vz: 1 },
                     fullPath: [
                               { x: 5, y: 0, z: 0, vx: 0, vy: 0, vz: 1  },  // climb up
                               { x: 5, y: 1, z: 0, vx: 0, vy: 0, vz: 1 },
                               { x: 5, y: 1, z: 1, vx: 0, vy: 0, vz: 1 },
                               { x: 5, y: 1, z: 2, vx: 0, vy: 0, vz: 1 }
                               ]
                     }
                     ]
              },

              // ── Wave 2: B55 climbs onto B57 (tower middle) ──
              {
              step: 2,
              moves: [
                     {
                     id: "B55",
                     from: { x: 5, y: 1, z: 2, vx: 0, vy: 0, vz: 1 },
                     to:   { x: 3, y: 2, z: 2, vx: -1, vy: 0, vz: 0 },
                     fullPath: [
                               { x: 5, y: 1, z: 2, vx: 0,  vy: 0, vz: 1 },  // start
                               { x: 5, y: 1, z: 2, vx: -1, vy: 0, vz: 0 },  // rotate to -X
                               { x: 4, y: 1, z: 2, vx: -1, vy: 0, vz: 0 },  // step (-X)
                               { x: 4, y: 2, z: 2, vx: -1, vy: 0, vz: 0  },  // climb up
                               { x: 3, y: 2, z: 2, vx: -1, vy: 0, vz: 0 }   // onto B57
                               ]
                     }
                     ]
              },

              // ── Wave 3: B56 moves around the tower to z=1, then climbs up on the left side ──
              {
              step: 3,
              moves: [
                     {
                     id: "B56",
                     from: { x: 4, y: 0, z: 0, vx: 0, vy: 0, vz: 1 },
                     to:   { x: 3, y: 3, z: 2, vx: -1, vy: 0, vz: 0 },
                     fullPath: [
                               { x: 4, y: 0, z: 0, vx: 0,  vy: 0, vz: 1  },  // 1 start
                               { x: 4, y: 1, z: 0, vx: 0,  vy: 0, vz: 1  },  // 2 up (T)
                               { x: 4, y: 1, z: 1, vx: 0,  vy: 0, vz: 1 },  // 3 front (F) -> F_TF_F
                               { x: 4, y: 1, z: 1, vx: 1,  vy: 0, vz: 0 },  // 4 rotate +X
                               { x: 5, y: 1, z: 1, vx: 1,  vy: 0, vz: 0 },  // 5 +X (around tower)
                               { x: 5, y: 1, z: 1, vx: 0,  vy: 0, vz: 1 },  // 6 rotate +Z
                               { x: 5, y: 1, z: 2, vx: 0,  vy: 0, vz: 1 },  // 7 +Z
                               { x: 5, y: 1, z: 2, vx: -1, vy: 0, vz: 0 },  // 8 rotate -X
                               { x: 4, y: 1, z: 2, vx: -1, vy: 0, vz: 0 },  // 9 -X
                               { x: 4, y: 2, z: 2, vx: -1, vy: 0, vz: 0  },  // 10 top (up)
                               { x: 4, y: 3, z: 2, vx: -1, vy: 0, vz: 0  },  // 11 up
                               { x: 3, y: 3, z: 2, vx: -1, vy: 0, vz: 0 }   // 12 final -X (tower top)
                               ]
                     }
                     ]
              }

              ],
       targets: targets
       });
} // buildMorphLog()


// Write the morph plan atomically: first <file>.tmp, then rename to the final name.
// This way the controller never reads a half-written file.
function writeMorphOutput()
{
let morph_log   = buildMorphLog();
let output_path = path.join(__dirname, OUTPUT_FILE);
let tmp_path    = output_path + ".tmp";

fs.writeFileSync(tmp_path, JSON.stringify(morph_log, null, 2));
fs.renameSync(tmp_path, output_path);

return(output_path);
} // writeMorphOutput()


// Main sequence: short countdown, then write the plan and announce that it is ready.
async function main()
{
removeStaleOutput();

// Countdown so the operator can see the module coming up (1s per step)
for (let i = 3; i >= 0; i--)
    {
    emitLine("MORPH_STATUS " + JSON.stringify({ phase: "starting in " + i + "...", progress: 0 }));
    await delay(1000);
    } // for

writeMorphOutput();

emitLine("MORPH_RESULT_READY " + OUTPUT_FILE);
} // main()


main().catch(function (err)
{
emitLine("MORPH_ERROR " + JSON.stringify(
                                         {
                                         code: "RUNNER_FAILED",
                                         message: String(err?.message ?? err)
                                         }
                                         ));
process.exit(1);
});
