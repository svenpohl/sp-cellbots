/**
 * @file        botcontroller_class.js
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
const fs       = require('fs');
const path     = require('path');
const net      = require('net');
const readline = require('readline');


const WebSocket = require('ws');
const http      = require('http');

const self_assembly   = require('./self_assembly'); 
const signature_class = require('../common/signature/signature_class'); 


//const MorphBFSSimple    = require('./morph/morph_bfs_simple');
const MorphBFSWavefront = require('./morph/morph_bfs_wavefront');


const Logger = require('./logger');

const cmd_parser_class = require('./cmd_parser_class');  

const bot_class_mini = require('./bot_class_mini');




class botcontroller_class 
{
  
  
constructor() 
   {            
   this.self_assembly_obj   = new self_assembly( );
   this.signature_class_obj = new signature_class( );
   
      
   Logger.reset();
   Logger.log("Start Botcontroller");
   
   this.setup_console_interface();   
   this._shutdownRequested = false;
   

   let configPath = path.join(__dirname, 'config.cfg');
   this.config = this.loadconfig(configPath);
   
   this.bots           = [];
   this.botindex       = [];


   // Save config to variables
   this.version           = this.config.version;
   this.connect_masterbot = this.config.connect_masterbot;
   this.HOST              = this.config.masterbot_host;
   this.PORT = parseInt( this.config.masterbot_port, 10 );

 
 
   this.mb = [];
   this.mb['x']          = this.config.mb_x;
   this.mb['y']          = this.config.mb_y;
   this.mb['z']          = this.config.mb_z;
   this.mb['vx']         = this.config.mb_vx;
   this.mb['vy']         = this.config.mb_vy;
   this.mb['vz']         = this.config.mb_vz;
   this.mb['connection'] = this.config.mb_connection;

 

   
   // Status-vars
   this.MASTERBOT_CONNECTED = 0;
   this.masterbot_name = "";
   this.masterbot_first_scan = 1;

   this.scan_status  = 0;
   this.tmpid_cnt    = 0;
 
   this.scan_waiting_info          = {}; 
   this.scan_timeout = 0;


   this.threadcounter          = 0;
   this.scanwaitingcounter     = 0;
   this.max_scanwaitingcounter = 80;

   this.signal_botids = null;
   
   this.ws_gui = null;
   
   // Define supportet morph-Algorithms
   this.morphAlgorithms = [
       {
       id: "bfs_wavefront",
       name: "BFS Wavefront",
       description: "Default wavefront morphing with parallel waves and neighborhood checks.",
       default: true
       },
       {
       id: "bfs_simple",
       name: "BFS Simple",
       description: "Simple, serial BFS morphing. Always one bot per step.",
       default: false
       }
       // More algorithms can be added later
   ];
   this.morphAlgorithmSelected = "bfs_wavefront";



   console.log(`BotController Version: ${this.version} - CellBots`);
   console.log(`Port: ${this.PORT}`);
   console.log(`connect_masterbot: ${this.connect_masterbot}`);



   // Add virtual Masterbot (important for get_inverse_address() !)
   this.bot_class_mini_obj = new bot_class_mini();
   this.bot_class_mini_obj.setvalues( "masterbot", this.mb['x'], this.mb['y'], this.mb['z'], this.mb['vx'], this.mb['vy'], this.mb['vz'] );
   this.bot_class_mini_obj.checked = 1;
   this.register_bot( this.bot_class_mini_obj );
 


   this.connect_to_external_masterbot();

   // Start thread
   this.thread_botcontroller();


    
   
   // start WebGUI (async Modul)
   const { startWebGUI } = require('./webgui_server');
   startWebGUI(this);

   } // constructor()
   
   
   
   

 
loadconfig(filePath) {
  const configData = fs.readFileSync(filePath, 'utf-8');
  const config = {};

  configData.split('\n').forEach(line => 
  {
    const [key, value] = line.split('=');
    if (key && value) {
                      config[key.trim()] = value.trim();
                      }
  });

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
// sign()
//  
sign( param )
{
let signparam = "";


if ( this.config.enable_signing == "true" )
   {
   let param_to_sign = this.split_first( param, '#' )[1];
   
   if ( this.config.signature_type == 'HMAC' )
      {
      signparam += "01";
      signparam += this.signature_class_obj.signMessage( this.signature_class_obj.SIG_HMAC, param_to_sign, this.config.private_key_or_secret );      
      } // HMAC

   if ( this.config.signature_type == 'ED25519' )
      {
      signparam += "02";
      signparam += this.signature_class_obj.signMessage( this.signature_class_obj.SIG_ED25519, param_to_sign, this.config.private_key_or_secret );      
      } // HMAC

   if ( this.config.signature_type == 'RSA' )
      {      
      let private_key = this.signature_class_obj.restorePEM( this.config.private_key_or_secret , "PRIVATE KEY");
                 
      signparam += "03";
      signparam += this.signature_class_obj.signMessage( this.signature_class_obj.SIG_RSA, param_to_sign, private_key );      
      } // HMAC
   
   return ( signparam + "@" + param ); 
   } // this.config.enable_signing

return ( param );
} // sign()
  
  
  
  
  
  

//
// connect_to_external_masterbot()
//   
connect_to_external_masterbot() {
    if (this.connect_masterbot == 1) {
        this.start_masterbot_autoconnect();
    }
} // connect_to_external_masterbot



  
  
  


//
// start_masterbot_autoconnect()
//  - versucht Verbindung → reconnect bei Fehler
//
start_masterbot_autoconnect() {

    const tryConnect = () => {

        console.log(`[BotController] Trying to connect to ClusterSim at ${this.HOST}:${this.PORT} ...`);

        this.client = new net.Socket();
        this.client.setNoDelay(true);

        this.client.connect(this.PORT, this.HOST, () => {
            console.log("[BotController] Connected with MasterBot");

            this.MASTERBOT_CONNECTED = 1;

            // Status anfordern
            this.client.write('{ "cmd":"status" }\n');

            // !!! WICHTIG:
            // nach erfolgreichem Connect wieder Listener aktivieren
            this.setup_masterbot_data_listener();
        });

        this.client.on('error', (err) => {
            console.log("[BotController] Connection failed:", err.code);

            this.MASTERBOT_CONNECTED = 0;

            // Nach 2s erneut versuchen
            setTimeout(tryConnect, 2000);
        });

        // NEU: sauberer close-Listener
        this.client.on('close', () => {

            console.log("[BotController] Connection closed.");

            this.MASTERBOT_CONNECTED = 0;

            if (!this._shutdownRequested) {
                console.log("[BotController] Lost connection → attempting reconnect...");
                setTimeout(tryConnect, 2000);
            }
        });
    };

    tryConnect();
} // start_masterbot_autoconnect()




afterMasterbotConnected() {

    console.log('Connected with MasterBot');
    console.log('Enter command (gettime/getstatus) or "quit":');

    this.MASTERBOT_CONNECTED = 1;

    // initial Status holen
    this.client.write('{ "cmd": "status" }\n');

    // ✨ alte Event-Handler wieder aktivieren
    this.setup_readline_interface();
    this.setup_masterbot_data_listener();
} // afterMasterbotConnected

  
  


setup_readline_interface() {
    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

  
    
      
  this.rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      this.rl.close();
      this.client.end();
    } else 
           {
    
           if (input == "status")
              {               
              cmd = "{ \"cmd\":\"status\" }\n";              
              }
           else
           
            
           if (input == "quit")
              {               
              this.shutdown();

/*              cmd = "{ \"cmd\":\"quit\" }\n";
              this.client.write(cmd);

              this.rl.close();
              this.client.end();*/
              }
           else

           
           if (input == "dump")
              {               
              cmd = "{ \"cmd\":\"dump\" }\n";
              }
           else


           if (input == "step")
              {               
              cmd = "{ \"cmd\":\"step\" }\n";
              }
           else

           
           if (input == "debug")
              {
                                           
              cmd = "{debug}";
              cmd = "{ \"cmd\":\"debug\" }";
              
              }
           else
           
           if (input == "push")
              {               
         
              param = "F#SC#00ff00";
              param = "FFF#SC#00ff00";
              param = "FFR#SC#00ff00";
              param = "FFL#SC#00ff00";
              param = "F#PING#S";     // Directly conncted cube
              param = "FF#PING#BB";   // Second conncted cube
 
               
              param = "F#INFO#0_01#S";     // Directly conncted cube - ok
              param = "FF#INFO#0_02#SB";   //   cube - ok
              param = "FFL#INFO#0_05#SBB"; //   cube 
              

              param = "FFT#INFO#0_04#DBB"; //   cube TD-Test
              param = "T#INFO#0_06#D";     //   masterbot T-Test
              param = "D#INFO#0_06#T";     //   masterbot D-Test
              param = "T#INFO#0_06#S";     //   masterbot D-Test - SELF


              param = "FFTT#INFO#0_06#DDBB"; //   masterbot T-Test 
              param = "FFD#INFO#0_06#TBB";   //   masterbot D-Test 
              param = "F#CHECK#F#B";         //   check
              param = "FF#CHECK#F#BB";       //   check
              
              param = "F#XSC#ffaa00";        //   XSC - Setcolor
              param = "FF#XSC#ffaa00#BB";    //   XSC - Setcolor
              param = "FF#XRC##BB";          //   XRC - ReadColor
              
              param = "FFT#MOVE#D_F_D";       //   Move
              param = "FFT#MOVE#D_FT_D;LIFE"; //   Move
              param = "FFT#MOVE#D_F_D;LIFE";  //   Move

              param = "FFT#MOVE#D_SR_D;LIFE";      //   Move
              param = "FFT#MOVE#D_SL_D;ALIFE#DBB"; //   ALIFE
              param = "FFT#MOVE#D_F_D;ALIFE#DLBB"; //   ALIFE 
              
              param = "FFT#MOVE#D_SL_D;CFDT";  // Connect-Test
              param = "FFT#MOVE#D_SL_D;C";     // Connect-Test

              param = "FFT#MOVE#GF";        // Grab
              
              
              param = "FFT#MOVE#D_F_D;ALIFE;4711#DLBB"; 
//            
              param = "FFT#MOVE#D_F_D;ALIFE;5522#DLBB"; 

                      
              param = "FF#MOVE#D_TF_D;ALIFE;5523#DBB";   
              param = "FF#MOVE#D_TF_D;D_F_D;ALIFE;5523#DBBB"; 
              param = "FF#MOVE#D_TF_D;D_F_D;ALIFE;5523#DBLBBRB";  

              param = "FFT#MOVE#D_F_D#";  
              param = "FFT#MOVE#D_SL_D;ALIFE;hic#DLB";  



              param = "FFT#MOVE#GF;D_F_D#";  // Front
              param = "FFT#MOVE#GF;D_SL_D#"; // Spin-Left
              
              param = "FFT#MOVE#D_GF;D_SL_D#"; // Spin-Left

              param = "FFT#XSC#ff0000#";       // SetColor
              
              param = "FFF#MOVE#D_F_D";       // SetColor
              
               
              param = "FFF#XDUMMY#{dummy:'ok',x:42,parameter1:'this is a test1' }#"; // Dummy-X Command  
                 
              param = "FF#SYS#LOCKFRL"; // LOCK
                 
                 
              param = "FF#XSC#ff0000#";
              
              //param = "FF#MOVE#NONCE;42"; // NONCE
              
                 
              // Signing
              //console.log("param: ["+param+"]");
              param = this.sign( param );
                  
              cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
                            
              console.log("CMD:" + cmd);
                           
              }
           else           
           
           
   if (input == "push2")
              {                                     
              param = "FFT#MOVE#D_F_D"; //   Move
                      
              param = "FFT#XRC##DLB";   // ReadColor
              
              param = "FFF#XSC#ff0000#";
              
              param = "FF#SYS#LOCK"; // LOCK
              
              
              
              // HMAC
              //  param = "FF#SYS#UPDATEKEY01f3573fc481087cd80aa60ed72d6197180712c1a1b318d87fb0a7473566b3919c"; //
              
              // ED25519
              //  param = "FF#SYS#UPDATEKEY02X3wjg+AEDHHTu99/0UYlfkvJVkEPhJjP0y5Aa39Bj34="; //
               
              // RSA
              param = "FF#SYS#UPDATEKEY03PEM|MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArb/fDWScRvlgNj12A22y|GRCjtvSkMxMYRSnaLnEyWbOPVU+EEtV7UVRPEE6ZoDkFOWKJnkN459jGyG+/7hfR|afHKywCi3SGkEGnOg42onpUU6k/j89n1jjQ/KdmY+4zZMmI9TJABU/dXzr8KyjNj|xgUJB3rz6wMwZm4COsLOlXt9+vKSCL8++zaa19Eno0PjavEQ2lFUBHUm1QJoSRR6|X3Lk4tPBKJqac7U6dzZwGPL40qsZ6Xw51wJDEtRyYpBluzwC4yceuWwHU3D8utAy|Uqh19i5DdniAym1z9xPN11e+SfZ9l3CQiaGrwxwG8rz2qvh5eYmnyE/BsUxaubzH|sQIDAQAB;NONCE;43"; //
               
              param = this.sign( param );               
              
              cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
              
              // Set current signature to new setting
              this.config.signature_type = "RSA";
              this.config.private_key_or_secret = "PEM|MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCtv98NZJxG+WA2|PXYDbbIZEKO29KQzExhFKdoucTJZs49VT4QS1XtRVE8QTpmgOQU5YomeQ3jn2MbI|b7/uF9Fp8crLAKLdIaQQac6DjaielRTqT+Pz2fWOND8p2Zj7jNkyYj1MkAFT91fO|vwrKM2PGBQkHevPrAzBmbgI6ws6Ve3368pIIvz77NprX0SejQ+Nq8RDaUVQEdSbV|AmhJFHpfcuTi08EomppztTp3NnAY8vjSqxnpfDnXAkMS1HJikGW7PALjJx65bAdT|cPy60DJSqHX2LkN2eIDKbXP3E83XV75J9n2XcJCJoavDHAbyvPaq+Hl5iafIT8Gx|TFq5vMexAgMBAAECggEAJQCYuxxzH7ZaJBMAwAgrhqUBiKQfF/V4FLquCXf39hyE|aPGvOeeXBKIE2H80vmeGUktG7ZqG9DE5XFRYNpeB9KMWwhbXmGpiq1AtN90CTQuI|0cHD1RnU7rz3uqzppKDBXLaJQXXlooEphREwdhFtrS1DWAF6UtFyDE5fUS5Nmo3A|knxIEMcMfK0tOqt9ZEwpYZc67fZYrkYaazbQ13aJs5Hoa4r6C/PrWXtdM2Tw8a3w|WKmH92dqeHlvCfg2Ug5L5zmZz8wWfOHvyyqzczweewiFRIk0S1uGGW2Q1+mOohEw|CfFpyQCgmCS6LeXtWMi9WPNtkc6UsU8E5NHhUqM0xQKBgQDwfvk1yAYVNWe5btAd|ut2+QtPNTwiut4zyaGoBL3c5IeNDW5czocQt1c6ZoZDL/MszFuIjW2nbu0OHFvS3|O1tK2MjEOOCPltL3ZAX1vSnhe2VWxA8HUrvO9QWO7k6fqP64Id6XBFVkV9YzXCQI|XlFwKlOaLlqj0BITSVaQd2/8CwKBgQC481jIsKBEphnT7nv7/XbAJs0CASBa0gA9|DrdmV8lwFYcMDPYNs8a3yyM8eKZ10lSsWv8K0vnPVfuaJ1u8gWuxE/uZUpWI5j6p|BB3/aq7G1R28OJaNlhplVG5BHvTu3wWMJJTs0leLMTOzyEV3fvCc52HJKzqinLN4|X5T6ZbokswKBgBWXkNBfUQx+av2fEVhZ+qamYVXBjsoA+MqazUml9VJP1JOrmXut|PmvPEmmAs/tcivHfUBZUksCDo6BxUy9QSPYDWKMlaCP8KpzDgjV58lSoO4T6vU6v|AuWl4gXfJ3f2OEhX4iA052XG7RhXYXTO4wjrA+6H0uN6PuU0ZG08C/XZAoGAdFN6|UB/nbcYbEJU7Hi85dXnyD4St2PGkfMK4z4H/jKO9oPK1/8BHCGqX6vznlcuIvi8t|op03yhSGf1qp9FJibann4XNz4fsPBjc0tuVesGhyn2PoLX1vdLQ59HOIEoXrc02+|7YUO0tlLb5RTPOl2ZPmTI3gxFP4CU3+qsCMzhMkCgYBEyT13L2kXnaP5PpmcIB04|GGfwAnHkzKVpYcp/7DWZHsyin+dRn7+D4PSZbLTqsGCufhx+vK4tIU/d4wM6GfL4|zZDIOGujOGkrc2axY+yhyJ+/2hw4hJGD2bs+8JoXFZgG7nsd0u9EvVuq0QiueJBT|9BYdXPvO8L923ocNgB3I1A==";
              
             
              }
           else   
           
          if (input == "push3")
              {                     
                          param = "FF#XSC#0000ff#";
              
              //param = "FF#MOVE#NONCE;42"; // NONCE
              
                 
              // Signing
              //console.log("param: ["+param+"]");
              param = this.sign( param );
                  
              cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
                            
              console.log("CMD:" + cmd);
              } 
            else
           
           
           if (input == "scanstep")
              {              
           
              this.scan_step();
              
              }
           else   
                      
  
           if (input == "pop")
              {              
              param = "";
              
              cmd = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";
              
              //console.log("CMD:" + cmd);
               
              }
           else   
           
           
       if (input == "export")
              {              
              this.bots_jsonexport("logs/botexport_live.json");
               
              }
           else           
            
           
           if (input == "run")
              {              
                              
              let retstruct = this.create_opcode_sequence( "" );
              let opcodes = retstruct.opcodes;
              
              console.log("RETSTRUCT: ");
              console.log( retstruct );
  
              // Write opcodes to file  
              const filePath = path.join(__dirname, 'sequences', 'morph.sequence');
    
              fs.writeFileSync(filePath, opcodes, 'utf8');

              }
           else              
      
      
                 {
                 cmd = input;
                 console.log("cmd = input");
                 }
                 
                 
                 
      if (
         input != 'quit'     &&
         input != 'scanstep' &&
         input != 'run' 
         ) 
         {
         
         console.log("cmd: " + cmd);
         this.client.write(cmd);
         }
    }
  });
  
  
  
    
} // setup_readline_interface()




