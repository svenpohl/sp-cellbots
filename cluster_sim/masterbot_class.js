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
const WebSocket = require('ws');

const path = require('path');

const bot_class = require('./bot_class');
const cmd_parser_class = require('./cmd_parser_class');  

const Logger = require('./logger');
Logger.reset();
Logger.log("Start cluster_sim");


const LoggerBlender = require('./logger_blender');



 
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
  
  this.botindex = [];
  
  
  this.setlivelogging = false;
  this.ws = null;
  
  // Start stopwatch
  this._stopwatchStart = Date.now();
      
  } // constructor
  
  
  
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
  if (!this.QUIET) console.log( "blenderlogging: " + this.config.blenderlogging );

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
if ( this.setlivelogging == true )
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
      
      }); // mbcell.forEach
      
      
     
     
      
      const cells = result.xml.cell;
      cells.forEach(cell => {
      
      const bot_class_obj = new bot_class();
      bot_class_obj.setvalues(
                           cell.id[0],
                           cell.pos[0].x[0],
                           cell.pos[0].y[0],
                           cell.pos[0].z[0],
                           cell.pos[0].vx[0],
                           cell.pos[0].vy[0],
                           cell.pos[0].vz[0],
                           cell.inactive,
                           cell.pos[0].col[0],
                           this.config.physical_bot_move_delay,
                           
                           this.config.enable_signing, 
                           this.config.signature_type, 
                           this.config.public_key_or_secret
                                                  
                           );
                           
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
// loadConfig()
// 
loadconfig(filePath) {
  const configData = fs.readFileSync(filePath, 'utf-8');
  const config = {};

  configData.split('\n').forEach(line => {
    const [key, value] = this.split_first(line.trim(), '=');
    if (key && value !== null) {
      config[key.trim()] = value.trim();
    }
  });

  // Add config to global space
  this.config = config;
  
  return config;
}


split_first(text, separator) {
  const index = text.indexOf(separator);
  if (index === -1) {
    return [text, null]; // Separator not found
  }
  const part1 = text.slice(0, index);
  const part2 = text.slice(index + separator.length);
  return [part1, part2];
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

    jsondata += "   \"col\": \""+this.bots[i].color +"\"  ";
    
    jsondata += "   }    ";
    
    if (i < (this.bots.length-1) )
       {
       jsondata += "   ,    ";
       }
       
    } // for i...
       
       
jsondata += "]";       
        

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


 
   
      let koor_x = Number(this.x) + Number(indexdestbot[0]);
      let koor_y = Number(this.y) + Number(indexdestbot[1]);
      let koor_z = Number(this.z) + Number(indexdestbot[2]);
   
      let tmp_botindex = this.get_3d(koor_x,koor_y,koor_z); // e.g. "x,y,z" 
 
    
      let slot_inbound = this.calc_inbound_slot(tmp_botindex, indexdestbot);
 
      
      if ( slot_inbound != "")
         {
         cmdnext = slot_inbound + "*" + cmdnext;
         } // if ( slot_inbound != "")  
   
      
      // Message for other bot
      this.bots[tmp_botindex].push_msg( cmdnext );
      
      // LoggerBlender.event_log( "Routing: " + cmdnext );
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
let l = this.bots.length;

for (let i=0; i < l; i++)
    {               
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
    
          let koor_x = Number(this.bots[i].x) + Number(indexdestbot[0]);
          let koor_y = Number(this.bots[i].y) + Number(indexdestbot[1]);
          let koor_z = Number(this.bots[i].z) + Number(indexdestbot[2]);
   

          let tmp_botindex = this.get_3d(koor_x,koor_y,koor_z);
   
          if (tmp_botindex != null)
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
          
          await this.bots[i].run_cmd( msgarray, this );

          } // if (destslot == "")


       } // if message != ""
   
    
    
    } // for i...

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
     let botindex2 = this.botindex[key2];
    

     source_vector_x = this.bots[botindex2].vector_x;
     source_vector_y = this.bots[botindex2].vector_y;
     source_vector_z = this.bots[botindex2].vector_z;
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
   
   if (this.bots[botindex2].inactive == 'true') status = "OFFL";
   }


 
  
return ( status );  
} // get_botstatus





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
this.botindex.length = 0;

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




