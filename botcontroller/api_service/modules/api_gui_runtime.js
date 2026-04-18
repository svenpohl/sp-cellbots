function apicall_gui_set_marker(controller, x, y, z, size, color)
{
const allowed_colors = ['red', 'green', 'blue', 'yellow', 'cyan', 'white'];
let marker_x = Number(x);
let marker_y = Number(y);
let marker_z = Number(z);
let marker_size = Number(size);
let marker_color = String(color ?? "").trim().toLowerCase();

if (
    Number.isNaN(marker_x) ||
    Number.isNaN(marker_y) ||
    Number.isNaN(marker_z) ||
    Number.isNaN(marker_size)
   )
   {
   return({
          ok: false,
          answer: "api_gui_set_marker",
          error: "INVALID_MARKER_PARAMETERS"
          });
   } // if

if (marker_size <= 0)
   {
   return({
          ok: false,
          answer: "api_gui_set_marker",
          error: "INVALID_MARKER_SIZE"
          });
   } // if

if (!allowed_colors.includes(marker_color))
   {
   return({
          ok: false,
          answer: "api_gui_set_marker",
          error: "INVALID_MARKER_COLOR",
          allowed_colors: allowed_colors
          });
   } // if

const events = [];
events.push(
           {
           event: "setmarker",
           x: marker_x,
           y: marker_y,
           z: marker_z,
           size: marker_size,
           color: marker_color,
           opacity: 0.8
           }
           );

const sent = controller.notify_frontend(events);

return({
       ok: true,
       answer: "api_gui_set_marker",
       accepted: true,
       frontend_attached: sent,
       marker: {
                x: marker_x,
                y: marker_y,
                z: marker_z,
                size: marker_size,
                color: marker_color,
                opacity: 0.8
                }
       });
} // apicall_gui_set_marker()


function apicall_gui_clear_markers(controller)
{
const events = [];
events.push(
           {
           event: "clearmarkers"
           }
           );

const sent = controller.notify_frontend(events);

return({
       ok: true,
       answer: "api_gui_clear_markers",
       accepted: true,
       frontend_attached: sent
       });
} // apicall_gui_clear_markers()


function apicall_gui_refresh(controller)
{
const events = [];
events.push(
           {
           event: "refreshworld"
           }
           );

const sent = controller.notify_frontend(events);

return({
       ok: true,
       answer: "api_gui_refresh",
       accepted: true,
       frontend_attached: sent
       });
} // apicall_gui_refresh()


function apicall_set_debug_move(controller, mode)
{
let normalized_mode = String(mode ?? "status").trim().toLowerCase();

if (normalized_mode == "")
   {
   normalized_mode = "status";
   } // if

if (normalized_mode == "on")
   {
   controller.debug_move_enabled = true;
   } // if
else if (normalized_mode == "off")
   {
   controller.debug_move_enabled = false;
   } // else if
else if (normalized_mode != "status")
   {
   return({
          ok: false,
          answer: "api_debug_move",
          error: "INVALID_MODE",
          mode: normalized_mode,
          allowed_modes: ["on", "off", "status"]
          });
   } // else if

return({
       ok: true,
       answer: "api_debug_move",
       mode: normalized_mode,
       debug_move_enabled: (controller.debug_move_enabled === true)
       });
} // apicall_set_debug_move()


module.exports = {
                  apicall_gui_set_marker,
                  apicall_gui_clear_markers,
                  apicall_gui_refresh,
                  apicall_set_debug_move
                 };