setup_masterbot_data_listener() {

/*
    this.client.on('data', (data) => {
        // dein alter JSON-Parsing-Code hier rein
    });
  */  
    
   
this.client.on('data', (data) => 
{

const messages = data.toString().split("\n").filter(Boolean);
  

  
 messages.forEach(msg => 
 {
const jsonstring = msg.toString().trim();
  
   
   try {
       const decodedobject = JSON.parse(jsonstring);
       
       if ( decodedobject.cmd == "submitstatus" )
          {
          this.masterbot_name = decodedobject.masterbot_name;
          } // "submitstatus"
       else
       
       if ( decodedobject.cmd == "submitqueue" )
          {
          
          this.handle_answer( decodedobject );
          
          } // "submitstatus"
          
          
       else
       if ( decodedobject.cmd == "msg" )
          {
          msg = decodedobject.msg;
          } // "submitstatus"
       
       } catch (error) 
         {
         console.error("Error parsing JSON:", error);
         }
         
  
  
 });   /// messages.forEach(msg =>     
   


}); // this.client.on
 
    
 


this.client.on('close', () => {
    console.log('MasterBot connection closed.');

    this.MASTERBOT_CONNECTED = 0;

    // Versuche nicht, neu zu verbinden, falls der Benutzer absichtlich "quit" gedrückt hat
    if (this._shutdownRequested) {
        console.log("Shutting down BotController.");
        process.exit(0);
    }

    // Andernfalls einfach die Schleife weiterlaufen lassen:
    console.log("Waiting for MasterBot to come online...");
});





} // setup_masterbot_data_listener()





  /*
//
// connect_to_external_masterbot()
// 
connect_to_external_masterbot()
{
let param = "";

this.client = new net.Socket();

this.rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


 



if (this.connect_masterbot == 1)
{

this.client.connect( this.PORT, this.HOST, () => {
  console.log('Connected with MasterBot');
  console.log('Enter command (gettime/getstatus) or "quit":');
  
  this.MASTERBOT_CONNECTED = 1;
  let cmd = "";
  
    
  // ask for initial status 
  cmd = "{ \"cmd\":\"status\" }\n";
  this.client.write(cmd);
  
    

}); // this.client.connect






 


this.client.on('close', () => {
  console.log('Connection closed!');
  process.exit(0);
});


} // if (connect_masterbot == 1)
else
{

}



 


} // connect_to_external_masterbot()
  
  
  

*/




//
// setup_console_interface()
//  (safe mode: only adds a wrapper, nothing removed)
//
setup_console_interface() {

    // Falls später schon gesetzt, abbrechen (sicherheitscheck)
    if (this.rl) {
        console.log("[setup_console_interface] readline already active.");
        return;
    }

    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('Console ready. Type "quit" to exit.');

    this.rl.on('line', input => {
        input = input.trim();

        // Quit -> sauber shutdown
        if (input === 'quit') {
            console.log("Shutting down...");
            this._shutdownRequested = true;

            try { if (this.client) this.client.end(); } catch(e) {}

            process.exit(0);
        }

        // Alle anderen Eingaben erstmal NICHT verändern!
        // Deine alte Console-Logik darf sich erstmal weiter darum kümmern.
        console.log("[Console passthrough]", input);
    });

} // setup_console_interface()



 
 
