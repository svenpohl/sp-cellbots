const fs = require('fs');
const path = require('path');


function apicall_morph_get_structures(controller)
{
const structures_dir = path.join(__dirname, '..', '..', 'structures');
let structures = [];

try
   {
   structures = fs.readdirSync(structures_dir)
                  .filter((filename) => filename.endsWith('.json'))
                  .map((filename) => filename.replace(/\.json$/i, ''))
                  .sort();
   } // try
catch (err)
   {
   return({
          ok: false,
          answer: "api_morph_get_structures",
          error: "STRUCTURES_READ_FAILED",
          details: String(err?.message ?? err)
          });
   } // catch

// Add virtual :voxeledit structure if VoxelEdit is available
if (controller && controller.voxeledit) {
    structures.push(':voxeledit');
}

return({
       ok: true,
       answer: "api_morph_get_structures",
       count: structures.length,
       list: structures
       });
} // apicall_morph_get_structures()


function apicall_morph_get_algos(controller)
{
return({
       ok: true,
       answer: "api_morph_get_algos",
       count: Array.isArray(controller.morphAlgorithms) ? controller.morphAlgorithms.length : 0,
       list: Array.isArray(controller.morphAlgorithms) ? controller.morphAlgorithms : []
       });
} // apicall_morph_get_algos()


function apicall_morph_start(controller, algo, structure)
{
let normalized_algo = String(algo ?? "").trim();
let normalized_structure = String(structure ?? "").trim();
let communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();
let structures_ret = apicall_morph_get_structures(controller);
let algos_ret = apicall_morph_get_algos(controller);
let selected_algo = null;

if (normalized_algo == "")
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_ALGO_MISSING"
          });
   } // if

if (normalized_structure == "")
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_STRUCTURE_MISSING",
          algo: normalized_algo
          });
   } // if

selected_algo = (algos_ret.list ?? []).find((entry) => String(entry?.id ?? "").trim() == normalized_algo) ?? null;

if (!selected_algo)
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_ALGO_NOT_FOUND",
          algo: normalized_algo,
          available_algos: algos_ret.list ?? []
          });
   } // if

if (normalized_structure !== ':voxeledit' && !(structures_ret.list ?? []).includes(normalized_structure))
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_STRUCTURE_NOT_FOUND",
          algo: normalized_algo,
          structure: normalized_structure,
          available_structures: structures_ret.list ?? []
          });
   } // if

if (communication_mode == "direct_radio")
   {
   return({
          ok: false,
          answer: "api_morph_start",
          error: "MORPH_ONLY_IMPLEMENTED_IN_MESH_MODE",
          communication_mode: communication_mode,
          algo: normalized_algo,
          structure: normalized_structure
          });
   } // if

controller.prepare_morph(normalized_structure, normalized_algo);

return({
       ok: true,
       answer: "api_morph_start",
       accepted: true,
       algo: normalized_algo,
       structure: normalized_structure
       });
} // apicall_morph_start()


function apicall_morph_start_headless(controller, algo, structure, output_file, socket)
{
let normalized_algo = String(algo ?? "").trim();
let normalized_structure = String(structure ?? "").trim();
let communication_mode = String(controller?.config?.communication_mode ?? "mesh_opcode").trim().toLowerCase();
let structures_ret = apicall_morph_get_structures(controller);
let algos_ret = apicall_morph_get_algos(controller);
let selected_algo = null;

if (normalized_algo == "")
   {
   return({
          ok: false,
          answer: "api_morph_start_headless",
          error: "MORPH_ALGO_MISSING"
          });
   } // if

if (normalized_structure == "")
   {
   return({
          ok: false,
          answer: "api_morph_start_headless",
          error: "MORPH_STRUCTURE_MISSING",
          algo: normalized_algo
          });
   } // if

selected_algo = (algos_ret.list ?? []).find((entry) => String(entry?.id ?? "").trim() == normalized_algo) ?? null;

if (!selected_algo)
   {
   return({
          ok: false,
          answer: "api_morph_start_headless",
          error: "MORPH_ALGO_NOT_FOUND",
          algo: normalized_algo,
          available_algos: algos_ret.list ?? []
          });
   } // if

if (normalized_structure !== ':voxeledit' && !(structures_ret.list ?? []).includes(normalized_structure))
   {
   return({
          ok: false,
          answer: "api_morph_start_headless",
          error: "MORPH_STRUCTURE_NOT_FOUND",
          algo: normalized_algo,
          structure: normalized_structure,
          available_structures: structures_ret.list ?? []
          });
   } // if

if (communication_mode == "direct_radio")
   {
   return({
          ok: false,
          answer: "api_morph_start_headless",
          error: "MORPH_ONLY_IMPLEMENTED_IN_MESH_MODE",
          communication_mode: communication_mode,
          algo: normalized_algo,
          structure: normalized_structure
          });
   } // if

// Start headless morph with a callback that sends the result via socket
controller.headless_prepare_morph(
                                 normalized_structure,
                                 normalized_algo,
                                 output_file,
                                 function(morphLog, success, outputPath) {
                                 let ret = {
                                           ok: true,
                                           answer: "api_morph_start_headless",
                                           success: success,
                                           algo: normalized_algo,
                                           structure: normalized_structure,
                                           output_file: outputPath || null
                                           };
                                 if (success && morphLog)
                                    {
                                    ret.wave_count = Array.isArray(morphLog.waves) ? morphLog.waves.length : 0;
                                    ret.move_count = morphLog.waves ? morphLog.waves.reduce((sum, w) => sum + (Array.isArray(w.moves) ? w.moves.length : 0), 0) : 0;
                                    }
                                 const answer = JSON.stringify(ret) + "\n";
                                 socket.write(answer, () => { socket.end(); });
                                 }
                                 );

return(null); // null = accepted, response will be sent via callback
} // apicall_morph_start_headless()


function apicall_update_morph_status(controller, patch = {})
{
let now_iso = new Date().toISOString();

controller.morph_status = {
                          ...controller.morph_status,
                          ...(patch ?? {}),
                          last_update: now_iso
                          };

return(controller.morph_status);
} // apicall_update_morph_status()


function apicall_get_morph_status(controller)
{
return({
       ok: true,
       answer: "api_morph_check_progress",
       running: Boolean(controller.morph_status?.running),
       phase: controller.morph_status?.phase ?? "idle",
       progress: Number(controller.morph_status?.progress ?? 0),
       structure: controller.morph_status?.structure ?? null,
       algo: controller.morph_status?.algo ?? null,
       success: controller.morph_status?.success ?? null,
       started_at: controller.morph_status?.started_at ?? null,
       finished_at: controller.morph_status?.finished_at ?? null,
       last_update: controller.morph_status?.last_update ?? null,
       message: controller.morph_status?.message ?? ""
       });
} // apicall_get_morph_status()


module.exports = {
                 apicall_morph_get_structures,
                 apicall_morph_get_algos,
                 apicall_morph_start,
                 apicall_morph_start_headless,
                 apicall_update_morph_status,
                 apicall_get_morph_status
                 };
