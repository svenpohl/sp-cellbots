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
  this.rid      = "";
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
  this.servicebay = 0;
  this.mobility   = true;      // false = immobile (pseudo-bot, hMB, fixed anchor)
  this.masterbot  = bot_class.MB_NONE;  // MB_NONE | MB_PRIMARY | MB_HELPER

  //
  // failure injections
  //
  this.move_interruption_enabled = false;
  this.move_interruption_mode    = "half_way";   // half_way, random, after
  this.move_interruption_param   = 0;
  this.move_interruption_counter = 0;
  this.slot_reliability = {};            // {f:1.0, r:1.0, b:1.0, l:1.0, t:1.0, d:1.0} – default all 1.0
  this.special_slot_configuration = false; // true wenn ein Slot != 1.0 konfiguriert wurde
  this.fake_id_config = null;            // {fakeId: "SB1", probability: 0.3} – config_fakeid
  this.real_id = null;                   // original ID when fake_id_config.probability >= 1.0
  this.duplicate_msg = 1;                // 1=normal, 2=double, 3=triple, ... – config_duplicate_msg
  this.forwarding_disabled = false;       // true=blockiert Weiterleitung, antwortet aber auf direkte Anfragen – config_disable_forwarding
  this.msg_delay = 0;                     // ms delay for message forwarding (0=no delay) – config_msg_delay
  this.corrupt_config = null;            // {probability: 0.3, pattern: "RINFO", replacement: "RALIFE"} – config_corrupt_msg
  //
  // end - failure injections
  //

  this.msgqueue        = [];
  this.msgqueue_bc     = [];   // Queue for BotController (pollable per bot)
  this.index_neighbors = [];
  
  this.index_neighbors['f'] = -1;
  this.index_neighbors['r'] = -1;
  this.index_neighbors['b'] = -1;
  this.index_neighbors['l'] = -1;
  this.index_neighbors['t'] = -1;
  this.index_neighbors['d'] = -1;
  
  this.locked        = [];
  
  //this.max_msgqueue = 5;
  this.max_msgqueue_default = 500;
  this.max_msgqueue = this.max_msgqueue_default;

  this.cmd_parser_class_obj = new cmd_parser_class();
  
  this.grabbed_cellbot = null;
  this.servicebay_extracted = false;
  
  this.physical_bot_move_delay = 0;
  
   
    
  this.enable_signing       = false;
  this.signature_type       = "";
  this.public_key_or_secret = "";
  
  this.signature_class_obj = new signature_class( );
  
  } // constructor
  
  
  
  
//
// setvalues()
//  
setvalues( id, rid = "", x,y,z, vx,vy,vz, inactive = 0, servicebay = 0, color, physical_bot_move_delay,                           
           enable_signing,
           signature_type,
           public_key_or_secret,
           mobility = true,
           masterbot_role = 0
)
{
this.id = id;
this.rid = Array.isArray(rid) ? String(rid[0] ?? "") : String(rid ?? "");
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

if (Array.isArray(servicebay))
   {
   servicebay = servicebay[0];
   }

this.servicebay = (
                   servicebay === true ||
                   servicebay === 1 ||
                   servicebay === "1" ||
                   servicebay === "true"
                   );

this.inactive = (
                 inactive === true ||
                 inactive === 1 ||
                 inactive === "1" ||
                 inactive === "true"
                 );

// Backward-compatibility:
// servicebay cells are treated as non-active simulator cells, even without <inactive>.
if (this.servicebay === true)
   {
   this.inactive = true;
   } // if

this.color = color;

this.physical_bot_move_delay = physical_bot_move_delay;

this.enable_signing       = enable_signing;
this.signature_type       = signature_type;
this.public_key_or_secret = public_key_or_secret;

this.mobility   = mobility;
this.masterbot  = masterbot_role;

} // setvalues()


