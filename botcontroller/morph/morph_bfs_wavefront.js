/**
 * MorphBFSWavefront
 * -----------------
 * Advanced BFS-based morphing algorithm for programmable matter / cellbot cluster transformation.
 *
 * This module contains all core logic, helper functions, and data structures needed
 * to plan and execute the morphing process from an initial cluster state to a target configuration.
 * 
 * Structure:
 *   - All functions are included in this single file for maximum transparency and experimental flexibility.
 *   - No visualization code is included; this file is focused purely on the algorithmic side.
 *   - Designed for laboratory use, rapid prototyping, and further AI integration.
 *
 * Main features:
 *   - Fully self-contained class with start/target injection
 *   - Step-wise or batch morphing (run/step)
 *   - Progress tracking and logging (morphLog)
 *   - All cluster and pathfinding helpers included as private methods
 *   - Ready for future refactoring or modularization if needed
 *
 * Author: Sven Pohl
 * Date: [2025-06-17]
 * Version: [v1.2]
 */

const MorphBase = require('./morph_base');
const fs = require('fs');
const path = require('path');
class MorphBFSWavefront extends MorphBase 
{




//
// MOVEMENT_RULES defines all valid movement types for bots during BFS pathfinding.
// Each rule contains a name and a list of steps with movement vectors (dx, dy, dz)
// and logical conditions as strings to be evaluated at runtime.
// Used by getAllowedMoves3D() and the morph algorithm for path planning.
//
static MOVEMENT_RULES = [ 
{
  name: "G_F",
  steps: [
    {
      dx: +1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)', // Target has to be empty
        'has_contact(x,y,z)',
        'is_bot(originX+1, originY+1, originZ) || is_bot(originX+1, originY-1, originZ) || is_bot(originX+1, originY, originZ+1) || is_bot(originX+1, originY, originZ-1)'
      ]
    }
  ]
},

{
  name: "G_R",
  steps: [
    {
      dx: 0, dy: 0, dz: -1,
      conditions: [
        'is_empty(x,y,z)',
        'has_contact(x,y,z)',
        'is_bot(originX+1, originY, originZ-1) || is_bot(originX-1, originY, originZ-1) || is_bot(originX, originY+1, originZ-1) || is_bot(originX, originY-1, originZ-1)'
      ]
    }
  ]
}
,

{
  name: "G_B",
  steps: [
    {
      dx: -1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)',
        'has_contact(x,y,z)',
        'is_bot(originX-1, originY+1, originZ) || is_bot(originX-1, originY-1, originZ) || is_bot(originX-1, originY, originZ+1) || is_bot(originX-1, originY, originZ-1)'
      ]
    }
  ]
}
,

{
  name: "G_L",
  steps: [
    {
      dx: 0, dy: 0, dz: +1,
      conditions: [
        'is_empty(x,y,z)',
        'has_contact(x,y,z)',
        'is_bot(originX+1, originY, originZ+1) || is_bot(originX-1, originY, originZ+1) || is_bot(originX, originY+1, originZ+1) || is_bot(originX, originY-1, originZ+1)'
      ]
    }
  ]
}

,

{
  name: "G_T",
  steps: [
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',
        'has_contact(x,y,z)',
        'is_bot(originX+1, originY+1, originZ) || is_bot(originX-1, originY+1, originZ) || is_bot(originX, originY+1, originZ+1) || is_bot(originX, originY+1, originZ-1)'
      ]
    }
  ]
}

,

{
  name: "G_D",
  steps: [
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',
        'has_contact(x,y,z)',
        'is_bot(originX+1, originY-1, originZ) || is_bot(originX-1, originY-1, originZ) || is_bot(originX, originY-1, originZ+1) || is_bot(originX, originY-1, originZ-1)'
      ]
    }
  ]
}

,


{
  name: "K_TF",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX+1, originY, originZ)'  
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: +1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)',       
        'has_contact(x,y,z)'    
      ]
    }
  ]
}

,

{
  name: "K_TB",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX-1, originY, originZ)'  
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: -1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)',       
        'has_contact(x,y,z)'    
      ]
    }
  ]
}
,

{
  name: "K_DF",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX+1, originY, originZ)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: +1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'    
      ]
    }
  ]
}
,

{
  name: "K_DB",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX-1, originY, originZ)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: -1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'    
      ]
    }
  ]
}
,

{
  name: "K_BT",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY+1, originZ)'  
      ]
    },
    {
      dx: -1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',
        'has_contact(x,y,z)'  
      ]
    }
  ]
}

,

{
  name: "K_BD",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY-1, originZ)'  
      ]
    },
    {
      dx: -1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)' 
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'   
      ]
    }
  ]
}
,


{
  name: "K_FT",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY+1, originZ)'  
      ]
    },
    {
      dx: +1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)' 
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',     
        'has_contact(x,y,z)'   
      ]
    }
  ]
}

,


{
  name: "K_FD",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY-1, originZ)'  
      ]
    },
    {
      dx: +1, dy: 0, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'   
      ]
    }
  ]
}

,

{
  name: "K_TR",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY, originZ-1)'  
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: -1,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'    
      ]
    }
  ]
}


,

{
  name: "K_TL",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY, originZ+1)'  
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: +1,
      conditions: [
        'is_empty(x,y,z)',     
        'has_contact(x,y,z)'    
      ]
    }
  ]
}

,

{
  name: "K_DR",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY, originZ-1)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: -1,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'   
      ]
    }
  ]
}
,

{
  name: "K_DL",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY, originZ+1)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)' 
      ]
    },
    {
      dx: 0, dy: 0, dz: +1,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'   
      ]
    }
  ]
}


,

{
  name: "K_LT",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY+1, originZ)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: +1,
      conditions: [
        'is_empty(x,y,z)' 
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'   
      ]
    }
  ]
}
,


{
  name: "K_LD",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY-1, originZ)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: +1,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'    
      ]
    }
  ]
}
,

{
  name: "K_RT",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY+1, originZ)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: -1,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: +1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'    
      ]
    }
  ]
}
,

