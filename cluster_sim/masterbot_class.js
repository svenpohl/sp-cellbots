/**
 * @file        masterbot_class.js
 * @author      Sven Pohl <sven.pohl@zen-systems.de>
 * @copyright   Copyright (c) 2025 Sven Pohl
 * @license     MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
 
const fs = require('fs');
const net = require('net');
const WebSocket = require('ws');

const path = require('path');

const bot_class = require('./bot_class');
const cmd_parser_class = require('../common/cmd_parser_class');  
const { parse_config_file } = require('../common/config_parser');
const { console_format_log } = require('../common/system_utils');

const Logger = require('./logger');
Logger.reset();
Logger.log("Start cluster_sim");


const LoggerBlender = require('./logger_blender');
const AccessDomainSimulator = require('./libs/accessdomainsimulator');
const FailureInjector = require('./libs/failure_injector');



 
class masterbot_class 
{
  
  
 
      


  constructor( options = {} ) 
  {
  this.QUIET             = options.QUIET || false;
  this.config            = {}; 
  this.bots              = [];
  this.XMLLOADED         = 0;
  this.mbconnection_id   = -1;  
  this.mbconnection_slot = "";
  this.rid               = "";
  
  this.msgqueue          = [];
  this.max_msgqueue      = 600;

  // Queue for the botconstroller
  this.msgqueue_bc       = [];
  
  
  
  
  // Position and orientation
  this.x 				 = 0;
  this.y 				 = 0;
  this.z 				 = 0;
  
  this.vx                = 1;
  this.vy                = 0;
  this.vz                = 0;
  
  
  this.index_neighbors = [];  
  this.index_neighbors['f'] = -1;
  this.index_neighbors['r'] = -1;
  this.index_neighbors['b'] = -1;
  this.index_neighbors['l'] = -1;
  this.index_neighbors['t'] = -1;
  this.index_neighbors['d'] = -1;
  
  // only ID's (!)
  this.nbh_info = [];  
  this.nbh_info['f'] = "";
  this.nbh_info['r'] = "";
  this.nbh_info['b'] = "";
  this.nbh_info['l'] = "";
  this.nbh_info['t'] = "";
  this.nbh_info['d'] = "";
  
  this.botindex = [];
  this.payload_bot_ids = {};
  this.servicebay_cells = [];
  this.obstacles = []; // [{x, y, z}, ...] für set_obstacle
  
  
  this.setlivelogging = false;
  this.ws = null;
  
  // Start stopwatch
  this._stopwatchStart = Date.now();

  // AccessDomainSimulator (parallel zum bestehenden Code, nur lesend)
  this.ads = new AccessDomainSimulator(this);

  // FailureInjector (Simulated-Fault-API on Port 3101)
  this.failureInjector = new FailureInjector(this);
      
  } // constructor

parse_role_bool(value)
{
if (Array.isArray(value))
   {
   value = value[0];
   } // if

return(
       value === true ||
       value === 1 ||
       value === "1" ||
       value === "true"
      );
} // parse_role_bool()


register_payload_bot_int_id(botindex)
{
if (botindex === null || botindex === undefined || botindex < 0)
   {
   return(false);
   } // if

if (this.bots[botindex] === undefined)
   {
   return(false);
   } // if

this.payload_bot_ids[String(this.bots[botindex].id)] = true;
return(true);
} // register_payload_bot_int_id()


unregister_payload_bot_int_id(botindex)
{
if (botindex === null || botindex === undefined || botindex < 0)
   {
   return(false);
   } // if

if (this.bots[botindex] === undefined)
   {
   return(false);
   } // if

delete this.payload_bot_ids[String(this.bots[botindex].id)];
return(true);
} // unregister_payload_bot_int_id()


is_payload_bot_int_id(botindex)
{
if (botindex === null || botindex === undefined || botindex < 0)
   {
   return(false);
   } // if

if (this.bots[botindex] === undefined)
   {
   return(false);
   } // if

return(this.payload_bot_ids[String(this.bots[botindex].id)] === true);
} // is_payload_bot_int_id()


is_payload_bot_at_position(x, y, z)
{
let botindex = this.get_3d(x, y, z);

if (botindex == null)
   {
   return(false);
   } // if

if (this.bots[botindex] === undefined)
   {
   return(false);
   } // if

return(this.is_payload_bot_int_id(botindex));
} // is_payload_bot_at_position()
  
  
  
  async init( construct_file )
  {
  // Pfad to XML-Cell definition
  const xmlFilePath = construct_file;
  await this.parseXMLFile(xmlFilePath);
   
   
  // Start thread
  this.counter = 0;
  this.thread_bots();  

 
  // spinner
  this.spinnerframes = ['|', '/', '-', '\\'];
  this.frameIndex = 0;

  // config should be already loaded
  
  
  
  // --> Blender-Logging
  if (!this.QUIET) console.log(console_format_log("blenderlogging", 30, this.config.blenderlogging));
  if (!this.QUIET) console.log(console_format_log("mobility_mode", 30, (this.config.mobility_mode ?? "full_edge")));
  if (!this.QUIET) console.log(console_format_log("communication_mode", 30, (this.config.communication_mode ?? "mesh_opcode")));

  LoggerBlender.setEnabled( this.config.blenderlogging );
  LoggerBlender.open();


  LoggerBlender.event_addbot( "masterbot", 
                                {  x:this.x, y:this.y, z:this.z  }, 
                                {  vx:this.vx, vy:this.vy, vz:this.vz  } ,
                                ""
                            );
                            
  let size = this.bots.length;
  for (let i=0; i<size; i++)
      {
      
      LoggerBlender.event_addbot( this.bots[i].id, 
                                {  x:this.bots[i].x, y:this.bots[i].y, z:this.bots[i].z  }, 
                                {  vx:this.bots[i].vector_x, vy:this.bots[i].vector_y, vz:this.bots[i].vector_z } ,
                                 this.bots[i].color                                                            
                               );
                              
      } // for i...
                              
 

  // <-- Blender-Logging

  // FailureInjector API starten (Port 3101)
  this.start_failure_api();
  
  } // init..
  
  
  
//
// set_webgui_socket()
//  
set_webgui_socket( ws )
{
this.ws = ws;
} // set_webgui_socket 



//
// send_webgui()
//
send_webgui( msg )
{
if ( this.ws != null )
   {
   this.ws.send(msg);
   }
} // send_webgui()

               
            
             
  

async  parseXMLFile(filePath) 
 {

 const data = await fs.readFileSync(filePath, 'utf-8');


const xml2js = require('xml2js');

 


    xml2js.parseString(data, (err, result) => 
    {
      if (err) {
        console.error("Error parsing XML:", err);
        return;
      }
    
      
      const mbcell = result.xml.masterbot;
      mbcell.forEach(cell => 
      {

  	  this.x 				 = parseFloat(cell.pos[0].x[0]);
	  this.y 				 = parseFloat(cell.pos[0].y[0]);
  	  this.z 				 = parseFloat(cell.pos[0].z[0]);
  
      this.vx                = parseFloat(cell.pos[0].vx[0]);
      this.vy                = parseFloat(cell.pos[0].vy[0]);
      this.vz                = parseFloat(cell.pos[0].vz[0]);
   
      this.mbconnection_slot  = cell.mbconnection[0];
      this.rid               =
                               Array.isArray(cell.rid)
                               ? String(cell.rid[0] ?? "")
                               : (cell.rid !== undefined ? String(cell.rid) : "");
      
      }); // mbcell.forEach
      
      
     
     
      
      this.bots = [];
      this.servicebay_cells = [];

      const cells = result.xml.cell;
      cells.forEach(cell => {

      const parsed_inactive = this.parse_role_bool(cell.inactive);
      const parsed_servicebay = this.parse_role_bool(cell.servicebay);
      const parsed_rid =
            Array.isArray(cell.rid) ? String(cell.rid[0] ?? "") :
            (cell.rid !== undefined ? String(cell.rid) : "");

      if (parsed_servicebay === true)
         {
         this.servicebay_cells.push(
                                    {
                                     id: cell.id[0],
                                     x: Number(cell.pos[0].x[0]),
                                     y: Number(cell.pos[0].y[0]),
                                     z: Number(cell.pos[0].z[0]),
                                     vx: Number(cell.pos[0].vx[0]),
                                     vy: Number(cell.pos[0].vy[0]),
                                     vz: Number(cell.pos[0].vz[0]),
                                     color: cell.col[0]
                                    }
                                   );
         return;
         } // if

      const bot_class_obj = new bot_class();
      bot_class_obj.setvalues(
                           cell.id[0],
                           parsed_rid,
                           cell.pos[0].x[0],
                           cell.pos[0].y[0],
                           cell.pos[0].z[0],
                           cell.pos[0].vx[0],
                           cell.pos[0].vy[0],
                           cell.pos[0].vz[0],
                           parsed_inactive,
                           parsed_servicebay,
                           cell.col[0],
                           this.config.physical_bot_move_delay,
                           
                           this.config.enable_signing, 
                           this.config.signature_type, 
                           this.config.public_key_or_secret
                                                  
                           );

      // mobility aus XML setzen (optional, Default true)
      if (cell.mobility !== undefined) {
          let mobStr = String(cell.mobility[0] ?? "").trim().toLowerCase();
          bot_class_obj.mobility = (mobStr !== "false" && mobStr !== "0");
      }
                           
                           /*
                           # Sigining
enable_signing  = true
signature_type  = HMAC 
#signature_type  = ED25519 
#signature_type  = RSA 
public_key_or_secret = c25f5d256a3a0104c9eabab81f6d87abc2f9f75179101de2f527de535f2b1fb3
private_key_or_secret = c25f5d256a3a0104c9eabab81f6d87abc2f9f75179101de2f527de535f2b1fb3
 
                           */

    this.bots.push( bot_class_obj ); 
        
        
    }); // cells.forEach
    

    this.XMLLOADED = 1; 

    // ADS: hMBs aus config_mb.xml als Bots registrieren
    if (this.ads && this.ads.config_loaded) {
        for (let mb_id in this.ads.masterbots) {
            let mb_cfg = this.ads.masterbots[mb_id];
            let exists = this.bots.some(b => Number(b.x) === mb_cfg.pos.x && Number(b.y) === mb_cfg.pos.y && Number(b.z) === mb_cfg.pos.z);
            if (exists) continue;

            let role = (mb_cfg.role === "primary") ? bot_class.MB_PRIMARY : bot_class.MB_HELPER;
            let bot = new bot_class();
            bot.setvalues(
                mb_cfg.id, "",
                mb_cfg.pos.x, mb_cfg.pos.y, mb_cfg.pos.z,
                mb_cfg.orientation.x, mb_cfg.orientation.y, mb_cfg.orientation.z,
                0, 0, "999999",
                this.config.physical_bot_move_delay || 0,
                this.config.enable_signing,
                this.config.signature_type,
                this.config.public_key_or_secret,
                false,
                role
            );
            this.bots.push(bot);
            Logger.log("[ADS] Registered " + mb_cfg.role + " masterbot " + mb_id + " at " + mb_cfg.pos.x + "," + mb_cfg.pos.y + "," + mb_cfg.pos.z);
        }
    }

    // Find neighbors          
    this.init_cells_xml_neighbors();
    

    
  let target_x = this.x + parseFloat( this.index_neighbors[ this.mbconnection_slot ][0]); 
  let target_y = this.y + parseFloat(this.index_neighbors[ this.mbconnection_slot ][1]); 
  let target_z = this.z + parseFloat(this.index_neighbors[ this.mbconnection_slot ][1]);

  
  
  // Iterate all bots, find target position 
  let FOUND = 0;  
  for (let i=0; i < this.bots.length; i++)
      {  
      let botid    =  this.bots[i].id;
      
      if ( 
         target_x == this.bots[i].x &&
         target_y == this.bots[i].y &&
         target_z == this.bots[i].z
         )
         {
         FOUND = 1;
         this.mbconnection_id = i;
         }
          
      } // for i..
      
  
   
    //this.dumpdebug();  


    }); //  xml2js.parseString(data, (err, result) => 

  
} // parseXMLFile(filePath)
  
  
  
  
  
  
  