//
// get_nbh()
//
get_nbh(mode, slot, caller = null)
{
/*
In direct_radio mode, this helper behaves like a local barcode/NFC style reader.
The bot reads neighbor data on the requested slot directly from local hardware context.
If mode == "rid", reading RID must respect config.allow_rid_discovery == true.
If allow_rid_discovery is false, RID must not be disclosed.

In mesh_opcode mode, this helper is intentionally different.
Bots are treated as communication peers on a routed protocol path, not as barcode readers.
So neighbor ID/RID discovery should be performed via protocol opcodes (to be decided),
instead of direct local RID reads.
*/

const requested_mode = String(mode ?? "").toLowerCase().trim();
const requested_slot = String(slot ?? "").toUpperCase().trim();
const communication_mode =
      (caller && caller.config && caller.config.communication_mode)
      ? String(caller.config.communication_mode)
      : "mesh_opcode";

if (communication_mode == "direct_radio")
   {
   if (!caller || typeof caller.get_nbh != "function")
      {
      return({
             ok: false,
             mode: requested_mode,
             slot: requested_slot,
             neighbor_id: null,
             neighbor_rid: null,
             reason: "MASTERBOT_NBH_UNAVAILABLE"
             });
      } // if

   return(caller.get_nbh(requested_mode, this.x, this.y, this.z, requested_slot));
   } // if

if (communication_mode == "mesh_opcode")
   {
   // reserved for future opcode-based neighborhood discovery in mesh mode
   } // if

return({
       ok: false,
       mode: requested_mode,
       slot: requested_slot,
       neighbor_id: null,
       neighbor_rid: null,
       reason: "NOT_IMPLEMENTED_YET"
       });
} // get_nbh()


//
// get_mobility_mode()
//
get_mobility_mode(caller = null)
{
let mode = "full_edge";

if (caller && caller.config && caller.config.mobility_mode)
   {
   mode = String(caller.config.mobility_mode).trim();
   if (mode == "")
      {
      mode = "full_edge";
      } // if
   } // if

return(mode);
} // get_mobility_mode()


//
// validate_vehicle_kinematics_move()
//
validate_vehicle_kinematics_move(caller, fa, la, direction_slot, target_x, target_y, target_z)
{
let ret =
{
ok: true,
code: "VK_OK",
reason: "",
mode: this.get_mobility_mode(caller)
};

// Explicit mobility gate:
// - full_edge: keep legacy behavior unchanged
// - vehicle_kinematics: enforce reduced DoF rules
if (ret.mode != "vehicle_kinematics")
   {
   return(ret);
   } // if

let dir = String(direction_slot ?? "").toUpperCase().trim();
let first_anchor = String(fa ?? "").toUpperCase().trim();
let last_anchor  = String(la ?? "").toUpperCase().trim();

// Rule 1: no lateral translation without rotation
if (dir == "R" || dir == "L")
   {
   ret.ok = false;
   ret.code = "VK_BLOCK_LATERAL_MOVE";
   ret.reason = "Lateral translation requires rotation in vehicle_kinematics mode.";
   return(ret);
   } // if

// Rule 2: climbing only with frontal support
// Rule 3: no rear climbing
// Rule 4: no overhead-only climbing
if (dir == "T" || dir == "D")
   {
   let front_anchor_from_cmd = (first_anchor.indexOf("F") >= 0 || last_anchor.indexOf("F") >= 0);
   let rear_anchor_from_cmd  = (first_anchor.indexOf("B") >= 0 || last_anchor.indexOf("B") >= 0);
   let top_anchor_from_cmd   = (first_anchor.indexOf("T") >= 0 || last_anchor.indexOf("T") >= 0);

   let front_on_current = caller.has_neighbour(this.x, this.y, this.z, this.vector_x, this.vector_y, this.vector_z, this.x, this.y, this.z, "F");
   let front_on_target  = caller.has_neighbour(target_x, target_y, target_z, this.vector_x, this.vector_y, this.vector_z, this.x, this.y, this.z, "F");

   if (rear_anchor_from_cmd)
      {
      ret.ok = false;
      ret.code = "VK_BLOCK_REAR_CLIMB";
      ret.reason = "Rear-anchor climbing is not allowed in vehicle_kinematics mode.";
      return(ret);
      } // if

   if (top_anchor_from_cmd && !front_anchor_from_cmd && !front_on_current && !front_on_target)
      {
      ret.ok = false;
      ret.code = "VK_BLOCK_OVERHEAD_CLIMB";
      ret.reason = "Overhead-only climbing is blocked; frontal support is required.";
      return(ret);
      } // if

   if (!front_anchor_from_cmd && !front_on_current && !front_on_target)
      {
      ret.ok = false;
      ret.code = "VK_BLOCK_CLIMB_REQUIRES_FRONT_SUPPORT";
      ret.reason = "Vertical movement requires frontal support in vehicle_kinematics mode.";
      return(ret);
      } // if
   } // if

return(ret);
} // validate_vehicle_kinematics_move()


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