{
  name: "K_RD",
  steps: [
    {
      dx: 0, dy: 0, dz: 0,
      conditions: [
        'is_bot(originX, originY-1, originZ)'  
      ]
    },
    {
      dx: 0, dy: 0, dz: -1,
      conditions: [
        'is_empty(x,y,z)'  
      ]
    },
    {
      dx: 0, dy: -1, dz: 0,
      conditions: [
        'is_empty(x,y,z)',      
        'has_contact(x,y,z)'    
      ]
    }
  ]
}




]; // MOVEMENT_RULES





constructor(startBots, targetBots, params) 
    {
    super(startBots, targetBots, params);   
     
    
    this.DEBUG = true;
    this.LOGLEVEL = 0; // 0=off, 1=error, 2=info, 3=verbose
 
    this.progress = 0;
    
    this.cells          = startBots;
    this.cluster_target = targetBots;
    
    
    this.bot_id = null;     // ID of the currently moving bot (e.g. "id_7")    
    this.bot_start = null;  // Position {x, y, z} of the start (for debug/visual)
    this.bot_target = null; // Target coordinate {x, y, z}
    this.plannedCells = null;
    this.wavepaths = [];
    this.grid_size = params.grid_size;

    if ( params.masterbot !== undefined )
       {
       this.MASTER_BOT_POSITION = params.masterbot;
       } else
         {
         this.MASTER_BOT_POSITION = { x: 0, y: 0, z: 0 };
         }

    // Immobile obstacles (e.g. hMBs) that must be avoided by the path planner
    this.forbiddenCells = Array.isArray(params.forbiddenCells) ? params.forbiddenCells : [];

    // Anchors: hMBs/MBs as static connection nodes for wouldSplitCluster.
    // These bots are not in this.cells (they are not moved), but they
    // are considered essential nodes in BFS so that the morph does not
    // disconnect them from the cluster.
    this.anchors = [];
    if (params.anchors !== undefined && Array.isArray(params.anchors))
       {
       this.anchors = params.anchors;
       }
    
    // Log object for morphing process: stores initial bot setup (optional) and all morphing waves
    this.morphLog =  
       {
       bots: [],    // optional, e.g. from your initCells
       waves: []
       };


    // 'cells' with Startbots
    this.morphLog.bots = Object.values(this.cells).map(bot => (
       {
       id: bot.id,
       x: bot.x,
       y: bot.y,
       z: bot.z
       }));

    // Target Bots
    this.morphLog.targets = Object.values(this.cluster_target).map(bot => (
       {
       id: bot.id,
       x: bot.x,
       y: bot.y,
       z: bot.z
       }));
       
     
    
    
       
    // Define a constant for the maximum number of paths per wave

    // Default value:
    this.MAX_PATHS_IN_WAVE = 15;
    if (params.max_paths_in_wave !== undefined) 
       {
       this.MAX_PATHS_IN_WAVE = params.max_paths_in_wave;
       }
   
    this.MAX_ATTEMPTS_TO_FIND_PAIR = 25;
    if (params.max_attempts_to_find_pair !== undefined) 
       {
       this.MAX_ATTEMPTS_TO_FIND_PAIR = params.max_attempts_to_find_pair;
       }   
    
    // Max attempts to find a new, untried pair – 10-30 is usually sufficient!
    this.wavecnt = 0;
       
    // Valid path log file - cleared on each new morph run
    // Contains ONLY paths verified by planPath3D() during stepMorph()
    this.validPathLogPath = path.join(__dirname, 'morph_full_edge_validpath.log');
    fs.writeFileSync(this.validPathLogPath, '', 'utf8');
       
       

    

 
    this.log("Construct wavefront");    
    } // constructor()
    
    
    
log (msg, level = 2) 
        {
        if (this.DEBUG && level <= this.LOGLEVEL) console.log(msg);
        }      
    
 


//
// Returns an array of all bot objects in the given collection,
// accepting both arrays and object-maps as input.
// Useful for unified iteration over bots regardless of storage format.
//
getAllBots(collection = this.cells) 
{
console.assert(collection !== undefined, "Collection ist undefined!");
return Array.isArray(collection) ? collection : Object.values(collection);
}






//
// Returns true if the position (x, y, z) matches any target position in the goal cluster.
// Used to check if a bot is already at its intended goal (i.e., is "happy").
//
isHappy(x, y, z) 
{
return this.getAllBots(this.cluster_target).some(t => t.x === x && t.y === y && t.z === z);
}

isTargetCovered(target, bots) {
  // true, if any bot sits exactly on target
  return bots.some(b => b.x === target.x && b.y === target.y && b.z === target.z);
}



//
// Returns true if all target positions in bot_target_param are occupied
// by a bot in the current collection. Used to check if the morphing process is complete.
//
areAllBotsHappy(bot_target_param, collection = this.cells) 
{
    console.assert(collection !== undefined, "Collection is undefined!");
    const bots = Object.values(collection);

    for (const target of bot_target_param) 
    {
        const found = bots.some(bot =>
            bot.x === target.x &&
            bot.y === target.y &&
            bot.z === target.z
        );

        if (!found) {
            //this.log(`⏳ Target not yet occupied: (${target.x}, ${target.y}, ${target.z})`);
            return false;
        }
    }

    //this.log("✅ All target positions are correctly occupied!");
    return true;
} // areAllBotsHappy





//
// Returns a list of all bots from 'collection' that are NOT on any target position in 'bot_target_param'.
// Debug purposes?
//
getUnhappyBots(bot_target_param, collection = this.cells) 
{
    console.assert(collection !== undefined, "Collection is undefined!");
    const bots = Object.values(collection);

    // An unhappy bot is a bot that is NOT on any target coordinate:
    return bots.filter(bot => {
        return !bot_target_param.some(target =>
            bot.x === target.x &&
            bot.y === target.y &&
            bot.z === target.z
        );
    });
}