shutdown() 
{
    if (this._shutdownRequested) return;  
    this._shutdownRequested = true;

    console.log("Shutting down...");

   

    // 2) Close GUI-Websocket  
    if (this.ws_gui) {
        try {
            console.log("→ Closing WebGUI WebSocket...");
            this.ws_gui.close();
        } catch(e) {}
    }

    // 3) close readline 
    if (this.rl) {
        try {
            this.rl.close();
        } catch(e) {}
    }

    // 4) exit process
    setTimeout(() => {
        console.log("→ Exit.");
        process.exit(0);
    }, 300);
    
} // shutdown
 
 
 
 
 
start_scan( reset = 1)
{

this.bots     = [];  
this.botindex = [];

this.scan_waiting_info = {};


this.scan_status  = 0;
this.tmpid_cnt    = 0;
this.scan_timeout = 0;



// Add masterbot ...
const bot_class_mini_obj = new bot_class_mini();
  
    
bot_class_mini_obj.setvalues(
                            "masterbot",
                             this.mb['x'],
                             this.mb['y'],
                             this.mb['z'],
                             this.mb['vx'],
                             this.mb['vy'],
                             this.mb['vz'],
                             "FF0000"                            
                           );
             
            
                       
                 
bot_class_mini_obj.checked = 1;
   
bot_class_mini_obj.checked_neighbors['f'] = 1;
bot_class_mini_obj.checked_neighbors['r'] = 1;
bot_class_mini_obj.checked_neighbors['b'] = 1;
bot_class_mini_obj.checked_neighbors['l'] = 1;
bot_class_mini_obj.checked_neighbors['t'] = 1;
bot_class_mini_obj.checked_neighbors['d'] = 1;

bot_class_mini_obj.checked_neighbors[ this.mb['connection']] = 0;


 


bot_class_mini_obj.adress += this.mb['connection'].toUpperCase();


 

this.register_bot( bot_class_mini_obj );

 

this.scanwaitingcounter = 0;
this.scan_status        = 1;

this.tmpid_cnt          = 0;
this.threadcounter      = 0;

} // start_scan()



  
  



//
// createAlgorithm()
// Called by prepare_morph()
//
createAlgorithm(algoName, startBots, targetBots, params) {

    switch (algoName) {
        //case "simple": return new MorphBFSSimple(startBots, targetBots, params);
        case "wavefront": return new MorphBFSWavefront(startBots, targetBots, params);
        default: throw new Error("Unknown algorithm: " + algoName);
    }
} // createAlgorithm

  
 





//
// prepare_morph()
//
prepare_morph( structure, algo_selected )
{
        
// Set to global space
this.morphAlgorithmSelected = algo_selected;

let startBots = [];
let size      = this.bots.length;

for (let i=0; i<size; i++)
    {
    let { id, x, y, z } = this.bots[i];    
    
       {
       startBots.push( { id:id, x:Number(x), y:Number(y), z:Number(z) } ) ;
       }
    }



const data = fs.readFileSync
  (
  path.join(__dirname, 'structures', structure + '.json'),
  'utf8'
  );
const targetBots = JSON.parse(data);


 

let params = {};
let algo = null;

if ( this.morphAlgorithmSelected == "bfs_wavefront" ) 
   {
   console.log("Prepare bfs_wavefront...");
   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 14,
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("wavefront", startBots, targetBots, params);

   } // "bfs_wavefront"
 
 

if ( this.morphAlgorithmSelected == "bfs_simple" ) 
   {
   console.log("Prepare bfs_simple...");

   params = {
            masterbot : { x: Number(this.mb['x']), y: Number(this.mb['y']), z:   Number(this.mb['z'])    },
            max_paths_in_wave: 1, // Only one Bot per wave
            max_attempts_to_find_pair: 50
            };

   algo = this.createAlgorithm("wavefront", startBots, targetBots, params);

   } // "bfs_simple"
  
 
 




this.notify_frontend_console("Prepare Morph");

algo.run( this,  this.morph_finish_handler.bind(this) );




} // prepare_morph( structure )


 


//
// Morph finish handler
//
morph_finish_handler( morphLog, success ) 
{
console.log("Morphing calculation complete!");
this.notify_frontend_console("Morphing calculation complete!");


if (success === false)
   {
   console.log("Morphing stuck! No more moves possible, but not all bots are happy!");
   this.notify_frontend_console("Morphing stuck! No more moves possible, but not all bots are happy!");

   return;
   } else
     {
     console.log("Morphing calculation success!");
     this.notify_frontend_console("Morphing calculation success!");
     }
    
// console.log("morphLog returns:");
// console.log(JSON.stringify(morphLog, null, 2));
 
fs.writeFileSync("logs/morphresult.json", JSON.stringify(morphLog, null, 2));  

  
  
             let retstruct      = this.create_opcode_sequence( morphLog );
             let opcodes        = retstruct.opcodes;
             this.signal_botids = retstruct.signal_botids;
          
              
             // console.log("RETSTRUCT: ");
             // console.log( retstruct );
             // console.log(JSON.stringify(retstruct, null, 2));

// Write opcodes to file  
const filePath = path.join(__dirname, 'sequences', 'morph.sequence');
    
fs.writeFileSync(filePath, opcodes, 'utf8');

 
this.self_assembly_obj.run_sequence( "morph" );
  
} // morph_finish_handler()




//
// create_opcode_sequence()
//
create_opcode_sequence( morphLog )
{
let locallog = false;
let signal_botids = {};

if (locallog) console.log( "create_opcode_sequence..." );
let ret = "";

 

let bots_tmp = this.bots.map(b => ({
  id: b.id,
  x: b.x,
  y: b.y,
  z: b.z,
  vector_x: b.vector_x,
  vector_y: b.vector_y,
  vector_z: b.vector_z,
  adress: b.adress
}));
  
let size = morphLog.waves.length;
if (locallog) console.log("size: " + size);


let signalbuffer = "";
let signalindex = 1;

for (let i=0; i<size; i++)
    {    
    let size2 = morphLog.waves[i].moves.length;
    
    if (locallog) console.log("size2: " + size2); 
    
  
    // create blockedBots
    let blockedBots = morphLog.waves[i].moves.map(mv => mv.from);
    
    ret += "block "+signalbuffer+"\n";
    ret += "{\n";
    
    
    signalbuffer = "";
    
    for (let i2=0; i2<size2; i2++)
        {
        
        if (locallog) console.log(morphLog.waves[i].moves[i2]);
        let thebotid = morphLog.waves[i].moves[i2].id;
       
        
     
        
      
        let thex = morphLog.waves[i].moves[i2].from.x;
        let they = morphLog.waves[i].moves[i2].from.y;
        let thez = morphLog.waves[i].moves[i2].from.z;
        let thekey = this.getKey_3d(thex, they, thez);
        let bindex = this.botindex[thekey];
    
        if (locallog) console.log("thebotid: ");
        if (locallog) console.log(bindex);
        if (locallog) console.log(thebotid);
        
        let neighbours1 = this.get_valid_neighbours( {x:bots_tmp[bindex].x, y:bots_tmp[bindex].y, z:bots_tmp[bindex].z },{x:0, y:0, z:0 }, bots_tmp );
 
 
        
       
        
        if (locallog) console.log("thebotid: " + thebotid + " " + bindex + " vxyz: " + bots_tmp[bindex].vector_x + " " +   bots_tmp[bindex].vector_y + " " +  bots_tmp[bindex].vector_z + " " ); 
        
        let size3 = morphLog.waves[i].moves[i2].fullPath.length;
        if (locallog) console.log( " thebotid:" + thebotid + " size3:"+size3 + " Adress: " + bots_tmp[bindex].adress );
    
        // Get Bot coordinate...
        let bot_from = morphLog.waves[i].moves[i2].from;
        let bot_to   = morphLog.waves[i].moves[i2].to;
        
        if (locallog) 
        {
        console.log("bot_from: ");
        console.log(bot_from);
        console.log("bot_to: ");
        console.log(bot_to);
        }
        
        
 
       

       
        // console.log("Blocked bots:");
        // console.log(blockedBots);
        
        
       
        // Adress-Update (all bots!) 
        for (let b = 0; b < bots_tmp.length; b++) 
            {
 
            // Don't block masterbot and current target-bot
            const cleanedBlockedBots = blockedBots.filter(b2 =>
             !(b2.x === this.mb.x && b2.y === this.mb.y && b2.z === this.mb.z) &&
             !(b2.x === bots_tmp[b].x && b2.y === bots_tmp[b].y && b2.z === bots_tmp[b].z)
            );
            bots_tmp[b].adress = this.get_mb_returnaddr(
             {x: this.mb.x, y: this.mb.y, z: this.mb.z},
             {x: bots_tmp[b].x, y: bots_tmp[b].y, z: bots_tmp[b].z},
             bots_tmp, cleanedBlockedBots
            );
      
           if (bots_tmp[b].adress  == "" )
            { 
            if (locallog)  console.log("empty adress!!!! ---- Bot:", bots_tmp[b].id, "Pos:", bots_tmp[b].x, bots_tmp[b].y, bots_tmp[b].z);
            }

          
            }      // for b...   
      
          
         
         
       
         
  
    
        let signal = "";
        if (i < (size-1) )
           {
           signal += "sig" + (signalindex);
           
           signal_botids[signal] = { thebotid:thebotid, to:{x:bot_to.x, y:bot_to.y, z:bot_to.z} };
           signalindex++;
           
           signalbuffer += signal + " ";
           } else
             {
             signal = "FIN";
             signal_botids[signal] = { thebotid:thebotid, to:{x:bot_to.x, y:bot_to.y, z:bot_to.z} };
             }
    
    
    
        let cmd = "";
    
    
        cmd += bots_tmp[bindex].adress + "#MOVE#";


        let fullPath = morphLog.waves[i].moves[i2].fullPath;
        
        let result = this.calc_move_cmds(fullPath, bots_tmp[bindex].vector_x, bots_tmp[bindex].vector_y, bots_tmp[bindex].vector_z ,bots_tmp);
        
        let movecmds = result.movecmds;
            
           
        if (locallog) console.log("movecmds: ["+movecmds+"]");

 
 
 
        
    
      
      
        // UPDATE bots_tmp: verschiebe den aktuellen Bot auf die neue Position
        bots_tmp[bindex].x = bot_to.x;
        bots_tmp[bindex].y = bot_to.y;
        bots_tmp[bindex].z = bot_to.z;

        
        
        
        // Get returnaddress
        let retaddr = "[retaddr]";
        
           
        if (locallog) console.log("result.lastneighbour:");
        if (locallog) console.log(JSON.stringify( result.lastneighbour , null, 2));
        
        
        retaddr = this.get_mb_returnaddr({x:bot_to.x, y:bot_to.y, z:bot_to.z }, {x:this.mb.x, y:this.mb.y, z:this.mb.z }, bots_tmp, blockedBots );
        

        if (locallog) console.log("new retaddr: [" + retaddr + "]");
        
       
        
      
        cmd += movecmds + ";ALIFE;" + signal + "#" + retaddr; 
                       
    
        cmd += "\n";        
    
        ret += cmd;
        
        
        } // for i2...
    
    
    ret += "}\n"; // block...

  
    ret += "\n";     
    } // for i...
    
    
 



if (locallog) 
{
console.log("ret:");
console.log("-----");
console.log(ret);
console.log("-----");

 
console.log("FIN reate_opcode_sequence()");
}


 
let retstruct = { opcodes:ret, signal_botids:signal_botids };
return (retstruct);
} // create_opcode_sequence()




 