// Forwarding disabled check (Fehlertyp 08):
// Block messages that have a non-empty address (need further forwarding).
// Allow: messages with empty address (for self) and self-generated responses (no @).
if (this.forwarding_disabled === true) {
    let atPos = msg.indexOf("@");
    if (atPos >= 0) {
        let afterAt = msg.substring(atPos + 1);
        // Check if there's a non-empty address between @ and #
        let hashPos = afterAt.indexOf("#");
        if (hashPos > 0) {
            // Non-empty address found → this message needs forwarding → drop
            Logger.log("push_msg("+this.id+") [DROPPED forwarding_disabled] ["+msg+"]");
            return(0);
        }
    }
}

let size = this.msgqueue.length;

if (size < this.max_msgqueue)
   {   
   Logger.log("push_msg("+this.id+") ["+msg+"]  size("+size+")");

   // Message delay injection (config_msg_delay)
   if (this.msg_delay > 0) {
       let delayMs = this.msg_delay;
       setTimeout(() => {
           if (this.msgqueue.length < this.max_msgqueue) {
               // Corrupt message injection (config_corrupt_msg) – vor dem Queue-Push
               if (this.corrupt_config && Math.random() < this.corrupt_config.probability) {
                   let oldMsg = msg;
                   msg = msg.replace(this.corrupt_config.pattern, this.corrupt_config.replacement);
                   Logger.log("push_msg("+this.id+") [CORRUPTED] ["+oldMsg+"] → ["+msg+"]");
               }
               this.msgqueue.push(msg);
               Logger.log("push_msg("+this.id+") [DELAYED "+delayMs+"ms] ["+msg+"]  size("+this.msgqueue.length+")");
               // Duplicate message injection (config_duplicate_msg) auch für verzögerte Nachrichten
               if (this.duplicate_msg > 1) {
                   for (let d = 1; d < this.duplicate_msg; d++) {
                       if (this.msgqueue.length < this.max_msgqueue) {
                           this.msgqueue.push(msg);
                       }
                   }
               }
           }
       }, delayMs);
       return(1);
   }

   // Corrupt message injection (config_corrupt_msg) – vor dem Queue-Push
   if (this.corrupt_config && Math.random() < this.corrupt_config.probability) {
       let oldMsg = msg;
       msg = msg.replace(this.corrupt_config.pattern, this.corrupt_config.replacement);
       Logger.log("push_msg("+this.id+") [CORRUPTED] ["+oldMsg+"] → ["+msg+"]");
   }

   this.msgqueue.push( msg );

   // Duplicate message injection (config_duplicate_msg)
   if (this.duplicate_msg > 1) {
       for (let d = 1; d < this.duplicate_msg; d++) {
           if (this.msgqueue.length < this.max_msgqueue) {
               this.msgqueue.push( msg );
           }
       }
   }

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
// push_botcontroller_queue()
// Pushes a message into the BotController queue (msgqueue_bc).
// Analogous to masterbot_class.push_botcontroller_queue().
//
push_botcontroller_queue( msg )
{
if (this.inactive == 'true' || this.inactive === true || this.inactive == 1)
   {
   return;
   }

let size = this.msgqueue_bc.length;

if (size < this.max_msgqueue)
   {
   this.msgqueue_bc.push( msg );
   }
} // push_botcontroller_queue()


//
// pop_botcontroller_queue()
// Reads and clears the BotController queue (msgqueue_bc).
// Returns a JSON string, analogous to masterbot_class.pop_botcontroller_queue().
//
pop_botcontroller_queue()
{
let jsondata = "";
jsondata += "{ \"msgqueue_bc\": [ ";

let size = this.msgqueue_bc.length;
for (let i=0; i<size; i++)
    {
    jsondata += "\"" + this.msgqueue_bc[i] + "\"";
    if (i < (size-1))
       {
       jsondata += ", ";
       }
    }

jsondata += " ] }";

// Queue leeren
this.msgqueue_bc = [];

return(jsondata);
} // pop_botcontroller_queue()




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

Logger.log("[RUN_CMD] ENTER bot=" + this.id + " pos=(" + this.x + "," + this.y + "," + this.z + ") orient=(" + this.vector_x + "," + this.vector_y + "," + this.vector_z + ") cmd=" + cmdarray.cmdname + " subcmd_count=" + (Array.isArray(cmdarray.subcmd) ? cmdarray.subcmd.length : "?"));



 
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
   Logger.log(
              "run_cmd signature_check failed botid=[" + this.id +
              "] rid=[" + String(this.rid ?? "") +
              "] cmdname=[" + String(cmdarray.cmdname ?? "") +
              "] destination=[" + String(cmdarray.destination ?? "") +
              "] sign_type=[" + String(cmdarray.signature_type ?? "") + "]"
              );
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
   

   // Fake-ID-Injection: Wenn fake_id_config gesetzt ist, ggf. die Bot-ID in der RINFO ersetzen
   let rinfo_id = this.id;
   if (this.fake_id_config) {
       let cfg = this.fake_id_config;
       if (cfg.probability >= 1.0) {
           // Bei 100%: Bot "glaubt" dauerhaft, er sei die fake ID (this.id bereits gesetzt)
           rinfo_id = this.id;
       } else if (Math.random() < cfg.probability) {
           // Bei <100%: Nur diese Antwort bekommt die fake ID, ID bleibt erhalten
           rinfo_id = cfg.fakeId;
       }
   }
   let cmdreturn = destination + "#RINFO#" + rinfo_id + ";"  +  this.bottmpid +  ";" + this.type + ";" + sourceslot + ";" + rel_x + ","  + rel_y + "," + rel_z + "";
   
  
  
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
   
   
   // Execute command.
   // In direct_radio mode we bypass slot-routing and return directly to masterbot queue.
   // Fake-ID-Injection for RCHECK (wie bei RINFO)
   let rcheck_id = this.id;
   if (this.fake_id_config) {
       let cfg = this.fake_id_config;
       if (cfg.probability < 1.0 && Math.random() < cfg.probability) {
           rcheck_id = cfg.fakeId;
       }
   }
   let cmdreturn = destreturn + "#RCHECK#" + rcheck_id + ";"  +  status + "";

   if (String(caller?.config?.communication_mode ?? "mesh_opcode") == "direct_radio")
      {
      caller.push_msg(cmdreturn);
      } else
        {
        this.push_msg(cmdreturn);
        } // else
   } // CMD_CHECK


