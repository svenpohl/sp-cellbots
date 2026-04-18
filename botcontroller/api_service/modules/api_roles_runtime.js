function apicall_get_structure_role_list(controller, role_key)
{
let key = String(role_key ?? "").trim();

if (!controller.structure_roles || typeof controller.structure_roles != "object")
   {
   controller.structure_roles = {};
   } // if

if (!Array.isArray(controller.structure_roles[key]))
   {
   controller.structure_roles[key] = [];
   } // if

return(controller.structure_roles[key]);
} // apicall_get_structure_role_list()


function apicall_normalize_grid_point(controller, x, y, z)
{
let nx = Number(x);
let ny = Number(y);
let nz = Number(z);

if (Number.isNaN(nx) || Number.isNaN(ny) || Number.isNaN(nz))
   {
   return(null);
   } // if

return({
       x: nx,
       y: ny,
       z: nz
       });
} // apicall_normalize_grid_point()


function apicall_role_point_index(controller, role_key, x, y, z)
{
let list = controller.apicall_get_structure_role_list(role_key);

for (let i = 0; i < list.length; i++)
    {
    if (Number(list[i].x) == Number(x) && Number(list[i].y) == Number(y) && Number(list[i].z) == Number(z))
       {
       return(i);
       } // if
    } // for

return(-1);
} // apicall_role_point_index()


function apicall_forbidden_add(controller, x, y, z)
{
let point = controller.apicall_normalize_grid_point(x, y, z);

if (!point)
   {
   return({
          ok: false,
          answer: "api_forbidden_add",
          error: "INVALID_COORDINATES"
          });
   } // if

let list = controller.apicall_get_structure_role_list("forbidden");
let idx = controller.apicall_role_point_index("forbidden", point.x, point.y, point.z);
let changed = false;

if (idx < 0)
   {
   list.push(point);
   changed = true;
   } // if

let refresh_ret = controller.apicall_gui_refresh();

return({
       ok: true,
       answer: "api_forbidden_add",
       changed: changed,
       point: point,
       count: list.length,
       list: list,
       gui_refresh: {
                     accepted: refresh_ret.accepted ?? false,
                     frontend_attached: refresh_ret.frontend_attached ?? false
                     }
       });
} // apicall_forbidden_add()


function apicall_forbidden_remove(controller, x, y, z)
{
let point = controller.apicall_normalize_grid_point(x, y, z);

if (!point)
   {
   return({
          ok: false,
          answer: "api_forbidden_remove",
          error: "INVALID_COORDINATES"
          });
   } // if

let list = controller.apicall_get_structure_role_list("forbidden");
let idx = controller.apicall_role_point_index("forbidden", point.x, point.y, point.z);
let changed = false;

if (idx >= 0)
   {
   list.splice(idx, 1);
   changed = true;
   } // if

let refresh_ret = controller.apicall_gui_refresh();

return({
       ok: true,
       answer: "api_forbidden_remove",
       changed: changed,
       point: point,
       count: list.length,
       list: list,
       gui_refresh: {
                     accepted: refresh_ret.accepted ?? false,
                     frontend_attached: refresh_ret.frontend_attached ?? false
                     }
       });
} // apicall_forbidden_remove()


function apicall_forbidden_clear(controller)
{
let list = controller.apicall_get_structure_role_list("forbidden");
let removed_count = list.length;
controller.structure_roles.forbidden = [];

let refresh_ret = controller.apicall_gui_refresh();

return({
       ok: true,
       answer: "api_forbidden_clear",
       removed_count: removed_count,
       count: 0,
       list: [],
       gui_refresh: {
                     accepted: refresh_ret.accepted ?? false,
                     frontend_attached: refresh_ret.frontend_attached ?? false
                     }
       });
} // apicall_forbidden_clear()


function apicall_forbidden_list(controller)
{
let list = controller.apicall_get_structure_role_list("forbidden");

return({
       ok: true,
       answer: "api_forbidden_list",
       count: list.length,
       list: list
       });
} // apicall_forbidden_list()


function apicall_servicebay_add(controller, x, y, z)
{
let point = controller.apicall_normalize_grid_point(x, y, z);

if (!point)
   {
   return({
          ok: false,
          answer: "api_servicebay_add",
          error: "INVALID_COORDINATES"
          });
   } // if

let list = controller.apicall_get_structure_role_list("x");
let idx = controller.apicall_role_point_index("x", point.x, point.y, point.z);
let changed = false;

if (idx < 0)
   {
   list.push(point);
   changed = true;
   } // if

let refresh_ret = controller.apicall_gui_refresh();

return({
       ok: true,
       answer: "api_servicebay_add",
       changed: changed,
       point: point,
       count: list.length,
       list: list,
       gui_refresh: {
                     accepted: refresh_ret.accepted ?? false,
                     frontend_attached: refresh_ret.frontend_attached ?? false
                     }
       });
} // apicall_servicebay_add()


function apicall_servicebay_remove(controller, x, y, z)
{
let point = controller.apicall_normalize_grid_point(x, y, z);

if (!point)
   {
   return({
          ok: false,
          answer: "api_servicebay_remove",
          error: "INVALID_COORDINATES"
          });
   } // if

let list = controller.apicall_get_structure_role_list("x");
let idx = controller.apicall_role_point_index("x", point.x, point.y, point.z);
let changed = false;

if (idx >= 0)
   {
   list.splice(idx, 1);
   changed = true;
   } // if

let refresh_ret = controller.apicall_gui_refresh();

return({
       ok: true,
       answer: "api_servicebay_remove",
       changed: changed,
       point: point,
       count: list.length,
       list: list,
       gui_refresh: {
                     accepted: refresh_ret.accepted ?? false,
                     frontend_attached: refresh_ret.frontend_attached ?? false
                     }
       });
} // apicall_servicebay_remove()


function apicall_servicebay_clear(controller)
{
let list = controller.apicall_get_structure_role_list("x");
let removed_count = list.length;
controller.structure_roles.x = [];

let refresh_ret = controller.apicall_gui_refresh();

return({
       ok: true,
       answer: "api_servicebay_clear",
       removed_count: removed_count,
       count: 0,
       list: [],
       gui_refresh: {
                     accepted: refresh_ret.accepted ?? false,
                     frontend_attached: refresh_ret.frontend_attached ?? false
                     }
       });
} // apicall_servicebay_clear()


function apicall_servicebay_list(controller)
{
let list = controller.apicall_get_structure_role_list("x");

return({
       ok: true,
       answer: "api_servicebay_list",
       count: list.length,
       list: list
       });
} // apicall_servicebay_list()


module.exports = {
                  apicall_get_structure_role_list,
                  apicall_normalize_grid_point,
                  apicall_role_point_index,
                  apicall_forbidden_add,
                  apicall_forbidden_remove,
                  apicall_forbidden_clear,
                  apicall_forbidden_list,
                  apicall_servicebay_add,
                  apicall_servicebay_remove,
                  apicall_servicebay_clear,
                  apicall_servicebay_list
                 };