//
// Returns the ID (key) of the bot at the given start position in the collection.
// The position is given as an array [x, y, z]. Returns e.g. "id_2" or null if not found.
//
get_bot_id(bot_start, collection = this.cells) {
  console.assert(collection !== undefined, "Collection is undefined!");

  const foundEntry = Object.entries(collection).find(([id, bot]) =>
    bot.x === bot_start[0] &&
    bot.y === bot_start[1] &&
    bot.z === bot_start[2]
  );

  return foundEntry ? foundEntry[0] : null; // e.g., returns "id_2"
} // get_bot_id


 

//
// Returns the bot object at the given (x, y, z) position from the collection,
// or null if not found.
//
getBotByPos(x, y, z, collection = this.cells) {
  console.assert(collection !== undefined, "Collection is undefined!");
  const bots = this.getAllBots(collection);
  return bots.find(b => b.x === x && b.y === y && b.z === z) || null;
}






//
// Checks if the position (x, y, z) is adjacent to any bot in the collection (direct neighbor contact).
// Optionally excludes a specific position (excludeX, excludeY, excludeZ) from being considered.
//
hasContact(x, y, z, collection = this.cells, excludeX = null, excludeY = null, excludeZ = null) {
  const neighborOffsets = [
    [ 0,  1,  0], // up
    [ 0, -1,  0], // down
    [-1,  0,  0], // left
    [ 1,  0,  0], // right
    [ 0,  0,  1], // front
    [ 0,  0, -1]  // back
  ];

  return this.getAllBots(collection).some(cell => {
    if (
      excludeX !== null && cell.x === excludeX &&
      cell.y === excludeY && cell.z === excludeZ
    ) return false;

    return neighborOffsets.some(([dx, dy, dz]) =>
      cell.x === x + dx && cell.y === y + dy && cell.z === z + dz
    );
  });
}




//
// Checks if the position (x, y, z) is adjacent (Manhattan distance 1) to any bot in the collection.
// Used to test for direct cluster contact.
//
hasClusterContact(x, y, z, collection = this.cells) {
  return Object.values(collection).some(bot =>
    Math.abs(bot.x - x) + Math.abs(bot.y - y) + Math.abs(bot.z - z) === 1
  );
}



//
// Returns true if the position (x, y, z) is not occupied by any bot in the collection
// and not blocked by a forbidden cell (e.g. immobile hMBs).
//
isFree(x, y, z, collection = this.cells) {
  if (collection.some(c => c.x === x && c.y === y && c.z === z))
     return false;
  if (this.forbiddenCells.some(c => c.x === x && c.y === y && c.z === z))
     return false;
  return true;
}

 

 
//
// Checks if removing the given bot would split the cluster into separate parts.
// Returns true if the cluster would be disconnected, otherwise false.
// Uses BFS starting from the master bot to see if all other bots remain connected.
// 
// @param {Object} bot - The bot to test removal for (should have .id, .x, .y, .z)
// @param {Object} collection - Bot collection (default: global 'cells')
// @returns {boolean} - True if removal would split the cluster, false otherwise
//
wouldSplitCluster(bot, collection = this.cells) {
    if (!bot.id) {
        console.warn("❗ Bot without ID:", bot);
    }

    // Get all bots except the one to be (temporarily) removed
    const bots = this.getAllBots(collection).filter(b => b.id !== bot.id);

    // Add anchors (hMBs) as static nodes for BFS check.
    // Anchors are immobile but essential for cluster connectivity.
    const anchors = this.anchors || [];
    for (const a of anchors) {
        // Only add if not already present (by position)
        const exists = bots.some(b => Number(b.x) === Number(a.x) && Number(b.y) === Number(a.y) && Number(b.z) === Number(a.z));
        if (!exists) {
            bots.push({
                id: `anchor_${a.x}_${a.y}_${a.z}`,
                x: Number(a.x), y: Number(a.y), z: Number(a.z)
            });
        }
    }

    if (bots.length === 0) {
        // Only the master bot left, cannot split
        return false;
    }

    // Function to generate unique coordinate key
    const key = (b) => `${b.x},${b.y},${b.z}`;

    // Find the master bot (the cluster's anchor, usually at a fixed position)
    const master = this.getAllBots(collection).find(b =>
        b.x === this.MASTER_BOT_POSITION.x &&
        b.y === this.MASTER_BOT_POSITION.y &&
        b.z === this.MASTER_BOT_POSITION.z
    );

    if (!master) {
        // If no master bot in collection, try to use the first anchor at MASTER_BOT_POSITION
        const anchorMaster = anchors.find(a =>
            Number(a.x) === this.MASTER_BOT_POSITION.x &&
            Number(a.y) === this.MASTER_BOT_POSITION.y &&
            Number(a.z) === this.MASTER_BOT_POSITION.z
        );
        if (anchorMaster) {
            bots.push({
                id: `anchor_master`,
                x: Number(anchorMaster.x),
                y: Number(anchorMaster.y),
                z: Number(anchorMaster.z)
            });
        } else {
            console.warn("wouldSplitCluster: No master bot or anchor at MASTER_BOT_POSITION!");
            return true;
        }
        // Re-find master now that we added it
        const master2 = bots.find(b =>
            b.x === this.MASTER_BOT_POSITION.x &&
            b.y === this.MASTER_BOT_POSITION.y &&
            b.z === this.MASTER_BOT_POSITION.z
        );
        if (!master2) return true;
        
        // BFS from the (re-found) master bot
        const visited2 = new Set();
        const queue2 = [];
        visited2.add(key(master2));
        queue2.push(master2);

        while (queue2.length > 0) {
            const current = queue2.shift();
            for (const nb of bots) {
                if (visited2.has(key(nb))) continue;
                const dx = Math.abs(current.x - nb.x);
                const dy = Math.abs(current.y - nb.y);
                const dz = Math.abs(current.z - nb.z);
                const dist = dx + dy + dz;
                if (dist === 1) {
                    visited2.add(key(nb));
                    queue2.push(nb);
                }
            }
        }

        const allKeys2 = new Set(bots.map(b => key(b)));
        return [...allKeys2].some(k => !visited2.has(k));
    }

    // BFS from the master bot to see which bots are still connected
    const visited = new Set();
    const queue = [];
    visited.add(key(master));
    queue.push(master);

    while (queue.length > 0) {
        const current = queue.shift();
        for (const nb of bots) {
            if (visited.has(key(nb))) continue;
            const dx = Math.abs(current.x - nb.x);
            const dy = Math.abs(current.y - nb.y);
            const dz = Math.abs(current.z - nb.z);
            const dist = dx + dy + dz;
            if (dist === 1) { // Only orthogonal neighbors
                visited.add(key(nb));
                queue.push(nb);
            }
        }
    }

    // After BFS: check if all remaining bots were visited (= connected)
    const allKeys = new Set(bots.map(b => key(b)));
    const isSplit = [...allKeys].some(k => !visited.has(k));

    return isSplit;
} // wouldSplitCluster