//
// Get return adress with blocketBots
//
get_mb_returnaddr(pos_from, pos_to, bots_tmp, blockedBots=[]) {
    let queue = [{pos: pos_from, path: ""}];
    let visited = new Set();

     
    // Set for quick block check
    const blockedSet = new Set(
      blockedBots.map(b => `${b.x},${b.y},${b.z}`)
    );

    let steps = 0;

    while (queue.length > 0) {
        let current = queue.shift();
        let key = `${current.pos.x},${current.pos.y},${current.pos.z}`;
        steps++;

        if (visited.has(key)) continue;
        visited.add(key);

        if (
            current.pos.x === pos_to.x &&
            current.pos.y === pos_to.y &&
            current.pos.z === pos_to.z
        ) {
            return current.path;
        }

        // iterarte all neighbours
        for (let bot of bots_tmp) {
            // -----> New: skip blocked-bots!
            if (blockedSet.has(`${bot.x},${bot.y},${bot.z}`)) continue;

            // skip self coordinate
            if (
                bot.x === current.pos.x &&
                bot.y === current.pos.y &&
                bot.z === current.pos.z
            ) continue;

            let dx = Math.abs(bot.x - current.pos.x);
            let dy = Math.abs(bot.y - current.pos.y);
            let dz = Math.abs(bot.z - current.pos.z);
            if (dx + dy + dz !== 1) continue; // only orthogonal neighbours

            let from_bot = bots_tmp.find(b =>
                b.x === current.pos.x &&
                b.y === current.pos.y &&
                b.z === current.pos.z
            );
            if (!from_bot) continue;

            let dx2 = bot.x - from_bot.x;
            let dy2 = bot.y - from_bot.y;
            let dz2 = bot.z - from_bot.z;
            let vx = from_bot.vector_x;
            let vy = from_bot.vector_y;
            let vz = from_bot.vector_z;
            let port = this.get_cell_slot_byvector(dx2, dy2, dz2, vx, vy, vz);

            if (!port) continue;

            let newpath = current.path + port;
            queue.push({
                pos: { x: bot.x, y: bot.y, z: bot.z, vector_x: bot.vector_x, vector_y: bot.vector_y, vector_z: bot.vector_z },
                path: newpath
            });
        }
    }
    // not path found
    return ""; //  
} // get_mb_returnaddr()


 

printPathCoords(start, path) {
    let x = parseInt(start.x), y = parseInt(start.y), z = parseInt(start.z);
    console.log(`Start: (${x},${y},${z})`);
    for (let i = 0; i < path.length; i++) {
        let step = path[i];
        if (step === 'F') x++;
        if (step === 'B') x--;
        if (step === 'T') y++;      
        if (step === 'D') y--;     
        if (step === 'R') z++;
        if (step === 'L') z--;
        console.log(`Schritt ${i+1} (${step}): (${x},${y},${z})`);
    }
} // printPathCoords()


 

