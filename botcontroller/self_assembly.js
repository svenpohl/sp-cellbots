/**
 * @file        self_assenbly.js
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
const readline = require('readline');


class self_assembly 
{

constructor ()
{

//this.running = 0;
this.assembly_status    = 0;
this.sequencelist       = [];
this.sequenceindex      = 0; 


this.parsed     = [];               
this.signals    = new Set();    // received signals (e.g. by addSignal)
this.blockState = [];           // reminds current index of each block (e.g. how much proceeded)


} // constructor ( baseclass )



addsignal ( caller, signal )
{
  
  this.signals.add(signal);
  
if ( signal == "FIN" ) 
   {
   // console.log("Finish Morph Process!");
   caller.notify_frontend_console("Finish morph process!");
   this.assembly_status = 0;
   
   // Notify caller that the morph sequence has finished (all ACKs received)
   // This allows the botcontroller to persist final positions/orientations from morphLog
   if (typeof caller.onMorphSequenceFinished === "function")
      {
      caller.onMorphSequenceFinished();
      }
   }
   
} // addsignal ( signal )


//
// run_sequence()
//
async run_sequence( filename )
{

this.assembly_status    = 0;
this.sequencelist       = [];
this.sequenceindex      = 0; 

// important (!) - reset for next morph-cycld
this.parsed     = [];               
this.signals    = new Set();    // received signals (e.g. by addSignal)
this.blockState = [];           // reminds current index of each block (e.g. how much proceeded)



let filepath =  __dirname + '/sequences/' + filename  + '.sequence';
const input = fs.readFileSync(filepath, 'utf-8');
let parsed = this.parseBlocks(input);
console.dir(this.parsed, { depth: null });

this.assembly_status = 1;
 
this.initBlocks(parsed); 

// Timeout-Handling
if (0) this.startCounter();
 
} // load()

 
initBlocks(parsed) {
  this.parsed = parsed;
  this.blockState = parsed.map(() => 0); // all blocks starts with index 0 
}



parseBlocks(input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const blocks = [];
  let currentBlock = null;
  let insideBlock = false;

  for (const line of lines) {
    if (line.startsWith('block')) {
      const parts = line.split(/\s+/);
      const signals = parts.slice(1); // skip the word "block"
      currentBlock = {
        signals: signals.length > 0 ? signals : [], // list of signals
        instructions: []
      };
    } else if (line === '{') {
      insideBlock = true;
    } else if (line === '}') {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = null;
      insideBlock = false;
    } else if (insideBlock && currentBlock) {
      // komplette Zeile als eine Anweisung speichern
      currentBlock.instructions.push(line);
    }
  }

return blocks;
}




pop_cmd() {
  for (let b = 0; b < this.parsed.length; b++) {
    const block = this.parsed[b];
    const currentIndex = this.blockState[b];


    // Skip block if all commands handled
    if (currentIndex >= block.instructions.length) continue;

    // activate block is no signal or all filled
    const isReady = block.signals.length === 0 || block.signals.every(sig => this.signals.has(sig));
    if (!isReady) continue;

    // get next instruction
    const instr = block.instructions[currentIndex];
    this.blockState[b]++; // increment index
    return instr;
  }

  return undefined; // nothing elste to do
}



isFinished() {
  for (let b = 0; b < this.parsed.length; b++) {
    const block = this.parsed[b];
    const currentIndex = this.blockState[b];

    const isReady = block.signals.length === 0 || block.signals.every(sig => this.signals.has(sig));
    const hasMore = currentIndex < block.instructions.length;

    if (isReady && hasMore) {
      return false; // something to do in active block
    }
  }
  
  //console.log("isFinished - set assembly_status = 0")
  this.assembly_status    = 0;
  return true; // finished
}


 

//
// Sequences
//


startCounter() {
  let count = 1;
  const interval = setInterval(() => {
    console.log(count);
    if (count >= 5) 
       {
       
       // startCounter: set assembly_status = 0");
       this.assembly_status = 0;
       clearInterval(interval);
       
       }
    count++;
  }, 1000);
} // startCounter()

 



sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
 
 
// 
// Thread Sequence 
//
async thread_sequence() 
{
let delayms = 1000;
let busy    = false;
  
const intervalId =  setInterval( async () => 
  {
  if (busy) return; // alten Durchlauf noch abwarten
  
  // console.log("step thread");
  
  delayms = 4000;
           

  }, delayms);
 
} // thread_sequence()


     


} // class self_assembly 

module.exports = self_assembly;