//
// countOrthogonalNeighbors
// Counts how many of the 6 orthogonal positions around (x, y, z) are occupied
// by bots in the given collection.
//
// Used to determine if a target is "deep inside" the cluster (many neighbors),
// which means it should be filled first to prevent blocking inner positions.
//
// @param {number} x - X coordinate
// @param {number} y - Y coordinate
// @param {number} z - Z coordinate
// @param {Array|Object} collection - Bot collection
// @returns {number} - Number of occupied orthogonal neighbors (0-6)
//
countOrthogonalNeighbors(x, y, z, collection = this.cells)
{
    let count = 0;
    const directions = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 }
    ];

    for (const dir of directions) {
        const nx = x + dir.x;
        const ny = y + dir.y;
        const nz = z + dir.z;
        if (this.getAllBots(collection).some(b => b.x === nx && b.y === ny && b.z === nz)) {
            count++;
        }
    }
    return count;
} // countOrthogonalNeighbors


 




//
// choosePair selects a suitable bot–target pair for morphing.
// 
// The function works as follows:
// 1. Finds all "unhappy" bots (bots that have not reached their target).
// 2. Finds all available target positions in the target cluster that are not already occupied and have contact with the current cluster.
// 3. For each unhappy bot, computes the minimum distance to any free target.
// 4. Selects the top N bots (default: 4) with the greatest minimum distance to a target.
// 5. For each of these top bots, checks all possible target positions for validity (cluster integrity, contact, not previously attempted/reserved).
// 6. Among all valid pairs, selects the one with the largest distance (or applies a different selection criterion if needed).
// 7. Sets the chosen bot and target; if no valid pair is found, resets the selection.
//
choosePair(collection = this.cells, attemptedPairs = new Set(), reservedTargets = new Set()) {
  // 1. Find all unhappy bots (not at master position and not already at their target)
  //    Exclude inactive and immobile bots (they stay in the grid but cannot be donors)
  const unhappyBots = this.getAllBots(collection).filter(bot =>
    !(bot.x === this.MASTER_BOT_POSITION.x &&
      bot.y === this.MASTER_BOT_POSITION.y &&
      bot.z === this.MASTER_BOT_POSITION.z) &&
    !this.isHappy(bot.x, bot.y, bot.z) &&
    bot.inactive !== true &&
    bot.mobility !== false
  );

  // 2. Find all free targets (positions in cluster_target not already occupied, with cluster contact)
  let freeTargets = this.getAllBots(this.cluster_target).filter(t =>
    !this.getAllBots(collection).some(b => b.x === t.x && b.y === t.y && b.z === t.z) &&
    this.hasContact(t.x, t.y, t.z, collection)
  );

  // 2b. Sort free targets by neighbor count (descending) - "backfill" heuristic.
  //     Targets with the most orthogonal neighbors are filled first.
  //     This prevents blocking the entrance to inner positions by filling
  //     the "deepest" positions first (most surrounded by existing bots).
  freeTargets.sort((a, b) => {
    const neighborsA = this.countOrthogonalNeighbors(a.x, a.y, a.z, collection);
    const neighborsB = this.countOrthogonalNeighbors(b.x, b.y, b.z, collection);
    return neighborsB - neighborsA; // most neighbors first
  });

  // 3. For each bot, compute the minimum distance to any free target
  let botCandidates = unhappyBots.map(bot => {
    let minDist = Infinity;
    let bestTarget = null;
    for (const t of freeTargets) {
      const d = Math.sqrt(
        (bot.x - t.x) ** 2 +
        (bot.y - t.y) ** 2 +
        (bot.z - t.z) ** 2
      );
      if (d < minDist) {
        minDist = d;
        bestTarget = t;
      }
    }
    return { bot, minDist, bestTarget };
  });

  // 4. Sort: Reserve-Bots (R*) first, then by greatest distance
  //    (analogous to vehicle_kinematics choosePair)
  botCandidates.sort((a, b) => {
    const aIsReserve = String(a.bot.id ?? "").startsWith("R");
    const bIsReserve = String(b.bot.id ?? "").startsWith("R");
    if (aIsReserve && !bIsReserve) return -1; // R* bots first
    if (!aIsReserve && bIsReserve) return 1;
    return b.minDist - a.minDist; // then by greatest distance
  });

  // 5. Iterate through ALL candidates (not just top 4) to find valid bot-target pairs.
  //    The sorting ensures Reserve-Bots and bots with greatest distance are checked first.
  //    We stop as soon as we find the first valid pair (which is the best one due to sorting).
  //    (analogous to vehicle_kinematics choosePair)
  let selectedPair = null;
  for (const candidate of botCandidates) {
    const bot = candidate.bot;
    if (selectedPair) break; // Found a valid pair, stop searching

    for (const target of freeTargets) {
      if (selectedPair) break;

      const pairId = `${bot.x},${bot.y},${bot.z}-${target.x},${target.y},${target.z}`;
      if (attemptedPairs.has(pairId)) continue;
      const targetCoordString = `${target.x},${target.y},${target.z}`;
      if (reservedTargets.has(targetCoordString)) continue;
      if (
        !this.wouldSplitCluster(bot, collection) &&
        this.hasContact(target.x, target.y, target.z, collection, bot.x, bot.y, bot.z)
      ) {
        const dist = Math.sqrt(
          (bot.x - target.x) ** 2 +
          (bot.y - target.y) ** 2 +
          (bot.z - target.z) ** 2
        );
        selectedPair = { bot, target, dist };
        break; // Found a valid pair for this bot, stop checking more targets
      }
    }
  }

  // 6. Use the selected pair (first valid one found, which is the best due to sorting)
  //    (analogous to vehicle_kinematics choosePair)
  if (selectedPair) {
    const { bot, target, dist } = selectedPair;
    this.bot_id = bot.id;
    this.bot_start = { x: bot.x, y: bot.y, z: bot.z };
    this.bot_target = { x: target.x, y: target.y, z: target.z };
  } else {
    this.bot_id = null;
    this.bot_start = null;
    this.bot_target = null;
  }
} // choosePair

 
 