//
// get_valid_neighbours() ... of a coordinate
//
get_valid_neighbours(pos, excludePos, botsInput) 
{
let neighbours = [];

const bots_tmp = Array.isArray(botsInput) ? botsInput : Object.values(botsInput);

 

  // 6 possible directions
  const directions = [
    {dx:  1, dy: 0, dz: 0},
    {dx: -1, dy: 0, dz: 0},
    {dx:  0, dy: 1, dz: 0},
    {dx:  0, dy: -1, dz: 0},
    {dx:  0, dy: 0, dz: 1},
    {dx:  0, dy: 0, dz: -1}
  ];

  function isSamePos(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

 

  for (let dir of directions) 
      {
      let np = { x: pos.x + dir.dx, y: pos.y + dir.dy, z: pos.z + dir.dz };

      // Exclude the given position
      if (excludePos && isSamePos(np, excludePos)) continue;

 


      // search bot on neighbour-position (options: faster with indexobject)
      let bot = bots_tmp.find(b => isSamePos(b, np));
      if (bot) {
               neighbours.push(bot);
               }
      } // for
  
  return neighbours;
} // get_valid_neighbours()



 

//
// calc_move_cmd()
//
calc_move_cmds(fullPath, vx, vy, vz, bots )
{
let movecmds = "";

         

const moveMap = {
  "E,1,0,0": "F",
  "E,0,-1,0": "D",
  "E,-1,0,0": "B",
  "E,0,1,0": "T",
  "E,0,0,-1": "R",
  "E,0,0,1": "L",

  "S,1,0,0": "L",
  "S,0,-1,0": "D",
  "S,-1,0,0": "R",
  "S,0,1,0": "T",
  "S,0,0,-1": "F",
  "S,0,0,1": "B",

  "W,1,0,0": "B",
  "W,0,-1,0": "D",
  "W,-1,0,0": "F",
  "W,0,1,0": "T",
  "W,0,0,-1": "L",
  "W,0,0,1": "R",
  
  "N,1,0,0": "R",
  "N,0,-1,0": "D",
  "N,-1,0,0": "L",
  "N,0,1,0": "T",
  "N,0,0,-1": "B",
  "N,0,0,1": "F"
     
};


let orientation = "";

if (vx ==  1 && vy ==  0 && vz ==  0) orientation = "E";
if (vx ==  0 && vy ==  0 && vz == -1) orientation = "S";
if (vx == -1 && vy ==  0 && vz ==  0) orientation = "W";
if (vx ==  0 && vy ==  0 && vz ==  1) orientation = "N";


// Create raw moves
let rawMoves = "";

let bot_x = fullPath[0].x;
let bot_y = fullPath[0].y;
let bot_z = fullPath[0].z;


let size = fullPath.length;

for (let i=0; i<size-1; i++)
    {
    
        
    
    let diffx = fullPath[i+1].x - fullPath[i].x;
    let diffy = fullPath[i+1].y - fullPath[i].y;
    let diffz = fullPath[i+1].z - fullPath[i].z;
    

    let moveMapIndex = orientation + "," + diffx + "," + diffy + "," + diffz ;

    let result = moveMap[ moveMapIndex ] ;
    
    if (!result) {
    console.warn('WARN: no mapping for:', moveMapIndex, '(orientation:', orientation, ')');  
    }
    
    rawMoves += moveMap[ moveMapIndex ];

    } // for i..size



    
    
size = rawMoves.length;
    
    
let lastneighbour = {};    
//    
// Iterate all SubMoves, e.g. 'F' or 'FT'...    
//
for (let i=0; i<size; i++)
    {
    
    //
    // Get first anchor slot
    //

    let neighbours = this.get_valid_neighbours( {x:bot_x, y:bot_y, z:bot_z },{x:this.mb.x, y:this.mb.y, z:this.mb.z }, bots );


    let tx = neighbours[0].x - bot_x;
    let ty = neighbours[0].y - bot_y;
    let tz = neighbours[0].z - bot_z;
    
    lastneighbour = {x:neighbours[0].x, y:neighbours[0].y, z:neighbours[0].z };
    
     
    let move = this.get_cell_slot_byvector(tx,ty,tz, vx,vy,vz);
    

    movecmds += move + "_";
     
     
    
    let MoveSubCmd = rawMoves[i];
    let check = "";
    let lastanchor = "";
    let teststruct = null;
    
    
    // check if last valid connection slot 
    teststruct   = this.test_virtual_botmove( {x:bot_x, y:bot_y, z:bot_z } , MoveSubCmd ,  bots);
    check        = teststruct.check;
    lastanchor   = teststruct.lastanchor;
 
    
    
    // must check again with next movecmds
    if (check === false)
       {
       
       i++;
       MoveSubCmd += rawMoves[i];
    
       // check ist last valid connection slot          
       teststruct   = this.test_virtual_botmove( {x:bot_x, y:bot_y, z:bot_z } , MoveSubCmd ,  bots);
       check        = teststruct.check;
       lastanchor   = teststruct.lastanchor;
       
        
       //console.log("second i: "+i + " : MoveSubCmd:" + MoveSubCmd + " check: [" + check +"]" );
        
       } // if check === false
    
    //   
    // Here Path should be valid
    //
    if (check === false)
       {  
       
       console.log('\x1b[1m\x1b[31m%s\x1b[0m', 'No valid move found!');
       //process.exit(1);
       } else
         {
         // check if last valid connection slot
         movecmds += MoveSubCmd + "_" + lastanchor ;
         
         
         if (i < (size-1) ) 
            {
            movecmds += ";";
                        
            } else
              {
              
              //console.log( "teststruct.lastanchorneighbour :" + JSON.stringify(teststruct.lastanchorneighbour, null, 2)  );
              //console.log( "last anchor: " + lastanchor );
              
              }
         
         //
         // Set tmpbot virtual to new target coordinate
         //
         let botindex = this.get_botindex_by_xyz(  {x:bot_x, y:bot_y, z:bot_z }, bots  );
         
         if ( botindex != null )
            {

            bots[botindex].x = teststruct.lastpos.x;
            bots[botindex].y = teststruct.lastpos.y;
            bots[botindex].z = teststruct.lastpos.z;
            
            bot_x            = teststruct.lastpos.x;
            bot_y            = teststruct.lastpos.y;
            bot_z            = teststruct.lastpos.z;

            } else
              {
              console.warn("botindex is null");
              }
         

         } // else
       
    
    
    
    } // for i..size        
    
 


let ret = { movecmds:movecmds, lastneighbour: lastneighbour }; 

// console.log("ret: calc_move_cmds");
// console.log( ret );

return(ret);
} // calc_move_cmds




 


//
// Get-Botindex by xyz (for temporary bots-sturucture)
//
get_botindex_by_xyz(  Botpos , bots )
{
let botindex = null;


let size = bots.length;
for (let i=0; i<size; i++)
    {
    
    if ( bots[i].x == Botpos.x &&
         bots[i].y == Botpos.y &&
         bots[i].z == Botpos.z )
         {
         botindex = i;
         i = size;        
         }
    
    } // for i...
 
 
return( botindex ); 
} // get_botindex_by_xyz






//
// test_virtual_botmove
//
test_virtual_botmove( Botpos, MoveSubCmd ,  bots)
{
let result = {};
let check = false;
 
let locallog = false;
if (locallog ) console.log("-----test_virtual_botmove-----");
if (locallog ) console.log("-Botpos: " +  JSON.stringify(Botpos, null, 2));
if (locallog ) console.log("-MoveSubCmd: " + MoveSubCmd);

let bot_x = Botpos.x;
let bot_y = Botpos.y;
let bot_z = Botpos.z;

if (locallog ) console.log("-botpos pre:");
if (locallog ) console.log(bot_x + " " + bot_y + " " + bot_z);

 
 
let keyindex = this.get_botindex_by_xyz(  {x:bot_x, y:bot_y, z:bot_z } , bots );
if (locallog ) console.log( "-keyindex:" + keyindex);

let vx = bots[ keyindex ] .vector_x;
let vy = bots[ keyindex ] .vector_y;
let vz = bots[ keyindex ] .vector_z;
 
 
 
if (locallog ) console.log( "-botid: " + bots[ keyindex ] .id + " vxyz:" +  bots[ keyindex ] .vector_x + " " + bots[ keyindex ] .vector_y + " " + bots[ keyindex ] .vector_z + " " );


let size = MoveSubCmd.length;
let lastmove   = "";
let lastanchor = "";
let neighbour_bot_x,neighbour_bot_y,neighbour_bot_z;

for (let i=0; i<size; i++)
    {
    lastmove = MoveSubCmd[i];
    if (locallog ) console.log("-lastmove: " + lastmove);
    
    let relvector = this.get_cell_relation_vector_byslot(lastmove, vx,vy,vz); 
    if (locallog ) console.log("-relvector:");
    if (locallog ) console.log(relvector);
    
    bot_x += Number( relvector.x );
    bot_y += Number( relvector.y );
    bot_z += Number( relvector.z );
    
    } // for i...


if (locallog ) console.log("-botpos after:");
if (locallog ) console.log(bot_x + " " + bot_y + " " + bot_z);

     

//
// check if Bot on target position has neighbours:
// 
let neighbours = this.get_valid_neighbours( {x:bot_x, y:bot_y, z:bot_z },{x:Botpos.x, y:Botpos.y, z:Botpos.z }, bots );
 
size = neighbours.length;
if (locallog ) console.log("-size neighbours: " + size); 
if (size > 0)
   {
   

   
   //   
   // get lastanchor
   //
   lastanchor = '';
   
   
   let nv_x = neighbours[0].x - bot_x;
   let nv_y = neighbours[0].y - bot_y;
   let nv_z = neighbours[0].z - bot_z;
   
   lastanchor = this.get_cell_slot_byvector(nv_x,nv_y,nv_z, vx,vy,vz);

   neighbour_bot_x = neighbours[0].x;
   neighbour_bot_y = neighbours[0].y;
   neighbour_bot_z = neighbours[0].z;
   
   
   
   check = true;
   if (locallog ) console.log("-size > 0 : " + check +  "  lastanchor:"  +lastanchor );
   }
   else
      {
      if (locallog ) 
         {
         // This could happen if the command works only with a double-move (climbing-action)     
         }
      }
    
//   
// is target-position free?
//
let botindex = this.get_botindex_by_xyz(  {x:bot_x, y:bot_y, z:bot_z } , bots );

if ( botindex != null )
   {
   if (locallog ) console.log("-Target pos is not free");
   check = false;
   } else
     {
     if (locallog )  console.log("-Target pos is free");
     }
   

  
 
result.check      = check; 
result.lastanchor = lastanchor; 
result.lastpos    = {x:bot_x, y:bot_y, z:bot_z };
result.lastanchorneighbour   = {x:neighbour_bot_x, y:neighbour_bot_y, z:neighbour_bot_z };

if (locallog ) console.log(" - tvb returns -------------");
return (result);
} // test_virtual_botmove




 

//
// getclusterdata_json()
//
getclusterdata_json()
{

 
let jsondata = "";

jsondata += "{";

jsondata += " \"masterbot\":  [   ";

jsondata += "   { ";
jsondata += "   \"x\": "+this.mb['x']+",  ";
jsondata += "   \"y\": "+this.mb['y']+",  ";
jsondata += "   \"z\": "+this.mb['z']+",  ";

jsondata += "   \"vx\": "+this.mb['vx']+",  ";
jsondata += "   \"vy\": "+this.mb['vy']+",  ";
jsondata += "   \"vz\": "+this.mb['vz']+"  ";

jsondata += "   }    ";

jsondata += "  ],  ";
//jsondata += "  ]  ";



jsondata += " \"bots\":  [   ";


 
let l = this.bots.length;



// Bot '0' is masterbot
for (let i=1; i < l; i++)
    {

 
    jsondata += "   { ";
    jsondata += "   \"id\": \""+ this.bots[i].id +"\" ,  ";
    jsondata += "   \"x\": "+ this.bots[i].x +",  ";
    jsondata += "   \"y\": "+ this.bots[i].y +",  ";
    jsondata += "   \"z\": "+ this.bots[i].z +",  ";

    jsondata += "   \"vx\": "+ this.bots[i].vector_x +",  ";
    jsondata += "   \"vy\": "+ this.bots[i].vector_y +",  ";
    jsondata += "   \"vz\": "+ this.bots[i].vector_z +",  ";

    jsondata += "   \"col\": \""+ this.bots[i].color +"\"  ";
    
    jsondata += "   }    ";
    
    if (i < ( l-1) )
       {
       jsondata += "   ,    ";
       }
       
    } // for i...
     
jsondata += "]";       
        

  
jsondata += "}";

 

return(jsondata);
} // getclusterdata_json()




 
 
 

//
// Returns answer-address (if path does exist!)
// firstindex_xyz, if 
//
get_inverse_address( firstindex_xyz, addr )
{
let ret = "";
 
  
let keyindex = this.botindex[firstindex_xyz];

// 1) Only Index in x_y_z-format
// Index of sending Cells (addr -> direction)
let pathindexarray = []; // x_y_z,...

pathindexarray[0] = firstindex_xyz;


let size = addr.length;
for (let i=0; i<size; i++)
    {
    let slot = addr[i];
    
    let keyindex = this.botindex[ pathindexarray[i] ];
   
    // Get orientation vector
    let vx = this.bots[ keyindex ].vector_x;     
    let vy = this.bots[ keyindex ].vector_y;     
    let vz = this.bots[ keyindex ].vector_z;
    
    let rel_vector = this.get_cell_relation_vector_byslot(slot,vx,vy,vz);
    
    //
    // Get addressed Cellbot
    //
    let cb_x = Number(this.bots[ keyindex ].x) + Number(rel_vector.x);
    let cb_y = Number(this.bots[ keyindex ].y) + Number(rel_vector.y);
    let cb_z = Number(this.bots[ keyindex ].z) + Number(rel_vector.z);
        
    let nextindex_xyz = this.getKey_3d(cb_x,cb_y,cb_z);
        
    pathindexarray[i+1] = nextindex_xyz; 
    } // for i

     
    

       
    
//    
// 2) Iterate reverse the pathindex-array    
//
size = pathindexarray.length;

ret += "S";

for (let i = (size-2); i > 0; i--)
    {
    
    // Target-vector
    let index1  = this.botindex[pathindexarray[i] ];
    let index2  = this.botindex[pathindexarray[i-1] ];
    
    
    let tx = this.bots[ index2 ].x - this.bots[ index1 ].x  ;     
    let ty = this.bots[ index2 ].y - this.bots[ index1 ].y  ;     
    let tz = this.bots[ index2 ].z - this.bots[ index1 ].z  ;     
    
    let slot2 = this.get_cell_slot_byvector(tx,ty,tz,  this.bots[ index1 ].vector_x, this.bots[ index1 ].vector_y, this.bots[ index1 ].vector_z);
 
    
    ret += slot2;
    } // for --i
    
    
// 2) Traverse the indexes backwards and fetch the Cellbot data:
//     - Index, slot (e.g. L), and the orientation of the (sending) bot
//     - For the first (last) slot (L), set an 'S' because the rotation direction is not yet known -> S
//     - For each following bot, determine the source slot based on the rotation direction (instead of 'F', use 'B') -> B
//     - repeat the last steps

return(ret);
} // get_inverse_address







//
// get_cell_relation_vector
// Relative vector of the slot, taking under acount the rotation of the cellbot.
//
get_cell_relation_vector_byslot(slot,vx,vy,vz)
{
let rx = 0;
let ry = 0;
let rz = 0;

if (slot != 'T' && slot != 'D')
{
// rotation 1
if ( vx == 1 && vy == 0 && vz == 0)
   {
   if (slot == 'F') {      rx =  1; ry =  0; rz =  0;      } else
   if (slot == 'R') {      rx =  0; ry =  0; rz = -1;      } else
   if (slot == 'B') {      rx = -1; ry =  0; rz =  0;      } else
   if (slot == 'L') {      rx =  0; ry =  0; rz =  1;      };
   } // if rotation 1

// rotation 2
if ( vx == 0 && vy == 0 && vz == -1)
   {
   if (slot == 'F') {      rx =   0; ry =  0; rz = -1;      } else
   if (slot == 'R') {      rx =  -1; ry =  0; rz =  0;      } else
   if (slot == 'B') {      rx =   0; ry =  0; rz =  1;      } else
   if (slot == 'L') {      rx =   1; ry =  0; rz =  0;      };
   } // if rotation 2

// rotation 3
if ( vx == -1 && vy == 0 && vz == 0)
   {
   if (slot == 'F') {      rx =   -1; ry =  0; rz =   0;      } else
   if (slot == 'R') {      rx =    0; ry =  0; rz =   1;      } else
   if (slot == 'B') {      rx =    1; ry =  0; rz =   0;      } else
   if (slot == 'L') {      rx =    0; ry =  0; rz =  -1;      };
   } // if rotation 3

// rotation 4
if ( vx == 0 && vy == 0 && vz == 1)
   {
   if (slot == 'F') {      rx =    0; ry =  0; rz =   1;      } else
   if (slot == 'R') {      rx =    1; ry =  0; rz =   0;      } else
   if (slot == 'B') {      rx =    0; ry =  0; rz =  -1;      } else
   if (slot == 'L') {      rx =   -1; ry =  0; rz =   0;      };
   } // if rotation 4
} // if (slot != 'T' && slot != 'D')
else
   if (slot == 'T') {      rx =    0; ry =  1; rz =   0;      }  else
   if (slot == 'D') {      rx =    0; ry = -1; rz =   0;      };  


return { x: rx, y: ry, z: rz };
} // get_cell_relation_vector_byslot


 




//
// get_cell_slot_byvector
// Relative vector of the slot, taking under acount the rotation of the cellbot.
// tx,ty,tz -> target vector (instead of the slot)
// vx,vy,vz -> rotation vector of the cellbot
//
get_cell_slot_byvector(tx,ty,tz, vx,vy,vz)
{
let ret = "";


// rotation 1
if ( vx == 1 && vy == 0 && vz == 0)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "F"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "R"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "B"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "L"  };
   } // if rotation 1


// rotation 2
if ( vx == 0 && vy == 0 && vz == -1)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "L"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "F"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "R"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "B"  };
   } // if rotation 2


// rotation 3
if ( vx == -1 && vy == 0 && vz == 0)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "B"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "L"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "F"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "R"  };
   } // if rotation 3