if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_NBH )
   {
   destreturn = cmdarray.destreturn;
   let sourceslot = cmdarray.sourceslot.toUpperCase();
   destreturn = destreturn.replace(/s/gi, sourceslot);

   let nbh_mode = "id";
   let nbh_slot_selector = ".";
   if (
       Array.isArray(cmdarray.subcmd) &&
       cmdarray.subcmd.length > 0 &&
       Array.isArray(cmdarray.subcmd[0]) &&
       cmdarray.subcmd[0].length > 0
      )
      {
      nbh_mode = String(cmdarray.subcmd[0][0].mode ?? "id").toLowerCase().trim();
      nbh_slot_selector = String(cmdarray.subcmd[0][0].slot_selector ?? ".").toUpperCase().trim();
      } // if

   if (nbh_mode != "id" && nbh_mode != "rid")
      {
      nbh_mode = "id";
      } // if

   if (
       nbh_slot_selector != "." &&
       nbh_slot_selector != "F" &&
       nbh_slot_selector != "R" &&
       nbh_slot_selector != "B" &&
       nbh_slot_selector != "L" &&
       nbh_slot_selector != "T" &&
       nbh_slot_selector != "D"
      )
      {
      nbh_slot_selector = ".";
      } // if

   let target_slots = [];
   if (nbh_slot_selector == ".")
      {
      target_slots = [ "F", "R", "B", "L", "T", "D" ];
      } else
        {
        target_slots = [ nbh_slot_selector ];
        } // else

   const payload_parts = [];
   for (let i = 0; i < target_slots.length; i++)
       {
       const slot_name = String(target_slots[i] ?? "").toUpperCase().trim();
       let nbh_value = "x";
       let nbh_vec = "x";

       const nbh_result = this.get_nbh(nbh_mode, slot_name, caller);
       if (nbh_result && nbh_result.ok === true)
          {
          if (nbh_mode == "rid")
             {
             nbh_value = String(nbh_result.neighbor_rid ?? "x").trim();
             if (nbh_value == "")
                {
                nbh_value = "x";
                } // if
             } else
               {
               nbh_value = String(nbh_result.neighbor_id ?? "x").trim();
               if (nbh_value == "")
                  {
                  nbh_value = "x";
                  } // if
               } // else

          nbh_vec = String(nbh_result.neighbor_vec ?? "x").trim();
          if (nbh_vec == "")
             {
             nbh_vec = "x";
             } // if
          } // if

       payload_parts.push(slot_name + ":" + nbh_value + "|" + nbh_vec);
       } // for

   let payload = payload_parts.join("/");
   let cmdreturn = destreturn + "#RNBH#" + this.id + ";" + payload;
   if (String(caller?.config?.communication_mode ?? "mesh_opcode") == "direct_radio")
      {
      caller.push_msg(cmdreturn);
      } else
        {
        this.push_msg(cmdreturn);
        } // else
   } // CMD_NBH