//
// Evaluates a logical expression (as string) with respect to a given 3D context and collection of bots.
// Provides helper functions for expression: is_bot, is_empty, has_contact, has_lateral_anchor.
// Used to check complex movement conditions in the rule engine.
//
// @param {string} expr - The logical expression to evaluate.
// @param {Object} context - The coordinate context {x, y, z, originX, originY, originZ}.
// @param {Object} collection - The current collection of bots (default: cells).
// @returns {boolean} - Result of the logical expression.
//
evaluateCondition(expr, context, collection = this.cells) {
  const { x, y, z, originX, originY, originZ } = context;

  const bots = this.getAllBots(collection);
/*
  const is_bot = (x, y, z) => this.isInside(x, y, z) && bots.some(b => b.x === x && b.y === y && b.z === z);
  const is_empty = (x, y, z) => this.isInside(x, y, z) && !bots.some(b => b.x === x && b.y === y && b.z === z);
  const has_contact = (x, y, z) => this.hasContact(x, y, z, collection, originX, originY, originZ);
*/
  const is_forbidden = (x, y, z) => this.forbiddenCells.some(c => c.x === x && c.y === y && c.z === z);
  const is_bot = (x, y, z) =>  bots.some(b => b.x === x && b.y === y && b.z === z);
  const is_empty = (x, y, z) =>  !bots.some(b => b.x === x && b.y === y && b.z === z) && !is_forbidden(x, y, z);
  const has_contact = (x, y, z) => this.hasContact(x, y, z, collection, originX, originY, originZ);

  // optional: for more complex climbing conditions in the future
  const has_lateral_anchor = (x, y, z) =>
    is_bot(x, y - 1, z) || is_bot(x, y + 1, z) || is_bot(x - 1, y, z) || is_bot(x + 1, y, z);

  return Function(
    "x", "y", "z", "originX", "originY", "originZ",
    "is_bot", "is_empty", "has_contact", "has_lateral_anchor",
    `return (${expr});`
  )(x, y, z, originX, originY, originZ, is_bot, is_empty, has_contact, has_lateral_anchor);
}







 //
 // Returns a list of all valid moves from a given (startX, startY, startZ) position,
 // according to the MOVEMENT_RULES and the current collection state.
 // Each move is checked against rule-specific conditions.
 // Used by the morph algorithm for generating possible next steps in pathfinding.
 //
getAllowedMoves3D(startX, startY, startZ, collection = this.cells) {
  const allowed = [];
  
  if (collection === undefined || collection === null) {
    console.warn("getAllowedMoves3D: collection missing!", startX, startY, startZ);
  } else {
         //this.log("getAllowedMoves3D: collection provided!", startX, startY, startZ);
         }

  for (const rule of this.constructor.MOVEMENT_RULES) {
    let cx = startX;
    let cy = startY;
    let cz = startZ;
    let valid = true;
    let path = [];

    for (const step of rule.steps) {
      const nx = cx + (step.dx || 0);
      const ny = cy + (step.dy || 0);
      const nz = cz + (step.dz || 0);

      // Check conditions
      for (const cond of step.conditions) {
        const ok = this.evaluateCondition(cond, {
          x: nx,
          y: ny,
          z: nz,
          originX: startX,
          originY: startY,
          originZ: startZ
        }, collection);

        if (!ok) {
          valid = false;
          break;
        }
      }

      if (!valid) break;

      // Only log actual moves
      if (step.dx !== 0 || step.dy !== 0 || step.dz !== 0) {
        path.push([nx, ny, nz]);
      }

      // Update position
      cx = nx;
      cy = ny;
      cz = nz;
    }

    if (valid) {
      allowed.push({ typ: rule.name, path });
    }
  }

  return allowed;
} // getAllowedMoves3D