//
// init_cells_xml_neighbors()
//  
init_cells_xml_neighbors()
{

    
   
   
/*
   
-> 4 orientations



            T    L
            |   / 
             ------
            / ->  /|  
           ------  |  
  B <-     |    |  |   -> F
           |    | / 
           ------
            |  /
            D  R
            
0 F (1,0,0) *
1 R (0,0,-1)
2 B (-1,0,0)
3 L (0,0,1)
4 T (0,1,0)
5 D (0,-1,0)            


            T    B
            |   / 
             ------
            / /   /|  
           --\/--  |  
  R <-     |    |  |   -> L
           |    | / 
           ------
            |  /
            D  F
            
0 F (0,0,-1) *
1 R (-1,0,0)
2 B (0,0,1)
3 L (1,0,0)
4 T (0,1,0)
5 D (0,-1,0)            
            
            
            T    R
            |   / 
             ------
            / <-  /|  
           ------  |  
  F <-     |    |  |   -> B
           |    | / 
           ------
            |  /
            D  L

0 F (-1,0,0) *
1 R (0,0,1)
2 B (1,0,0)
3 L (0,0,-1)
4 T (0,1,0)
5 D (0,-1,0)            

            
            T    F
            |   / 
             --/\--
            /  / /|  
           ------  |  
  L <-     |    |  |   -> R
           |    | / 
           ------
            |  /
            D  B

0 F (0,0,1) *
1 R (1,0,0)
2 B (0,0,-1)
3 L (-1,0,0)
4 T (0,1,0)
5 D (0,-1,0)          
*/
   
const rotations = [
  { F: [1, 0, 0], R: [0, 0, -1], B: [-1,0,0], L: [0,0,1], T: [0,1,0], D: [0,-1,0] },
  { F: [0, 0, -1], R: [-1, 0, 0], B: [0,0,1], L: [1,0,0], T: [0,1,0], D: [0,-1,0] },
  { F: [-1, 0,0], R: [0, 0, 1], B: [1,0,0], L: [0,0,-1], T: [0,1,0], D: [0,-1,0] },
  { F: [0, 0,1], R: [1, 0, 0], B: [0,0,-1], L: [-1,0,0], T: [0,1,0], D: [0,-1,0] }
];

 
 

      // rotation 1
      if (this.vx == 1 && this.vy == 0 && this.vz == 0 ) 
         {         
         this.index_neighbors['f'] = rotations[0].F;
         this.index_neighbors['r'] = rotations[0].R;
         this.index_neighbors['b'] = rotations[0].B;
         this.index_neighbors['l'] = rotations[0].L;
         this.index_neighbors['t'] = rotations[0].T;
         this.index_neighbors['d'] = rotations[0].D;
         } // 1,0,0

      // rotation 2
      if (this.vx == 0 && this.vy == 0 && this.vz == -1 ) 
         {         
         this.index_neighbors['f'] = rotations[1].F;
         this.index_neighbors['r'] = rotations[1].R;
         this.index_neighbors['b'] = rotations[1].B;
         this.index_neighbors['l'] = rotations[1].L;
         this.index_neighbors['t'] = rotations[1].T;
         this.index_neighbors['d'] = rotations[1].D;
         } // 0,0,-1

      // rotation 3
      if (this.vx == -1 && this.vy == 0 && this.vz == 0 ) 
         {         
         this.index_neighbors['f'] = rotations[2].F;
         this.index_neighbors['r'] = rotations[2].R;
         this.index_neighbors['b'] = rotations[2].B;
         this.index_neighbors['l'] = rotations[2].L;
         this.index_neighbors['t'] = rotations[2].T;
         this.index_neighbors['d'] = rotations[2].D;
         } // -1,0,0

      // rotation 4
      if (this.vx == 0 && this.vy == 0 && this.vz == 1 ) 
         {         
         this.index_neighbors['f'] = rotations[3].F;
         this.index_neighbors['r'] = rotations[3].R;
         this.index_neighbors['b'] = rotations[3].B;
         this.index_neighbors['l'] = rotations[3].L;
         this.index_neighbors['t'] = rotations[3].T;
         this.index_neighbors['d'] = rotations[3].D;
         } // 0,0,1

 
 


 
  let j = this.mbconnection_id;

   
  // Iterate all bots  
  for (let i=0; i < this.bots.length; i++)
      {  
      let botid    =  this.bots[i].id;
    
 
      this.update_bot_index_neighbors( i );
  
      
      } // for i..bots.length
      
                    
                              
} // init_cells_xml_neighbors()
   
   
//
// update_bot_index_neighbors() - update index_neighbors after rotation or initialisation
//   
update_bot_index_neighbors( botindex )
{
if (botindex === null || botindex === undefined)
   {
   console.warn("[WARN] update_bot_index_neighbors called with null/undefined botindex - skipping");
   return;
   } // if

const rotations = [
  { F: [1, 0, 0], R: [0, 0, -1], B: [-1,0,0], L: [0,0,1], T: [0,1,0], D: [0,-1,0] },
  { F: [0, 0, -1], R: [-1, 0, 0], B: [0,0,1], L: [1,0,0], T: [0,1,0], D: [0,-1,0] },
  { F: [-1, 0,0], R: [0, 0, 1], B: [1,0,0], L: [0,0,-1], T: [0,1,0], D: [0,-1,0] },
  { F: [0, 0,1], R: [1, 0, 0], B: [0,0,-1], L: [-1,0,0], T: [0,1,0], D: [0,-1,0] }

];

let i = botindex;

let vector_x =  this.bots[i].vector_x;
let vector_y =  this.bots[i].vector_y;
let vector_z =  this.bots[i].vector_z;
      
  
 
    
      //
      // check all 4 rotation-options
      //
      
      // rotation 1
      if (vector_x == 1 && vector_y == 0 && vector_z == 0 ) 
         {         
         this.bots[i].index_neighbors['f'] = rotations[0].F;
         this.bots[i].index_neighbors['r'] = rotations[0].R;
         this.bots[i].index_neighbors['b'] = rotations[0].B;
         this.bots[i].index_neighbors['l'] = rotations[0].L;
         this.bots[i].index_neighbors['t'] = rotations[0].T;
         this.bots[i].index_neighbors['d'] = rotations[0].D;
         } // 1,0,0

      // rotation 2
      if (vector_x == 0 && vector_y == 0 && vector_z == -1 ) 
         {         
         this.bots[i].index_neighbors['f'] = rotations[1].F;
         this.bots[i].index_neighbors['r'] = rotations[1].R;
         this.bots[i].index_neighbors['b'] = rotations[1].B;
         this.bots[i].index_neighbors['l'] = rotations[1].L;
         this.bots[i].index_neighbors['t'] = rotations[1].T;
         this.bots[i].index_neighbors['d'] = rotations[1].D;
         } // 0,0,-1

      // rotation 3
      if (vector_x == -1 && vector_y == 0 && vector_z == 0 ) 
         {         
         this.bots[i].index_neighbors['f'] = rotations[2].F;
         this.bots[i].index_neighbors['r'] = rotations[2].R;
         this.bots[i].index_neighbors['b'] = rotations[2].B;
         this.bots[i].index_neighbors['l'] = rotations[2].L;
         this.bots[i].index_neighbors['t'] = rotations[2].T;
         this.bots[i].index_neighbors['d'] = rotations[2].D;
         } // -1,0,0

      // rotation 4
      if (vector_x == 0 && vector_y == 0 && vector_z == 1 ) 
         {         
         this.bots[i].index_neighbors['f'] = rotations[3].F;
         this.bots[i].index_neighbors['r'] = rotations[3].R;
         this.bots[i].index_neighbors['b'] = rotations[3].B;
         this.bots[i].index_neighbors['l'] = rotations[3].L;
         this.bots[i].index_neighbors['t'] = rotations[3].T;
         this.bots[i].index_neighbors['d'] = rotations[3].D;
         } // 0,0,1

 

} // update_bot_index_neighbors   