if ( cmdarray.cmd == this.cmd_parser_class_obj.CMD_MOVE )
   {
   // Immobile bots (mobility=false) do not execute MOVE commands
   if (!this.mobility) {
       Logger.log("MOVE rejected: bot " + this.id + " is immobile (mobility=false)");
       return;
   }
   const mobility_mode = this.get_mobility_mode(caller);
   let size = cmdarray.subcmd.length;
   let move_sequence_aborted = false;
   this.servicebay_extracted = false;

   Logger.log("MOVE mobility_mode=" + mobility_mode + " bot=" + this.id + " subcmd_count=" + size);
   Logger.log("[MOVE_STATE] bot=" + this.id + " pos=(" + this.x + "," + this.y + "," + this.z + ") orient=(" + this.vector_x + "," + this.vector_y + "," + this.vector_z + ") adr=" + this.adress + " sign_type=" + this.signature_type);

   for (let i=0; i<size; i++)
       {
       if (move_sequence_aborted)
          {
          break;
          } // if

       // Helper: prüft ob Koordinate in caller.obstacles ist
       function _isObstacle(x, y, z) {
           if (!caller || !Array.isArray(caller.obstacles)) return false;
           for (let o of caller.obstacles) {
               if (Number(o.x) === Number(x) && Number(o.y) === Number(y) && Number(o.z) === Number(z)) return true;
           }
           return false;
       }
       // Helper: WebGUI-Refresh nach obstacle-bedingtem Stopp
       function _refreshGUI() {
           if (caller && caller.ws && typeof caller.getclusterdata_json === "function") {
               try {
                   let raw = caller.getclusterdata_json();
                   let jsondata = JSON.parse(raw);
                   let msg = { answer: "answer_getclusterdata", jsondata: jsondata };
                   caller.ws.send(JSON.stringify(msg));
               } catch(e) {}
           }
       }

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
                     let saveX = this.x, saveY = this.y, saveZ = this.z;
                     await this.motoric_move( caller, fa, la, moves[i3] );

                     if (this.servicebay_extracted === true)
                        {
                        move_sequence_aborted = true;
                        break;
                        } // if
                     
                     // Obstacle-Prüfung nach Bewegung
                     if (_isObstacle(this.x, this.y, this.z)) {
                         this.x = saveX; this.y = saveY; this.z = saveZ;
                         move_sequence_aborted = true;
                         _refreshGUI();
                         break;
                     }
                     }
                     
                  if (size2 == 2)
                     {
                     let saveX = this.x, saveY = this.y, saveZ = this.z;
                     if (i3==0) await this.motoric_move( caller, fa, "", moves[i3] );
                     if (i3==1) await this.motoric_move( caller, "", la, moves[i3] );

                     if (this.servicebay_extracted === true)
                        {
                        move_sequence_aborted = true;
                        break;
                        } // if
                     
                     // Obstacle-Prüfung nach Bewegung
                     if (_isObstacle(this.x, this.y, this.z)) {
                         this.x = saveX; this.y = saveY; this.z = saveZ;
                         move_sequence_aborted = true;
                         _refreshGUI();
                         break;
                     }
                     } // if (size2 == 2)  

                  // Failure injection: move interruption
                  if (this.move_interruption_enabled) {
                      this.move_interruption_counter++;
                      let shouldStop = false;
                      if (this.move_interruption_mode === "half_way" && this.move_interruption_counter >= Math.floor(size2 * 0.5)) {
                          shouldStop = true;
                      } else if (this.move_interruption_mode === "random" && Math.random() < this.move_interruption_param) {
                          shouldStop = true;
                      } else if (this.move_interruption_mode === "after" && this.move_interruption_counter >= this.move_interruption_param) {
                          shouldStop = true;
                      }
                      if (shouldStop) {
                          console.log("[INJECTION] Move interrupted for " + (this.id || "unknown") + " (mode=" + this.move_interruption_mode + ")");
                          move_sequence_aborted = true;
                          break;
                      }
                  }                          
 
                  
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

                  // Obstacle-Prüfung nach Rotation: orthogonale Nachbarn in X/Z prüfen
                  if (Array.isArray(this.index_neighbors)) {
                      let horizSlots = ['f','r','b','l'];
                      for (let s of horizSlots) {
                          let nv = this.index_neighbors[s];
                          if (!nv || !Array.isArray(nv)) continue;
                          let nx = Number(this.x) + Number(nv[0] || 0);
                          let ny = Number(this.y) + Number(nv[1] || 0);
                          let nz = Number(this.z) + Number(nv[2] || 0);
                          if (_isObstacle(nx, ny, nz)) {
                              // Zurück rotieren
                              let backDir = (direction === "L") ? "R" : "L";
                              await this.motoric_spin(caller, fa, la, backDir);
                              move_sequence_aborted = true;
                              _refreshGUI();
                              break;
                          }
                      }
                      if (move_sequence_aborted) break;
                  }

                  if (this.servicebay_extracted === true)
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
          let released_previous_payload = false;

          if (previous_grabbed_cellbot !== null)
             {
             caller.unregister_payload_bot_int_id(previous_grabbed_cellbot);
             } // if

          if (size == 0 || targetslot != 'F')
             {
             this.grabbed_cellbot = null;
             released_previous_payload = (previous_grabbed_cellbot !== null);
             } // if
          
           // Generic slot transport (F, B, R, L, T, D)
           if (targetslot == 'F' || targetslot == 'B' || targetslot == 'R' || targetslot == 'L' || targetslot == 'T' || targetslot == 'D')
              {
                          
              this.grabbed_cellbot = caller.get_target_int_id( this.x, this.y, this.z, targetslot );

              if (this.grabbed_cellbot !== null && this.grabbed_cellbot >= 0)
                 {
                 caller.register_payload_bot_int_id(this.grabbed_cellbot);
                 } // if
       
              } // if (valid slot)

          if (released_previous_payload)
             {
             caller.check_service_bay_extraction(previous_grabbed_cellbot);
             } // if
          
        
          } // GRAB

          
       // ALIFE
       if ( sub == "ALIFE" )
          {
          destreturn = cmdarray.destreturn;   
          
          // Execute command
          let cmdreturn = destreturn + "#RALIFE#" + this.id + ";" + cmdarray.bottmpid ;

          if (String(caller?.config?.communication_mode ?? "mesh_opcode") == "direct_radio")
             {
             caller.push_msg(cmdreturn);
             } else
               {
               this.push_msg(cmdreturn);
               } // else


          } // LIFE

       
       } // for i
   
   Logger.log("[RUN_CMD] AFTER_MOVE bot=" + this.id + " pos=(" + this.x + "," + this.y + "," + this.z + ") orient=(" + this.vector_x + "," + this.vector_y + "," + this.vector_z + ")");
   
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
const is_valid_grabbed_index = (idx) =>
   (
    idx !== null &&
    idx !== undefined &&
    Number(idx) >= 0 &&
    caller.bots[ Number(idx) ] !== undefined
   );