//
// planPath3D - Finds a valid 3D path for a bot from start to goal using BFS.
// @param {Object} start - {x, y, z} Start position
// @param {Object} goal - {x, y, z} Goal position
// @param {Object} botCollection - All current bot positions
// @returns {Array|null} - Array of [x, y, z] steps, or null if no path found
//
planPath3D(start, goal, botCollection = this.plannedCells) {

  const queue = [];
  const bestPathLength = new Map();
  const deadEnds = new Set();  
  let lastTriedPath = null;

  queue.push({ x: start.x, y: start.y, z: start.z, path: [ [start.x, start.y, start.z] ] });
  bestPathLength.set(`${start.x},${start.y},${start.z}`, 0);

  while (queue.length > 0) 
  {
    const current = queue.shift();
    lastTriedPath = current.path;

    if (current.x === goal.x && current.y === goal.y && current.z === goal.z) {
      return current.path;
    }

    const allowed = this.getAllowedMoves3D(current.x, current.y, current.z, botCollection);

    if (allowed.length === 0) {
      // console.warn(`⛔ No allowed moves from (${current.x},${current.y},${current.z})`);
    } else {
      //this.log(`✅ Allowed moves from (${current.x},${current.y},${current.z}):`);
      allowed.forEach(m => {
        const [lx, ly, lz] = m.path[m.path.length - 1];
        //this.log(`→ ${m.typ} → (${lx},${ly},${lz})`);
      });
    }

    for (const move of allowed) {
      if (!move.path || move.path.length === 0) {
        //   console.warn("⚠️ Invalid move without path:", move);
        continue;
      }

      const coords = move.path;
      const [lastX, lastY, lastZ] = coords[coords.length - 1];
      const key = `${lastX},${lastY},${lastZ}`;
      
      if (lastX === goal.x && lastY === goal.y && lastZ === goal.z) 
      {
        return [...current.path, ...coords];
      }

      // 🚫 If position is already known as dead end → skip
      if (deadEnds.has(key)) {
        //this.log(`⛔ Target is in dead end: (${key}) → Move discarded`);
        continue;
      }

      const newPath = [...current.path, ...coords];
      const newLength = newPath.length;

      if (!bestPathLength.has(key) || newLength < bestPathLength.get(key)) {
        bestPathLength.set(key, newLength);
        queue.push({
          x: lastX,
          y: lastY,
          z: lastZ,
          path: newPath
        });
        // Optional: draw_path(newPath, "rgba(0,255,0,0.2)");
      }
    }

    // console.warn("🧱 Last position with no way out:", current.x, current.y, current.z);
    // console.warn("🪤 Goal was never reached:", goal.x, goal.y, goal.z);
  } // while (queue.length > 0) 
  

  // ❌ No path found → last position becomes dead end
  if (lastTriedPath && lastTriedPath.length > 0) {
    const [lx, ly, lz] = lastTriedPath[lastTriedPath.length - 1];
    const key = `${lx},${ly},${lz}`;
    deadEnds.add(key);
    //  console.warn(`🚫 Dead end registered: (${key})`);
  }

  // Show path for analysis
  //  console.warn("🔍 No valid path found.");
  if (lastTriedPath) {
    //  console.warn("🧩 Last tried path:");
    lastTriedPath.forEach(([x, y, z], i) => {
      //this.log(`  ${i}: (${x},${y},${z})`);
    });
  }

  return null;
} // planPath3D


 
 
 



//
// Registers the results of one morphing wave for export/logging.
// Stores, for each move in the wave, the bot id, start and end position, and optionally the full path.
//
registerMorphStepForExport(wavePaths, waveCount) {
  // For each wave, create a log object:
  let waveLog = {
    step: waveCount, 
    moves: []
  };

  wavePaths.forEach(wave => {
    let path = wave.path;
    let from = path[0];
    let to = path[path.length - 1];

    waveLog.moves.push({
      id: wave.botId,
      from: { x: from[0], y: from[1], z: from[2] },
      to: { x: to[0], y: to[1], z: to[2] },
      fullPath: path.map(([x, y, z]) => ({ x, y, z })) // full path (optional)
    });
  });

  this.morphLog.waves.push(waveLog);
}

  

//
// Sets the position of a bot with a given id in the botCollection.
// Throws an error if the bot is not found.
// Works for Array of bots (plannedCells)
//
set(id, x, y, z, botCollection = this.cells) {
    const bot = botCollection.find(bot => bot.id === id);
    if (!bot) {
        console.error(`Critical error: Bot with ID "${id}" not found in botCollection!`);
        console.trace();
        throw new Error(`set(): Bot with ID "${id}" not found!`);
    }
    bot.x = x;
    bot.y = y;
    bot.z = z;
}