//
//
//
has_neighbour( x,y,z, vx,vy,vz, excl_x,excl_y,excl_z, slot )
{
let ret = false;
let logging = false;

const rotations = [
  { F: [1, 0, 0], R: [0, 0, -1], B: [-1,0,0], L: [0,0,1], T: [0,1,0], D: [0,-1,0] },
  { F: [0, 0, -1], R: [-1, 0, 0], B: [0,0,1], L: [1,0,0], T: [0,1,0], D: [0,-1,0] },
  { F: [-1, 0,0], R: [0, 0, 1], B: [1,0,0], L: [0,0,-1], T: [0,1,0], D: [0,-1,0] },
  { F: [0, 0,1], R: [1, 0, 0], B: [0,0,-1], L: [-1,0,0], T: [0,1,0], D: [0,-1,0] }

];



if (logging) console.log("has_neighbour: "+x+" "+y+" "+z+" slot:"+slot );
if (logging) console.log("---------");


let target_x = 0;
let target_y = 0;
let target_z = 0;

let vec = {};
let i2 = 0;
  // rotation 1
      if (vx == 1 && vy == 0 && vz == 0 ) 
         { 
         i2 = 0;        
         } // 1,0,0

      // rotation 2
      if (vx == 0 && vy == 0 && vz == -1 ) 
         {         
         i2 = 1;        
         } // 0,0,-1

      // rotation 3
      if (vx == -1 && vy == 0 && vz == 0 ) 
         {         
         i2 = 2;        
         } // -1,0,0

      // rotation 4
      if (vx == 0 && vy == 0 && vz == 1 ) 
         {         
         i2 = 3;        
         } // 0,0,1
         
    if (slot == 'F') vec = rotations[i2].F;
    if (slot == 'R') vec = rotations[i2].R;
    if (slot == 'B') vec = rotations[i2].B;
    if (slot == 'L') vec = rotations[i2].L;
    if (slot == 'T') vec = rotations[i2].T;
    if (slot == 'D') vec = rotations[i2].D;         
         
if (logging) console.log("vec: " + vec);

target_x = Number(x) + Number(vec[0]);
target_y = Number(y) + Number(vec[1]);
target_z = Number(z) + Number(vec[2]);

if (logging) console.log("target_xyz: "+target_x+" "+target_y+" "+target_z+" "  );

let botindex2 = this.get_3d(target_x,target_y,target_z);
if (logging) console.log("botindex2: " + botindex2);

if (botindex2 == null) ret = false; else ret = true;

if ( target_x == excl_x && target_y == excl_y && target_z == excl_z )
   {  
   if (logging) console.log("Self-collision : set false");
   ret = false;  
   }



if (logging) console.log("Returns: " + ret);
return(ret);
} // has_neighbour


//
// Call by bot_class.js / motoric_spin()
// Returns true, if any horizontal neighbour exists on F/R/B/L
//
has_horizontal_neighbor( x,y,z, vx,vy,vz, excl_x,excl_y,excl_z )
{
let ret = false;
const slots = [ 'F', 'R', 'B', 'L' ];

for (let i = 0; i < slots.length; i++)
    {
    const hasneighbor = this.has_neighbour(
                                        x,
                                        y,
                                        z,
                                        vx,
                                        vy,
                                        vz,
                                        excl_x,
                                        excl_y,
                                        excl_z,
                                        slots[i]
                                        );

    if (hasneighbor)
       {
       ret = true;
       break;
       } // if (hasneighbor)
    } // for

return(ret);
} // has_horizontal_neighbor


//
// get_botindex_by_rid()
//
get_botindex_by_rid(rid)
{
if (rid === undefined || rid === null)
   {
   return(null);
   } // if

const rid_string = String(rid).trim();

if (rid_string == "")
   {
   return(null);
   } // if

for (let i = 0; i < this.bots.length; i++)
    {
    if (this.bots[i] === undefined || this.bots[i] == null)
       {
       continue;
       } // if

    if (String(this.bots[i].rid ?? "").trim() == rid_string)
       {
       return(i);
       } // if
    } // for

return(null);
} // get_botindex_by_rid()


  
// 
// dumpdebug()
// 
dumpdebug()
{
if (!this.QUIET) console.log("---------");
if (!this.QUIET) console.log("Dump Bots");



  
               
for (let i=0; i < this.bots.length; i++)
        {
        let msgqueuesize =    this.bots[i].msgqueue.length;
        
        if (!this.QUIET) 
           {
           console.log("---");
           console.log("Id: " +  this.bots[i].id  +  
                     " xyz: " 
                     +  this.bots[i].x  + " " +
                     +  this.bots[i].y  + " " +
                     +  this.bots[i].z  + " " +
                     
                     " vector: " 
                     +  this.bots[i].vector_x  + " " +
                     +  this.bots[i].vector_y  + " " +
                     +  this.bots[i].vector_z  + " " +

                     " debug:[" +   this.bots[i].debug + "] " +
                     " color:[" +   this.bots[i].color + "] " +
                     
                     "msgqueuesize: " + msgqueuesize  
                     
                     
                     
                     
                     );
                     
           console.log( this.bots[i].index_neighbors );             
        
           console.log("MSG-Queue (BOT):");
           // Print MSGQueue 
           for (let i2=0; i2< this.bots[i].msgqueue.length; i2++)
               {            
               console.log(i2 + " - ["+ this.bots[i].msgqueue[i2] +"]");
               }
            
           } // if (!this.QUIET) 
    
                  
        } //


if (!this.QUIET) 
{
console.log("---");
console.log("Masterbot:");
console.log("xyz: " + this.x + " " + this.y + " " + this.z + " vector: "  + this.vx + " " +  + this.vy + " "  + this.vz + " " );

console.log("mbconnection_id: " + this.mbconnection_id + " this.mbconnection_slot: " + this.mbconnection_slot );
   
console.log("");
console.log(this.index_neighbors);
} // if (!this.QUIET) 


let msgqueuesize =    this.msgqueue.length;
if (!this.QUIET) console.log("msgqueuesize: " + msgqueuesize);  

if (!this.QUIET) console.log("MSG-Queue (MB):");

        // Print MSGQueue 
        for (let i2=0; i2< this.msgqueue.length; i2++)
            {            
            if (!this.QUIET) console.log(i2 + " - ["+ this.msgqueue[i2] +"]");
            }


if (!this.QUIET) console.log("---");      

let msgqueue_bc_size =    this.msgqueue_bc.length;
if (!this.QUIET) console.log("msgqueue_bc_size: " + msgqueue_bc_size);  



if (!this.QUIET) console.log("---------");  

} // dumpdebug()  
 
