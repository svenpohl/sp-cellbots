//
// bot_class.js — Sven Pohl <sven.pohl@zen-systems.de> — MIT License © 2025
//

const cmd_parser_class = require('../common/cmd_parser_class');  

const Logger = require('./logger');  

const signature_class = require('../common/signature/signature_class'); 

//
// Bot class
//
class bot_class 
{


constructor() 
  { 
  this.id       = "";
  this.bottmpid = "";
  this.type     = 0;
  this.x        = 0;
  this.y        = 0;
  this.z        = 0;

  this.vector_x = 0;
  this.vector_y = 0;
  this.vector_z = 0;
  
  this.color = "000000";

  this.mbconnection = 0;
  this.debug = "";
  this.active = 1;
  this.inactive = 0;
  
  this.msgqueue        = [];
  this.index_neighbors = [];
  
  this.index_neighbors['f'] = -1;
  this.index_neighbors['r'] = -1;
  this.index_neighbors['b'] = -1;
  this.index_neighbors['l'] = -1;
  this.index_neighbors['t'] = -1;
  this.index_neighbors['d'] = -1;
  
  this.locked        = [];
  
  //this.max_msgqueue = 5;
  this.max_msgqueue = 500;

  this.cmd_parser_class_obj = new cmd_parser_class();
  
  this.grabbed_cellbot = null;
  
  this.physical_bot_move_delay = 0;
  
  this.enable_signing       = false;
  this.signature_type       = "";
  this.public_key_or_secret = "";
  
  this.signature_class_obj = new signature_class( );
  
  } // constructor
  
  
  
  
//
// setvalues()
//  
setvalues( id, x,y,z, vx,vy,vz, inactive = 0, color, physical_bot_move_delay,                           
           enable_signing,
           signature_type,
           public_key_or_secret
)
{
this.id = id;
this.x = x;
this.y = y;
this.z = z;

this.vector_x = vx;
this.vector_y = vy;
this.vector_z = vz;

if (Array.isArray(inactive))
   {
   inactive = inactive[0];
   }

this.inactive = (
                 inactive === true ||
                 inactive === 1 ||
                 inactive === "1" ||
                 inactive === "true"
                 );

this.color = color;

this.physical_bot_move_delay = physical_bot_move_delay;

this.enable_signing       = enable_signing;
this.signature_type       = signature_type;
this.public_key_or_secret = public_key_or_secret;

} // setvalues()


//
// push_msg
//
push_msg( msg )
{
let ret = 0;

if (this.inactive == 'true' || this.inactive === true || this.inactive == 1)
   {
   return(0);
   }

let size = this.msgqueue.length;

if (size < this.max_msgqueue)
   {   
   Logger.log("push_msg("+this.id+") ["+msg+"]  size("+size+")");
   
   this.msgqueue.push( msg );
   return( 1 );
   } else
     {
     Logger.log("Queue overflow!");
     }
   

return(ret);
} // push_msg

 


//
// pop_msg
//
pop_msg()
{
let ret = "";

if (this.inactive == 'true' || this.inactive === true || this.inactive == 1)
   {
   return("");
   }

let size = this.msgqueue.length;

if (size == 0) 
   {
   return("");
   }

let message = this.msgqueue.pop();
return(message);
} // push_msg






//
// run_cmd( cmdarray )
//
async run_cmd( cmdarray, caller )
{
let destination = null;
let destreturn  = null;

if (this.inactive == 'true' || this.inactive === true || this.inactive == 1)
   {
   return(false);
   }


// -> Reject all from locked slots
let tmp_sourceslot  = cmdarray.sourceslot.toUpperCase();
  
if ( this.locked.includes( tmp_sourceslot ) ) 
   {
   // console.log('Reject from slot ' + tmp_sourceslot);
   return (false);
   }
// <- lock check



 
// -> signature check
let signature_check = true;

if (this.enable_signing == "true")
   {
   signature_check = false;

   if ( cmdarray.signature_type != this.signature_type)  signature_check = false;
   
   if ( this.signature_type == "HMAC" )
      {
      let sigtype = this.signature_class_obj.SIG_HMAC;
      
      signature_check = this.signature_class_obj.verifyMessage( sigtype, cmdarray['sign_message'], cmdarray['public_signature'], this.public_key_or_secret );             
      } // HMAC
      

   if ( this.signature_type == "ED25519" )
      {
      let sigtype = this.signature_class_obj.SIG_ED25519;

      signature_check = this.signature_class_obj.verifyMessage( sigtype, cmdarray['sign_message'], cmdarray['public_signature'], this.public_key_or_secret );
      } // ED25519
   
   
   if ( this.signature_type == "RSA" )
      {
      let sigtype = this.signature_class_obj.SIG_RSA;
      
      let public_key = this.signature_class_obj.restorePEM( this.public_key_or_secret , "PUBLIC KEY");      
      
      signature_check = this.signature_class_obj.verifyMessage( sigtype, cmdarray['sign_message'], cmdarray['public_signature'], public_key);             
      } // RSA
      
     
   } // if (this.enable_signing == "true")
  
  
if (signature_check != true)
   {
   console.log("WRONG SIGNATURE")
   return;
   }  
// <-
 
 

if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_PING )
   {
   destination = cmdarray.destreturn;
   destreturn = cmdarray.destreturn;
   let sourceslot = cmdarray.sourceslot.toUpperCase();
      
   destination = destination.replace(/s/gi, sourceslot);
   
   let cmdreturn = destination + "#OK#" + this.id;
   
   // Execute command
   this.push_msg( cmdreturn )
   }
   
   
   
   

if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_INFO )
   {  
   this.bottmpid   = cmdarray.bottmpid;
   destination     = cmdarray.destreturn;
   destreturn      = cmdarray.destreturn;
   let sourceslot  = cmdarray.sourceslot.toUpperCase();

   destination     = destination.replace(/s/gi, sourceslot);

 
   let rel_x = 0;
   let rel_y = 0;
   let rel_z = 0;
   
   if (sourceslot == 'D' || sourceslot == 'T')
      {   
      let relvector = caller.get_td_relationvector( this.x,this.y,this.z, sourceslot );
      rel_x = relvector[0];
      rel_y = relvector[1];
      rel_z = relvector[2];
      } // if (sourceslot == 'D' || sourceslot == 'T')
   

   let cmdreturn = destination + "#RINFO#" + this.id + ";"  +  this.bottmpid +  ";" + this.type + ";" + sourceslot + ";" + rel_x + ","  + rel_y + "," + rel_z + "";
   
  
  
   // Execute command
   this.push_msg( cmdreturn );
   
 
   } // CMD_INFO  


 