// rotation 4
if ( vx == 0 && vy == 0 && vz == 1)
   {
   if (tx ==  1 && ty ==  0 && tz ==  0) {  ret = "R"  };
   if (tx ==  0 && ty ==  0 && tz == -1) {  ret = "B"  };
   if (tx == -1 && ty ==  0 && tz ==  0) {  ret = "L"  };
   if (tx ==  0 && ty ==  0 && tz ==  1) {  ret = "F"  };
   } // if rotation 4

if ( tx == 0 && ty == -1 && tz == 0) ret = "D";
if ( tx == 0 && ty ==  1 && tz == 0) ret = "T";


return (ret);
} // get_cell_slot_byvector





//
// function calc_target_orientation_vector
// params stl_x, stl_y, stl_z, stl_vx, stl_vy, stl_vz, target_x,target_y,target_z, target_sourceslot 
// used by RINFO-handler ( this.handle_answer() )
//
calc_target_orientation_vector
        (
        stl_x,               
        stl_y,            
        stl_z, 
        target_x,
        target_y,
        target_z, 
        target_sourceslot
        )
{
let vx,vy,vz;


// calc difference-vector (from stl to target)
let diff_x = target_x - stl_x;
let diff_y = target_y - stl_y;
let diff_z = target_z - stl_z;




// 1. Relation of STL to target
if (diff_x == 1 && diff_y == 0 && diff_z == 0)
   {     
      if (target_sourceslot == 'B') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'R') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'F') {vx = -1, vy =  0, vz =  0};
      if (target_sourceslot == 'L') {vx =  0, vy =  0, vz =  1};        
   } // diffxyz = 1,0,0
   
   
// 2. Relation of STL to target
if (diff_x == 0 && diff_y == 0 && diff_z == -1)
   {     
      if (target_sourceslot == 'L') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'B') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'R') {vx = -1, vy =  0, vz =  0};        
      if (target_sourceslot == 'F') {vx =  0, vy =  0, vz =  1};
   } // diffxyz = 0,0,-1


// 3. Relation of STL to target
if (diff_x == -1 && diff_y == 0 && diff_z == 0)
   {     
      if (target_sourceslot == 'F') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'L') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'B') {vx = -1, vy =  0, vz =  0};        
      if (target_sourceslot == 'R') {vx =  0, vy =  0, vz =  1};
   } // diffxyz = -1,0,0


// 4. Relation of STL to target
if (diff_x == 0 && diff_y == 0 && diff_z == 1)
   {     
      if (target_sourceslot == 'R') {vx =  1, vy =  0, vz =  0};
      if (target_sourceslot == 'F') {vx =  0, vy =  0, vz = -1};
      if (target_sourceslot == 'L') {vx = -1, vy =  0, vz =  0};        
      if (target_sourceslot == 'B') {vx =  0, vy =  0, vz =  1};
   } // diffxyz = -1,0,0


return { vx: vx, vy: vy, vz: vz };
} // function calc_target_orientation_vector(...)       






//
// calc_target_orientation_vector_relative()
// returns the absolute orientation of target, depending from relativ-vector 
// (for Top/Down-scans).
// stl - orientation vecdtor of second-to-last element
// target_vx - relative vector of target
//
calc_target_orientation_vector_relative(
                                                                          stl_vx,
                                                                          stl_vy,
                                                                          stl_vz,
                                                                          target_vx,
                                                                          target_vy,
                                                                          target_vz
                                                                          )
{
let vx,vy,vz, angle;
 
if (target_vx ==  0 && target_vy ==  0 && target_vz ==  1) angle =   0;
if (target_vx ==  1 && target_vy ==  0 && target_vz ==  0) angle =  90;
if (target_vx ==  0 && target_vy ==  0 && target_vz == -1) angle = 180;
if (target_vx == -1 && target_vy ==  0 && target_vz ==  0) angle = 270;


if (angle == 0)
   {
   // Same orientation
   vx = stl_vx;
   vy = stl_vy;
   vz = stl_vz;
   } // 0°

if (angle == 90)
   {
   if (stl_vx ==  1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz = -1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz == -1) {vx = -1; vy =  0; vz =  0; }
   if (stl_vx == -1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz =  1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz ==  1) {vx =  1; vy =  0; vz =  0; }
   } // 90° 

if (angle == 180)
   {
   if (stl_vx ==  1 && stl_vy ==  0 && stl_vz ==  0) {vx = -1; vy =  0; vz =  0; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz == -1) {vx =  0; vy =  0; vz =  1; }
   if (stl_vx == -1 && stl_vy ==  0 && stl_vz ==  0) {vx =  1; vy =  0; vz =  0; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz ==  1) {vx =  0; vy =  0; vz = -1; }
   } // 180° 

if (angle == 270)
   {
   if (stl_vx ==  1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz =  1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz == -1) {vx =  1; vy =  0; vz =  0; }
   if (stl_vx == -1 && stl_vy ==  0 && stl_vz ==  0) {vx =  0; vy =  0; vz = -1; }
   if (stl_vx ==  0 && stl_vy ==  0 && stl_vz ==  1) {vx = -1; vy =  0; vz =  0; }
   } // 270° 


return { vx: vx, vy: vy, vz: vz };
} // calc_target_orientation_vector_relative()


                                                                      

//
// Register Bot - add bot to bots-array and also set the index
//
register_bot( bot_class_mini_obj )
{
let size = this.bots.length;
 
this.bots.push( bot_class_mini_obj ); 

this.set_3d(bot_class_mini_obj.x, bot_class_mini_obj.y, bot_class_mini_obj.z,  size );
} // register_bot()


 


// ---> key handling

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

// <--- key handling




 
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
 
this.ws_gui.send( JSON.stringify(msg) );
 
} // notify_frontend()


//
//
//
notify_frontend_console( msg )
{

        const events = [];
      
        let notify_msg =
            {
            event: "console",
            msg: msg 
            };

        events.push( notify_msg );
        this.notify_frontend( events );

} // notify_frontend_console


//
// update_keyindex()
//
update_keyindex( old_x, old_y, old_z, target_x, target_y, target_z )
{
 
let old_keyindex3d = this.getKey_3d( old_x, old_y, old_z );
let old_keyindex = this.botindex[ old_keyindex3d ];
   
delete this.botindex[ old_keyindex3d ];
    
// set new botindex-entry
this.set_3d(target_x, target_y, target_z, old_keyindex); 
 
} // update_keyindex





//
// get_bot_by_id()
// -> to refactor (!) - should be index-based
//
get_bot_by_id( id, bots )
{
let ret = null;

let size = bots.length;

for (let i=0; i<size; i++)
    {
    if (bots[i].id == id)
       {
       ret = i;
       i = size;       
       }
    } // for i...

return (ret);
} // get_bot_by_id();



//
// handle_answer (e.g. RINFO-handling)
//
handle_answer( decodedobject )
{
let cmd_parser_class_obj = new cmd_parser_class();
let logging = false;


let cmd_to_decode = decodedobject.jsondata['msgqueue_bc'][0];

 
if (cmd_to_decode == undefined) 
   {
   // nothing to do
   return;
   }
   
   
if (logging) Logger.log("size mbc: " + decodedobject.jsondata['msgqueue_bc'].length );
if (logging) console.log("size mbc: " + decodedobject.jsondata['msgqueue_bc'].length );

let size = decodedobject.jsondata['msgqueue_bc'].length;

if (size > 1)
   {
   if (logging) console.log("DEBUG:");
   if (logging) console.log(decodedobject.jsondata['msgqueue_bc']);
   }

for (let i=0; i<size; i++)
{
cmd_to_decode = decodedobject.jsondata['msgqueue_bc'][i];


let msgarray = cmd_parser_class_obj.parse( cmd_to_decode );

   

if ( msgarray.cmd == cmd_parser_class_obj.CMD_RINFO )
   {
   if (logging) console.log("RINFO detected");
   
   let bottmpid = msgarray.bottmpid;
   
    
   this.scan_waiting_info[bottmpid].status = 1;
   
   
   // Register new detected Cellbot to internals structure...
   let bot_class_mini_obj = new bot_class_mini();
 
   let target_x      = this.scan_waiting_info[bottmpid]['x'];
   let target_y      = this.scan_waiting_info[bottmpid]['y'];
   let target_z      = this.scan_waiting_info[bottmpid]['z'];
   let target_color  = this.scan_waiting_info[bottmpid]['color'];
   let target_stl_id = this.scan_waiting_info[bottmpid]['stl_id'];
   let target_addr   = this.scan_waiting_info[bottmpid].addr;
   
   
   
   
   // Check if CellBot already is registered!   
   let target_bot_index = this.get_3d( target_x, target_y, target_z );
   if (target_bot_index != null)
      {
      //  console.log("ALREADY REGISTERED!!!");
      //  return(0);
      }
   // END - Check
   
   
   
   let target_vectorx,target_vectory,target_vectorz;
   
  

   // Get STL xyz and vx,vy,vz
   let stl_x = 0;
   let stl_y = 0;
   let stl_z = 0;

   let stl_vx = 0;
   let stl_vy = 0;
   let stl_vz = 0;

   // if STL == Masterbot...
   if (target_stl_id == "MB")
      {
      stl_x = this.mb['x'];
      stl_y = this.mb['y'];
      stl_z = this.mb['z'];

      stl_vx = this.mb['vx'];
      stl_vy = this.mb['vy'];
      stl_vz = this.mb['vz'];
      } else
        {
        // other cellbot
        let bi = this.botindex[target_stl_id];
        stl_x = this.bots[bi].x;
        stl_y = this.bots[bi].y;
        stl_z = this.bots[bi].z;

        stl_vx = this.bots[bi].vector_x;
        stl_vy = this.bots[bi].vector_y;
        stl_vz = this.bots[bi].vector_z;       
        }
        
        


   let target_vector;
   
   if (msgarray.sourceslot != 'T' && msgarray.sourceslot != 'D')
      {
   
      let target_vector = this.calc_target_orientation_vector (
                                                         stl_x,
                                                         stl_y,
                                                         stl_z,
                                                         target_x,
                                                         target_y,
                                                         target_z,
                                                         msgarray.sourceslot                  
                                                         );
 
    
    
      target_vectorx = target_vector.vx;
      target_vectory = target_vector.vy;
      target_vectorz = target_vector.vz;
                                                 
      } // if (msgarray.sourceslot != 'T' && msgarray.sourceslot != 'D')                                                   
      else
          {
          // Orientation is delivered by the RINFO-command
          // ...or is this the relative vector?          
    
          let orientation_vector = this.calc_target_orientation_vector_relative(
                                                                          stl_vx,
                                                                          stl_vy,
                                                                          stl_vz,
                                                                          msgarray.vx,
                                                                          msgarray.vy,
                                                                          msgarray.vz
                                                                          ); 
           
          target_vectorx = orientation_vector.vx;
          target_vectory = orientation_vector.vy;
          target_vectorz = orientation_vector.vz;
          }
      

    
 

   // Register new detected cellbot   
   
   if (target_bot_index != null)
      {
      // console.log("ALREADY REGISTERED!!!");
      } else
        {
        // will register
        bot_class_mini_obj.setvalues( msgarray.botid, target_x,target_y,target_z,  target_vectorx,target_vectory,target_vectorz,  target_color, target_addr); 
        this.register_bot( bot_class_mini_obj );
   
        this.scanwaitingcounter = 0;
        
        
        // notify new bot to fronend / webgui
        const events = [];
      
        let notify_msg =
            {
            event: "addbot",
            botid: msgarray.botid ,
            position: { x: Number(target_x), y: Number(target_y), z: Number(target_z) },
            orientation: { x: Number(target_vectorx), y: Number(target_vectory), z: Number(target_vectorz) },
            color: undefined,
            adress: undefined
          };

        events.push( notify_msg );
        this.notify_frontend( events );
        
        
          
        } // else
   

   
   } // CMD_RINFO
   
   
if ( msgarray.cmd == cmd_parser_class_obj.CMD_RALIFE )
   {
   // console.log("RALIFE");
   // Logger.log("RALIFE " + msgarray.botid + " - " + msgarray.bottmpid);
 


   if ( this.signal_botids[ msgarray.bottmpid ] !== undefined )
      {
      // console.log("Signal found !");
      
              
      const events = [];
      

      let notify_msg =
          {
          event: "move",
          botid: this.signal_botids[ msgarray.bottmpid ].thebotid ,
          to: this.signal_botids[ msgarray.bottmpid ].to
          };

      events.push( notify_msg );




      this.notify_frontend( events );
    

      //
      // Update Bot-Position
      //
      let tmpbotid = this.get_bot_by_id( this.signal_botids[ msgarray.bottmpid ].thebotid, this.bots );
      
      let oldx = this.bots[tmpbotid].x;
      let oldy = this.bots[tmpbotid].y;
      let oldz = this.bots[tmpbotid].z;
      
      let new_x = this.signal_botids[ msgarray.bottmpid ].to.x;
      let new_y = this.signal_botids[ msgarray.bottmpid ].to.y;
      let new_z = this.signal_botids[ msgarray.bottmpid ].to.z;
 
      this.update_keyindex( oldx, oldy, oldz, new_x, new_y, new_z );  
      this.bots[tmpbotid].x = new_x;
      this.bots[tmpbotid].y = new_y;
      this.bots[tmpbotid].z = new_z;
      
      

      this.bots[tmpbotid].adress = this.get_mb_returnaddr( {x:this.mb.x, y:this.mb.y, z:this.mb.z }, {x:new_x, y:new_y, z:new_z }, this.bots );


         
      }
      else
         {
         console.log("Signal is undefined!");
         }
 
 
   
   
   
   // submit signal
   this.self_assembly_obj.addsignal ( this, msgarray.bottmpid );
   
   } // CMD_RALIFE  

   
 if ( msgarray.cmd == "XRRC" )
   {
   console.log("XRRC");
   console.log(msgarray);
   
   let colorarray = msgarray.raw.split(';');
      
   const events = [];
   let notify_msg =
          {
          event: "setcolor",
          botid: colorarray[0],
          color: colorarray[1]
          };

   events.push( notify_msg );

   this.notify_frontend( events );
        
   } // XRRC
 
} // for i...
 

} // handle_answer( decodedobject )



 
 


