function apicall_get_status_extended(controller)
{
let total_bots = controller.bots.length;
let cluster_bots = controller.bots.filter((bot) => bot.id != "masterbot");
let cluster_count = cluster_bots.length;
let bounding_box = null;

if (cluster_count > 0)
   {
   let min_x = Number(cluster_bots[0].x);
   let max_x = Number(cluster_bots[0].x);
   let min_y = Number(cluster_bots[0].y);
   let max_y = Number(cluster_bots[0].y);
   let min_z = Number(cluster_bots[0].z);
   let max_z = Number(cluster_bots[0].z);

   for (let i=1; i<cluster_count; i++)
       {
       let x = Number(cluster_bots[i].x);
       let y = Number(cluster_bots[i].y);
       let z = Number(cluster_bots[i].z);

       if (x < min_x) min_x = x;
       if (x > max_x) max_x = x;
       if (y < min_y) min_y = y;
       if (y > max_y) max_y = y;
       if (z < min_z) min_z = z;
       if (z > max_z) max_z = z;
       } // for

   bounding_box = {
                  min_x: min_x,
                  max_x: max_x,
                  min_y: min_y,
                  max_y: max_y,
                  min_z: min_z,
                  max_z: max_z
                  };
   } // if

return({
       ok: true,
       answer: "api_status_extended",
       loaded_bots_total: total_bots,
       loaded_cluster_bots: cluster_count,
       masterbot_connected: (controller.MASTERBOT_CONNECTED == 1),
       masterbot_name: controller.masterbot_name,
       bounding_box: bounding_box
       });
} // apicall_get_status_extended()


function apicall_get_masterbot(controller)
{
return({
       ok: true,
       answer: "api_get_masterbot",
       id: "masterbot",
       name: controller.masterbot_name,
       connected: (controller.MASTERBOT_CONNECTED == 1),
       connection_slot: String(controller.mb['connection'] ?? "").toUpperCase(),
       position: {
                  x: Number(controller.mb['x']),
                  y: Number(controller.mb['y']),
                  z: Number(controller.mb['z'])
                  },
       orientation: {
                    x: Number(controller.mb['vx']),
                    y: Number(controller.mb['vy']),
                    z: Number(controller.mb['vz'])
                    }
       });
} // apicall_get_masterbot()


function apicall_get_scan_state(controller)
{
return({
       ok: true,
       answer: "api_get_scan_state",
       level1: {
               running: (controller.scan_status == 1),
               waiting_counter: Number(controller.scanwaitingcounter),
               max_waiting_counter: Number(controller.max_scanwaitingcounter)
               },
       level2: {
               running: (controller.scan_status_lvl2 == 1),
               waiting_counter: Number(controller.scanwaitingcounter_lvl2),
               max_waiting_counter: Number(controller.max_scanwaitingcounter)
               },
       radio: {
               running: (controller.scan_status_radio == 1),
               waiting_counter: Number(controller.scanwaitingcounter_radio ?? 0),
               max_waiting_counter: Number(controller.max_scanwaitingcounter)
               },
       loaded_bots: Number(controller.bots.length),
       detected_inactive_bots: Number(controller.detected_inactive_bots.length)
       });
} // apicall_get_scan_state()


module.exports = {
                  apicall_get_status_extended,
                  apicall_get_masterbot,
                  apicall_get_scan_state
                 };