//
// export_system_dump_json()
//
export_system_dump_json()
{
const dump_dir  = path.join(__dirname, "logs");
const dump_file = path.join(dump_dir, "system_dump.json");

if (!fs.existsSync(dump_dir))
   {
   fs.mkdirSync(dump_dir, { recursive: true });
   } // if

const bots_dump = [];

for (let i = 0; i < this.bots.length; i++)
    {
    bots_dump.push({
      id: this.bots[i].id,
      rid: this.bots[i].rid ?? "",
      x: Number(this.bots[i].x),
      y: Number(this.bots[i].y),
      z: Number(this.bots[i].z),
      vx: Number(this.bots[i].vector_x),
      vy: Number(this.bots[i].vector_y),
      vz: Number(this.bots[i].vector_z)
    });
    } // for

const dump_json = {
  meta: {
    generated_at: new Date().toISOString(),
    dump_version: "1.0"
  },
  system: {
    bot_count: this.bots.length,
    bot_count_with_masterbot: this.bots.length + 1,
    payload_bot_count: Object.keys(this.payload_bot_ids).length,
    servicebay_count: this.servicebay_cells.length,
    queue_bc_size: this.msgqueue_bc.length,
    queue_masterbot_size: this.msgqueue.length
  },
  masterbot: {
    id: this.id,
    x: Number(this.x),
    y: Number(this.y),
    z: Number(this.z),
    vx: Number(this.vx),
    vy: Number(this.vy),
    vz: Number(this.vz)
  },
  bots: bots_dump
};

fs.writeFileSync(dump_file, JSON.stringify(dump_json, null, 2), "utf8");

return({
  ok: true,
  file: dump_file,
  bot_count: this.bots.length
});
} // export_system_dump_json()


//
// loadConfig()
// 
loadconfig(filePath) {
  const config = parse_config_file(filePath);

  if (!config.mobility_mode || config.mobility_mode.trim() == "") {
    config.mobility_mode = "full_edge";
  } // if

  if (!config.communication_mode || config.communication_mode.trim() == "") {
    config.communication_mode = "mesh_opcode";
  } // if

  // Add config to global space
  this.config = config;

  // ADS: config_mb.xml parallel einlesen (nicht-invasiv)
  if (this.ads) {
      this.ads.loadConfig();
  }
  
  return config;
} // loadconfig()


//
// start_failure_api() – TCP-JSON-API für Failure-Injection (Port 3101)
//
start_failure_api() {
    if (this.config.enable_api != "true") {
        console.log("[FailureAPI] API disabled by config.");
        return;
    }
    let api_port = parseInt(this.config.api_port, 10);
    if (!api_port || Number.isNaN(api_port)) {
        console.log("[FailureAPI] No valid api_port configured.");
        return;
    }
    this.fapi_server = net.createServer((socket) => {
        let buffer = "";
        socket.on('data', async (data) => {
            buffer += data.toString();
            const messages = buffer.split("\n");
            buffer = messages.pop();
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i].trim();
                if (!msg) continue;
                let decoded = null;
                try { decoded = JSON.parse(msg); } catch(e) {
                    socket.write(JSON.stringify({ ok: false, error: "INVALID_JSON" }) + "\n");
                    continue;
                }
                let answer = { ok: false, error: "UNKNOWN_COMMAND" };
                if (decoded.cmd === "disable_bot" || decoded.cmd === "enable_bot") {
                    answer = this.failureInjector.setBotActive(decoded.bot_id, decoded.cmd === "enable_bot");
                } else if (decoded.cmd === "remove_bot") {
                    answer = this.failureInjector.removeBot(decoded.bot_id);
                } else if (decoded.cmd === "get_status") {
                    let mode = String(decoded.mode ?? "").trim().toLowerCase();
                    let status = {
                        ok: true,
                        answer: "api_get_status",
                        total_bots: this.bots.length,
                        obstacles_count: this.obstacles ? this.obstacles.length : 0
                    };
                    if (mode === "obstacles" || mode === "all") {
                        status.obstacles = this.obstacles || [];
                    }
                    if (mode === "bots" || mode === "all") {
                        status.bots = this.bots.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z }));
                    }
                    answer = status;
                } else if (decoded.cmd === "describe") {
                    let filePath = path.join(__dirname, "api_ref", "core_commands.txt");
                    let text = "";
                    try { text = fs.readFileSync(filePath, "utf8"); } catch(e) { text = "Error loading commands: " + e.message; }
                    answer = { ok: true, answer: "api_description", text: text };
                } else if (decoded.cmd === "set_mobility") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let mobile = decoded.mobile;
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else if (mobile === undefined || mobile === null) { answer = { ok: false, error: "MISSING_MOBILE_FLAG" }; }
                    else { answer = this.failureInjector.setBotMobility(botId, mobile); }
                } else if (decoded.cmd === "config_slot") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let slotConfig = String(decoded.slot_config ?? "").trim();
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else if (!slotConfig) { answer = { ok: false, error: "MISSING_SLOT_CONFIG" }; }
                    else { answer = this.failureInjector.configSlot(botId, slotConfig); }
                } else if (decoded.cmd === "config_fakeid") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let fakeIdConfig = String(decoded.fake_id_config ?? "").trim();
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.configFakeId(botId, fakeIdConfig); }
                } else if (decoded.cmd === "config_duplicate_msg") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let factor = decoded.factor ?? 1;
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.configDuplicateMsg(botId, factor); }
                } else if (decoded.cmd === "config_disable_forwarding") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let disabled = decoded.disabled;
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.configDisableForwarding(botId, disabled); }
                } else if (decoded.cmd === "config_msg_delay") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let delayMs = decoded.delay_ms ?? 0;
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.configMsgDelay(botId, delayMs); }
                } else if (decoded.cmd === "config_max_msgqueue") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let maxSize = decoded.max_size ?? "default";
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.configMaxMsgQueue(botId, maxSize); }
                } else if (decoded.cmd === "config_corrupt_msg") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let probability = decoded.probability ?? 0;
                    let pattern = decoded.pattern ?? "";
                    let replacement = decoded.replacement ?? "";
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.configCorruptMsg(botId, probability, pattern, replacement); }
                } else if (decoded.cmd === "set_obstacle") {
                    let enabled = decoded.enabled;
                    let x = Number(decoded.x ?? 0);
                    let y = Number(decoded.y ?? 0);
                    let z = Number(decoded.z ?? 0);
                    answer = this.failureInjector.setObstacle(enabled, x, y, z);
                } else if (decoded.cmd === "add_bot_to") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let x = Number(decoded.x ?? 0);
                    let y = Number(decoded.y ?? 0);
                    let z = Number(decoded.z ?? 0);
                    let vx = decoded.vx !== undefined ? Number(decoded.vx) : undefined;
                    let vy = decoded.vy !== undefined ? Number(decoded.vy) : undefined;
                    let vz = decoded.vz !== undefined ? Number(decoded.vz) : undefined;
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.addBot(botId, x, y, z, vx, vy, vz); }
                } else if (decoded.cmd === "teleport_bot_to") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let x = Number(decoded.x ?? 0);
                    let y = Number(decoded.y ?? 0);
                    let z = Number(decoded.z ?? 0);
                    let vx = decoded.vx !== undefined ? Number(decoded.vx) : undefined;
                    let vy = decoded.vy !== undefined ? Number(decoded.vy) : undefined;
                    let vz = decoded.vz !== undefined ? Number(decoded.vz) : undefined;
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.teleportBot(botId, x, y, z, vx, vy, vz); }
                } else if (decoded.cmd === "set_move_interruption") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    let enabled = decoded.enabled;
                    let mode = String(decoded.mode ?? "half_way").trim();
                    let param = Number(decoded.param ?? 0);
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else { answer = this.failureInjector.setMoveInterruption(botId, enabled, mode, param); }
                } else if (decoded.cmd === "get_bot_info") {
                    let botId = String(decoded.bot_id ?? "").trim();
                    if (!botId) { answer = { ok: false, error: "MISSING_BOT_ID" }; }
                    else {
                        let bot = null;
                        for (let i = 0; i < this.bots.length; i++) {
                            if (this.bots[i] && String(this.bots[i].id).trim() === botId) { bot = this.bots[i]; break; }
                        }
                        if (!bot) { answer = { ok: false, error: "BOT_NOT_FOUND", bot_id: botId }; }
                        else {
                            // Failure-Injection-Status ermitteln
                            let fi = {
                                fake_id_config: bot.fake_id_config || null,
                                duplicate_msg: bot.duplicate_msg || 1,
                                forwarding_disabled: bot.forwarding_disabled === true,
                                max_msgqueue: bot.max_msgqueue ?? 500,
                                corrupt_msg: bot.corrupt_config || null
                            };
                            answer = {
                                ok: true,
                                bot_id: bot.id,
                                position: { x: Number(bot.x), y: Number(bot.y), z: Number(bot.z) },
                                orientation: { x: Number(bot.vector_x), y: Number(bot.vector_y), z: Number(bot.vector_z) },
                                inactive: (bot.inactive == 'true' || bot.inactive === true || bot.inactive == 1) ? 1 : 0,
                                failure_injection: fi
                            };
                        }
                    }
                }
                socket.write(JSON.stringify(answer) + "\n");
            }
        });
        socket.on('error', (err) => { console.error("[FailureAPI] Socket error:", err.message); });
    });
    this.fapi_server.listen(api_port, () => {
        console.log("[FailureAPI] listening on port " + api_port);
    });
    this.fapi_server.on('error', (err) => {
        console.error("[FailureAPI] Server error:", err.message);
    });
}