let carrier_x_old = this.x;
let carrier_y_old = this.y;
let carrier_z_old = this.z;

Logger.log("[MOTORIC] ENTER bot=" + this.id + " pos=(" + this.x + "," + this.y + "," + this.z + ") orient=(" + this.vector_x + "," + this.vector_y + "," + this.vector_z + ") dir=" + direction_slot + " fa=" + fa + " la=" + la);

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
if (is_valid_grabbed_index(this.grabbed_cellbot))
   {           
   grabbed_x = caller.bots[ this.grabbed_cellbot ].x;
   grabbed_y = caller.bots[ this.grabbed_cellbot ].y;
   grabbed_z = caller.bots[ this.grabbed_cellbot ].z;
   
   grabbed_botid = caller.bots[ this.grabbed_cellbot ].id;
   } else
      {
      this.grabbed_cellbot = null;
      } // if/else



target_x = Number(this.x) + Number(vector[0]);
target_y = Number(this.y) + Number(vector[1]);
target_z = Number(this.z) + Number(vector[2]);

// ------------------------------------------------------------
// mobility_mode gate (vehicle_kinematics / full_edge / future)
// ------------------------------------------------------------
let vk_validation = this.validate_vehicle_kinematics_move(caller, fa, la, direction_slot, target_x, target_y, target_z);
if (!vk_validation.ok)
   {
   Logger.log("MOVE blocked [" + vk_validation.code + "] bot=" + this.id + " dir=" + direction_slot + " from=" + this.x + "," + this.y + "," + this.z + " to=" + target_x + "," + target_y + "," + target_z + " reason=" + vk_validation.reason);
   return;
   } // if


     
