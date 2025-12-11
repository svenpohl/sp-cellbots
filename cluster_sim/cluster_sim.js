/**
 * @file        cluster_sim.js
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

const args = process.argv.slice(2);
const QUIET = args.includes("--quiet")

if (!QUIET)
   {
   const { check_nodejs_version } = require('../common/system_utils');
   check_nodejs_version("23.11.0");
   }


const net  = require('net');
const path = require('path');
const fs   = require('fs').promises;

// for webguisim
const WebSocket = require('ws');
const http = require('http');


let masterbot_class_obj = null;



 

async function main()
{



const masterbot_class = require('./masterbot_class');  
masterbot_class_obj = new masterbot_class( { QUIET } );


// Load config.cfg
const configPath = path.join(__dirname, 'config.cfg');
const config = masterbot_class_obj.loadconfig(configPath);

 
await masterbot_class_obj.init("constructs/" + config.construct);
 



// Init from config
const version        = config.version;
const PORT           = parseInt(config.port, 10);
let   MASTERBOT_NAME = config.name;




if (!QUIET) 
   {
   console.log(`Masterbot Version: ${version} - CellBots`);
   console.log(`Port: ${PORT}`);
   console.log(`MASTERBOT_NAME: ${MASTERBOT_NAME}`);
   }

 

//
// Start Server socket (for botcontroller)
//
const server = net.createServer((socket) => {
  if (!QUIET) console.log('Client connected');

  socket.on('data', (data) => {

  const messages = data.toString().split("\n").filter(Boolean);
  
  
  messages.forEach(msg => {
           
  const jsonstring = msg.toString().trim();
    
  try {
      const decodedobject = JSON.parse(jsonstring);
    
      let jsonmsg;
      let param;
  
      switch( decodedobject.cmd ) {
    
        case 'gettime':
        	const currentTime = new Date().toLocaleTimeString();
 	        socket.write(currentTime + '\n');                              
        break;

        case 'status':
        	jsonmsg = '{ "cmd": "submitstatus",  "masterbot_name":"'+MASTERBOT_NAME+'" }\n';
        	if (!QUIET) console.log("Status " + MASTERBOT_NAME);
        	socket.write( jsonmsg );                   	     
        break;
        
        case 'quit':
            if (!QUIET) console.log("Shutdown cluster_sim")
            masterbot_class_obj.close_blender_logging();
            process.exit(0);
        break;

        case 'dump':
            masterbot_class_obj.dumpdebug();  
            jsonmsg = '{ "cmd": "msg",   "info": "dumphandler", "msg":"executed" }\n';
            socket.write( jsonmsg );                
        break;

        case 'step':       
            masterbot_class_obj.simulate_bot_step();
                   
            //jsonmsg = '{ "cmd": "msg",  "info": "stephandler",  "msg":"executed" }\n';
            //socket.write( jsonmsg );                
        break;

        case 'debug':        
            masterbot_class_obj.debug();        
            jsonmsg = '{ "cmd": "msg",    "info": "debughandler", "msg":"debug executed" }\n';
            if (!QUIET) console.log("DEBUG");
            socket.write( jsonmsg );                
        break;
        
        
        case 'push':                     
            param = decodedobject.param;
            
            //console.log(param);
                
            let ret = masterbot_class_obj.push_msg( param );       
        break;
        
        case 'pop':               
            let jsondata = masterbot_class_obj.pop_botcontroller_queue();
                                   
            param = decodedobject.param;
            jsonmsg = '{ "cmd": "submitqueue", "jsondata": '+jsondata+' }\n';
        
            socket.write( jsonmsg );                     
        break;
     
                
      default:
        jsonmsg = '{ "cmd": "msg", "msg":"unknown command" }\n';
        socket.write(jsonmsg);
        }
    
   
   
       } catch (error) {
         console.error("Error parsing JSON:", error);
         if (!QUIET)
            {
            console.log( "json:" );
            console.log(jsonstring);
            }
         }
 
    
  });   /// messages.forEach(msg =>     
    
    
  }); //  socket.on('data', (data) =>
  
  
  
  
  

  socket.on('end', () => {
       if (!QUIET) console.log('Client disconnected');
       });

});

 
server.listen(PORT, () => {
  if (!QUIET) console.log(`ClusterSim-Server running on Port ${PORT}`);
  });


} // async function main()




// ---
// WebGUI (DEBUG)
//
if (!QUIET) console.log("start webserver...");

let counter = 0;


const httpserver = http.createServer(async (req, res) => {
  if (!QUIET) console.log("REQUEST:", req.url);

  let filePath = req.url;

  // Wenn nur "/" angefragt, lade index.html
  if (filePath === "/") {
      filePath = "/index.html";
  }

  // Baue echten Dateipfad
  const absPath = path.join(__dirname, "webguisim", filePath);

  try {
      const data = await fs.readFile(absPath);

      // MIME-Typ bestimmen
      const ext = path.extname(absPath).toLowerCase();
      const mime = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
          ".json": "application/json",
      }[ext] || "application/octet-stream";

      if (!QUIET) console.log("Serving:", absPath);
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);

  } catch (err) {
      if (!QUIET) console.log("File not found:", absPath);
      res.writeHead(404);
      res.end("404 Not Found");
  }
});





const wss = new WebSocket.Server( { server: httpserver } );


wss.on('connection', (ws) => {


  // Enable masterbot-debug-webgui connection
  masterbot_class_obj.set_webgui_socket( ws );
  masterbot_class_obj.setlivelogging = true;
  
  ws.on('message', (message) => {

    
    try {
        const decodedobject = JSON.parse(message);
    
    
        if (decodedobject.cmd === 'status') 
           {       
           let masterbot_name = "DEBUG-CLUSTER-SIM (no masterbot)";
           answer = "{ \"answer\":\"answer_status\" , \"masterbot_name\":\""+masterbot_name+"\" }"; 
           ws.send(answer);          
           } else


        if (decodedobject.cmd === 'setlivelogging') 
           {       
           if (!QUIET) console.log( "decodedobject.value : " + decodedobject.value);
           
           if (decodedobject.value == 'on')
              masterbot_class_obj.setlivelogging = true; else
              masterbot_class_obj.setlivelogging = false;                       
           } else


        if (decodedobject.cmd === 'quit') 
           {       
           if (!QUIET) console.log("Shutdown cluster_sim (by Debug-Frontend)")
           masterbot_class_obj.close_blender_logging();           
           process.exit(0);        
           } else


        if (decodedobject.cmd === 'getclusterdata') 
           {       
           let jsondata = masterbot_class_obj.getclusterdata_json();
           
           try {
               let jsonObject = JSON.parse(jsondata);
               
               let jsonString = JSON.stringify(jsonObject);
               
               let masterbot_name = "data...";
               answer = "{ \"answer\":\"answer_getclusterdata\" , \"jsondata\": " +jsonString+ "    }"; 
               

               ws.send(answer);             
               } catch (error) 
                 {
                 console.error("Error parsing JSON:", error);
                 }
           
               
           } else
             {
             if (!QUIET) console.log("Unknown command");
             }
    
    
        counter++;  
        } catch (error) {
                        console.error("Error parsing JSON:", error);
                        }
 
 
    

  });
});

httpserver.listen(3020, () => 
{
 
if (!QUIET) console.log('Server (webguisim) is running on http://localhost:3020');

});



main();