//
// Debug - Add your own debug-stuff
//
debug()
{
if (!this.QUIET) console.log("Masterbot DEBUG...");

//this.export_bot_snapshot( "logs/botsnapshot.json" );

let target_x = 2;
let target_y = 1;
let target_z = 0;

let vector_x = 1;
let vector_y = 0;
let vector_z = 0;

let la = "F";
 
} // debug





//
// export_bot_snapshot()
//
export_bot_snapshot( filename )
{
let buffer = "";

const filePath = path.join(__dirname, '', filename);


buffer += '{ \n';

buffer += '"masterbot": { "x":'+this.x+', "y":'+this.y+', "z":'+this.z+'  },    \
 \
 \n';


buffer += '"bots": [';

let size = this.bots.length;

for (let i=0; i<size; i++)
    {
    
    buffer += '{ \n \
     \
     "id" : "'+this.bots[i].id+'", \n \
     "x" :'+this.bots[i].x+', \n \
     "y" :'+this.bots[i].y+', \n \
     "z" :'+this.bots[i].z+', \n \
     "vector_x" :'+this.bots[i].vector_x+', \n \
     "vector_y" :'+this.bots[i].vector_y+', \n \
     "vector_z" :'+this.bots[i].vector_z+' \n \
     \n  \
       }    \n ';
    
    if (i < (size-1) ) buffer += ", \n";
    
    } // for i...


buffer += '] \n';


buffer += "} \n";
 

    
fs.writeFileSync(filePath, buffer, 'utf8');
              
} // export_bot_snapshot()




//
// push_msg
//
push_msg( msg )
{
let ret = 0;

let size = this.msgqueue.length;

if (size < this.max_msgqueue)
   {
   this.msgqueue.push( msg );
   return( 1 );
   }
   
return(ret);
} // push_msg


//
// pop_msg
//
pop_msg()
{
let ret = "";

let size = this.msgqueue.length;

if (size == 0) 
   {
   return("");
   }

let message = this.msgqueue.pop();
return(message);

} // push_msg





//
// calc_inbound_slot()
// Calculate the inbound slot, depending from receiver-bot orientation
// TODO: EXPLAIN
//
calc_inbound_slot(tmp_botindex, vector)
{
let inbound_slot = "";

if (tmp_botindex == null || this.bots[tmp_botindex] === undefined)
   {
   return(inbound_slot);
   } // if
 

// From 'down'
if ( vector[0] == 0 && vector[1] == 1 && vector[2] == 0 )
   {
   inbound_slot = 'd';
   } 
else   

// From 'top'
if ( vector[0] == 0 && vector[1] == -1 && vector[2] == 0 )
   {
   inbound_slot = 't';
   } 
else   
{


let vx = this.bots[tmp_botindex].vector_x;
let vy = this.bots[tmp_botindex].vector_y;
let vz = this.bots[tmp_botindex].vector_z;


if (vx == 1 && vy == 0 && vz == 0)
   {   
   if (vector[0] ==  1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'b';
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] == -1 ) inbound_slot = 'l';
   if (vector[0] == -1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'f';
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] ==  1 ) inbound_slot = 'r';   
   } // 1,0,0

if (vx == 0 && vy == 0 && vz == -1)
   {   
   if (vector[0] ==  1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'r';
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] == -1 ) inbound_slot = 'b';
   if (vector[0] == -1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'l';
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] ==  1 ) inbound_slot = 'f';   
   } // 0,0,-1

if (vx == -1 && vy == 0 && vz == 0)
   {   
   if (vector[0] ==  1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'f';
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] == -1 ) inbound_slot = 'r';
   if (vector[0] == -1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'b';
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] ==  1 ) inbound_slot = 'l';   
   } // -1,0,0

if (vx == 0 && vy == 0 && vz == 1)
   {   
   if (vector[0] ==  1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'l'; 
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] == -1 ) inbound_slot = 'f'; 
   if (vector[0] == -1  && vector[1] ==  0  && vector[2] ==  0 ) inbound_slot = 'r'; 
   if (vector[0] ==  0  && vector[1] ==  0  && vector[2] ==  1 ) inbound_slot = 'b';   
   } // 0,0,1


} // else
   


 

return(inbound_slot);
} // calc_inbound_slot()




//
// getclusterdata_json()
//
getclusterdata_json()
{
let jsondata = "";

jsondata += "{";

jsondata += " \"masterbot\":  [   ";

jsondata += "   { ";
jsondata += "   \"x\": "+this.x+",  ";
jsondata += "   \"y\": "+this.y+",  ";
jsondata += "   \"z\": "+this.z+",  ";

jsondata += "   \"vx\": "+this.vx+",  ";
jsondata += "   \"vy\": "+this.vy+",  ";
jsondata += "   \"vz\": "+this.vz+"  ";

jsondata += "   }    ";

jsondata += "  ],  ";



jsondata += " \"bots\":  [   ";




for (let i=0; i < this.bots.length; i++)
    {

    jsondata += "   { ";
    jsondata += "   \"id\": \""+this.bots[i].id +"\" ,  ";
    jsondata += "   \"x\": "+this.bots[i].x +",  ";
    jsondata += "   \"y\": "+this.bots[i].y +",  ";
    jsondata += "   \"z\": "+this.bots[i].z +",  ";

    jsondata += "   \"vx\": "+this.bots[i].vector_x +",  ";
    jsondata += "   \"vy\": "+this.bots[i].vector_y +",  ";
    jsondata += "   \"vz\": "+this.bots[i].vector_z +",  ";

    // Inaktive Bots (Failure-Injector / config) mit hellrot anzeigen
    // Immobile Bots (hMBs, mobility=false) mit grau anzeigen
    let bot_color = this.bots[i].color;
    if (this.bots[i].inactive == 'true' || this.bots[i].inactive === true || this.bots[i].inactive == 1)
       {
       bot_color = "ffaaaa";
       }
    else if (this.bots[i].mobility === false)
       {
       bot_color = "aaaaaa";
       }
    jsondata += "   \"col\": \""+bot_color+"\",  ";
    jsondata += "   \"masterbot\": "+this.bots[i].masterbot +"  ";
    
    jsondata += "   }    ";
    
    if (i < (this.bots.length-1) )
       {
       jsondata += "   ,    ";
       }
       
    } // for i...
       
       
jsondata += "]";       

jsondata += ", \"servicebay_cells\": [ ";

for (let i=0; i<this.servicebay_cells.length; i++)
    {
    jsondata += JSON.stringify(this.servicebay_cells[i]);

    if (i < (this.servicebay_cells.length-1))
       {
       jsondata += ", ";
       } // if
    } // for

jsondata += " ] ";

jsondata += ", \"obstacles\": [ ";
for (let i=0; i<this.obstacles.length; i++) {
    jsondata += JSON.stringify(this.obstacles[i]);
    if (i < (this.obstacles.length-1)) jsondata += ", ";
}
jsondata += " ] ";

jsondata += "}";

 
return(jsondata);
} // getclusterdata_json()




//
// block sleep
//
blockSleep  (ms)  
  {
  const start = Date.now();
  while (Date.now() - start < ms) {
        // do nothing
        }
  };
  
  
  
  