//
// FA-LA - Check 
// 
   
// First Anchor - Check
let start_hasneighbours = true;

if (fa != "")
   {
   start_hasneighbours = caller.has_neighbour( this.x, this.y, this.z, this.vector_x, this.vector_y, this.vector_z, this.x, this.y, this.z, fa );
   }
Logger.log("[MOTORIC] bot=" + this.id + " FA=" + fa + " start_hasneighbours=" + start_hasneighbours + " pos=(" + this.x + "," + this.y + "," + this.z + ")");

// Last Anchor - Check
let target_hasneighbours = true;

if (la != "")
   {
   target_hasneighbours = caller.has_neighbour( target_x, target_y, target_z, this.vector_x, this.vector_y, this.vector_z, this.x, this.y, this.z, la );
   }
Logger.log("[MOTORIC] bot=" + this.id + " LA=" + la + " target_hasneighbours=" + target_hasneighbours + " target=(" + target_x + "," + target_y + "," + target_z + ")");
 
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



Logger.log("[MOTORIC] bot=" + this.id + " collision=" + collision + " start_hasneighbours=" + start_hasneighbours + " target_hasneighbours=" + target_hasneighbours + " -> update_carrier_bot=" + (!collision && start_hasneighbours && target_hasneighbours));

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
if (!is_valid_grabbed_index(this.grabbed_cellbot))
   {
   update_grabbed_bot = false;
   this.grabbed_cellbot = null;
   } // if

if (update_grabbed_bot)
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


   } // if (update_grabbed_bot)

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
   Logger.log("[MOTORIC] MOVED bot=" + this.id + " from=(" + carrier_x_old + "," + carrier_y_old + "," + carrier_z_old + ") to=(" + this.x + "," + this.y + "," + this.z + ") dir=" + direction_slot);
   }
   
if ( update_grabbed_bot )
   {
   if (!is_valid_grabbed_index(this.grabbed_cellbot))
      {
      update_grabbed_bot = false;
      this.grabbed_cellbot = null;
      } // if

   if (update_grabbed_bot)
      {
   // Update Bot-Position and set new values:  
   caller.update_keyindex( grabbed_x, grabbed_y, grabbed_z, new_x, new_y, new_z );   
   caller.bots[ this.grabbed_cellbot ].x = new_x;
   caller.bots[ this.grabbed_cellbot ].y = new_y;
   caller.bots[ this.grabbed_cellbot ].z = new_z;
      } // if
   }   

if ( update_grabbed_bot && is_valid_grabbed_index(this.grabbed_cellbot) )
   {
   let payload_extract_ret = caller.check_service_bay_extraction( this.grabbed_cellbot );

   if (payload_extract_ret.extracted)
      {
      this.grabbed_cellbot = null;
      } // if
   } // if