//
// stepMorph()
//
stepMorph( caller, finishHandler ) {
 

    let wavepaths = []; // Initialize wavepaths locally
    // Create a deep copy of the current cell state for planning the wave.
    // This state is updated during path planning for the current wave.
    let plannedCells = JSON.parse(JSON.stringify( this.cells ));

    const plannedOccupiedCoordsSet = new Set(); // Holds the target coordinates of bots to be moved in this wave

    // Check if all bots are already at their target
    if (this.areAllBotsHappy(this.cluster_target, plannedCells)) {
        this.log("🎉 All bots are happy! Morphing complete.");

        
        // Finish and call external finishHandler()
        this.progress = 100;
        finishHandler( this.morphLog, true );
        

        return;
    }
    
    
    
    

    let collisionChecks = 0;

    // A set to store already attempted pairs (start-target),
    // to avoid infinite loops during selection or inefficient repetitions.
    const attemptedPairs = new Set();
    const reservedTargets = new Set();

    let pathsFoundInWave = 0;
    //const MAX_PATHS_IN_WAVE = 14; // Your constant
    let currentAttempt = 0; // Counts the attempts to find a pair, not the paths

    // *** MAIN LOOP FOR PATH PLANNING OF THE WAVE ***
while (pathsFoundInWave < this.MAX_PATHS_IN_WAVE && currentAttempt < this.MAX_ATTEMPTS_TO_FIND_PAIR) 
    {
        this.bot_start = null;
        this.bot_target = null;
        this.bot_id = null; // Make sure bot_id also comes from choosePair or is set globally

        this.choosePair(plannedCells, attemptedPairs, reservedTargets); // choosePair must set the global variables bot_start, bot_target, bot_id

        if (!this.bot_start || !this.bot_target) {
            this.log("No more pairs found. Aborting wave.");
            break;
        }

  

     currentAttempt++;  // Increment attempt counter



// Get the real bot from plannedCells
const realBot = this.getBotByPos(this.bot_start.x, this.bot_start.y, this.bot_start.z, plannedCells);
if (realBot && realBot.id !== undefined) {
    this.bot_start.id = realBot.id;
}

let skip = false;   // or: let error = false;
let reason = "";    // optional for logging

// Prevent self-contract, temporarily remove startbot
this.removeBotFromCellsById(this.bot_start.id, plannedCells);

if (!this.bot_start || !this.bot_target) 
{
    reason = "No more unhappy or plannable bot-target pairs";
    this.log("🚫", reason);
}

const pairId = `${this.bot_start.x},${this.bot_start.y},${this.bot_start.z}-${this.bot_target.x},${this.bot_target.y},${this.bot_target.z}`;
//this.log("Candidate:", pairId, "BotStart:", this.bot_start, "this.BotTarget:", this.bot_target);

// Pair already tested in this wave?
if (attemptedPairs.has(pairId)) 
{
    //  this.log(`DEBUG: stepMorph() - Pair ${pairId} already tested. Skip.`);
    skip = true; reason = "already attempted"; // instead of continue, as discussed!
}

const newPath = this.planPath3D(this.bot_start, this.bot_target, plannedCells);

if (!newPath) {
    skip = true; reason = "No path found";
    attemptedPairs.add(pairId);
}

if (skip) {
    this.addBotToCells(this.bot_start, plannedCells);
    continue;
}


 const [targetX, targetY, targetZ] = [this.bot_target.x, this.bot_target.y, this.bot_target.z];
const [lastX, lastY, lastZ] = newPath[newPath.length - 1];

if (lastX !== targetX || lastY !== targetY || lastZ !== targetZ) {
    skip = true;
    reason = `Path does not end at the target (${lastX},${lastY},${lastZ} ≠ ${targetX},${targetY},${targetZ})`;
    attemptedPairs.add(pairId);
}

if (!skip && !this.hasContact(targetX, targetY, targetZ, plannedCells)) {
    skip = true;
    reason = "No cluster contact";
    attemptedPairs.add(pairId);
}

let hasCollision = false;

// --- NEW: TARGET COLLISION CHECK ---
const [newPathTargetX, newPathTargetY, newPathTargetZ] = newPath[newPath.length - 1];
const newPathTargetCoordString = `${newPathTargetX},${newPathTargetY},${newPathTargetZ}`;





// === BEGIN Check for target and neighbor collisions ===
const [tx, ty, tz] = newPath[newPath.length - 1];
const neighborOffsets = [
    [0, 0, 0],   // target itself
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
];

if (!skip) {
    for (const [dx, dy, dz] of neighborOffsets) {
        const nx = tx + dx;
        const ny = ty + dy;
        const nz = tz + dz;
        const neighborCoordString = `${nx},${ny},${nz}`;
        if (plannedOccupiedCoordsSet.has(neighborCoordString)) {
            skip = true;
            reason = `Target or neighbor occupied: (${neighborCoordString})`;
            attemptedPairs.add(pairId);
            break;
        }
    }
}
// === END Check for target and neighbor collisions ===





if (plannedOccupiedCoordsSet.has(newPathTargetCoordString)) {
    //    console.warn("Collision: Target already reserved!", newPathTargetCoordString);
}



if (!skip) {
    for (const existingWavePath of wavepaths) {

        if (this.pathsCollideContact(existingWavePath.path, newPath)) {

            skip = true;
            reason = `Path collides with another wavepath`;
            attemptedPairs.add(pairId);
            break;
        }
    }
}



 

// === BEGIN Start position neighborhood check ===
let isTouchingOtherWaveBot = false;
const [sx, sy, sz] = [this.bot_start.x, this.bot_start.y, this.bot_start.z];

for (const existingWave of wavepaths) {
    const [ex, ey, ez] = [existingWave.botStart.x, existingWave.botStart.y, existingWave.botStart.z];
    // 6 neighbours:
    if (
        (Math.abs(sx - ex) + Math.abs(sy - ey) + Math.abs(sz - ez)) === 1
    ) {
        isTouchingOtherWaveBot = true;
        break;
    }
}

if (isTouchingOtherWaveBot) {
    skip = true;
    reason = "Start position touches another wave bot (tower/cluster contact)";
    attemptedPairs.add(pairId);

    // console.log("Wave-Kollision (Stack):", this.bot_start, "colliding with other start-bot.");
}

// === END









// === ERROR HANDLING AT END OF BLOCK ===
if (skip) {
    // Put the start bot back into plannedCells (at original position)
    this.addBotToCells(this.bot_start, plannedCells);

    // Logging & next iteration:
    //  if (reason) console.warn("Skip reason:", reason);
    continue; // Next attempt in the while loop
}



// If we reach here: the path is valid, collision-free with targets and other paths in this wave!
wavepaths.push({ path: newPath, botStart: this.bot_start, botTarget: this.bot_target, botId: this.bot_id }); // botId added
pathsFoundInWave++; // Increase the number of found paths for this wave

// Log valid path to morph_full_edge_validpath.log
try {
    const tz = this.timezone || 'UTC';
    const timestamp = new Date().toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T').substring(0, 19);
    const line = `[${timestamp}] VALID PATH: bot=${this.bot_id} from=(${this.bot_start.x},${this.bot_start.y},${this.bot_start.z}) to=(${newPathTargetX},${newPathTargetY},${newPathTargetZ}) pathLen=${newPath.length}\n`;
    fs.appendFileSync(this.validPathLogPath, line, 'utf8');
} catch (e) {
    // silently ignore file write errors
}

// IMPORTANT: Set the bot in 'plannedCells' to its TARGET POSITION.
// This simulates the bot's move for subsequent path planning in the same wave.

if (!this.botExists( this.bot_start, plannedCells )) 
{
this.log("Bot does not exist!");
    this.addBotToCells(this.bot_start, plannedCells);
}


this.set(this.bot_id, newPathTargetX, newPathTargetY, newPathTargetZ, plannedCells);


 
// IMPORTANT: Add the target coordinate to the set so that no other bot in this wave can claim it.
// Only block the target and its neighbors:
this.add6NeighborsToSet(tx, ty, tz, plannedOccupiedCoordsSet);

reservedTargets.add(`${newPathTargetX},${newPathTargetY},${newPathTargetZ}`); // <-- Block target


// Add the pair to attemptedPairs to avoid retrying it in this wave.
// This is important, since it now counts as successfully *planned*.
attemptedPairs.add(pairId); // Now add here, after path is successfully added

this.log(`✅ Path ${pathsFoundInWave} for ${pairId} added wavecnt:${this.wavecnt}. Path length: ${newPath.length}. Bot ${this.bot_id} in plannedCells at (${newPathTargetX},${newPathTargetY},${newPathTargetZ}).`);
currentAttempt = 0; // Reset the attempt counter, since a path was successfully found
} // End of while loop





this.log(`DEBUG: Loop ended.`);
this.log(`DEBUG: pathsFoundInWave = ${pathsFoundInWave}`);
this.log(`DEBUG: MAX_PATHS_IN_WAVE = ${this.MAX_PATHS_IN_WAVE}`);
this.log(`DEBUG: currentAttempt = ${currentAttempt}`);
this.log(`DEBUG: MAX_ATTEMPTS_TO_FIND_PAIR = ${this.MAX_ATTEMPTS_TO_FIND_PAIR}`);

// Check if bot_start / bot_target were null at the end
if (!this.bot_start && !this.bot_target) {
    this.log("DEBUG: Loop ended because no more pairs were found by choosePair.");
} else if (pathsFoundInWave === this.MAX_PATHS_IN_WAVE) {
    this.log("DEBUG: Loop ended because MAX_PATHS_IN_WAVE was reached.");
} else if (currentAttempt >= this.MAX_ATTEMPTS_TO_FIND_PAIR) {
    this.log("DEBUG: Loop ended because MAX_ATTEMPTS_TO_FIND_PAIR was reached.");
}

// Add bot_start back to plannedCells (if needed)

// Start animation only if any paths were found
if (wavepaths.length > 0) 
{


        this.log("Wave finished!");

     
        
        this.wavecnt++;
      
        this.log("Sync after animation: cells = plannedCells");
     
        this.registerMorphStepForExport(wavepaths, this.wavecnt);

        this.cells = plannedCells;
        
        
        // Optionally plan next wave here
        // e.g. stepMorph(); // Call for next wave to continue the process
        
        // <--- ADD HERE: Continue morph process if not finished --->
        //setTimeout(stepMorph, 30); // small pause so browser doesn't freeze
        
        const progress = this.getProgress();
        //console.log("before finishHandler call... " + progress + "%");

 
    
        caller.notify_frontend_console( `Progress: ${progress}%` );
    
        
        this.stepMorph( caller, finishHandler ); // recursive call
        

 
      
    
} // if (wavepaths.length > 0)
else {

     console.warn("No paths found in this wave. Morphing is blocked or finished?");
     this.cells = plannedCells;
     // <-- new: blocked but not happy!
     if (!this.areAllBotsHappy(this.cluster_target, plannedCells)) {
         console.error("Morphing stuck! No more moves possible, but not all bots are happy.");
         finishHandler(this.morphLog, false);
         return;
         }
         
        
     // Here, an abort condition or error handling should be added,
     // e.g. if MAX_ATTEMPTS_TO_FIND_PAIR was reached and no more paths are possible.
}

} // stepMorph()





 
//
// Adds the given (x, y, z) position and its 6 direct neighbors (on X, Y, and Z axes)
// to the provided set, as coordinate strings. Used for reserving target areas in 3D grids.
//
add6NeighborsToSet(x, y, z, set) {
    // Target itself
    set.add(`${x},${y},${z}`);
    // 6 direct Neighbors (X, Y, Z-axes)
    set.add(`${x+1},${y},${z}`);
    set.add(`${x-1},${y},${z}`);
    set.add(`${x},${y+1},${z}`);
    set.add(`${x},${y-1},${z}`);
    set.add(`${x},${y},${z+1}`);
    set.add(`${x},${y},${z-1}`);
}

 

 