//
// scan_Step - Single scan-step
//
scan_step()
{
const slotnames = ['f','r','b','l','t','d'];

 

// First Masterbot scan
if (this.masterbot_first_scan == 1)
   {
  
   
   let cmd_slot =  this.mb['connection'].toUpperCase();
 
   let retaddr = "S";
   
   let cmd = cmd_slot + "#INFO#" + this.tmpid_cnt + "#" + retaddr;
 
   // Must remember tmpid and address (!) for later assignment in case of an RINFO answer.    
   let targetcoor = this.get_next_target_coor( this.mb['x'],this.mb['y'], this.mb['z'],  this.mb['vx'], this.mb['vy'], this.mb['vz'],  cmd_slot );
   
   
   let stl_id = "MB"; // stl = second to last (not Standard Template Library, sorry C++)

   
   this.scan_waiting_info[this.tmpid_cnt] = {                         
                           tmpid: this.tmpid_cnt,
                           addr: cmd_slot,
                           status: 0,
                           x: targetcoor.x,
                           y: targetcoor.y,
                           z: targetcoor.z,
                           stl_id: stl_id,
                           };
  
  
   cmd = this.sign( cmd );  
   
   let mb_cmd = "{ \"cmd\":\"push\", \"param\":\""+cmd+"\" }\n";                                         
   this.client.write(mb_cmd);
                   
    
   // increment scan_waiting_info cellbot-ID
   this.tmpid_cnt++;
   
   this.masterbot_first_scan = 0;   
   } // if (masterbot_first_scan == 1)
   

        
        
        let l = this.bots.length;
                      
        // Search all cubes with checked == 0        
        for (let i=0; i<l; i++)
            {
            
            if ( this.bots[i].checked == 0 )
               {               
               let l2 = slotnames.length;
               
               
               // iterate all slots
               for (let i2=0; i2 < l2; i2++)
                   {
                   let sl = slotnames[i2];
                   
                   // If unchecked slot
                   if (this.bots[i].checked_neighbors[ sl ] != 1)
                      {
                      
                      // Check if coordinate already is known
                      let target_xyz = this.get_neighbor_by_slot( i, sl);
                                            
                   
                      let target_bot_index = this.get_3d(target_xyz.x, target_xyz.y, target_xyz.z);
                       
                       

                      let found_mb = 0; 
                      // Is coordinate of Masterbot? 
                         {
                         if (
                            target_xyz.x == this.mb['x'] &&
                            target_xyz.y == this.mb['y'] &&
                            target_xyz.z == this.mb['z'] 
                            ) found_mb = 1;
                         }                       
                      
                      
                      // END coordinate - check

                      if (target_bot_index == null)
                         {
                         
                         //
                         // Prepare INFO-command and send message
                         //                      
                         let cmd_slot = sl.toUpperCase();
                         
                         let new_addr = this.bots[i].adress + cmd_slot;
                         
                         // prepare return address
                         let firstindex = this.getKey_3d(this.mb.x, this.mb.y, this.mb.z);

                         let retaddr = this.get_inverse_address(firstindex,new_addr); 
   
                         let cmd = new_addr + "#INFO#" + this.tmpid_cnt + "#" + retaddr;
                      
                         // Must remember tmpid and address (!) for later assignment in case of an RINFO answer.
                         let targetcoor = this.get_next_target_coor( this.bots[i].x, this.bots[i].y, this.bots[i].z,  this.bots[i].vector_x, this.bots[i].vector_y, this.bots[i].vector_z,  cmd_slot );
                         
                         let stl_id = this.getKey_3d( this.bots[i].x, this.bots[i].y, this.bots[i].z ); // stl = second to last (not Standard Template Library, sorry C++)

   
       
                         this.scan_waiting_info[this.tmpid_cnt] = {                         
                                                        tmpid: this.tmpid_cnt,
                                                        addr: new_addr,
                                                        status: 0,
                                                        x: targetcoor.x,
                                                        y: targetcoor.y,
                                                        z: targetcoor.z,
                                                        stl_id: stl_id,
                                                        };
  
        
                         cmd = this.sign( cmd );  
   
                         let cellbot_cmd = "{ \"cmd\":\"push\", \"param\":\""+cmd+"\" }\n";                                         

                         this.client.write(cellbot_cmd);
                   
                         // Logger.log("Request cell: " + cmd);

    
                         // Mark as sent                      
                         this.bots[i].checked_neighbors[ sl ] = 1;
                    
                         // increment scan_waiting_info cellbot-ID
                         this.tmpid_cnt++;
   
                         } // if (target_bot_index == null && found_mb == 0)
                  
                      
                   
                      
                      } // if unchecked slot---
                      
 
                   } // for i2...
               
               this.bots[i].checked = 1;
               
               } // if ( bots[i].checked == 0 )
            
            } // for i..

     
        
     
     
        this.scanwaitingcounter++;
        
        if (this.scanwaitingcounter > this.max_scanwaitingcounter)
           {
           this.scan_status          = 0;
           this.masterbot_first_scan = 1;
           this.scanwaitingcounter   = 0;
           // console.log("NO MORE ANSWER - FINISH SCAN!");
           
           //
           this.bots_jsonexport("logs/botexport.json");
           }     
     
 
} // function scan_step()




 
 



//
// bots_jsonexport
// Export of bots for test purposes
//
bots_jsonexport( outfile )
{
 
 
fs.writeFile(outfile, JSON.stringify( this.bots, null, 2), (err) => {
  if (err) {
    console.error("Export-json error:", err);
  } else {
    console.log("Export-json successful.");
  }
});

    
} //  bots_jsonexport()









//
// get_neighbor_by_slot()
// in:  botindex, slot
// out: vector of target-cellbot
//
get_neighbor_by_slot( botindex, slot )
{
 
let x = this.bots[botindex].x;
let y = this.bots[botindex].y;
let z = this.bots[botindex].z;

let vector_x = this.bots[botindex].vector_x;
let vector_y = this.bots[botindex].vector_y;
let vector_z = this.bots[botindex].vector_z;

let vx,vy,vz;

if (vector_x ==  1 && vector_y ==  0 && vector_z ==  0)
   {
   if (slot == 'f') {vx =  1; vy =  0; vz =  0; };
   if (slot == 'r') {vx =  0; vy =  0; vz = -1; };
   if (slot == 'b') {vx = -1; vy =  0; vz =  0; };
   if (slot == 'l') {vx =  0; vy =  0; vz =  1; };
   }

if (vector_x ==  0 && vector_y ==  0 && vector_z == -1)
   {
   if (slot == 'f') {vx =  0; vy =  0; vz = -1; };
   if (slot == 'r') {vx = -1; vy =  0; vz =  0; };
   if (slot == 'b') {vx =  0; vy =  0; vz =  1; };
   if (slot == 'l') {vx =  1; vy =  0; vz =  0; };
   }

if (vector_x == -1 && vector_y ==  0 && vector_z ==  0)
   {
   if (slot == 'f') {vx = -1; vy =  0; vz =  0; };
   if (slot == 'r') {vx =  0; vy =  0; vz =  1; };
   if (slot == 'b') {vx =  1; vy =  0; vz =  0; };
   if (slot == 'l') {vx =  0; vy =  0; vz = -1; };
   }

if (vector_x ==  0 && vector_y ==  0 && vector_z ==  1)
   {
   if (slot == 'f') {vx =  0; vy =  0; vz =  1; };
   if (slot == 'r') {vx =  1; vy =  0; vz =  0; };
   if (slot == 'b') {vx =  0; vy =  0; vz = -1; };
   if (slot == 'l') {vx = -1; vy =  0; vz =  0; };
   }
   
// Top   
if (slot == 't') {vx =  0; vy =  1; vz =  0; };

// Down   
if (slot == 'd') {vx =  0; vy = -1; vz =  0; };
   
   

x = x + vx;
y = y + vy;
z = z + vz;


return { x: x, y: y, z: z };
} // get_neighbor_by_slot