if ( update_carrier_bot )
   {
   let self_index = caller.get_3d(this.x, this.y, this.z);
   let self_extract_ret = caller.check_service_bay_extraction( self_index );

   if (self_extract_ret.extracted)
      {
      this.servicebay_extracted = true;
      return;
      } // if
   } // if

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
// Calculates the target and sweep positions for a payload bot during a carrier spin.
// Uses position_offset_old and position_offset_new (from carrier to payload) for
// target and sweep collision checking. In F-slot mode (default), the offset equals
// the payload's orientation vector (one step forward). In VK B-slot mode, the caller
// passes inverted heading vectors so the payload is placed at the carrier's back.
//
get_payload_spin_collision_profile( caller, payload_botindex, payload_old_vector, payload_new_vector, position_offset_old, position_offset_new )
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
let pos_offset_old_x = Number((position_offset_old !== undefined) ? position_offset_old[0] : payload_old_vector[0]);
let pos_offset_old_y = Number((position_offset_old !== undefined) ? position_offset_old[1] : payload_old_vector[1]);
let pos_offset_old_z = Number((position_offset_old !== undefined) ? position_offset_old[2] : payload_old_vector[2]);
let pos_offset_new_x = Number((position_offset_new !== undefined) ? position_offset_new[0] : payload_new_vector[0]);
let pos_offset_new_y = Number((position_offset_new !== undefined) ? position_offset_new[1] : payload_new_vector[1]);
let pos_offset_new_z = Number((position_offset_new !== undefined) ? position_offset_new[2] : payload_new_vector[2]);
let payload_target_x = Number(this.x) + pos_offset_new_x;
let payload_target_y = Number(this.y) + pos_offset_new_y;
let payload_target_z = Number(this.z) + pos_offset_new_z;
let payload_sweep_x = Number(this.x) + pos_offset_old_x + pos_offset_new_x;
let payload_sweep_y = Number(this.y) + pos_offset_old_y + pos_offset_new_y;
let payload_sweep_z = Number(this.z) + pos_offset_old_z + pos_offset_new_z;

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

   // Update neighbors
   let self_int_index = caller.get_3d(this.x, this.y, this.z);
   if (self_int_index === null || self_int_index === undefined)
      {
      console.warn("[WARN] motoric_spin bot=" + this.id + " position (" + this.x + "," + this.y + "," + this.z + ") not found in caller grid!");
      } // if
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
   
   
   // Determine the slot offset vectors from carrier to payload position.
   // F-slot (default): payload sits at the new orientation vector (one step forward).
   // B-slot (VK mode): payload sits at the inverse of the carrier's heading.
   let slot_offset_old = [ Number(grabbed_vector_x_old), Number(grabbed_vector_y_old), Number(grabbed_vector_z_old) ];
   let slot_offset_new = [ Number(grabbed_vector_new[0]), Number(grabbed_vector_new[1]), Number(grabbed_vector_new[2]) ];
   let mobility_mode = this.get_mobility_mode(caller);
   if (mobility_mode == "vehicle_kinematics")
      {
      // VK mode: payload is always carried on the B-slot (inverse of carrier heading)
      slot_offset_old = [ -Number(this.vector_x), -Number(this.vector_y), -Number(this.vector_z) ];
      slot_offset_new = [ -Number(vector_new[0]), -Number(vector_new[1]), -Number(vector_new[2]) ];
      } // if

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
                                                                 grabbed_vector_new,
                                                                 slot_offset_old,
                                                                 slot_offset_new
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
      if (self_int_index === null || self_int_index === undefined)
         {
         console.warn("[WARN] motoric_spin (collision-revoke) bot=" + this.id + " position (" + this.x + "," + this.y + "," + this.z + ") not found in caller grid!");
         } // if
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

if ( update_grabbed_bot && this.grabbed_cellbot !== null )
   {
   let payload_extract_ret = caller.check_service_bay_extraction( this.grabbed_cellbot );

   if (payload_extract_ret.extracted)
      {
      this.grabbed_cellbot = null;
      } // if
   } // if

let self_index = caller.get_3d(this.x, this.y, this.z);
let self_extract_ret = caller.check_service_bay_extraction( self_index );
if (self_extract_ret.extracted)
   {
   this.servicebay_extracted = true;
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

// Bot constants (static)
bot_class.MB_NONE    = 0;
bot_class.MB_PRIMARY = 1;
bot_class.MB_HELPER  = 2;

module.exports = bot_class;