//
// move_botcontroller_queue 
//  
move_botcontroller_queue( msgarray, message )  
{
let cmd_parser_class_obj = new cmd_parser_class();
let logging = false;

 
 
if ( msgarray['cmd'] ==  cmd_parser_class_obj.CMD_RET_OK )
   {     
   this.msgqueue_bc.push( message ); 
   } // ok
   


if ( msgarray['cmd'] ==  cmd_parser_class_obj.CMD_RINFO )
   {  
   if (logging)  console.log('\x1b[31;1m%s\x1b[0m', '-- ADD BC_QUEUE CMD_RINFO ' + message);
    
   this.msgqueue_bc.push( message ); 
   } // rinfo

if ( msgarray['cmd'] ==  cmd_parser_class_obj.CMD_RCHECK )
   {      
   this.msgqueue_bc.push( message ); 
   } // rcheck
   
   
   
if ( msgarray['cmd'] ==  cmd_parser_class_obj.CMD_RALIFE )
   {  

   if (logging) console.log("prepare CMD_RALIFE");
   if (logging) console.log(message);
    
   this.msgqueue_bc.push( message ); 
   } // rcheck   

if ( msgarray['cmd'] ==  cmd_parser_class_obj.CMD_RNBH )
   {
   this.msgqueue_bc.push( message );
   } // rnbh

   
// Custom - Return  
if ( msgarray['cmd'] ==  "XRRC" )
   {  
   if (logging) console.log('\x1b[31;1m%s\x1b[0m', '-- ADD BC_QUEUE XRRC');
   if (logging) console.log( message );
    
   this.msgqueue_bc.push( message ); 
   } // rcheck   
   


} // move_botcontroller_queue
  
  
  
//
// pop_botcontroller_queue()
//
pop_botcontroller_queue()
{

 


let jsondata = "";

jsondata += "{";

jsondata += " \"msgqueue_bc\":  [   ";



let size = this.msgqueue_bc.length;

for (let i=0; i<size; i++)
    {
    jsondata += "\""+this.msgqueue_bc[i] + "\" ";
    if (i < (size-1) )     
       {
       jsondata += ", ";
       }
    } // for i..



jsondata += "  ]  ";

jsondata += ', "servicebay_cells": [ ';

let servicebay_size = this.servicebay_cells.length;

for (let i=0; i<servicebay_size; i++)
    {
    jsondata += JSON.stringify(this.servicebay_cells[i]);
    if (i < (servicebay_size-1) )
       {
       jsondata += ", ";
       } // if
    } // for

jsondata += " ] ";

jsondata += ', "obstacles": [ ';
for (let i=0; i<this.obstacles.length; i++) {
    jsondata += JSON.stringify(this.obstacles[i]);
    if (i < (this.obstacles.length-1)) jsondata += ", ";
}
jsondata += " ] ";

jsondata += "}";

 

// clear the msgqueue_bc
this.msgqueue_bc = [];


return(jsondata);
} // pop_botcontroller_queue 
  
  
 
//
// spinner()
//
spinner() {
process.stdout.write('\r' + this.spinnerframes[this.frameIndex] + " " + this.counter + " ");
this.frameIndex = (this.frameIndex + 1) % this.spinnerframes.length;
}
  
  
  
  
//
// simulate_bot_step()
//  
async simulate_bot_step()
{
let cmd_parser_class_obj = new cmd_parser_class();
  
this.create_botindex_array();

const communication_mode = (this.config && this.config.communication_mode) ? this.config.communication_mode : "mesh_opcode";

// Communication mode switch:
// - mesh_opcode: use legacy routing + run_cmd processing below.
// - direct_radio: use dedicated direct-radio branch.
if (communication_mode == "mesh_opcode")
   {
 

//
// Work on Masterbot queue
//
let message = this.pop_msg();

 

if (message != "")
   {
   let msgarray = cmd_parser_class_obj.parse(message);
   
 
   
   let destslot    = msgarray['destslot'];
   let cmdnext     = msgarray['cmdnext'];
   
   // Routing message
   if (destslot != "")
      {
      let indexdestbot = this.index_neighbors[destslot]; // e.g. (1.0,0) - null if does not exist

      if (indexdestbot == undefined)
         {
         if (destslot == ".")
            {
            msgarray['destslot'] = "";
            this.move_botcontroller_queue( msgarray, message );
            } // if (destslot == ".")
         else
            {
            Logger.log("Invalid masterbot routing destslot: " + destslot + " message: " + message);
            } // else
         } else
           {

 
      
          let koor_x = Number(this.x) + Number(indexdestbot[0]);
          let koor_y = Number(this.y) + Number(indexdestbot[1]);
          let koor_z = Number(this.z) + Number(indexdestbot[2]);
   
          let tmp_botindex = this.get_3d(koor_x,koor_y,koor_z); // e.g. "x,y,z" 
 
          if (tmp_botindex == null || this.bots[tmp_botindex] === undefined)
             {
             Logger.log("Routing target bot missing for destslot: " + destslot + " message: " + message);
             return;
             } // if

    
          let slot_inbound = this.calc_inbound_slot(tmp_botindex, indexdestbot);
 
      
      if ( slot_inbound != "")
         {
         cmdnext = slot_inbound + "*" + cmdnext;
         } // if ( slot_inbound != "")  
   
      
      // Message for other bot
      this.bots[tmp_botindex].push_msg( cmdnext );
      
      // LoggerBlender.event_log( "Routing: " + cmdnext );
          } // else
      } // if (destslot != "")
   
   
   // Destination: self
   if (destslot == "")
      {        
      
      this.move_botcontroller_queue( msgarray, message );
      
      let botid     = msgarray['botid'];
      
      } // if (destslot == "")


   } // if message != ""
 



//
// Work on Bot queues
//
for (let i=0; i < this.bots.length; i++)
    {               
    if (this.bots[i] === undefined || this.bots[i] == null)
       {
       continue;
       } // if

    let message = this.bots[i].pop_msg();


    if (message != "")
       {
       let msgarray = cmd_parser_class_obj.parse(message);
       
          
       let destslot    = msgarray['destslot'];
       let cmdnext     = msgarray['cmdnext'];
   
      
       
       
   
   
       // Routing message 
       if (destslot != "")
          {
          let indexdestbot = this.bots[i].index_neighbors[destslot];

          if (indexdestbot == undefined)
             {
             if (destslot == ".")
                {
                msgarray['destslot'] = "";
                await this.bots[i].run_cmd( msgarray, this );
                continue;
                } // if (destslot == ".")

             Logger.log("Invalid bot routing destslot: " + destslot + " message: " + message);
             continue;
             } // if (indexdestbot == undefined)
    
          let koor_x = Number(this.bots[i].x) + Number(indexdestbot[0]);
          let koor_y = Number(this.bots[i].y) + Number(indexdestbot[1]);
          let koor_z = Number(this.bots[i].z) + Number(indexdestbot[2]);
   

          let tmp_botindex = this.get_3d(koor_x,koor_y,koor_z);
   
          if (tmp_botindex != null && this.bots[tmp_botindex] !== undefined)
          {
          
   
      
          let slot_inbound = this.calc_inbound_slot(tmp_botindex, indexdestbot);
         
          
          if ( slot_inbound != "")
             {
             cmdnext = slot_inbound + "*" + cmdnext;
             } // if ( slot_inbound != "")            


         
          
          

 

          // Add zu bot-message queue if slot is not locked! 
          // Reject locked ingoing and outgoing slots
          let LOCKED = false;
          
          if ( slot_inbound != "")
             {            

             if ( 
                this.bots[tmp_botindex].locked.includes( slot_inbound.toUpperCase() )                 
                )               
                {
                LOCKED = true;
                }


             let out_slot = msgarray['cmdnext'][0];

             if (               
                this.bots[tmp_botindex].locked.includes( out_slot.toUpperCase() ) 
                )               
                {

                LOCKED = true;
                }


             }
                           
          // Slot reliability check (outgoing: Sender-Seite)
          if (!LOCKED && this.bots[i].special_slot_configuration) {
              let outSlot = destslot.toLowerCase();
              let outRel = this.bots[i].slot_reliability[outSlot];
              if (outRel !== undefined && outRel < 1.0 && Math.random() > outRel) {
                  LOCKED = true; // Nachricht auf dem Weg verloren
              }
          }

          // Slot reliability check (incoming: Empfänger-Seite)
          if (!LOCKED && slot_inbound != "" && this.bots[tmp_botindex].special_slot_configuration) {
              let inSlot = slot_inbound.toLowerCase();
              let inRel = this.bots[tmp_botindex].slot_reliability[inSlot];
              if (inRel !== undefined && inRel < 1.0 && Math.random() > inRel) {
                  LOCKED = true; // Nachricht am Ziel nicht angekommen
              }
          }

          if (!LOCKED)
             {
             this.bots[tmp_botindex].push_msg( cmdnext );
             }
             
             
          } // if (tmp_botindex != null)

          
          // Masterbot-Return
          if (
             koor_x == this.x &&
             koor_y == this.y &&
             koor_z == this.z 
             )
             {
                         
             this.push_msg( cmdnext );
             }
          
          } // if (destslot != "")
   
   
       // Destination: self
       if (destslot == "")
          {   
          // MBs/hMBs (masterbot > 0): Response-Typen direkt an BotController,
          // ohne signature_check in run_cmd() – identisch zum legacy MasterBot.
          if ((this.bots[i].masterbot ?? 0) > 0)
             {
             let cmd = msgarray['cmd'] ?? null;
             if (
                cmd == cmd_parser_class_obj.CMD_RINFO ||
                cmd == cmd_parser_class_obj.CMD_RALIFE ||
                cmd == cmd_parser_class_obj.CMD_RCHECK ||
                cmd == cmd_parser_class_obj.CMD_RNBH ||
                cmd == cmd_parser_class_obj.CMD_RET_OK
                )
                {
                this.bots[i].push_botcontroller_queue(message);
                }
             } else
               {
               await this.bots[i].run_cmd( msgarray, this );
               }

          } // if (destslot == "")


       } // if message != ""
   
    
    
    } // for i...

   } // if (communication_mode == "mesh_opcode")
else
if (communication_mode == "direct_radio")
   {
   //
   // Direct radio:
   // - Destination is interpreted as RID (not slot-address routing).
   // - Command is executed directly on target bot via run_cmd().
   //
   let message = this.pop_msg();

   if (message != "")
      {
      let msgarray = cmd_parser_class_obj.parse(message);
      let destination = String(msgarray['destination'] ?? "").trim();
      let cmd_name = String(msgarray['cmdname'] ?? "");
      const sign_parts = String(message).split("@");

      Logger.log("direct_radio dispatch incoming destination=[" + destination + "] cmdname=[" + cmd_name + "] raw=[" + message + "]");

      if (destination == "" || destination == ".")
         {
         Logger.log("direct_radio local masterbot handling destination=[" + destination + "] cmdname=[" + cmd_name + "]");
         this.move_botcontroller_queue(msgarray, message);
         } else
           if (
               destination == String(this.rid ?? "") ||
               destination == "00:00:00:00:00:00"
              )
             {
             Logger.log(
                        "direct_radio local masterbot handling by rid destination=[" +
                        destination + "] cmdname=[" + cmd_name + "] master_rid=[" +
                        String(this.rid ?? "") + "]"
                       );
             this.move_botcontroller_queue(msgarray, message);
             } else
           {
           let target_botindex = this.get_botindex_by_rid(destination);

           if (target_botindex == null)
              {
              Logger.log("Invalid direct_radio destination rid: " + destination + " message: " + message);
              } else
                {
                // In direct_radio, keep signature payload exactly as originally signed
                // (everything after first '#', same as BotController.sign()).
                if (msgarray['signature_type'] != "" && sign_parts.length >= 2)
                   {
                   const full_payload = sign_parts.slice(1).join("@");
                   const hash_idx = full_payload.indexOf("#");
                   if (hash_idx >= 0 && hash_idx < (full_payload.length - 1))
                      {
                      msgarray['sign_message'] = full_payload.substring(hash_idx + 1);
                      } // if
                   } // if

                Logger.log("direct_radio resolved destination rid=[" + destination + "] -> botid=[" + this.bots[target_botindex].id + "]");
                await this.bots[target_botindex].run_cmd(msgarray, this);
                } // else
           } // else
      } // if message != ""




   } // if (communication_mode == "direct_radio")






this.counter++;
 
if (!this.QUIET) this.spinner() ;
  
} // simulate_bot_step()