//
// get_next_target_coor - helper function, returns coordinate depending from
//                        the orientation of sending Cellbot
//
get_next_target_coor( sx, sy, sz, vx,vy,vz, slot )
{
let rx = 0;
let ry = 0;
let rz = 0;

let relation_vector = this.get_cell_relation_vector_byslot(slot,vx,vy,vz)


rx = Number(sx) +  Number(relation_vector.x);
ry = Number(sy) +  Number(relation_vector.y);
rz = Number(sz) +  Number(relation_vector.z);

 
return { x: rx, y: ry, z: rz };
} // get_next_target_coor




 
 
 
 
 
 
// 
// Thread BotController communication 
//
async thread_botcontroller() {
let cmd = "";

const delayms = 100;
const slotnames = ['f','r','b','l','t','d']; 
  
  setInterval(() => 
  {

  
  if (this.MASTERBOT_CONNECTED)
     {
     
     if (1)
     {
           

     if (this.scan_status == 1)
        {
        
        this.scan_step();
        
        
        
        // Pop...
        let param = "";              
        let cmd_pop = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";
                    
        this.client.write(cmd_pop);
                
        } /// if (scan_status == 1)

     
     
     if ( this.self_assembly_obj.assembly_status == 1 )
        {        
        
        let nextcmd = this.self_assembly_obj.pop_cmd();

 
        if (nextcmd != undefined)
           {
            
            
           nextcmd = this.sign( nextcmd );            
              
           cmd = "{ \"cmd\":\"push\", \"param\":\""+nextcmd+"\" }\n";
              
           console.log("thread_botcontroller cmd: " + cmd);
       
           this.client.write(cmd);
           
           
           } // if nextcmd != undefined...
           else           
               {
                
               }
        
        // Pop...
        let param = "";              
        let cmd_pop = "{ \"cmd\":\"pop\", \"param\":\""+param+"\" }\n";
                    
        this.client.write(cmd_pop);
        
        } // if (assembly_status == 1)
    
        
     this.threadcounter++;         
     } // if (0)    
         
     } // if (MASTERBOT_CONNECTED)

  }, delayms);
 
} // thread_botcontroller()
 
 

/*

startWebGUI() 
{
console.log('Starting websocket...');
    
  


// ---
// WebGUI 
//
console.log('Starting websocket...');

let counter = 0;
let answer = "";





const server = http.createServer(async (req, res) => {

    // Debug:
    console.log("REQUEST:", req.url);

    let filePath = req.url;

    // Default route → index.html
    if (filePath === "/") {
        filePath = "/index.html";
    }

    // Absolute Pfad basierend auf __dirname
    const absPath = path.join(__dirname, "webgui", filePath);

    try {
        const data = await fs.readFile(absPath);

        // MIME-Type ermitteln
        const ext = path.extname(absPath).toLowerCase();
        const mime = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml"
        }[ext] || "application/octet-stream";

        res.writeHead(200, { "Content-Type": mime });
        res.end(data);

    } catch (err) {

        console.log("404 Not found:", absPath);
        res.writeHead(404);
        res.end("404 Not Found");
    }
});

// WebSocket-Server koppeln
const wss = new WebSocket.Server({ server });


 
 


wss.on('connection', (ws) => {

  
  this.ws = ws;
    
  ws.on('message', (message) => {
  
  

    try {
        const decodedobject = JSON.parse(message);

 
        if (decodedobject.cmd === 'status') 
           {       
           answer = "{ \"answer\":\"answer_status\" , \"masterbot_name\":\""+this.masterbot_name+"\" }"; 
           ws.send(answer);          
           }


        if (decodedobject.cmd === 'getclusterdata') 
           {   

           let jsondata = this.getclusterdata_json();

           
           try {
               let jsonObject = JSON.parse(jsondata);
               
               let jsonString = JSON.stringify(jsonObject);
               
               answer = "{ \"answer\":\"answer_getclusterdata\" , \"jsondata\": " +jsonString+ "    }"; 
               
               ws.send(answer);  
           
               } catch (error) 
                 {
                 console.error("Fehler beim Parsen des JSON-Strings:", error);
                 }



           
               
           } // getclusterdata
           else
           

        if (decodedobject.cmd === 'gui_command') 
           {  
           console.log( "gui_command: " + decodedobject.value);
            
           let param = this.sign( decodedobject.value );
                  
           let cmd = "{ \"cmd\":\"push\", \"param\":\""+param+"\" }\n";
           
           this.client.write(cmd);
              
              
           } else           

           

        if (decodedobject.cmd === 'version') 
           {                  
           answer = "{ \"answer\":\"answer_version\" , \"version\":\""+this.version+"\" }"; 
           ws .send(answer);         
           // version
           console.log("VERSION....");
           } // version
           else


        if (decodedobject.cmd === 'structurescan') 
           {                             
           this.start_scan(1);
           } // structurescan
           else
           
           
        if (decodedobject.cmd === 'preparemorph') 
           {                             
           console.log("decodedobject.structure: " + decodedobject.structure);
           this.prepare_morph( decodedobject.structure, decodedobject.algo ) ;
           } // preparemorph
           else


        if (decodedobject.cmd === 'getpreviewtarget') 
           {                             
           console.log("decodedobject.structure: " + decodedobject.structure);
           //this.answer_getpreviewtarget() ;
           // alfalf
                                 
           const data = fs.readFileSync
                (
                path.join(__dirname, 'structures', decodedobject.structure + '.json'),
                'utf8'
                );
           const targetBots = JSON.parse(data);
           
           answer = JSON.stringify({ answer: "answer_getpreviewtarget", target: targetBots });

           console.log("ANSWER to send:");
           console.log(answer);

           ws.send(answer); 


          
           
           } // getpreviewtarget
           else



        if (decodedobject.cmd === 'requestsequences') 
           {                             
        
           
           // Pfad to structures-directory
           const structuresDir = path.join(__dirname, 'structures');

           // only .json
           function getStructurePrefixes() 
           {
                   return fs.readdirSync(structuresDir)
                   .filter(filename => filename.endsWith('.json'))
                   .map(filename => filename.replace(/\.json$/i, ''));
           }

           const list = getStructurePrefixes().join(',');

           answer = JSON.stringify({ answer: "answer_requestsequences", list: getStructurePrefixes() });

           

           ws.send(answer);         

           // console.log("REQUESTSEQUENCES....");
           } // requestsequences
           else
           
           
           
           
        if (decodedobject.cmd === 'requestmorphalgorithms') 
           {                             
                    
           answer = JSON.stringify({ answer: "answer_requestmorphalgorithms", list:  this.morphAlgorithms });
 

           ws.send(answer);         

           } // requestmorphalgorithms
           else        


        if (decodedobject.cmd === 'quit') 
           {                  
               
              let cmd = "{ \"cmd\":\"quit\" }\n";
              this.client.write(cmd);
             
              this.rl.close();
              this.client.end();
              
           }

    
        counter++;
  
        } catch (error) {
                        console.error("Error parsing JSON:", error);
                        }
 
 
    

  });
});


 


server.listen(3010, () => {
    console.log("BotController WebGUI available at http://localhost:3010");
});


 
    
} // startWebGUI() 

*/




attachGUIWebSocket(ws_gui) {
    this.ws_gui = ws_gui;

    ws_gui.on('message', (message) => {
        this.handleGUIMessage(message);
    });
} // attachGUIWebSocket


handleGUIMessage(message) {

    if (!this.counter) this.counter = 0;
    let answer = null;

    try {
        const decodedobject = JSON.parse(message);

        //
        // STATUS
        //
        if (decodedobject.cmd === 'status') {
            answer = JSON.stringify({
                answer: "answer_status",
                masterbot_name: this.masterbot_name
            });
            this.ws_gui.send(answer);
            return;
        }


        //
        // GETCLUSTERDATA
        //
        if (decodedobject.cmd === 'getclusterdata') {

            let jsondata = this.getclusterdata_json();

            try {
                let jsonObject = JSON.parse(jsondata);
                answer = JSON.stringify({
                    answer: "answer_getclusterdata",
                    jsondata: jsonObject
                });

                this.ws_gui.send(answer);

            } catch (error) {
                console.error("Fehler beim Parsen von clusterdata:", error);
            }

            return;
        }


        //
        // GUI COMMAND (PUSH zum Masterbot)
        //
        if (decodedobject.cmd === 'gui_command') {

            console.log("gui_command:", decodedobject.value);

            let param = this.sign(decodedobject.value);
            let cmd = JSON.stringify({ cmd: "push", param }) + "\n";

            this.client.write(cmd);
            return;
        }


        //
        // VERSION
        //
        if (decodedobject.cmd === 'version') {

            answer = JSON.stringify({
                answer: "answer_version",
                version: this.version
            });

            this.ws_gui.send(answer);
            console.log("VERSION...");
            return;
        }


        //
        // STRUCTURESCAN
        //
        if (decodedobject.cmd === 'structurescan') {
            this.start_scan(1);
            return;
        }


        //
        // PREPARE MORPH
        //
        if (decodedobject.cmd === 'preparemorph') {
            console.log("prepare morph:", decodedobject.structure);
            this.prepare_morph(decodedobject.structure, decodedobject.algo);
            return;
        }


        //
        // GET PREVIEW TARGET
        //
        if (decodedobject.cmd === 'getpreviewtarget') {

            console.log("getpreviewtarget:", decodedobject.structure);

            const filepath = path.join(__dirname, 'structures', decodedobject.structure + '.json');
            const data = fs.readFileSync(filepath, 'utf8');
            const targetBots = JSON.parse(data);

            answer = JSON.stringify({
                answer: "answer_getpreviewtarget",
                target: targetBots
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // REQUEST SEQUENCES
        //
        if (decodedobject.cmd === 'requestsequences') {

            const structuresDir = path.join(__dirname, 'structures');

            const getStructurePrefixes = () =>
                fs.readdirSync(structuresDir)
                    .filter(f => f.endsWith('.json'))
                    .map(f => f.replace(/\.json$/i, ''));

            answer = JSON.stringify({
                answer: "answer_requestsequences",
                list: getStructurePrefixes()
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // REQUEST MORPH ALGORITHMS
        //
        if (decodedobject.cmd === 'requestmorphalgorithms') {

            answer = JSON.stringify({
                answer: "answer_requestmorphalgorithms",
                list: this.morphAlgorithms
            });

            this.ws_gui.send(answer);
            return;
        }


        //
        // QUIT (Weiterleitung zum Masterbot)
        //
        if (decodedobject.cmd === 'quit') {
/*
            const cmd = "{ \"cmd\":\"quit\" }\n";
            this.client.write(cmd);

            this.rl.close();
            this.client.end();
            */
            
            this.shutdown();
            return;
        }


        //
        // FALLBACK
        //
        console.log("Unknown GUI command:", decodedobject.cmd);

        this.counter++;

    } catch (err) {
        console.error("Error parsing GUI message:", err);
    }
} // handleGUIMessage()

  
  
} // botcontroller_class


module.exports = botcontroller_class;

 