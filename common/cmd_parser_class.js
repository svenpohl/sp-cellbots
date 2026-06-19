//
// cmd_parser_class.js — Sven Pohl <sven.pohl@zen-systems.de> — MIT License © 2025
// cmd_parser_class v2.2
//

class cmd_parser 
{

 
 
 
constructor()
{
this.CMD_PING   = 1;
this.CMD_INFO   = 2;
this.CMD_NBH    = 3;
this.CMD_SC     = 4;
this.CMD_MOVE   = 5;
this.CMD_ROTATE = 6;
this.CMD_CLIMB  = 7;
this.CMD_BIND   = 8;
this.CMD_X      = 9;

this.CMD_RET_OK = 10;
this.CMD_RINFO  = 11;
this.CMD_RNBH   = 12;
this.CMD_CHECK  = 13;
this.CMD_RCHECK = 14;
this.CMD_ALIFE  = 15;
this.CMD_RALIFE = 16;
this.CMD_SYS    = 17;

} // constructor()

 


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
// Parse CMD
//
parse( cmd )
{
let ret        = [];

let botcmd      		 =  "";
let cmdname     		 =  "";
let cmdnext     		 =  "";
let sourceslot  		 =  ""; 
let cmdstring   		 =  "";
let destination 		 =  "";
let destreturn  		 =  "";
let color       		 =  "";
let botid       		 =  "";
let bottmpid    		 =  "";
let type        		 =  "";
let vx          		 = 0;
let vy          		 = 0;
let vz          		 = 0;
let destslot    		 =  "";
let rawcmd      		 =  "";
let status      		 =  "";
let status_mode          =  "";
let nbh_mode             =  "";
let nbh_slot_selector    =  "";
let nbh_payload          =  "";
let nbh_neighbors        =  {};
let subcmd      		 = [];
let signature_type       = "";
let public_signature     = "";
let sign_message         = "";



const trimmed = cmd.split('*');
let cnt = trimmed.length;

let logging = false;

if (cnt == 1)
   {
   cmdstring = trimmed[0];
   } else
     {
     sourceslot = trimmed[0];
     cmdstring  = trimmed[1];
     }
  
 
 
// 
// signatur - parsing
//
let trailer = cmdstring.substring(0,2);

if ( 
    trailer == "01" ||    
    trailer == "02" || 
    trailer == "03" 
   )
   {
   if ( trailer == "01" ) signature_type       = "HMAC";
   if ( trailer == "02" ) signature_type       = "ED25519";
   if ( trailer == "03" ) signature_type       = "RSA";

   let sig     = cmdstring.substring(2);
   
   const [part1, part2]= this.split_first( sig, '@' );
   
   public_signature = part1;
   
   cmdstring = part2;
   sign_message = cmdstring.substring(1);
   } // if "signature"


  

const trimmedcmd = cmdstring.split('#');


 
//
// PING
//
if (trimmedcmd[1] == "PING")
   {
   botcmd = this.CMD_PING;
   destination = trimmedcmd[0];
   destreturn  = trimmedcmd[2];
   
 
   } // PING


//
// Return for Ping "OK"
//
if (trimmedcmd[1] == "OK")
   {
   botcmd = this.CMD_RET_OK;
   destination = trimmedcmd[0];
   botid       = trimmedcmd[2];
   
 
   } // OK
   
   
//
// INFO
//
if (trimmedcmd[1] == "INFO")
   {

   botcmd      = this.CMD_INFO;
   cmdname     = "INFO";
   destination = trimmedcmd[0];
   bottmpid    = trimmedcmd[2];
   destreturn  = trimmedcmd[3];
                       
   } // INFO


 
//
// RINFO
//
if (trimmedcmd[1] == "RINFO")
   {
 
   botcmd = this.CMD_RINFO;
   cmdname     = "RINFO";
   destination = trimmedcmd[0];
   let tail        =  trimmedcmd[2];  
   
   if (logging) console.log('\x1b[33;1m%s\x1b[0m', 'TRIMM '); // yellow
   if (logging) console.log(trimmedcmd);
   
 
   let tailarray = tail.split(';');
   
   botid      = tailarray[0];
   bottmpid   = tailarray[1];
   type       = tailarray[2];
   sourceslot = tailarray[3];
   
   let vectorarray = tailarray[4].split(',');
   vx = vectorarray[0];
   vy = vectorarray[1];
   vz = vectorarray[2];
         
   } // RINFO


//
// NBH
//
if (trimmedcmd[1] == "NBH")
   {
   botcmd            = this.CMD_NBH;
   cmdname           = "NBH";
   destination       = trimmedcmd[0];
   nbh_mode          = String(trimmedcmd[2] ?? "").toLowerCase().trim();
   nbh_slot_selector = String(trimmedcmd[3] ?? "").trim();
   destreturn        = trimmedcmd[4];

   if (nbh_slot_selector != ".")
      {
      nbh_slot_selector = nbh_slot_selector.toUpperCase();
      } // if

   let subcmd_tmp = [ { mode: nbh_mode, slot_selector: nbh_slot_selector } ];
   subcmd.push(subcmd_tmp);
   } // NBH


//
// RNBH
//
if (trimmedcmd[1] == "RNBH")
   {
   botcmd      = this.CMD_RNBH;
   cmdname     = "RNBH";
   destination = trimmedcmd[0];

   let tail = trimmedcmd[2];
   const [tail_botid, tail_payload] = this.split_first(tail, ';');
   botid = tail_botid;
   nbh_payload = String(tail_payload ?? "");

   const slot_entries = nbh_payload.split('/');
   for (let i = 0; i < slot_entries.length; i++)
       {
       const entry = String(slot_entries[i] ?? "").trim();
       if (entry == "")
          {
          continue;
          } // if

       const [slot_key, slot_rest] = this.split_first(entry, ':');
       const key = String(slot_key ?? "").trim().toUpperCase();
       const rest = String(slot_rest ?? "").trim();

       if (key != "")
          {
          const [neighbor_id_raw, neighbor_vec_raw] = this.split_first(rest, '|');
          const neighbor_id = String(neighbor_id_raw ?? "").trim();
          const neighbor_vec = String(neighbor_vec_raw ?? "").trim();

          nbh_neighbors[key] =
            {
            id: (neighbor_id == "" ? "x" : neighbor_id),
            vec: (neighbor_vec == "" ? "x" : neighbor_vec)
            };
          } // if
       } // for
   } // RNBH


 

//
// MOVE
//
if (trimmedcmd[1] == "MOVE")
   {
   botcmd       = this.CMD_MOVE;
   cmdname      = "MOVE";
   destination  = trimmedcmd[0];
   
   let cmdbody  = trimmedcmd[2];
      
   destreturn   = trimmedcmd[3];
   
   let locallogging = false;

    
   const trimmed2 = cmdbody.split(';');
   cnt = trimmed2.length;
   if (locallogging) console.log(trimmed2);
   
    
   for (let i=0; i<cnt; i++)
       {

       let sub = trimmed2[i];
              if (locallogging) console.log("i:" + i + " " + sub);
              
       //      
       // move/climb       
       //
       if (sub.includes("_") && !sub.includes("S") ) 
          {
          if (locallogging) console.log("Move or climb!");
    
          // Repeat-handling      
          const match = sub.match(/^(.*?)(\d+)?$/);

          const prefix = match[1];   
          let   repeat = match[2]; 
          if (repeat == undefined) repeat = 1;

          
          let subarray = prefix.split('_');
                    
          let first_affector = subarray[0];
          let last_affector = subarray[2];
          
          let subcenter = subarray[1];
          if (locallogging) console.log("subcenter: " + subcenter);          
          let moves = subcenter.split('');
          
          let subcmd_tmp =  { sub: "MOV", fa: first_affector,  la: last_affector, moves: moves, repeat: repeat  } ;
          subcmd.push( subcmd_tmp );
          } // move/climb           
          
            
       //      
       // Spin       
       //
       if ( sub.match(/^._S[RL]_.$/) ) 
          {
          if (locallogging) console.log("Spin!");
          
          // Repeat-handling          
          const match = sub.match(/^(.*?)(\d+)?$/);

          const prefix = match[1];   
          let   repeat = match[2]; 
          if (repeat == undefined) repeat = 1;
          
          let subarray = prefix.split('_');
          
          let direction = prefix[3];
          
          
          let subcenter = subarray[1];
          if (locallogging) console.log("subcenter: " + subcenter);          
          let moves = subcenter.split('');

          let subcmd_tmp =  { sub: "SPIN", direction: direction , moves: moves[0], repeat: repeat } ;
          subcmd.push( subcmd_tmp );

          } // spin
          
          
       //      
       // Connect
       //
       if (sub[0] == 'C') 
          {          
                   
          let slotarray = sub.split('');
          slotarray.shift();

          let subcmd_tmp =  { sub: "CONNECT", slots: slotarray  } ;
          subcmd.push( subcmd_tmp );

          } // Connect          


       //      
       // Grab
       //
       if (sub[0] == 'G')
          {          
          
          let slotarray = sub.split('');
          slotarray.shift();
          if (slotarray.length > 1) slotarray.length = 1;
          
          let subcmd_tmp = { sub: "GRAB", slots: slotarray  } ;
          subcmd.push( subcmd_tmp );

          } // Grab
          
          
       //      
       // ALIFE
       //
       if ( sub == "ALIFE" ) 
          {
                  
          let sub2 = trimmed2[i+1];
         
          bottmpid = sub2;

          let subcmd_tmp =  { sub: "ALIFE" } ;
          subcmd.push( subcmd_tmp );
          } // ALIFE          
   
   
       //      
       // NONCE
       //
       if ( sub == "NONCE" ) 
          {                  
          let nonce = trimmed2[i+1];
                    
          let subcmd_tmp =  { sub: "NONCE", val: nonce } ;
          subcmd.push( subcmd_tmp );
          } // ALIFE          
          
              
       } // for i...
   
   
  
   } // MOVE
   



   
//
// RALIFE
//
if (trimmedcmd[1] == "RALIFE")
   {
   botcmd       = this.CMD_RALIFE;
   cmdname      = "RALIFE";
   destination  = trimmedcmd[0];
   
   
   let answerarray = trimmedcmd[2].split(';');
      
   botid        = answerarray[0];   
   bottmpid     = answerarray[1];
  

   } // RALIFE   

 
if (trimmedcmd[1] == "CHECK")
   {
   botcmd       = this.CMD_CHECK;
   cmdname      = "CHECK";
   destination  = trimmedcmd[0];
   destreturn   = trimmedcmd[3];
   
   let destslot_lokal       = trimmedcmd[2];
   destslot_lokal = destslot_lokal.trim();

   if (destslot_lokal != ".")
      {
      destslot_lokal = destslot_lokal.toLowerCase();
      } // if (destslot_lokal != ".")
   
   let checkmode = "single";
   if (destslot_lokal == ".")
      {
      checkmode = "all";
      } // if (destslot_lokal == ".")

   let subcmd_tmp = [ { destslot: destslot_lokal, mode: checkmode } ];
   subcmd.push( subcmd_tmp );
   
 
   } // CHECK
   
  
 
if (trimmedcmd[1] == "RCHECK")
   {
   botcmd       = this.CMD_RCHECK;
   cmdname      = "RCHECK";
   destination  = trimmedcmd[0];
   
   let tail = trimmedcmd[2];
   const [tail_botid, tail_status] = this.split_first(tail, ';');
   
   botid        = tail_botid;
   status       = tail_status;

   if (status == "OK" || status == "OFFL" || status == "EMPT")
      {
      status_mode = "legacy";
      } // if legacy

   if (
       status !== null &&
       status !== undefined &&
       status.length > 0 &&
       status[0] >= 'a' &&
       status[0] <= 'd'
      )
      {
      status_mode = "compact";
      } // if compact
   } // RCHECK
   
   
   
//   
// SYS
//    
if (trimmedcmd[1] == "SYS")
   {
   
   botcmd       = this.CMD_SYS;
   cmdname      = "SYS";
   destination  = trimmedcmd[0];
   
   
   let subcmdarray = trimmedcmd[2].split(';');
      
   let subcmd2       = subcmdarray[0];   
   

   if (subcmd2.startsWith("LOCK")) 
      {
      let slotparam = subcmd2.substring(4);  
      
      let slotarray = slotparam.split('');
      
      let subcmd_tmp =  { sub: "LOCK", slots: slotarray  } ;

      subcmd.push( subcmd_tmp );          
      } // LOCK


   if (subcmd2.startsWith("UPDATEKEY")) 
      {
      let sigtype = subcmd2.substring(9,11);  
      
      let newsig  = subcmd2.substring(11);  
             
      let subcmd_tmp =  { sub: "UPDATEKEY", type: sigtype, newsig: newsig  } ;

      subcmd.push( subcmd_tmp );          
      } // UPDATEKEY


 
   } // SYS
   
   
 
 if ( trimmedcmd != "undefined" &&  trimmedcmd[1][0] == "X")
    {
   
    botcmd       = trimmedcmd[1];
    cmdname      = "CUSTOM";
    destination  = trimmedcmd[0];
    rawcmd       = trimmedcmd[2];
    destreturn   = trimmedcmd[3];
      
    } // 'X'
   



//
// dest - if destination is not defined, prepare cmdnext for routing!
//
destslot = destination.charAt(0).toLowerCase();
if (destslot != "")
   {
   cmdnext = cmdstring.substring(1);  
   
   if ( signature_type != "" )
      {
      cmdnext = trailer + public_signature + "@" + cmdnext; 
      } // if ( signature_type != "" )
   
   } else
     {
     cmdnext = "";  
     }
  

ret['cmd']           = botcmd;
ret['raw']           = rawcmd;
ret['cmdname']       = cmdname;
ret['sourceslot']    = sourceslot;
ret['destination']   = destination;
ret['destreturn']    = destreturn;
ret['color']         = color;
ret['status']        = status;
ret['status_mode']   = status_mode;
ret['nbh_mode']      = nbh_mode;
ret['nbh_slot_selector'] = nbh_slot_selector;
ret['nbh_payload']   = nbh_payload;
ret['nbh_neighbors'] = nbh_neighbors;


ret['destslot']      = destslot;
ret['cmdnext']       = cmdnext;
ret['botid']         = botid;
ret['bottmpid']      = bottmpid;
ret['type']          = type;
ret['vx']            = vx;
ret['vy']            = vy;
ret['vz']            = vz;

ret['subcmd']        = subcmd;

ret['signature_type']     = signature_type;
ret['public_signature']   = public_signature;
ret['sign_message']       = sign_message;

 


if ( trimmedcmd[1] == "SYS" ||  trimmedcmd[1] == "MOVE"  || trimmedcmd[1] == "XSC" )
   {
   
   // console.log("parser log:");
   // console.log(ret);
   // console.log(JSON.stringify(ret, null, 2));
   
   }
 


return(ret)
} // parse

  

} // class cmd_parser 

// Export class
module.exports = cmd_parser;

// EOF