//
// Call by bot_class.js / run_cmd
//
get_td_relationvector( selfx,selfy,selfz, sourceslot )
{

let key = this.getKey_3d(selfx,selfy,selfz);

let botindex =  this.botindex[key] ;



 
let sourceslot_lower         =  sourceslot.toLowerCase();
let sourceslot_cellbot_index =  this.bots[botindex].index_neighbors[sourceslot_lower]


 
let arrayxyz = this.key_to_xyz(sourceslot_cellbot_index);

let newx = Number(selfx) + Number(arrayxyz[0]);
let newy = Number(selfy) + Number(arrayxyz[1]);
let newz = Number(selfz) + Number(arrayxyz[2]);

 

// Check, if newx,newy,newz is the masterbot-coordinate

let source_vector_x,source_vector_y,source_vector_z;

if (
   newx == this.x &&
   newy == this.y &&
   newz == this.z 
   ) 
   {
   // Target is masterbot
   source_vector_x = this.vx;
   source_vector_y = this.vy;
   source_vector_z = this.vz;
   } else
     {
     let key2 = this.getKey_3d(newx,newy,newz);
     let botindex2 = this.botindex ? this.botindex[key2] : undefined;
    
     if (botindex2 === undefined || botindex2 === null) {
         source_vector_x = 0; source_vector_y = 0; source_vector_z = 0;
     } else {
         source_vector_x = this.bots[botindex2].vector_x;
         source_vector_y = this.bots[botindex2].vector_y;
         source_vector_z = this.bots[botindex2].vector_z;
     }
     }
     


 


// Get own vector_x,y,z 
let vector_x = this.bots[botindex].vector_x;
let vector_y = this.bots[botindex].vector_y;
let vector_z = this.bots[botindex].vector_z;




let diffangle = this.rotationAngle90Y( [vector_x,vector_y,vector_z], [source_vector_x,source_vector_y,source_vector_z] );
 

let retvector = [];

if (diffangle == 0  ) retvector = [0,0,1];
if (diffangle == 90 ) retvector = [1,0,0];
if (diffangle == 180) retvector = [0,0,-1];
if (diffangle == 270) retvector = [-1,0,0];

 

 
return (retvector);
} // get_td_relationvector




//
// Call by bot_class.js / run_cmd
//
get_botstatus( x,y,z, subcmd_destslot )
{
let status = "";

let key = this.getKey_3d(x,y,z);



let botindex =  this.botindex[key] ;


 


let sourceslot_lower         =  subcmd_destslot.toLowerCase();
let sourceslot_cellbot_index =  this.bots[botindex].index_neighbors[sourceslot_lower]


let arrayxyz = this.key_to_xyz(sourceslot_cellbot_index);

let newx = Number(x) + Number(arrayxyz[0]);
let newy = Number(y) + Number(arrayxyz[1]);
let newz = Number(z) + Number(arrayxyz[2]);


let botindex2 = this.get_3d(newx,newy,newz);


if (botindex2 == null) status = "EMPT";

if (botindex2 != null)  
   {
   status = "OK";
   
   if (
       this.bots[botindex2].inactive == 'true' ||
       this.bots[botindex2].inactive === true ||
       this.bots[botindex2].inactive == 1
      ) status = "OFFL";
   }


 
  
return ( status );  
} // get_botstatus


//
// get_nbh()
//
get_nbh(mode, x, y, z, slot)
{
const requested_mode = String(mode ?? "").toLowerCase().trim();
const requested_slot = String(slot ?? "").toUpperCase().trim();
const allow_rid_discovery =
      (this.config && (
                       this.config.allow_rid_discovery === true ||
                       this.config.allow_rid_discovery === 1 ||
                       this.config.allow_rid_discovery === "1" ||
                       String(this.config.allow_rid_discovery ?? "").toLowerCase() == "true"
                      ));

const ret =
{
ok: false,
mode: requested_mode,
slot: requested_slot,
source_id: null,
source_rid: null,
neighbor_id: null,
neighbor_rid: null,
neighbor_vec: "x",
reason: "NBH_UNRESOLVED"
};

const valid_slots = [ "F", "R", "B", "L", "T", "D" ];
if (!valid_slots.includes(requested_slot))
   {
   ret.reason = "INVALID_SLOT";
   return(ret);
   } // if

if (requested_mode != "id" && requested_mode != "rid")
   {
   ret.reason = "INVALID_MODE";
   return(ret);
   } // if

if (requested_mode == "rid" && !allow_rid_discovery)
   {
   ret.reason = "RID_DISCOVERY_DISABLED";
   return(ret);
   } // if

let key = this.getKey_3d(x,y,z);
let source_botindex = this.botindex[key];
if (source_botindex === undefined || source_botindex === null)
   {
   ret.reason = "SOURCE_NOT_FOUND";
   return(ret);
   } // if

ret.source_id = String(this.bots[source_botindex].id ?? "");
if (requested_mode == "rid")
   {
   ret.source_rid = String(this.bots[source_botindex].rid ?? "");
   } // if

let slot_lower = requested_slot.toLowerCase();
let neighbor_key = this.bots[source_botindex].index_neighbors[slot_lower];
if (neighbor_key === undefined || neighbor_key === null || neighbor_key == -1)
   {
   ret.ok = true;
   ret.reason = "EMPTY";
   return(ret);
   } // if

let arrayxyz = this.key_to_xyz(neighbor_key);
let newx = Number(x) + Number(arrayxyz[0]);
let newy = Number(y) + Number(arrayxyz[1]);
let newz = Number(z) + Number(arrayxyz[2]);

if (
    newx == this.x &&
    newy == this.y &&
    newz == this.z
   )
   {
   ret.ok = true;
   ret.neighbor_id = "MB";
   if (requested_mode == "rid")
      {
      ret.neighbor_rid = String(this.rid ?? "");
      } // if
   ret.reason = "OK";
   return(ret);
   } // if

let neighbor_botindex = this.get_3d(newx,newy,newz);
if (neighbor_botindex === undefined || neighbor_botindex === null)
   {
   ret.ok = true;
   ret.reason = "EMPTY";
   return(ret);
   } // if

ret.ok = true;
ret.neighbor_id = String(this.bots[neighbor_botindex].id ?? "");

if (requested_mode == "rid")
   {
   ret.neighbor_rid = String(this.bots[neighbor_botindex].rid ?? "");
   } // if

if (requested_slot == "T" || requested_slot == "D")
   {
   // Keep T/D vector semantics aligned with RINFO:
   // vector is relative from the source bot's current pose.
   const source_x = this.bots[source_botindex].x;
   const source_y = this.bots[source_botindex].y;
   const source_z = this.bots[source_botindex].z;
   const nbh_vec = this.get_td_relationvector(source_x, source_y, source_z, requested_slot);
   if (Array.isArray(nbh_vec) && nbh_vec.length == 3)
      {
      ret.neighbor_vec = String(nbh_vec[0]) + "," + String(nbh_vec[1]) + "," + String(nbh_vec[2]);
      } // if
   } // if

ret.reason = "OK";
return(ret);
} // get_nbh()