//
// Removes the bot with the given ID from the cells object (if present).
//
removeBotFromCellsById(botId, cells) {
    if (cells.hasOwnProperty(botId)) {
        delete cells[botId];
    }
}




//
// Adds or replaces a bot in the cells object using its id as the key.
//
addBotToCells(bot, cells) {
    // Directly replace or add (object notation!)
    cells[bot.id] = {
        id: bot.id,
        x: bot.x,
        y: bot.y,
        z: bot.z,
        // ... more properties if needed
    };
}



//
// Returns true if a bot with the given id exists in the cells object.
//
botExists(bot, cells) {
    return !!cells[bot.id];
}




//
// Checks if two paths collide (share any coordinates).
// @param {Array} path1 - Array of [x, y, z] steps
// @param {Array} path2 - Array of [x, y, z] steps
// @returns {boolean} True if any coordinate is shared, else false
//
pathsCollide(path1, path2) {
    const path1Set = new Set();
    // Convert all coordinates of the first path to string for fast lookup
    for (const coord of path1) {
        path1Set.add(`${coord[0]},${coord[1]},${coord[2]}`);
    }

    // Check if any coordinate of the second path is in the first path's set
    for (const coord of path2) {
        const coordString = `${coord[0]},${coord[1]},${coord[2]}`;
        // Optionally: Ignore start/end points here if needed
        if (path1Set.has(coordString)) {
            // Collision found
            return true;
        }
    }
    return false; // No collisions found
}


// So 06.jul.2025   
pathsCollideContact(path1, path2) {
    for (const c1 of path1) {
        for (const c2 of path2) {
            // Manhattan-Distanz = 1: orthogonal benachbart (aber nicht identisch)
            const dx = Math.abs(c1[0] - c2[0]);
            const dy = Math.abs(c1[1] - c2[1]);
            const dz = Math.abs(c1[2] - c2[2]);
            const dist = dx + dy + dz;
            if (dist === 1) {
                return true; // Contact/touch found!
            }
        }
    }
    return false;
}

    
    
// =============================
    


//
// returns progress in percent
//
getProgress() {
    const bots = Object.values(this.cells);
    const targets = this.cluster_target;
    let matched = 0;

    for (const target of targets) {
        if (bots.some(bot => bot.x === target.x && bot.y === target.y && bot.z === target.z)) {
            matched++;
        }
    }

    const percent = (matched / targets.length) * 100;
    return Math.round(percent);
}

    
    
    
    
//
// Main-handler for the morph-algo
//    
run( caller, finishHandler ) 
{
//console.log("run...: " + this.getProgress() );

this.progress = 0;


if (typeof finishHandler === "function") 
   {
    
   this.stepMorph( caller, finishHandler );
               
   }
else
   console.warn("Finishhandler is NOT a function");
            
 
        
} // run()
    
    
  
} // class MorphBFSWavefront


module.exports = MorphBFSWavefront;
