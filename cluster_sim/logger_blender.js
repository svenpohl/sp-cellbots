//
// logger_blender.js — Sven Pohl <sven.pohl@zen-systems.de> — MIT License © 2025
//

const fs = require('fs');
const path = require('path');

class LoggerBlender {
static logFile = path.join(__dirname, 'logs/blender.txt');
  
static enabled = true;
 
  
static setEnabled(flag) {
   if (typeof flag === 'string') 
      {
      this.enabled = (flag.trim().toLowerCase() === 'true');
      } else {
             this.enabled = !!flag;
             }
} // setEnabled()
  
  
  
static open()
{
if (!this.enabled) return;

this.reset();

this.eventcounter = 0;

const entry = `[ \n`;
fs.appendFileSync(this.logFile, entry);
} // init



static event_addbot( botid, pos, dir, color )
{

if (!this.enabled) return;



if (this.eventcounter > 0)
   {
   let entry = `, \n`;
   fs.appendFileSync(this.logFile, entry);
   }
 
 
  let pos_int = {
    x: parseInt(pos.x, 10),
    y: parseInt(pos.y, 10),
    z: parseInt(pos.z, 10)
  };
  let dir_int = {
    vx: parseInt(dir.vx, 10),
    vy: parseInt(dir.vy, 10),
    vz: parseInt(dir.vz, 10)
  };

  let addbot_event = {
    "event": "addbot",
    "botid": botid,
    "pos": pos_int,
    "dir": dir_int,
    "ts": 0,
    "color": color
  };
   
 

let entry =  JSON.stringify(addbot_event) + "\n" ;
fs.appendFileSync(this.logFile, entry);
   
   


this.eventcounter++;
} // event_addbot()





static event_log( event )
{
if (!this.enabled) return;


if (this.eventcounter > 0)
   {
   let entry = `, \n`;
   fs.appendFileSync(this.logFile, entry);
   }
 
 

let entry =  JSON.stringify(event) + "\n" ;
fs.appendFileSync(this.logFile, entry);
   
   
 
this.eventcounter++;
} // event_log()


static close()
{
if (!this.enabled) return;


const entry = `] \n`;
fs.appendFileSync(this.logFile, entry);

} // init


 
  
  
  static reset() {
  if (!this.enabled) return;

  fs.writeFileSync(this.logFile, ''); // leert die Datei
  }

  
} // class LoggerBlender

module.exports = LoggerBlender;