//
// Call by bot_class.js / run_cmd
//
check_collision( target_x, target_y, target_z )
{
let ret = false;

let botindex = this.get_3d(target_x,target_y,target_z);


if (botindex != null) ret = true;

return ret;
} // check_collision


//
// is_servicebay_coordinate()
//
is_servicebay_coordinate(target_x, target_y, target_z)
{
let tx = Number(target_x);
let ty = Number(target_y);
let tz = Number(target_z);

for (let i=0; i<this.servicebay_cells.length; i++)
    {
    if (
        Number(this.servicebay_cells[i].x) == tx &&
        Number(this.servicebay_cells[i].y) == ty &&
        Number(this.servicebay_cells[i].z) == tz
       )
       {
       return(true);
       } // if
    } // for

return(false);
} // is_servicebay_coordinate()


//
// check_service_bay_extraction()
//
check_service_bay_extraction(botindex)
{
let ret =
{
extracted: false,
botid: "",
botindex_old: -1
};

if (botindex === null || botindex === undefined)
   {
   return(ret);
   } // if

if (botindex < 0 || botindex >= this.bots.length)
   {
   return(ret);
   } // if

let target_bot = this.bots[botindex];

if (target_bot === undefined)
   {
   return(ret);
   } // if

if (!this.is_servicebay_coordinate(target_bot.x, target_bot.y, target_bot.z))
   {
   return(ret);
   } // if

let removed_id = String(target_bot.id);
ret.extracted = true;
ret.botid = removed_id;
ret.botindex_old = Number(botindex);

target_bot.active = 0;
target_bot.inactive = true;

delete this.payload_bot_ids[removed_id];

this.bots.splice(botindex, 1);

for (let i=0; i<this.bots.length; i++)
    {
    let grabbed_index = this.bots[i].grabbed_cellbot;

    if (grabbed_index === null || grabbed_index === undefined)
       {
       continue;
       } // if

    if (grabbed_index == botindex)
       {
       this.bots[i].grabbed_cellbot = null;
       continue;
       } // if

    if (grabbed_index > botindex)
       {
       this.bots[i].grabbed_cellbot = Number(grabbed_index) - 1;
       } // if
    } // for

this.create_botindex_array();

const events = [];
events.push(
            {
             event: "removebot",
             botid: removed_id
            }
           );
this.notify_frontend(events);

Logger.log(
          "check_service_bay_extraction() extracted(" + removed_id + ") " +
          "at(" + target_bot.x + "," + target_bot.y + "," + target_bot.z + ")"
          );

return(ret);
} // check_service_bay_extraction()



//
// Call by bot_class.js / run_cmd
//
get_target_int_id( transporter_x, transporter_y, transporter_z, targetslot )
{
let target_cellbot_int_index = -1;

 
let key = this.getKey_3d(transporter_x,transporter_y,transporter_z);
let transporter_botindex =  this.botindex[key] ;


let targetslot_lower         =  targetslot.toLowerCase();
let key2 =  this.bots[transporter_botindex].index_neighbors[targetslot_lower]



let arrayxyz = this.key_to_xyz(key2);

let newx = Number(transporter_x) + Number(arrayxyz[0]);
let newy = Number(transporter_y) + Number(arrayxyz[1]);
let newz = Number(transporter_z) + Number(arrayxyz[2]);

 
 
target_cellbot_int_index = this.get_3d(newx,newy,newz);

 
 
return (target_cellbot_int_index);
} // get_target_int_id


  
update_keyindex( old_x, old_y, old_z, target_x, target_y, target_z )
{
 
let old_keyindex3d = this.getKey_3d( old_x, old_y, old_z );
let old_keyindex = this.botindex[ old_keyindex3d ];
   
delete this.botindex[ old_keyindex3d ];
    
// set new botindex-entry
this.set_3d(target_x, target_y, target_z, old_keyindex); 
 
} // update_keyindex


//
// rotationAngle90Y() -> return an relative rotation angle between own o-vector (ac) and
// another (sending CellBot) o-vector (vc).
//
rotationAngle90Y(ac, vc) {

 

let angle;

if ( vc[0] ==  1 && vc[1] ==  0 && vc[2] ==  0 )
   {
   if ( ac[0] ==  1 && ac[1] ==  0 && ac[2] ==  0 ) angle =   0;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] == -1 ) angle =  90;
   if ( ac[0] == -1 && ac[1] ==  0 && ac[2] ==  0 ) angle = 180;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] ==  1 ) angle = 270;
   }

if ( vc[0] ==  0 && vc[1] ==  0 && vc[2] == -1 )
   {
   if ( ac[0] ==  1 && ac[1] ==  0 && ac[2] ==  0 ) angle = 270;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] == -1 ) angle =   0;
   if ( ac[0] == -1 && ac[1] ==  0 && ac[2] ==  0 ) angle =  90;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] ==  1 ) angle = 180;
   }

if ( vc[0] == -1 && vc[1] ==  0 && vc[2] ==  0 )
   {
   if ( ac[0] ==  1 && ac[1] ==  0 && ac[2] ==  0 ) angle = 180;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] == -1 ) angle = 270;
   if ( ac[0] == -1 && ac[1] ==  0 && ac[2] ==  0 ) angle =   0;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] ==  1 ) angle =  90;
   }

if ( vc[0] ==  0 && vc[1] ==  0 && vc[2] ==  1 )
   {
   if ( ac[0] ==  1 && ac[1] ==  0 && ac[2] ==  0 ) angle =  90;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] == -1 ) angle = 180;
   if ( ac[0] == -1 && ac[1] ==  0 && ac[2] ==  0 ) angle = 270;
   if ( ac[0] ==  0 && ac[1] ==  0 && ac[2] ==  1 ) angle =   0;
   }


 
return (angle);
}


//
// create_botindex_array()
//
create_botindex_array()
{
this.botindex = [];

let l = this.bots.length;

for (let i=0; i<l; i++)
    {     
    let thex = this.bots[i].x;
    let they = this.bots[i].y;
    let thez = this.bots[i].z;
      
    this.set_3d(thex, they, thez, i);
      
    
    } // for i...


 

} // create_botindex_array()



//
// notify_frontend()
//
notify_frontend( events )
{
 


let msg =
{
notify: "update",
msg: events
};


this.send_webgui( JSON.stringify(msg) );

//
// Blender-logging
//
LoggerBlender.event_log( msg );


 

} // notify_frontend()




//
// close_blender_logging()
//
close_blender_logging()
{
LoggerBlender.close();
} // close_blender_logging()



//
// --> StopWatch
//
resetStopwatch() 
{
        this._stopwatchStart = Date.now();
}

get_stopwatch_ms() 
{
        return Date.now() - this._stopwatchStart;
}

//
// <-- StopWatch
//
    

  
// Funktion, um einen Schlüssel aus x, y, z zu erstellen
getKey_3d(x, y, z) {
    return `${x},${y},${z}`; // Kombiniere die Koordinaten als String
}  

// Wert setzen
set_3d(x, y, z, value) {
    const key = this.getKey_3d(x, y, z);
    this.botindex[key] = value;
}

// Wert abrufen
get_3d(x, y, z) {
    const key = this.getKey_3d(x, y, z);
    return this.botindex[key] ?? null; // Gib den Wert zurück oder null, falls nicht vorhanden
}

key_to_xyz(str) {
    str = str + "";
    return str.split(',').map(Number);
}

  
// 
// Thread BotController communication 
//
async thread_bots() {
  setInterval(() => 
  {
    
  if (1)
  	 {    
     this.simulate_bot_step();
     }
 
  }, Number(this.config.stepdelay) );
}
  
} // class masterbot_class

 
module.exports = masterbot_class;