if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_CHECK )
   { 
   destreturn = cmdarray.destreturn;
   let sourceslot = cmdarray.sourceslot.toUpperCase();

   destreturn = destreturn.replace(/s/gi, sourceslot);

   let subcmd_destslot = cmdarray.subcmd[0][0].destslot;
   
   let status = "";

   if (subcmd_destslot == ".")
      {
      const slotnames = ['F','R','B','L','T','D'];

      for (let i=0; i<slotnames.length; i++)
          {
          let tmpstatus = caller.get_botstatus( this.x, this.y, this.z, slotnames[i] );

          if (tmpstatus == "OK") status += "a"; else
          if (tmpstatus == "OFFL") status += "b"; else
          if (tmpstatus == "EMPT") status += "c"; else
                                 status += "d";
          } // for
      } else
        {
        status = caller.get_botstatus( this.x, this.y, this.z, subcmd_destslot );
        } // else
   
   
   // Execute command
   let cmdreturn = destreturn + "#RCHECK#" + this.id + ";"  +  status + "";
   
   this.push_msg( cmdreturn );      
   } // CMD_CHECK



if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_MOVE )
   {   
   let size = cmdarray.subcmd.length;
   let move_sequence_aborted = false;

   for (let i=0; i<size; i++)
       {
       if (move_sequence_aborted)
          {
          break;
          } // if

       let sub    = cmdarray.subcmd[i].sub;       
       let repeat = cmdarray.subcmd[i].repeat;
       let fa     = cmdarray.subcmd[i].fa;
       let la     = cmdarray.subcmd[i].la;
       let moves  = cmdarray.subcmd[i].moves;
       
      
       // MOV
       if ( sub == "MOV" )
          {
    
          
          for (let i2=0; i2 < repeat; i2++)
              {
                          
              let size2 = moves.length;
              for (let i3=0; i3 < size2; i3++)
                  {
                
                  //  
                  // first anchor / last anchor test - only first and last steps  
                  //
                  if (size2 == 1)
                     {
                     await this.motoric_move( caller, fa, la, moves[i3] );
                     }
                     
                  if (size2 == 2)
                     {
                     if (i3==0) await this.motoric_move( caller, fa, "", moves[i3] );
                     if (i3==1) await this.motoric_move( caller, "", la, moves[i3] );
                     } // if (size2 == 2)  
                          
 
                  
                  } // for i3...
              
              } // for i2...
          
          } // MOV


       // SPIN
       if ( sub == "SPIN" )
          {
          let direction     = cmdarray.subcmd[i].direction;
          let spin_success  = true;
          
          for (let i2=0; i2 < repeat; i2++)
              {    
              let size2 = moves.length;
              for (let i3=0; i3 < size2; i3++)
                  {
                  spin_success = await this.motoric_spin( caller, fa, la, direction );

                  if (!spin_success)
                     {
                     move_sequence_aborted = true;
                     break;
                     } // if
                  
                  } // for i3...

              if (move_sequence_aborted)
                 {
                 break;
                 } // if
              
              } // for i2...
              
          } // SPIN
          

       // CONNECT
       if ( sub == "CONNECT" )
          {
          let slots  = cmdarray.subcmd[i].slots;
          
          let size = slots.length;
          
          let buffer = "";
          for (let i2=0; i2<size; i2++)
              {
              buffer += "/" + slots[i2];
              }
          
          } // CONNECT
          
          
       // GRAB
       if ( sub == "GRAB" )
          {     
          let slots  = cmdarray.subcmd[i].slots;
          
          let size = slots.length;
          
          let targetslot = slots[0];
          let previous_grabbed_cellbot = this.grabbed_cellbot;

          if (previous_grabbed_cellbot !== null)
             {
             caller.unregister_payload_bot_int_id(previous_grabbed_cellbot);
             } // if

          if (size == 0)
             {
             this.grabbed_cellbot = null;
             } // if
          
          // Only F-Transport is permitted
          if (targetslot == 'F')
             {
                         
             this.grabbed_cellbot = caller.get_target_int_id( this.x, this.y, this.z, targetslot );

             if (this.grabbed_cellbot !== null && this.grabbed_cellbot >= 0)
                {
                caller.register_payload_bot_int_id(this.grabbed_cellbot);
                } // if
      
             } // if (targetslot == 'F')
          
        
          } // GRAB

          
       // ALIFE
       if ( sub == "ALIFE" )
          {
          destreturn = cmdarray.destreturn;   
          
          // Execute command
          let cmdreturn = destreturn + "#RALIFE#" + this.id + ";" + cmdarray.bottmpid ;
   
          this.push_msg( cmdreturn );


          } // LIFE

       
       } // for i
   
   } // CMD_MOVE
   
   
   
   
// SYS
if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_SYS )
   {   
   let size = cmdarray.subcmd.length;
   for (let i=0; i<size; i++)
       {
       let sub    = cmdarray.subcmd[i].sub;       
       
       if (sub == "LOCK")
          {          
          this.locked  = cmdarray.subcmd[i].slots;
        
          } // sub == LOCK

       if (sub == "UPDATEKEY")
          {
                    
          if ( cmdarray.subcmd[i].type == "01" ) this.signature_type = "HMAC";
          if ( cmdarray.subcmd[i].type == "02" ) this.signature_type = "ED25519";
          if ( cmdarray.subcmd[i].type == "03" ) this.signature_type = "RSA";

          this.public_key_or_secret = cmdarray.subcmd[i].newsig;

          } // sub == LOCK

          
       }
       
   } // CMD_SYS
       
      
   


// Custom-Command
if ( cmdarray.cmd[0] == 'X' )
   {
   destreturn = cmdarray.destreturn;  
   let raw = cmdarray.raw;  

   // SetColor
   if ( cmdarray.cmd == "XSC" )
      {     
      this.color = raw;
          
      
      const events = [];
      let notify_msg =
          {
          event: "setcolor",
          botid: this.id,
          color: this.color
          };

      events.push( notify_msg );
      caller.notify_frontend( events );

      } // XSC



   // ReadColor
   if ( cmdarray.cmd == "XRC" )
      {
      // Execute command
      let cmdreturn = destreturn + "#XRRC#" + this.id + ";"  +  this.color + "";
   
      // console.log("cmdreturn: " + cmdreturn );
   
      this.push_msg( cmdreturn );

      } // XRC
   
 
   } // CUSTOM


 

} // run_cmd ()
      
      
      
      
//
// motoric_move()
//      
async motoric_move( caller, fa, la, direction_slot )      
{
let target_x = 0;
let target_y = 0;
let target_z = 0;

let carrier_x_old = this.x;
let carrier_y_old = this.y;
let carrier_z_old = this.z;

let grabbed_x, grabbed_y, grabbed_z;
let grabbed_botid;

let vector = [  0, 0, 0 ];

let update_carrier_bot = false;
let update_grabbed_bot = false;


if (direction_slot == 'F')
   {
   vector = [ this.vector_x, this.vector_y, this.vector_z ];
   
   } // if (direction_slot == 'F')


if (direction_slot == 'R')
   {
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector = [  0, 0, -1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector = [ -1, 0,  0 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector = [  0, 0,  1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector = [  1, 0,  0 ];   
   } // if (direction_slot == 'R')


if (direction_slot == 'B')
   {
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector = [ -1, 0,  0 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector = [  0, 0,  1 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector = [  1, 0,  0 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector = [  0, 0, -1 ];   
   } // if (direction_slot == 'B')


if (direction_slot == 'L')
   {
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector = [  0, 0,  1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector = [  1, 0,  0 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector = [  0, 0, -1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector = [ -1, 0,  0 ];   
   } // if (direction_slot == 'L')


if (direction_slot == 'T')
   {
   vector = [  0,  1,  0 ];
   } // if (direction_slot == 'T')

if (direction_slot == 'D')
   {
   vector = [  0, -1,  0 ];
   } // if (direction_slot == 'D')


// Now we get grabbed_cellbot (needed for collision)
if (this.grabbed_cellbot !== null)
   {           
   grabbed_x = caller.bots[ this.grabbed_cellbot ].x;
   grabbed_y = caller.bots[ this.grabbed_cellbot ].y;
   grabbed_z = caller.bots[ this.grabbed_cellbot ].z;
   
   grabbed_botid = caller.bots[ this.grabbed_cellbot ].id;
   }



target_x = Number(this.x) + Number(vector[0]);
target_y = Number(this.y) + Number(vector[1]);
target_z = Number(this.z) + Number(vector[2]);



     
//
// FA-LA - Check 
// 
   
// First Anchor - Check
let start_hasneighbours = true;

if (fa != "")
   {
   start_hasneighbours = caller.has_neighbour( this.x, this.y, this.z, this.vector_x, this.vector_y, this.vector_z, this.x, this.y, this.z, fa );
   }
   
// Last Anchor - Check
let target_hasneighbours = true;

if (la != "")
   {
   target_hasneighbours = caller.has_neighbour( target_x, target_y, target_z, this.vector_x, this.vector_y, this.vector_z, this.x, this.y, this.z, la );
   }
 
// <-- FA-LA - Check




let collision;

if (
   this.grabbed_cellbot !== null &&
   grabbed_x == target_x &&
   grabbed_y == target_y &&
   grabbed_z == target_z 
   )
   {
   // Nothing to check, because the carrier cannot collide with transported CellBot!
   collision = false;
   } else
     {
     // Check all other collisions
     collision = caller.check_collision( target_x, target_y, target_z );
     }



// Set new position
if ( !collision && start_hasneighbours && target_hasneighbours )
   {
  
   update_carrier_bot = true;
 
   } // if ( !collision )
   
   
   
   

//
// Transport
//

// Collision-Detection
let new_x, new_y, new_z;
   
if (this.grabbed_cellbot !== null)
   {
   let vector_translate_new = [  0, 0, 0 ];
  
    
   new_x = Number(grabbed_x) + Number(vector[0]);
   new_y = Number(grabbed_y) + Number(vector[1]);
   new_z = Number(grabbed_z) + Number(vector[2]);
 


   let collision2;
   if (   
      new_x == carrier_x_old &&
      new_y == carrier_y_old &&
      new_z == carrier_z_old 
      )
      {
      // Nothing to check, because the carrier cannot collide with transported CellBot!
      collision2 = false;
      } else
        {
        // Check all other collisions
        collision2 = caller.check_collision( new_x, new_y, new_z );
        }

  
   
   if (collision2)
      {
      
 
      
      } // if (collision)
      else
          {
          
          update_grabbed_bot = true;
         
          } // no collision
   

   
   
   
   } // grabbed_cellbot != null 
   
   
   
   
   
//   
// --> Execute moves   
//

//
// --> Animation delay
//
 
  
if ( update_carrier_bot )
{

const events = [];

let stopwatch_ms = caller.get_stopwatch_ms(); 

let notify_msg =
{
event: "move",
botid: this.id,
from: { x: Number(this.x), y: Number(this.y), z: Number(this.z) },
to: { x: Number(target_x), y: Number(target_y), z: Number(target_z) },
duration: Number(this.physical_bot_move_delay),
parent: '',

ts : Number(stopwatch_ms)
};

events.push( notify_msg );


//
// grabbed_bot
//
if ( update_grabbed_bot )
{
     
// Update Bot-Position and set new values:     
caller.bots[ this.grabbed_cellbot ].x = new_x;
caller.bots[ this.grabbed_cellbot ].y = new_y;
caller.bots[ this.grabbed_cellbot ].z = new_z;
          
caller.update_keyindex( grabbed_x, grabbed_y, grabbed_z, new_x, new_y, new_z );
          
 

notify_msg =
{
event: "move",
botid: grabbed_botid,
from: { x: Number(grabbed_x), y: Number(grabbed_y), z: Number(grabbed_z) },
to: { x: Number(new_x), y: Number(new_y), z: Number(new_z) },
duration: Number(this.physical_bot_move_delay),
parent: this.id,
ts : Number(stopwatch_ms)
};

events.push( notify_msg );


} // if ( update_grabbed_bot )



caller.notify_frontend( events );

 


 
await this.sleep( this.physical_bot_move_delay );
 

} // if ( update_carrier_bot )


//
// <-- Animation delay
//


if ( update_carrier_bot )
   {
   // Update Bot-Position and set new values:  
   caller.update_keyindex( this.x, this.y, this.z, target_x, target_y, target_z );      
   this.x = target_x;
   this.y = target_y;
   this.z = target_z;
   }
   
if ( update_grabbed_bot )
   {
   // Update Bot-Position and set new values:  
   caller.update_keyindex( grabbed_x, grabbed_y, grabbed_z, new_x, new_y, new_z );   
   caller.bots[ this.grabbed_cellbot ].x = new_x;
   caller.bots[ this.grabbed_cellbot ].y = new_y;
   caller.bots[ this.grabbed_cellbot ].z = new_z;               
   }   
 

 

} // motoric_move()
      
      
      
      
      
      
//
// get_spin_block_profile()
//
get_spin_block_profile( caller, direction )
{
let ret =
{
blocked: false,
blocked_reason: "",
occupied_horizontal_count: 0,
occupied_vertical_count: 0,
occupied_orthogonal_slots: [],
occupied_orthogonal_neighbors: [],
occupied_sweep_slots: [],
occupied_sweep_neighbors: []
};
let vector_new = [ 0, 0, 0 ];
let orthogonal_checks = [
                        { slot: "XP", dx:  1, dy:  0, dz:  0, axis: "horizontal" },
                        { slot: "XN", dx: -1, dy:  0, dz:  0, axis: "horizontal" },
                        { slot: "ZP", dx:  0, dy:  0, dz:  1, axis: "horizontal" },
                        { slot: "ZN", dx:  0, dy:  0, dz: -1, axis: "horizontal" },
                        { slot: "YP", dx:  0, dy:  1, dz:  0, axis: "vertical"   },
                        { slot: "YN", dx:  0, dy: -1, dz:  0, axis: "vertical"   }
                        ];
let excluded_botindex = this.grabbed_cellbot;
let excluded_x = this.x;
let excluded_y = this.y;
let excluded_z = this.z;

if (this.grabbed_cellbot !== null && caller.bots[this.grabbed_cellbot] !== undefined)
   {
   excluded_x = caller.bots[this.grabbed_cellbot].x;
   excluded_y = caller.bots[this.grabbed_cellbot].y;
   excluded_z = caller.bots[this.grabbed_cellbot].z;
   } // if

if (direction == 'R')
   {
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0, -1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector_new = [ -1,  0,  0 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0,  1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector_new = [  1,  0,  0 ];
   } // if

if (direction == 'L')
   {
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0,  1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector_new = [  1,  0,  0 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0, -1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector_new = [ -1,  0,  0 ];
   } // if

for (let i = 0; i < orthogonal_checks.length; i++)
    {
    let check = orthogonal_checks[i];
    let target_x = Number(this.x) + Number(check.dx);
    let target_y = Number(this.y) + Number(check.dy);
    let target_z = Number(this.z) + Number(check.dz);
    let botindex = caller.get_3d(target_x, target_y, target_z);

    if (botindex !== null)
       {
       if (excluded_botindex !== null && botindex === excluded_botindex)
          {
          continue;
          } // if

       if ( target_x == excluded_x &&
            target_y == excluded_y &&
            target_z == excluded_z )
          {
          continue;
          } // if

       if (caller.is_payload_bot_at_position(target_x, target_y, target_z))
          {
          continue;
          } // if

       ret.occupied_orthogonal_slots.push(check.slot);
       ret.occupied_orthogonal_neighbors.push({
                                             slot: check.slot,
                                             id: caller.bots[botindex].id,
                                             x: Number(target_x),
                                             y: Number(target_y),
                                             z: Number(target_z)
                                             });

       if (check.axis == "horizontal")
          {
          ret.occupied_horizontal_count++;
          } // if
       else
          {
          ret.occupied_vertical_count++;
          } // else
       } // if
    } // for

let sweep_checks = [
                   { slot: "FRONT_OLD", dx: Number(this.vector_x), dy: Number(this.vector_y), dz: Number(this.vector_z) },
                   { slot: "FRONT_NEW", dx: Number(vector_new[0]), dy: Number(vector_new[1]), dz: Number(vector_new[2]) },
                   { slot: "BACK_OLD",  dx: Number(this.vector_x) * -1, dy: Number(this.vector_y) * -1, dz: Number(this.vector_z) * -1 },
                   { slot: "BACK_NEW",  dx: Number(vector_new[0]) * -1, dy: Number(vector_new[1]) * -1, dz: Number(vector_new[2]) * -1 }
                   ];
let seen_sweep_keys = {};

for (let i = 0; i < sweep_checks.length; i++)
    {
    let check = sweep_checks[i];
    let target_x = Number(this.x) + Number(check.dx);
    let target_y = Number(this.y) + Number(check.dy);
    let target_z = Number(this.z) + Number(check.dz);
    let sweep_key = String(target_x) + "," + String(target_y) + "," + String(target_z);

    if (seen_sweep_keys[sweep_key] === true)
       {
       continue;
       } // if

    seen_sweep_keys[sweep_key] = true;

    let botindex = caller.get_3d(target_x, target_y, target_z);

    if (botindex !== null)
       {
       if (excluded_botindex !== null && botindex === excluded_botindex)
          {
          continue;
          } // if

       if ( target_x == excluded_x &&
            target_y == excluded_y &&
            target_z == excluded_z )
          {
          continue;
          } // if

       if (caller.is_payload_bot_at_position(target_x, target_y, target_z))
          {
          continue;
          } // if

       ret.occupied_sweep_slots.push(check.slot);
       ret.occupied_sweep_neighbors.push({
                                         slot: check.slot,
                                         id: caller.bots[botindex].id,
                                         x: Number(target_x),
                                         y: Number(target_y),
                                         z: Number(target_z)
                                         });
       } // if
    } // for

if (ret.occupied_horizontal_count > 0)
   {
   ret.blocked = true;
   ret.blocked_reason = "HORIZONTAL_NEIGHBOR_ATTACHED";
   } // if

if (!ret.blocked && ret.occupied_sweep_neighbors.length > 0)
   {
   ret.blocked = true;
   ret.blocked_reason = "LOCAL_SPIN_SWEEP_OCCUPIED";
   } // if

return(ret);
} // get_spin_block_profile()


//
// get_payload_spin_collision_profile()
//
get_payload_spin_collision_profile( caller, payload_botindex, payload_old_vector, payload_new_vector )
{
let ret =
{
blocked: false,
blocked_reason: "",
payload_target: null,
payload_sweep: null,
blocking_target_bot_id: null,
blocking_sweep_bot_id: null
};
let payload_target_x = Number(this.x) + Number(payload_new_vector[0]);
let payload_target_y = Number(this.y) + Number(payload_new_vector[1]);
let payload_target_z = Number(this.z) + Number(payload_new_vector[2]);
let payload_sweep_x = Number(this.x) + Number(payload_old_vector[0]) + Number(payload_new_vector[0]);
let payload_sweep_y = Number(this.y) + Number(payload_old_vector[1]) + Number(payload_new_vector[1]);
let payload_sweep_z = Number(this.z) + Number(payload_old_vector[2]) + Number(payload_new_vector[2]);

ret.payload_target =
{
x: Number(payload_target_x),
y: Number(payload_target_y),
z: Number(payload_target_z)
};
ret.payload_sweep =
{
x: Number(payload_sweep_x),
y: Number(payload_sweep_y),
z: Number(payload_sweep_z)
};

let sweep_botindex = caller.get_3d( payload_sweep_x, payload_sweep_y, payload_sweep_z );

if ( sweep_botindex !== null &&
     sweep_botindex !== payload_botindex )
   {
   ret.blocked = true;
   ret.blocked_reason = "PAYLOAD_SPIN_SWEEP_OCCUPIED";
   ret.blocking_sweep_bot_id = caller.bots[ sweep_botindex ].id;

   return(ret);
   } // if

let target_botindex = caller.get_3d( payload_target_x, payload_target_y, payload_target_z );

if ( target_botindex !== null &&
     target_botindex !== payload_botindex )
   {
   ret.blocked = true;
   ret.blocked_reason = "PAYLOAD_SPIN_TARGET_OCCUPIED";
   ret.blocking_target_bot_id = caller.bots[ target_botindex ].id;
   } // if

return(ret);
} // get_payload_spin_collision_profile()


//
// is_spin_blocked()
//
is_spin_blocked( caller, direction )
{
let spin_profile = this.get_spin_block_profile( caller, direction );

if (spin_profile.blocked)
   {
   let orth_details = spin_profile.occupied_orthogonal_neighbors.map(
                                                               (entry) => entry.slot + ":" + entry.id
                                                               ).join(",");
   let sweep_details = spin_profile.occupied_sweep_neighbors.map(
                                                           (entry) => entry.slot + ":" + entry.id
                                                           ).join(",");
   Logger.log(
             "spin_blocked(" + this.id + ") reason(" + spin_profile.blocked_reason + ") " +
             "orth(" + spin_profile.occupied_orthogonal_slots.join(",") + ") " +
             "orth_ids(" + orth_details + ") " +
             "sweep(" + spin_profile.occupied_sweep_slots.join(",") + ") " +
             "sweep_ids(" + sweep_details + ")"
             );
   } // if

return(spin_profile);
} // is_spin_blocked()


      
      
      
      
      
//
// motoric_spin
//
async motoric_spin( caller, fa, la, direction )
{
let vector_new           = [  0, 0, 0 ];

let vector_x_old = this.vector_x;
let vector_y_old = this.vector_y;
let vector_z_old = this.vector_z;

let update_carrier_bot = false;
let update_grabbed_bot = false;

let grabbed_botid;
let grabbed_x, grabbed_y, grabbed_z;
let vector_grabbed_new           = [  0, 0, 0 ];

let grabbed_vector_x, grabbed_vector_y, grabbed_vector_z;
let grabbed_vector_x_old, grabbed_vector_y_old, grabbed_vector_z_old;
let grabbed_new_x, grabbed_new_y, grabbed_new_z;
let grabbed_vector_new = [  0, 0, 0 ];
let blocked_horizontal_spin = false;
let spin_block_profile = null;
let payload_spin_profile = null;

 
// Right
if (direction == 'R')
   {
   
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0, -1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector_new = [ -1,  0,  0 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0,  1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector_new = [  1,  0,  0 ];
    
   } // right

// Right
if (direction == 'L')
   {
   
   if ( this.vector_x ==  1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0,  1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z == -1) vector_new = [  1,  0,  0 ];
   if ( this.vector_x == -1 && this.vector_y ==  0 && this.vector_z ==  0) vector_new = [  0,  0, -1 ];
   if ( this.vector_x ==  0 && this.vector_y ==  0 && this.vector_z ==  1) vector_new = [ -1,  0,  0 ];
    
   } // right
   

//
// Prevent spins if the local neighbourhood blocks the move.
// Transported payload bots are excluded inside get_spin_block_profile()
// and are handled separately by the payload target collision below.
//
spin_block_profile = this.is_spin_blocked( caller, direction );
blocked_horizontal_spin = (spin_block_profile.blocked === true);


if (!blocked_horizontal_spin)
   {
   // Set new values
   update_carrier_bot = true;
   this.vector_x = vector_new[0];
   this.vector_y = vector_new[1];
   this.vector_z = vector_new[2];

   // Update_neighbors
   let self_int_index     = caller.get_3d(this.x,this.y,this.z);
   caller.update_bot_index_neighbors( self_int_index );
   } // if (!blocked_horizontal_spin)
    
    

//
// Transport
//
if (!blocked_horizontal_spin && this.grabbed_cellbot !== null)
   {
   grabbed_botid = caller.bots[ this.grabbed_cellbot ].id;
   
   grabbed_x = caller.bots[ this.grabbed_cellbot ].x;
   grabbed_y = caller.bots[ this.grabbed_cellbot ].y;
   grabbed_z = caller.bots[ this.grabbed_cellbot ].z;
   
   grabbed_vector_x = caller.bots[ this.grabbed_cellbot ].vector_x;
   grabbed_vector_y = caller.bots[ this.grabbed_cellbot ].vector_y;
   grabbed_vector_z = caller.bots[ this.grabbed_cellbot ].vector_z;
   
   
   grabbed_vector_x_old = grabbed_vector_x;
   grabbed_vector_y_old = grabbed_vector_y;
   grabbed_vector_z_old = grabbed_vector_z;
   
   
   // The grabbed bot must end up exactly at the new F-slot of the carrier.
   // A carrier spin changes the payload attachment slot, not just its world
   // translation by a diagonal offset.
   
   // Right
   if (direction == 'R')
      {
   
      if ( grabbed_vector_x ==  1 && grabbed_vector_y ==  0 && grabbed_vector_z ==  0) grabbed_vector_new = [  0,  0, -1 ];
      if ( grabbed_vector_x ==  0 && grabbed_vector_y ==  0 && grabbed_vector_z == -1) grabbed_vector_new = [ -1,  0,  0 ];
      if ( grabbed_vector_x == -1 && grabbed_vector_y ==  0 && grabbed_vector_z ==  0) grabbed_vector_new = [  0,  0,  1 ];
      if ( grabbed_vector_x ==  0 && grabbed_vector_y ==  0 && grabbed_vector_z ==  1) grabbed_vector_new = [  1,  0,  0 ];
    
      } // right

    // Right
    if (direction == 'L')
       {
   
       if ( grabbed_vector_x ==  1 && grabbed_vector_y ==  0 && grabbed_vector_z ==  0) grabbed_vector_new = [  0,  0,  1 ];
       if ( grabbed_vector_x ==  0 && grabbed_vector_y ==  0 && grabbed_vector_z == -1) grabbed_vector_new = [  1,  0,  0 ];
       if ( grabbed_vector_x == -1 && grabbed_vector_y ==  0 && grabbed_vector_z ==  0) grabbed_vector_new = [  0,  0, -1 ];
       if ( grabbed_vector_x ==  0 && grabbed_vector_y ==  0 && grabbed_vector_z ==  1) grabbed_vector_new = [ -1,  0,  0 ];
    
       } // right
   
   payload_spin_profile = this.get_payload_spin_collision_profile(
                                                                 caller,
                                                                 this.grabbed_cellbot,
                                                                 [ grabbed_vector_x_old, grabbed_vector_y_old, grabbed_vector_z_old ],
                                                                 grabbed_vector_new
                                                                 );

   grabbed_new_x = Number(payload_spin_profile.payload_target.x);
   grabbed_new_y = Number(payload_spin_profile.payload_target.y);
   grabbed_new_z = Number(payload_spin_profile.payload_target.z);

   let collision = payload_spin_profile.blocked;

   if (collision)
      {
      Logger.log(
                "payload_spin_blocked(" + this.id + ") reason(" + payload_spin_profile.blocked_reason + ") " +
                "payload(" + grabbed_botid + ") " +
                "sweep(" + payload_spin_profile.payload_sweep.x + "," + payload_spin_profile.payload_sweep.y + "," + payload_spin_profile.payload_sweep.z + ") " +
                "target(" + payload_spin_profile.payload_target.x + "," + payload_spin_profile.payload_target.y + "," + payload_spin_profile.payload_target.z + ") " +
                "sweep_blocker(" + String(payload_spin_profile.blocking_sweep_bot_id) + ") " +
                "target_blocker(" + String(payload_spin_profile.blocking_target_bot_id) + ")"
                );
      } // if
   
   
   if (collision)
      {
      // Revoke rotation
      this.vector_x = vector_x_old;
      this.vector_y = vector_y_old;
      this.vector_z = vector_z_old;
      update_carrier_bot = false;
      update_grabbed_bot = false;
      
      
      // update_neighbors
      let self_int_index  =  caller.get_3d(this.x,this.y,this.z);    
      caller.update_bot_index_neighbors( self_int_index );
                  
      } // if (collision)
      else
          {
          
          // Set new values:     
          caller.bots[ this.grabbed_cellbot ].x = grabbed_new_x;
          caller.bots[ this.grabbed_cellbot ].y = grabbed_new_y;
          caller.bots[ this.grabbed_cellbot ].z = grabbed_new_z;
          
          caller.update_keyindex( grabbed_x, grabbed_y, grabbed_z, grabbed_new_x, grabbed_new_y, grabbed_new_z );


          caller.bots[ this.grabbed_cellbot ].vector_x = grabbed_vector_new[0];
          caller.bots[ this.grabbed_cellbot ].vector_y = grabbed_vector_new[1];
          caller.bots[ this.grabbed_cellbot ].vector_z = grabbed_vector_new[2];
          
          caller.update_bot_index_neighbors( this.grabbed_cellbot );
    
          vector_grabbed_new = grabbed_vector_new;
          
          update_grabbed_bot = true;
          } // no collision
   

    
 
   
   
   } // grabbed_cellbot != null
   
   
   
   
   
//   
// --> Execute moves   
//

//
// --> Animation delay
//
 
  
if ( update_carrier_bot )
{

const events = [];

let stopwatch_ms = caller.get_stopwatch_ms(); 

let notify_msg =
{
event: "spin",
botid: this.id,
from: { x: Number(this.x), y: Number(this.z), z: Number(this.z), vx: Number(vector_x_old), vy: Number(vector_y_old), vz: Number(vector_z_old)  },
to: { x: Number(this.x), y: Number(this.x), z: Number(this.z), vx: Number(this.vector_x), vy: Number(this.vector_y), vz: Number(this.vector_z)  },
parent : '',
duration: Number(this.physical_bot_move_delay),


ts : Number(stopwatch_ms)
};

events.push( notify_msg );


 
//
// grabbed_bot
//
if ( update_grabbed_bot )
{
 
notify_msg =
{
event: "spin2",
botid: grabbed_botid,
from: { x: Number(grabbed_x), y: Number(grabbed_y), z: Number(grabbed_z), vx: Number(grabbed_vector_x_old), vy: Number(grabbed_vector_y_old), vz: Number(grabbed_vector_z_old),  },
to: { x: Number(grabbed_new_x), y: Number(grabbed_new_y), z: Number(grabbed_new_z), vx:Number(vector_grabbed_new[0]), vy:Number(vector_grabbed_new[1]), vz:Number(vector_grabbed_new[2])  },
center: { x: Number(this.x), y: Number(this.y), z: Number(this.z)   },
parent: this.id,
duration: Number(this.physical_bot_move_delay),

ts : Number(stopwatch_ms)
};

events.push( notify_msg );
 
 
 
} // if ( update_grabbed_bot )

 

caller.notify_frontend( events );

 


 
  
await this.sleep( this.physical_bot_move_delay );

} // if ( update_carrier_bot )


//
// <-- Animation delay
//

 
if (!update_carrier_bot)
   {
   return(false);
   } // if

return(true);
} // motoric_spin()
      
  
  
// Helpfunction for sleep
sleep(ms) 
{
return new Promise(resolve => setTimeout(resolve, ms));
} // sleep();                        

  
} // class bot_class 


module.exports = bot_class;
