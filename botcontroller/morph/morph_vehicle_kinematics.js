/**
 * MorphVehicleKinematics
 * -----------------------
 * Vehicle-kinematics-based morphing algorithm for programmable matter / cellbot cluster transformation.
 *
 * This module uses the A*-based vehicle kinematics path planner (embedded redundantly)
 * instead of the classic BFS + MOVEMENT_RULES approach used by MorphBFSWavefront.
 *
 * Structure:
 *   - All functions are included in this single file for maximum transparency and experimental flexibility.
 *   - The vehicle kinematics path planner (~1100 lines) is embedded as a private method
 *     to keep the morph independent from API changes.
 *   - Designed for laboratory use, rapid prototyping, and further AI integration.
 *
 * Main features:
 *   - Fully self-contained class with start/target injection
 *   - Step-wise or batch morphing (run/step)
 *   - Progress tracking and logging (morphLog)
 *   - Vehicle-kinematics-based path planning using A* with 30+ movement primitives
 *   - Reserve-Bots (R* IDs) are preferred as donor bots, but wouldSplitCluster is checked for ALL bots
 *   - Ready for future refactoring or modularization if needed
 *
 * Author: Sven Pohl
 * Date: [2026-04-30]
 * Version: [v1.0]
 */

const MorphBase = require('./morph_base');
const fs = require('fs');
const path = require('path');
const config_parser = require('../../common/config_parser.js');

class MorphVehicleKinematics extends MorphBase
{

    constructor(startBots, targetBots, params)
    {
        super(startBots, targetBots, params);

        this.DEBUG = true;
        this.LOGLEVEL = 0; // 0=off, 1=error, 2=info, 3=verbose

        // Read timezone from config.cfg (default to UTC if not set)
        try {
            const cfgPath = path.join(__dirname, '..', 'config.cfg');
            const cfg = config_parser.parse_config_file(cfgPath);
            this.timezone = cfg.timezone || 'UTC';
        } catch (e) {
            this.timezone = 'UTC';
        }

        // Debug log file - cleared on each new morph run
        this.debugLogPath = path.join(__dirname, 'morph_vehicle_kinematics.log');
        fs.writeFileSync(this.debugLogPath, '', 'utf8');

        // Valid path log file - cleared on each new morph run
        // Contains ONLY paths verified by _calcVehicleKinematicsPath()
        this.validPathLogPath = path.join(__dirname, 'morph_vehicle_kinematics_validpath.log');
        fs.writeFileSync(this.validPathLogPath, '', 'utf8');

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

        // Log object for morphing process: stores initial bot setup (optional) and all morphing waves
        this.morphLog =
           {
           bots: [],    // optional, e.g. from your initCells
           waves: []
           };

        // 'cells' with Startbots
        // Include initial rotation (vx, vy, vz) - defaults to facing ZP (0,0,1)
        // for full-edge mode bots that have no rotation data yet.
        this.morphLog.bots = Object.values(this.cells).map(bot => (
           {
           id: bot.id,
           x: bot.x,
           y: bot.y,
           z: bot.z,
           vx: Number(bot.vx ?? 0),
           vy: Number(bot.vy ?? 0),
           vz: Number(bot.vz ?? 1)
           }));

        // Target Bots
        this.morphLog.targets = Object.values(this.cluster_target).map(bot => (
           {
           id: bot.id,
           x: bot.x,
           y: bot.y,
           z: bot.z
           }));

        // Default value:
        this.MAX_PATHS_IN_WAVE = 14;
        if (params.max_paths_in_wave !== undefined)
           {
           this.MAX_PATHS_IN_WAVE = params.max_paths_in_wave;
           }

        this.MAX_ATTEMPTS_TO_FIND_PAIR = 50;
        if (params.max_attempts_to_find_pair !== undefined)
           {
           this.MAX_ATTEMPTS_TO_FIND_PAIR = params.max_attempts_to_find_pair;
           }

        // Vehicle kinematics specific parameters
        this.VK_MAX_SEARCH_STEPS = 100000;
        if (params.vk_max_search_steps !== undefined)
           {
           this.VK_MAX_SEARCH_STEPS = params.vk_max_search_steps;
           }

        this.wavecnt = 0;

        this.log("Construct MorphVehicleKinematics");
    } // constructor()


    log (msg, level = 2)
    {
        if (this.DEBUG && level <= this.LOGLEVEL) console.log(msg);
    }


    //
    // debugLog - writes a timestamped message to the debug log file
    //
    debugLog(msg)
    {
        try {
            const tz = this.timezone || 'UTC';
            const timestamp = new Date().toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T').substring(0, 19);
            const line = `[${timestamp}] ${msg}\n`;
            fs.appendFileSync(this.debugLogPath, line, 'utf8');
        } catch (e) {
            // silently ignore file write errors
        }
    }


    //
    // debugLogValidPath - writes a timestamped entry to the valid path log file.
    // Only called when a path has been verified by _calcVehicleKinematicsPath().
    // Logs: bot ID, start position, target position, distance, path length, states count,
    // and rejection statistics from the path planner.
    //
    debugLogValidPath(botId, fromPos, toPos, dist, vkResult)
    {
        try {
            const tz = this.timezone || 'UTC';
            const timestamp = new Date().toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T').substring(0, 19);
            const pathLen = vkResult && vkResult.states ? vkResult.states.length : 0;
            const orientation = fromPos.vx !== undefined ? ` orientation=(${fromPos.vx},${fromPos.vy},${fromPos.vz})` : '';
            const pathSuccess = vkResult && vkResult.ok && pathLen >= 2;
            const line = `[${timestamp}] VALID PATH: bot=${botId} from=(${fromPos.x},${fromPos.y},${fromPos.z}) to=(${toPos.x},${toPos.y},${toPos.z}) dist=${dist.toFixed(2)} pathLen=${pathLen} states=${pathLen}${orientation} pathSuccess=${pathSuccess}\n`;
            fs.appendFileSync(this.validPathLogPath, line, 'utf8');

            // Add rejection statistics if available (informational, not errors)
            if (vkResult && vkResult.rejection_counts) {
                const rejectionLine = `[${timestamp}]   Planner rejections (normal A* search stats): ` +
                    Object.entries(vkResult.rejection_counts)
                        .map(([err, cnt]) => `${err} x${cnt}`)
                        .join(', ') + '\n';
                fs.appendFileSync(this.validPathLogPath, rejectionLine, 'utf8');
            }
        } catch (e) {
            // silently ignore file write errors
        }
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


    isTargetCovered(target, bots)
    {
        // true if any bot sits exactly on target
        return bots.some(b => b.x === target.x && b.y === target.y && b.z === target.z);
    }


    //
    // Returns true if all UNIQUE target positions in bot_target_param are occupied
    // by a bot in the current collection. Used to check if the morphing process is complete.
    // Duplicate target entries (same x,y,z) are deduplicated to avoid false negatives.
    //
    areAllBotsHappy(bot_target_param, collection = this.cells)
    {
        console.assert(collection !== undefined, "Collection is undefined!");
        const bots = Object.values(collection);

        // Deduplicate targets by unique (x,y,z) coordinates
        const uniqueTargets = new Set();
        for (const target of bot_target_param)
        {
            uniqueTargets.add(`${target.x},${target.y},${target.z}`);
        }

        for (const targetKey of uniqueTargets)
        {
            const [tx, ty, tz] = targetKey.split(',').map(Number);
            const found = bots.some(bot =>
                bot.x === tx &&
                bot.y === ty &&
                bot.z === tz
            );

            if (!found) {
                return false;
            }
        }

        return true;
    } // areAllBotsHappy


    //
    // Returns a list of all bots from 'collection' that are NOT on any target position in 'bot_target_param'.
    //
    getUnhappyBots(bot_target_param, collection = this.cells)
    {
        console.assert(collection !== undefined, "Collection is undefined!");
        const bots = Object.values(collection);

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
    get_bot_id(bot_start, collection = this.cells)
    {
        console.assert(collection !== undefined, "Collection is undefined!");

        const foundEntry = Object.entries(collection).find(([id, bot]) =>
            bot.x === bot_start[0] &&
            bot.y === bot_start[1] &&
            bot.z === bot_start[2]
        );

        return foundEntry ? foundEntry[0] : null;
    } // get_bot_id


    //
    // Returns the bot object at the given (x, y, z) position from the collection,
    // or null if not found.
    //
    getBotByPos(x, y, z, collection = this.cells)
    {
        console.assert(collection !== undefined, "Collection is undefined!");
        const bots = this.getAllBots(collection);
        return bots.find(b => b.x === x && b.y === y && b.z === z) || null;
    }


    //
    // Checks if the position (x, y, z) is adjacent to any bot in the collection (direct neighbor contact).
    // Optionally excludes a specific position (excludeX, excludeY, excludeZ) from being considered.
    //
    hasContact(x, y, z, collection = this.cells, excludeX = null, excludeY = null, excludeZ = null)
    {
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
    hasClusterContact(x, y, z, collection = this.cells)
    {
        return Object.values(collection).some(bot =>
            Math.abs(bot.x - x) + Math.abs(bot.y - y) + Math.abs(bot.z - z) === 1
        );
    }


    //
    // Returns true if the position (x, y, z) is not occupied by any bot in the collection.
    //
    isFree(x, y, z, collection = this.cells)
    {
        return !collection.some(c => c.x === x && c.y === y && c.z === z);
    }


    //
    // Checks if removing the given bot would split the cluster into separate parts.
    // Returns true if the cluster would be disconnected, otherwise false.
    // Uses BFS starting from the master bot to see if all other bots remain connected.
    //
    // NOTE: wouldSplitCluster is now checked for ALL bots (including Reserve-Bots).
    //       The internal R* skip was removed on 02.05.2026.
    //
    wouldSplitCluster(bot, collection = this.cells)
    {
        if (!bot.id) {
            console.warn("Bot without ID:", bot);
        }

        // Get all bots except the one to be (temporarily) removed
        const bots = this.getAllBots(collection).filter(b => b.id !== bot.id);
        if (bots.length === 0) {
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
            console.warn("No master bot present in the cluster!");
            return true;
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
                if (dist === 1) {
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
    // canBotMoveInVhMode
    // Checks whether a bot can move in vehicle-kinematics mode.
    //
    // Instead of checking for a frontal neighbor (which was too strict for bots at
    // the edge of the cluster), this function now checks if the bot is completely
    // surrounded by 6 orthogonal neighbors. A bot that is fully embedded in the
    // cluster (count === 6) cannot move because it has no free space to maneuver.
    // A bot with at least one free orthogonal direction can potentially move -
    // the actual path planner (_calcVehicleKinematicsPath) will determine if a
    // valid path exists.
    //
    // @param {Object} bot - The bot to check { id, x, y, z }
    // @param {Object} target - The target position { x, y, z } (unused, kept for API compatibility)
    // @param {Array|Object} collection - Bot collection
    // @returns {boolean} - true if the bot can potentially move (not completely surrounded)
    //
    canBotMoveInVhMode(bot, target, collection = this.cells)
    {
        // Count how many of the 6 orthogonal positions around the bot are occupied.
        // If all 6 are occupied, the bot is completely embedded and cannot move.
        // If at least one direction is free, the bot can potentially move -
        // the path planner will decide if a valid path exists.
        const neighborCount = this.countOrthogonalNeighbors(bot.x, bot.y, bot.z, collection);

        // Bot can move if it is NOT completely surrounded by 6 orthogonal neighbors.
        // A bot with neighborCount < 6 has at least one free direction to maneuver.
        return neighborCount < 6;

    } // canBotMoveInVhMode()





    //
    // choosePair selects a suitable bot-target pair for morphing.
    //
    // The function works as follows:
    // 1. Finds all "unhappy" bots (bots that have not reached their target).
    // 2. Filters out bots that cannot move in vehicle-kinematics mode (no frontal/backward neighbor
    //    based on the bot's actual orientation vx,vy,vz).
    // 3. Finds all available target positions in the target cluster that are not already occupied
    //    and have contact with the current cluster.
    // 4. For each unhappy bot, computes the minimum distance to any free target.
    // 5. Sorts by: Reserve-Bots (R*) first, then by greatest distance.
    // 6. Selects the top N bots (default: 4).
    // 7. For each of these top bots, checks all possible target positions for validity
    //    (cluster integrity, contact, not previously attempted/reserved).
    // 8. Uses the actual path planner (_buildWorldAndPlanPath) as the definitive check -
    //    only pairs where the path planner finds a valid path are accepted.
    // 9. Among all valid pairs, selects the one with the largest distance.
    // 10. Sets the chosen bot and target; if no valid pair is found, resets the selection.
    //
    // NOTE: wouldSplitCluster is checked for ALL bots (including Reserve-Bots).
    //       Reserve-Bots are still preferred in the sorting order.
    //
    choosePair(collection = this.cells, attemptedPairs = new Set(), reservedTargets = new Set(), movedBotsInWave = new Set(), pathResult = null)
    {
        // 1. Find all unhappy bots (not at master position and not already at their target)
        //    Exclude bots that have already been moved in the current wave
        const unhappyBots = this.getAllBots(collection).filter(bot =>
            !(bot.x === this.MASTER_BOT_POSITION.x &&
              bot.y === this.MASTER_BOT_POSITION.y &&
              bot.z === this.MASTER_BOT_POSITION.z) &&
            !this.isHappy(bot.x, bot.y, bot.z) &&
            !movedBotsInWave.has(bot.id)
        );

        // 2. Find all free targets (positions in cluster_target not already occupied, with cluster contact)
        let freeTargets = this.getAllBots(this.cluster_target).filter(t =>
            !this.getAllBots(collection).some(b => b.x === t.x && b.y === t.y && b.z === t.z) &&
            this.hasContact(t.x, t.y, t.z, collection)
        );

        // 2b. Sort free targets by neighbor count (descending) - "Zuschütten"-Heuristik.
        //     Targets with the most orthogonal neighbors are filled first.
        //     This prevents blocking the entrance to inner positions by filling
        //     the "deepest" positions first (most surrounded by existing bots).
        freeTargets.sort((a, b) => {
            const neighborsA = this.countOrthogonalNeighbors(a.x, a.y, a.z, collection);
            const neighborsB = this.countOrthogonalNeighbors(b.x, b.y, b.z, collection);
            return neighborsB - neighborsA; // most neighbors first
        });

        // 1b. Filter out bots that cannot move in vehicle-kinematics mode.
        //     In VH mode, a bot needs a neighbor in its forward (F) direction to support
        //     STEP_UP/STEP_DOWN movements. The forward direction is determined by the bot's
        //     actual orientation (vx, vy, vz).
        //     For each unhappy bot, find its closest free target first, then check if
        //     the bot can move in VH mode toward that target.
        let movableBots = [];
        let skippedBots = 0;
        for (const bot of unhappyBots) {
            // Find the closest free target for this bot
            let minDist = Infinity;
            let closestTarget = null;
            for (const t of freeTargets) {
                const d = Math.sqrt(
                    (bot.x - t.x) ** 2 +
                    (bot.y - t.y) ** 2 +
                    (bot.z - t.z) ** 2
                );
                if (d < minDist) {
                    minDist = d;
                    closestTarget = t;
                }
            }
            if (closestTarget && this.canBotMoveInVhMode(bot, closestTarget, collection)) {
                movableBots.push(bot);
            } else {
                skippedBots++;
            }
        }
        if (skippedBots > 0) {
            this.debugLog(`choosePair: filtered ${skippedBots} bots that cannot move in VH mode toward their closest target (no frontal/backward neighbor)`);
        }

        this.debugLog(`choosePair: unhappyBots=${unhappyBots.length} movableBots=${movableBots.length} freeTargets=${freeTargets.length}`);

        // 3. For each bot, compute the minimum distance to any free target
        let botCandidates = movableBots.map(bot => {
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
        let selectedPair = null;
        let candidatesChecked = 0;
        for (const candidate of botCandidates) {
            const bot = candidate.bot;
            if (selectedPair) break; // Found a valid pair, stop searching

            this.debugLog(`choosePair: checking bot=${bot.id} at (${bot.x},${bot.y},${bot.z})`);

            for (const target of freeTargets) {
                if (selectedPair) break;

                const pairId = `${bot.x},${bot.y},${bot.z}-${target.x},${target.y},${target.z}`;
                if (attemptedPairs.has(pairId)) {
                    this.debugLog(`choosePair: skip bot=${bot.id} target=(${target.x},${target.y},${target.z}) reason=attemptedPairs`);
                    continue;
                }
                const targetCoordString = `${target.x},${target.y},${target.z}`;
                if (reservedTargets.has(targetCoordString)) {
                    this.debugLog(`choosePair: skip bot=${bot.id} target=(${target.x},${target.y},${target.z}) reason=reservedTargets`);
                    continue;
                }

                // wouldSplitCluster check for ALL bots (including Reserve-Bots)
                const splitCheckOk = !this.wouldSplitCluster(bot, collection);
                if (!splitCheckOk) {
                    this.debugLog(`choosePair: skip bot=${bot.id} target=(${target.x},${target.y},${target.z}) reason=wouldSplitCluster`);
                    continue;
                }

                const hasContactOk = this.hasContact(target.x, target.y, target.z, collection, bot.x, bot.y, bot.z);
                if (!hasContactOk) {
                    this.debugLog(`choosePair: skip bot=${bot.id} target=(${target.x},${target.y},${target.z}) reason=noContact`);
                    continue;
                }

                candidatesChecked++;
                // Use the actual path planner as the definitive check
                // Pass the bot's actual orientation (vx, vy, vz) so the path planner
                // uses the correct forward direction for STEP_UP/STEP_DOWN checks.
                // Temporarily remove the bot from collection for path planning
                const botCopy = { ...bot };
                const collectionCopy = JSON.parse(JSON.stringify(collection));
                // Remove the candidate bot from the copy (works for both arrays and objects)
                if (Array.isArray(collectionCopy)) {
                    const idx = collectionCopy.findIndex(b => b && b.id === bot.id);
                    if (idx >= 0) collectionCopy.splice(idx, 1);
                } else {
                    if (collectionCopy[bot.id]) {
                        delete collectionCopy[bot.id];
                    }
                }
                // DEBUG: Check if target has vx/vy/vz from cluster_target
                this.debugLog("[DEBUG choosePair] bot=" + bot.id + " target=(" + target.x + "," + target.y + "," + target.z + ") target.vx=" + target.vx + " target.vy=" + target.vy + " target.vz=" + target.vz + " cluster_target_type=" + (Array.isArray(this.cluster_target) ? "array" : typeof this.cluster_target) + " cluster_target_len=" + (Array.isArray(this.cluster_target) ? this.cluster_target.length : Object.keys(this.cluster_target).length));
                // Also check the raw cluster_target entry for this target position
                const rawTarget = this.getAllBots(this.cluster_target).find(t => Number(t.x) === Number(target.x) && Number(t.y) === Number(target.y) && Number(t.z) === Number(target.z));
                if (rawTarget) {
                    this.debugLog("[DEBUG choosePair] rawTarget.vx=" + rawTarget.vx + " rawTarget.vy=" + rawTarget.vy + " rawTarget.vz=" + rawTarget.vz + " rawTarget keys=" + Object.keys(rawTarget).join(","));
                }
                const vkResult = this._buildWorldAndPlanPath(
                    { x: bot.x, y: bot.y, z: bot.z ,  vx: Number(bot.vx ?? 0), vy: Number(bot.vy ?? 0), vz: Number(bot.vz ?? 1)},
                    { x: target.x, y: target.y, z: target.z  , vx: Number(target.vx ?? 0), vy: Number(target.vy ?? 0), vz: Number(target.vz ?? 0) },
                    collectionCopy,
                    bot
                );

                if (vkResult && vkResult.ok && vkResult.states && vkResult.states.length >= 2) {
                    const dist = Math.sqrt(
                        (bot.x - target.x) ** 2 +
                        (bot.y - target.y) ** 2 +
                        (bot.z - target.z) ** 2
                    );
                    selectedPair = { bot, target, dist };
                    // Store the computed path in pathResult for reuse by caller
                    if (pathResult) {
                        pathResult.vkResult = vkResult;
                    }
                    this.debugLogValidPath(bot.id, { x: bot.x, y: bot.y, z: bot.z, vx: Number(bot.vx ?? 0), vy: Number(bot.vy ?? 0), vz: Number(bot.vz ?? 1) }, { x: target.x, y: target.y, z: target.z }, dist, vkResult);
                    this.debugLog(`choosePair: valid pair bot=${bot.id} -> (${target.x},${target.y},${target.z}) dist=${dist.toFixed(2)} (path planner OK, checked ${candidatesChecked} candidates)`);
                } else {
                    this.debugLog(`choosePair: rejected pair bot=${bot.id} -> (${target.x},${target.y},${target.z}) (path planner: ${vkResult ? vkResult.error : 'null'})`);
                }
            }
        }

        // 6. Use the selected pair (first valid one found, which is the best due to sorting)
        if (selectedPair) {
            const { bot, target, dist } = selectedPair;
            this.bot_id = bot.id;
            this.bot_start = { x: bot.x, y: bot.y, z: bot.z, vx: Number(bot.vx ?? 0), vy: Number(bot.vy ?? 0), vz: Number(bot.vz ?? 1) };
            // Include orientation (vx/vy/vz) from the target structure if available,
            // so that _buildWorldAndPlanPath() can use the explicit target orientation
            // instead of falling back to auto-orientation or start orientation.
            this.bot_target = { x: target.x, y: target.y, z: target.z, vx: Number(target.vx ?? 0), vy: Number(target.vy ?? 0), vz: Number(target.vz ?? 0) };
            // NOTE: movedBotsInWave.add() is NOT called here - it is called in stepMorph()
            // after all collision/validation checks have passed. If we added the bot here,
            // it would be blocked for the entire wave even if the path is later rejected
            // in stepMorph() due to collision checks.
            this.debugLog(`choosePair: selected bot=${bot.id} from=(${bot.x},${bot.y},${bot.z}) to=(${target.x},${target.y},${target.z}) dist=${dist.toFixed(2)}`);
            return true;
        } else {
            this.bot_id = null;
            this.bot_start = null;
            this.bot_target = null;
            this.debugLog(`choosePair: NO valid pair found! unhappyBots=${unhappyBots.length} movableBots=${movableBots.length} freeTargets=${freeTargets.length} candidatesChecked=${candidatesChecked}`);
            return false;
        }
    } // choosePair



    //
    // Registers the results of one morphing wave for export/logging.
    // Stores, for each move in the wave, the bot id, start and end position, and optionally the full path.
    //
    // If VK states (with vx, vy, vz rotation data) are available, they are included
    // in from, to, and fullPath entries.
    //
    registerMorphStepForExport(wavePaths, waveCount)
    {
        let waveLog = {
            step: waveCount,
            moves: []
        };

        wavePaths.forEach(wave => {
            let path = wave.path;
            let from = path[0];
            let to = path[path.length - 1];
            let states = wave.pathStates; // VK states with vx, vy, vz rotation data

            let moveEntry = {
                id: wave.botId,
                from: { x: from[0], y: from[1], z: from[2] },
                to: { x: to[0], y: to[1], z: to[2] },
                fullPath: path.map(([x, y, z]) => ({ x, y, z }))
            };

            this.debugLog(`  registerMorphStepForExport: bot=${wave.botId} states=${states ? states.length : 'null'} pathLen=${path.length}`);

            // If VK states are available, add rotation data (vx, vy, vz)
            if (states && states.length >= 2) {
                this.debugLog(`  -> adding vx/vy/vz to from/to/fullPath for bot=${wave.botId}`);
                // Add rotation to 'from' (first state)
                moveEntry.from.vx = Number(states[0].vx ?? 0);
                moveEntry.from.vy = Number(states[0].vy ?? 0);
                moveEntry.from.vz = Number(states[0].vz ?? 1);

                // Add rotation to 'to' (target orientation from botTarget, not from states[last])
                // The A* path planner may end with the start orientation (1,0,0) instead of the
                // target orientation, because goalMatches() checks both position AND orientation
                // exactly. When the planner finds a path to the target position but not the exact
                // target orientation, it returns PATH_NOT_FOUND with best_partial where the last
                // state has wrong orientation. Therefore we use the target orientation from
                // wave.botTarget (set by choosePair / _buildWorldAndPlanPath) instead.
                let targetVx = Number(wave.botTarget?.vx ?? 0);
                let targetVy = Number(wave.botTarget?.vy ?? 0);
                let targetVz = Number(wave.botTarget?.vz ?? 0);
                //console.log("[DEBUG registerMorphStepForExport] bot=" + wave.botId + " botTarget.vx=" + wave.botTarget?.vx + " botTarget.vy=" + wave.botTarget?.vy + " botTarget.vz=" + wave.botTarget?.vz + " botStart.vx=" + wave.botStart?.vx + " botStart.vy=" + wave.botStart?.vy + " botStart.vz=" + wave.botStart?.vz + " targetVx=" + targetVx + " targetVy=" + targetVy + " targetVz=" + targetVz);
                // Fallback: if botTarget has no orientation, use start orientation
                if (targetVx === 0 && targetVy === 0 && targetVz === 0) {
                    targetVx = Number(wave.botStart?.vx ?? 0);
                    targetVy = Number(wave.botStart?.vy ?? 0);
                    targetVz = Number(wave.botStart?.vz ?? 1);
                    //console.log("[DEBUG registerMorphStepForExport] FALLBACK bot=" + wave.botId + " using start orientation: targetVx=" + targetVx + " targetVy=" + targetVy + " targetVz=" + targetVz);
                }
                moveEntry.to.vx = targetVx;
                moveEntry.to.vy = targetVy;
                moveEntry.to.vz = targetVz;

                // Add rotation to each step in fullPath
                moveEntry.fullPath = states.map(s => ({
                    x: Number(s.x),
                    y: Number(s.y),
                    z: Number(s.z),
                    vx: Number(s.vx ?? 0),
                    vy: Number(s.vy ?? 0),
                    vz: Number(s.vz ?? 1),
                    dir: s.dir ?? null,
                    support_mode: s.support_mode ?? "floor"
                }));
            }

            waveLog.moves.push(moveEntry);
        });

        this.morphLog.waves.push(waveLog);
    }


    //
    // Sets the position of a bot with a given id in the botCollection.
    // Throws an error if the bot is not found.
    // Works for Array of bots (plannedCells)
    //
    set(id, x, y, z, botCollection = this.cells)
    {
        const bot = botCollection.find(bot => bot.id === id);
        if (!bot) {
            console.error("Critical error: Bot with ID \"" + id + "\" not found in botCollection!");
            console.trace();
            throw new Error("set(): Bot with ID \"" + id + "\" not found!");
        }
        bot.x = x;
        bot.y = y;
        bot.z = z;
    }


    //
    // Adds the given (x, y, z) position and its 6 direct neighbors (on X, Y, and Z axes)
    // to the provided set, as coordinate strings. Used for reserving target areas in 3D grids.
    //
    add6NeighborsToSet(x, y, z, set)
    {
        set.add(`${x},${y},${z}`);
        set.add(`${x+1},${y},${z}`);
        set.add(`${x-1},${y},${z}`);
        set.add(`${x},${y+1},${z}`);
        set.add(`${x},${y-1},${z}`);
        set.add(`${x},${y},${z+1}`);
        set.add(`${x},${y},${z-1}`);
    }


    //
    // Removes the bot with the given ID from the cells collection (if present).
    // Works with both object collections (keyed by bot ID) and arrays.
    //
    removeBotFromCellsById(botId, cells)
    {
        if (Array.isArray(cells)) {
            const idx = cells.findIndex(b => b && b.id === botId);
            if (idx >= 0) {
                cells.splice(idx, 1);
            }
        } else {
            if (cells.hasOwnProperty(botId)) {
                delete cells[botId];
            }
        }
    }


    //
    // Adds or replaces a bot in the cells collection using its id.
    // Works with both object collections (keyed by bot ID) and arrays.
    // For arrays, finds the bot by ID and updates its position in-place.
    //
    addBotToCells(bot, cells)
    {
        const newEntry = {
            id: bot.id,
            x: bot.x,
            y: bot.y,
            z: bot.z,
            vx: Number(bot.vx ?? 0),
            vy: Number(bot.vy ?? 0),
            vz: Number(bot.vz ?? 1),
        };

        if (Array.isArray(cells)) {
            // Array mode: find existing bot by ID and update in-place
            const idx = cells.findIndex(b => b && b.id === bot.id);
            if (idx >= 0) {
                cells[idx] = newEntry;
            } else {
                cells.push(newEntry);
            }
        } else {
            // Object mode: use ID as key (direct replace or add)
            cells[bot.id] = newEntry;
        }
    }


    //
    // Returns true if a bot with the given id exists in the cells object.
    //
    botExists(bot, cells)
    {
        return !!cells[bot.id];
    }


    //
    // Checks if two paths collide (share any coordinates).
    //
    pathsCollide(path1, path2)
    {
        const path1Set = new Set();
        for (const coord of path1) {
            path1Set.add(`${coord[0]},${coord[1]},${coord[2]}`);
        }

        for (const coord of path2) {
            const coordString = `${coord[0]},${coord[1]},${coord[2]}`;
            if (path1Set.has(coordString)) {
                return true;
            }
        }
        return false;
    }


    //
    // Checks if two paths have orthogonal contact (Manhattan distance 1).
    //
    pathsCollideContact(path1, path2)
    {
        for (const c1 of path1) {
            for (const c2 of path2) {
                const dx = Math.abs(c1[0] - c2[0]);
                const dy = Math.abs(c1[1] - c2[1]);
                const dz = Math.abs(c1[2] - c2[2]);
                const dist = dx + dy + dz;
                if (dist === 1) {
                    return true;
                }
            }
        }
        return false;
    }


    //
    // Returns progress in percent based on UNIQUE target positions.
    // Duplicate target entries (same x,y,z) are deduplicated to avoid
    // counting the same position multiple times.
    //
    getProgress()
    {
        const bots = Object.values(this.cells);
        const targets = this.cluster_target;

        // Deduplicate targets by unique (x,y,z) coordinates
        const uniqueTargets = new Set();
        for (const target of targets) {
            uniqueTargets.add(`${target.x},${target.y},${target.z}`);
        }

        let matched = 0;
        for (const targetKey of uniqueTargets) {
            const [tx, ty, tz] = targetKey.split(',').map(Number);
            if (bots.some(bot => bot.x === tx && bot.y === ty && bot.z === tz)) {
                matched++;
            }
        }

        const percent = (matched / uniqueTargets.size) * 100;
        return Math.round(percent);
    }


    // ========================================================================
    // VEHICLE KINEMATICS PATH PLANNING (embedded redundantly)
    // ========================================================================
    //
    // The following methods implement the A*-based vehicle kinematics path planner.
    // This code is embedded redundantly to keep the morph independent from API changes.
    // Source: api_vehicle_kinematics_path_runtime.js
    //


    //
    // _buildSparseGridFromCollection
    // Builds a simple sparse grid (Map-based) from a bot collection.
    // Used internally by _buildWorldAndPlanPath().
    //
    _buildSparseGridFromCollection(collection)
    {
        const store = new Map();

        const grid = {
            set: function(x, y, z, value = 1) {
                store.set(`${x},${y},${z}`, value);
                return true;
            },
            get: function(x, y, z) {
                const key = `${x},${y},${z}`;
                return store.has(key) ? store.get(key) : null;
            },
            keys: function() {
                return Array.from(store.keys());
            }
        };

        for (let i = 0; i < collection.length; i++)
            {
            const bot = collection[i];
            if (!bot) continue;
            grid.set(Number(bot.x), Number(bot.y), Number(bot.z), bot.id);
            }

        return grid;
    } // _buildSparseGridFromCollection()


    //
    // findOrthogonalNeighbors
    // Checks the 6 orthogonal directions (x±1, y±1, z±1) around a given position
    // and returns an array of occupied neighbor positions.
    //
    // @param {number} x - X coordinate
    // @param {number} y - Y coordinate
    // @param {number} z - Z coordinate
    // @param {Object} world - World object with isOccupied(x, y, z) method
    // @returns {Array} - Array of {x, y, z} objects for occupied orthogonal neighbors
    //
    findOrthogonalNeighbors(x, y, z, world)
    {
        const neighbors = [];
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
            if (world.isOccupied(nx, ny, nz)) {
                neighbors.push({ x: nx, y: ny, z: nz });
            }
        }
        return neighbors;
    } // findOrthogonalNeighbors


    //
    // countOrthogonalNeighbors
    // Counts how many of the 6 orthogonal positions around (x, y, z) are occupied
    // by bots in the given collection.
    //
    // Used to determine if a bot is "completely surrounded" (count === 6),
    // which means it cannot move because it's fully embedded in the cluster.
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
            if (this.getBotByPos(x + dir.x, y + dir.y, z + dir.z, collection)) {
                count++;
            }
        }
        return count;
    } // countOrthogonalNeighbors


    //
    // _buildWorldAndPlanPath
    // Wrapper that builds the world object from plannedCells and calls _calcVehicleKinematicsPath().
    //
    // @param {Object} botStart - {x, y, z} Start position of the bot
    // @param {Object} botTarget - {x, y, z} Target position
    // @param {Object|Array} plannedCells - Bot collection (object keyed by ID, or array)
    // @param {Object} botToMove - The bot object that is being moved (to exclude from structure grid)
    // @returns {Object|null} - Path result from _calcVehicleKinematicsPath, or null on failure
    //
    _buildWorldAndPlanPath(botStart, botTarget, plannedCells, botToMove)
    {
        // Convert plannedCells to array if it's an object (keyed by bot ID)
        const cellsArray = Array.isArray(plannedCells) ? plannedCells : Object.values(plannedCells);

        this.debugLog(`_buildWorldAndPlanPath: start=(${botStart.x},${botStart.y},${botStart.z}) target=(${botTarget.x},${botTarget.y},${botTarget.z}) targetOrientation=(${botTarget.vx ?? 0},${botTarget.vy ?? 0},${botTarget.vz ?? 0}) cellsCount=${cellsArray.length}`);

        // Rebuild without the moving bot
        const bots_s_clean = this._buildSparseGridFromCollection(
            cellsArray.filter(b => !botToMove || b.id !== botToMove.id)
        );

        const world = {
            isOccupied: (x, y, z) => {
                return bots_s_clean.get(Number(x), Number(y), Number(z)) !== null;
            },
            isFree: (x, y, z) => {
                let occupied = (bots_s_clean.get(Number(x), Number(y), Number(z)) !== null);
                return !occupied;
            },
            forbidden: null
        };

        // Use the bot's ACTUAL orientation (vx, vy, vz) if available.
        // The bot already has an orientation from its initial state or from a previous move.
        // If no orientation data is available, fall back to dynamic start orientation
        // based on direction to target.
        let startVx = Number(botStart.vx ?? 0);
        let startVy = Number(botStart.vy ?? 0);
        let startVz = Number(botStart.vz ?? 0);

        if (startVx === 0 && startVy === 0 && startVz === 0) {
            // No orientation data - determine from direction to target
            const dx = botTarget.x - botStart.x;
            const dz = botTarget.z - botStart.z;
            if (Math.abs(dx) >= Math.abs(dz)) {
                startVx = dx >= 0 ? 1 : -1;
                startVz = 0;
            } else {
                startVx = 0;
                startVz = dz >= 0 ? 1 : -1;
            }
        }

        let start = {
            x: Number(botStart.x ?? 0),
            y: Number(botStart.y ?? 0),
            z: Number(botStart.z ?? 0),
            vx: Number(startVx),
            vy: Number(startVy),
            vz: Number(startVz)
        };

/*
        // Goal orientation: always use start orientation (original behavior)
        let goal = {
            x: Number(botTarget.x ?? 0),
            y: Number(botTarget.y ?? 0),
            z: Number(botTarget.z ?? 0),
            vx: Number(startVx),
            vy: Number(startVy),
            vz: Number(startVz)
        };
*/

   // Auto-orientation logic:
   // 1. If explicit vx/vy/vz is defined in botTarget (not all zero), use it.
   // 2. Else, check for orthogonal neighbors at the target position using the
   //    TARGET STRUCTURE (this.cluster_target) instead of the current world.
   //    The target structure defines the final configuration, so neighbors there
   //    represent the intended final arrangement. Using the current world is
   //    unreliable because the moving bot has been removed and other bots may
   //    not have reached their targets yet.
   //    - If horizontal neighbors exist in the target structure, point the F-slot
   //      toward the first one.
   //    - If no horizontal neighbors exist in the target structure, use the
   //      start orientation.
   let goalVx = Number(botTarget.vx ?? 0);
   let goalVy = Number(botTarget.vy ?? 0);
   let goalVz = Number(botTarget.vz ?? 0);
    if (goalVx === 0 && goalVy === 0 && goalVz === 0) {
        // No explicit orientation - check for orthogonal neighbors at target
        // using the TARGET STRUCTURE (cluster_target) for reliable orientation
        const targetNeighbors = this.findOrthogonalNeighbors(
            Number(botTarget.x ?? 0),
            Number(botTarget.y ?? 0),
            Number(botTarget.z ?? 0),
            {
                isOccupied: (x, y, z) => {
                    return this.getAllBots(this.cluster_target).some(t =>
                        Number(t.x) === Number(x) &&
                        Number(t.y) === Number(y) &&
                        Number(t.z) === Number(z)
                    );
                }
            }
        );
        // Filter to only horizontal neighbors (x±1, z±1) - VK planner only supports horizontal headings
        const horizontalNeighbors = targetNeighbors.filter(n => n.y === Number(botTarget.y ?? 0));
        if (horizontalNeighbors.length > 0) {
            // Point F-slot toward the first horizontal neighbor
            const firstNeighbor = horizontalNeighbors[0];
            const dx = firstNeighbor.x - Number(botTarget.x ?? 0);
            const dz = firstNeighbor.z - Number(botTarget.z ?? 0);
            // Normalize to unit vector (should already be ±1 in one axis)
            goalVx = Math.sign(dx);
            goalVy = 0;
            goalVz = Math.sign(dz);
            this.debugLog(`_buildWorldAndPlanPath: auto-orientation at target (${botTarget.x},${botTarget.y},${botTarget.z}) -> target-structure neighbor at (${firstNeighbor.x},${firstNeighbor.y},${firstNeighbor.z}) -> orientation=(${goalVx},${goalVy},${goalVz})`);
        } else {
            // No horizontal neighbors in target structure - use start orientation
            goalVx = Number(startVx);
            goalVy = Number(startVy);
            goalVz = Number(startVz);
            this.debugLog(`_buildWorldAndPlanPath: no horizontal neighbors in target structure at (${botTarget.x},${botTarget.y},${botTarget.z}), using start orientation=(${goalVx},${goalVy},${goalVz})`);
        }
    } else {
        this.debugLog(`_buildWorldAndPlanPath: explicit target orientation=(${goalVx},${goalVy},${goalVz})`);
    }
   let goal = {
       x: Number(botTarget.x ?? 0),
       y: Number(botTarget.y ?? 0),
       z: Number(botTarget.z ?? 0),
       vx: Number(goalVx),
       vy: Number(goalVy),
       vz: Number(goalVz)
   };





        let options = {
            max_search_steps: Number(this.VK_MAX_SEARCH_STEPS ?? 100000),
            max_debug_rejections: 120,
            include_start: true
        };

        return this._calcVehicleKinematicsPath(start, goal, world, options);
    } // _buildWorldAndPlanPath()


    //
    // _convertVKPathToCoordArray
    // Converts the vehicle kinematics path result (with states) into a simple
    // array of [x, y, z] coordinate arrays, as expected by the wave logic.
    //
    // Also extracts the VK states (with vx, vy, vz rotation data) for use in
    // morph result export.
    //
    // @returns {Object|null} - { coords: [[x,y,z],...], states: [{x,y,z,vx,vy,vz,dir,support_mode},...] }
    //
    _convertVKPathToCoordArray(vkResult)
    {
        if (!vkResult || !vkResult.ok || !vkResult.states || vkResult.states.length < 2)
           {
           return null;
           }

        const coords = [];
        const states = [];
        for (let i = 0; i < vkResult.states.length; i++)
            {
            const state = vkResult.states[i];
            coords.push([Number(state.x), Number(state.y), Number(state.z)]);
            states.push({
                x: Number(state.x),
                y: Number(state.y),
                z: Number(state.z),
                vx: Number(state.vx ?? 0),
                vy: Number(state.vy ?? 0),
                vz: Number(state.vz ?? 1),
                dir: state.dir ?? null,
                support_mode: state.support_mode ?? "floor"
            });
            }

        return { coords, states };
    } // _convertVKPathToCoordArray()


    // ========================================================================
    // EMBEDDED VEHICLE KINEMATICS PATH PLANNER
    // ========================================================================
    //
    // This is the core A* path planner for vehicle kinematics.
    // It is embedded redundantly to keep the morph independent from API changes.
    //
    // start  : Vehicle start state as object { x, y, z, vx, vy, vz }
    // goal   : Vehicle goal state as object { x, y, z, vx, vy, vz }
    // world  : World with terrain/structure bots and world.forbidden
    // options: Additional options like max_search_steps, max_debug_rejections, debug flags
    //
    _calcVehicleKinematicsPath(start, goal, world, options = {})
    {
        const DIR_XP = Object.freeze({ x: 1, y: 0, z: 0 });
        const DIR_XN = Object.freeze({ x: -1, y: 0, z: 0 });
        const DIR_ZP = Object.freeze({ x: 0, y: 0, z: 1 });
        const DIR_ZN = Object.freeze({ x: 0, y: 0, z: -1 });

        const primitives = Object.freeze({
            meta: Object.freeze({
                cell_states: ["free", "occupied"],
            }),
            primitives: [
                {
                    name: "MOVE_XP_FWD",
                    match: { dir: [1, 0, 0] },
                    pre: [{ cell: [1, 0, 0], is: "free" }  ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [1, -1, 0], is: "occupied" } ],
                    effect: { pos_delta: [1, 0, 0], dir: [1, 0, 0] },
                    cost: 1,
                },             
                {
                    name: "MOVE_XP_BWD",
                    match: { dir: [-1, 0, 0] },
                    pre: [{ cell: [1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [1, -1, 0], is: "occupied" } ],
                    effect: { pos_delta: [1, 0, 0], dir: [-1, 0, 0] },
                    cost: 1,
                },
                {
                    name: "MOVE_XN_FWD",
                    match: { dir: [-1, 0, 0] },
                    pre: [{ cell: [-1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [-1, -1, 0], is: "occupied" }],
                    effect: { pos_delta: [-1, 0, 0], dir: [-1, 0, 0] },
                    cost: 1,
                },
                {
                    name: "MOVE_XN_BWD",
                    match: { dir: [1, 0, 0] },
                    pre: [{ cell: [-1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [-1, -1, 0], is: "occupied" }],
                    effect: { pos_delta: [-1, 0, 0], dir: [1, 0, 0] },
                    cost: 1,
                },
                {
                    name: "MOVE_ZP_FWD",
                    match: { dir: [0, 0, 1] },
                    pre: [{ cell: [0, 0, 1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, 1], is: "occupied" }],
                    effect: { pos_delta: [0, 0, 1], dir: [0, 0, 1] },
                    cost: 1,
                },
                {
                    name: "MOVE_ZP_BWD",
                    match: { dir: [0, 0, -1] },
                    pre: [{ cell: [0, 0, 1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, 1], is: "occupied" }],
                    effect: { pos_delta: [0, 0, 1], dir: [0, 0, -1] },
                    cost: 1,
                },
                {
                    name: "MOVE_ZN_FWD",
                    match: { dir: [0, 0, -1] },
                    pre: [{ cell: [0, 0, -1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, -1], is: "occupied" }],
                    effect: { pos_delta: [0, 0, -1], dir: [0, 0, -1] },
                    cost: 1,
                },
                {
                    name: "MOVE_ZN_BWD",
                    match: { dir: [0, 0, 1] },
                    pre: [{ cell: [0, 0, -1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, -1], is: "occupied" }],
                    effect: { pos_delta: [0, 0, -1], dir: [0, 0, 1] },
                    cost: 1,
                },
                {
                    name: "STEP_DOWN_XP",
                    match: { dir: [-1, 0, 0] },
                    pre: [ { cell: [0, -1, 0], is: "occupied" }, { cell: [1, 0, 0], is: "free" },{ cell: [1, -1, 0], is: "free" } ],
                    effect: { pos_delta_inter: [1, 0, 0], dir_inter: [-1, 0, 0], pos_delta: [1, -1, 0], dir: [-1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "STEP_DOWN_XN",
                    match: { dir: [1, 0, 0] },
                    pre: [ { cell: [0, -1, 0], is: "occupied" }, { cell: [-1, 0, 0], is: "free" }, { cell: [-1, -1, 0], is: "free" }],
                    effect: { pos_delta_inter: [-1, 0, 0], dir_inter: [1, 0, 0], pos_delta: [-1, -1, 0], dir: [1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "STEP_DOWN_ZP",
                    match: { dir: [0, 0, -1] },
                    pre: [ { cell: [0, -1, 0], is: "occupied" }, { cell: [0, 0, 1], is: "free" },{ cell: [0, -1, 1], is: "free" }],
                    effect: { pos_delta_inter: [0, 0, 1], dir_inter: [0, 0, -1], pos_delta: [0, -1, 1], dir: [0, 0, -1] },
                    cost: 2,
                },
                {
                    name: "STEP_DOWN_ZN",
                    match: { dir: [0, 0, 1] },
                    pre: [{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, 0, -1], is: "free" },{ cell: [0, -1, -1], is: "free" }],
                    effect: { pos_delta_inter: [0, 0, -1], dir_inter: [0, 0, 1], pos_delta: [0, -1, -1], dir: [0, 0, 1] },
                    cost: 2,
                },
                {
                    name: "STEP_UP_XN",
                    match: { dir: [-1, 0, 0] },
                    pre: [ { cell: [-1, 0, 0], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [-1, 1, 0], is: "free" } ],
                    effect: { pos_delta_inter: [0, 1, 0], dir_inter: [-1, 0, 0], pos_delta: [-1, 1, 0], dir: [-1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "STEP_UP_XP",
                    match: { dir: [1, 0, 0] },
                    pre: [ { cell: [1, 0, 0], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [1, 1, 0], is: "free" }],
                    effect: { pos_delta_inter: [0, 1, 0], dir_inter: [1, 0, 0], pos_delta: [1, 1, 0], dir: [1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "STEP_UP_ZN",
                    match: { dir: [0, 0, -1] },
                    pre: [{ cell: [0, 0, -1], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [0, 1, -1], is: "free" }],
                    effect: { pos_delta_inter: [0, 1, 0], dir_inter: [0, 0, -1], pos_delta: [0, 1, -1], dir: [0, 0, -1] },
                    cost: 2,
                },
                {
                    name: "STEP_UP_ZP",
                    match: { dir: [0, 0, 1] },
                    pre: [ { cell: [0, 0, 1], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [0, 1, 1], is: "free" }],
                    effect: { pos_delta_inter: [0, 1, 0], dir_inter: [0, 0, 1], pos_delta: [0, 1, 1], dir: [0, 0, 1] },
                    cost: 2,
                },
                {
                    name: "WALL_DOWN_XP",
                    match: { dir: [1, 0, 0] },
                    pre: [
                        { cell: [0, -1, 0], is: "free" },
                        { cell: [1, 0, 0], is: "occupied" },
                        { cell: [1, -1, 0], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, -1, 0], dir: [1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "WALL_DOWN_XN",
                    match: { dir: [-1, 0, 0] },
                    pre: [
                        { cell: [0, -1, 0], is: "free" },
                        { cell: [-1, 0, 0], is: "occupied" },
                        { cell: [-1, -1, 0], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, -1, 0], dir: [-1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "WALL_DOWN_ZP",
                    match: { dir: [0, 0, 1] },
                    pre: [
                        { cell: [0, -1, 0], is: "free" },
                        { cell: [0, 0, 1], is: "occupied" },
                        { cell: [0, -1, 1], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, -1, 0], dir: [0, 0, 1] },
                    cost: 2,
                },
                {
                    name: "WALL_DOWN_ZN",
                    match: { dir: [0, 0, -1] },
                    pre: [
                        { cell: [0, -1, 0], is: "free" },
                        { cell: [0, 0, -1], is: "occupied" },
                        { cell: [0, -1, -1], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, -1, 0], dir: [0, 0, -1] },
                    cost: 2,
                },
                {
                    name: "WALL_UP_XP",
                    match: { dir: [1, 0, 0] },
                    pre: [
                        { cell: [0, 1, 0], is: "free" },
                        { cell: [1, 0, 0], is: "occupied" },
                        { cell: [1, 1, 0], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, 1, 0], dir: [1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "WALL_UP_XN",
                    match: { dir: [-1, 0, 0] },
                    pre: [
                        { cell: [0, 1, 0], is: "free" },
                        { cell: [-1, 0, 0], is: "occupied" },
                        { cell: [-1, 1, 0], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, 1, 0], dir: [-1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "WALL_UP_ZP",
                    match: { dir: [0, 0, 1] },
                    pre: [
                        { cell: [0, 1, 0], is: "free" },
                        { cell: [0, 0, 1], is: "occupied" },
                        { cell: [0, 1, 1], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, 1, 0], dir: [0, 0, 1] },
                    cost: 2,
                },
                {
                    name: "WALL_UP_ZN",
                    match: { dir: [0, 0, -1] },
                    pre: [
                        { cell: [0, 1, 0], is: "free" },
                        { cell: [0, 0, -1], is: "occupied" },
                        { cell: [0, 1, -1], is: "occupied" },
                    ],
                    effect: { pos_delta: [0, 1, 0], dir: [0, 0, -1] },
                    cost: 2,
                },
                {
                    name: "ROT_LEFT_XP_TO_ZN",
                    match: { dir: [1, 0, 0] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [0, 0, -1] },
                    cost: 2,
                },
                {
                    name: "ROT_RIGHT_XP_TO_ZP",
                    match: { dir: [1, 0, 0] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [0, 0, 1] },
                    cost: 2,
                },
                {
                    name: "ROT_LEFT_XN_TO_ZP",
                    match: { dir: [-1, 0, 0] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [0, 0, 1] },
                    cost: 2,
                },
                {
                    name: "ROT_RIGHT_XN_TO_ZN",
                    match: { dir: [-1, 0, 0] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [0, 0, -1] },
                    cost: 2,
                },
                {
                    name: "ROT_LEFT_ZP_TO_XP",
                    match: { dir: [0, 0, 1] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "ROT_RIGHT_ZP_TO_XN",
                    match: { dir: [0, 0, 1] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [-1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "ROT_LEFT_ZN_TO_XN",
                    match: { dir: [0, 0, -1] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [-1, 0, 0] },
                    cost: 2,
                },
                {
                    name: "ROT_RIGHT_ZN_TO_XP",
                    match: { dir: [0, 0, -1] },
                    pre: [ { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ],
                    effect: { pos_delta: [0, 0, 0], dir: [1, 0, 0] },
                    cost: 2,
                },
            ],
        });

        const primitiveList = primitives.primitives.slice();
        const primitiveByName = new Map(primitiveList.map((primitive) => [primitive.name, primitive]));
        const primitiveOrder = primitiveList.map((primitive) => primitive.name);
        const primitiveCosts = Object.fromEntries(primitiveList.map((primitive) => [primitive.name, Number(primitive.cost ?? 1)]));

        const forbiddenSource = (world && world.forbidden) ?? options.forbidden ?? options.forbidden_world ?? null;
        const isForbidden = (x, y, z) => {
            if (!forbiddenSource) return false;

            if (typeof forbiddenSource.isOccupied === "function") {
                return forbiddenSource.isOccupied(x, y, z);
            }

            if (typeof forbiddenSource.get === "function") {
                return forbiddenSource.get(x, y, z) !== null;
            }

            if (Array.isArray(forbiddenSource)) {
                for (let i = 0; i < forbiddenSource.length; i++) {
                    const cell = forbiddenSource[i];
                    if (
                        Number(cell?.x) === Number(x) &&
                        Number(cell?.y) === Number(y) &&
                        Number(cell?.z) === Number(z)
                    ) {
                        return true;
                    }
                }
            }

            return false;
        }; // isForbidden()

        const canCheckTerrain = Boolean(world && typeof world.isFree === "function");
        const isFree = canCheckTerrain
            ? (x, y, z) => world.isFree(x, y, z) && !isForbidden(x, y, z)
            : (x, y, z) => !isForbidden(x, y, z);

        function normalizeVehicleHeading(input) {
            const x = Number(input?.vx ?? input?.x ?? input?.dir?.x ?? 0);
            const y = Number(input?.vy ?? input?.y ?? input?.dir?.y ?? 0);
            const z = Number(input?.vz ?? input?.z ?? input?.dir?.z ?? 0);

            const sx = Math.sign(x);
            const sy = Math.sign(y);
            const sz = Math.sign(z);

            if (sx === 1) return DIR_XP;
            if (sx === -1) return DIR_XN;
            if (sz === 1) return DIR_ZP;
            if (sz === -1) return DIR_ZN;
            if (sy === 1) return { x: 0, y: 1, z: 0 };
            if (sy === -1) return { x: 0, y: -1, z: 0 };
            return DIR_ZP;
        } // normalizeVehicleHeading()

        function makeVehicleState(input = {}) {
            const heading = normalizeVehicleHeading(input.dir ?? input);
            return {
                x: Number(input.x ?? 0),
                y: Number(input.y ?? 0),
                z: Number(input.z ?? 0),
                vx: heading.x,
                vy: heading.y,
                vz: heading.z,
                support: input.support ?? null,
                edge: input.edge ?? null,
            };
        } // makeVehicleState()

        function cloneVehicleState(state, patch = {}) {
            return makeVehicleState({
                x: patch.x ?? state.x,
                y: patch.y ?? state.y,
                z: patch.z ?? state.z,
                dir: patch.dir ?? { x: patch.vx ?? state.vx, y: patch.vy ?? state.vy, z: patch.vz ?? state.vz },
                support: patch.support ?? state.support ?? null,
                edge: patch.edge ?? state.edge ?? null,
            });
        } // cloneVehicleState()

        function buildStateKey(state) {
            return [
                Number(state.x ?? 0),
                Number(state.y ?? 0),
                Number(state.z ?? 0),
                Number(state.vx ?? 0),
                Number(state.vy ?? 0),
                Number(state.vz ?? 0),
            ].join("|");
        } // buildStateKey()

        function sameHeading(a, b) {
            return Number(a?.x ?? 0) === Number(b?.x ?? 0) &&
                Number(a?.y ?? 0) === Number(b?.y ?? 0) &&
                Number(a?.z ?? 0) === Number(b?.z ?? 0);
        } // sameHeading()

        function headingKey(heading) {
            const dir = normalizeVehicleHeading(heading);
            if (dir.x === 1) return "XP";
            if (dir.x === -1) return "XN";
            if (dir.z === 1) return "ZP";
            if (dir.z === -1) return "ZN";
            return "ZP";
        } // headingKey()

        function rotationLowerBound(currentHeading, goalHeading) {
            const current = headingKey(currentHeading);
            const goalDir = headingKey(goalHeading);
            if (current === goalDir) return 0;
            const table = {
                XP: { XP: 0, ZP: 1, XN: 2, ZN: 1 },
                XN: { XN: 0, ZP: 1, XP: 2, ZN: 1 },
                ZP: { ZP: 0, XP: 1, ZN: 2, XN: 1 },
                ZN: { ZN: 0, XP: 1, ZP: 2, XN: 1 },
            };
            return table[current]?.[goalDir] ?? 0;
        } // rotationLowerBound()

        function manhattan3d(a, b) {
            return Math.abs(Number(a.x ?? 0) - Number(b.x ?? 0)) +
                Math.abs(Number(a.y ?? 0) - Number(b.y ?? 0)) +
                Math.abs(Number(a.z ?? 0) - Number(b.z ?? 0));
        } // manhattan3d()

        const startState = makeVehicleState(start);
        const goalState = makeVehicleState(goal);
        const includeStart = options.include_start !== false;
        const maxDebugRejections = Math.max(0, Number(options.max_debug_rejections ?? 120));
        const maxSearchSteps = Math.max(1, Number(options.max_search_steps ?? 100000));
        const openKeys = [];
        const openSet = new Set();
        const closedSet = new Set();
        const cameFrom = new Map();
        const actionFrom = new Map();
        const stateByKey = new Map();
        const gScore = new Map();
        const hScore = new Map();
        const fScore = new Map();
        const rejectionCounts = new Map();
        const debugRejections = [];
        let expandedNodes = 0;
        let generatedNodes = 0;
        let bestPartialKey = null;

        const recordRejection = (currentState, primitiveName, transition) => {
            const error = transition?.error ?? "ERR_PRIMITIVE_BLOCKED";
            rejectionCounts.set(error, (rejectionCounts.get(error) ?? 0) + 1);

            if (debugRejections.length >= maxDebugRejections) {
                return;
            }

            debugRejections.push({
                from: cloneVehicleState(currentState),
                primitive: primitiveName,
                error,
                target: transition?.target ?? null,
                contact: transition?.contact ?? null,
                expected_support: transition?.expected_support ?? null,
                actual_support: transition?.actual_support ?? null,
                composite: null,
                failed_step_index: null,
                failed_primitive: null,
                step_error: null,
                macro_trace: null,
                gate_debug: transition?.gate_debug ?? null,
            });
        }; // recordRejection()

        const considerBestPartial = (key) => {
            if (!key) return;
            const candidateState = stateByKey.get(key);
            if (!candidateState) return;

            const candidateH = hScore.get(key) ?? Infinity;
            const candidateG = gScore.get(key) ?? Infinity;

            if (!bestPartialKey) {
                bestPartialKey = key;
                return;
            }

            const currentBestH = hScore.get(bestPartialKey) ?? Infinity;
            const currentBestG = gScore.get(bestPartialKey) ?? Infinity;
            if (
                candidateH < currentBestH ||
                (candidateH === currentBestH && candidateG < currentBestG)
            ) {
                bestPartialKey = key;
            }
        }; // considerBestPartial()

        const heuristic = (state) => {
            return manhattan3d(state, goalState) + rotationLowerBound(state, goalState) * 2;
        }; // heuristic()

        const goalMatches = (state) => {
            const normalized = makeVehicleState(state);
            return (
                Number(normalized.x) === Number(goalState.x) &&
                Number(normalized.y) === Number(goalState.y) &&
                Number(normalized.z) === Number(goalState.z) &&
                Number(normalized.vx) === Number(goalState.vx) &&
                Number(normalized.vy) === Number(goalState.vy) &&
                Number(normalized.vz) === Number(goalState.vz)
            );
        }; // goalMatches()

        const isTerrainOccupied = (x, y, z) => {
            if (!canCheckTerrain) return false;
            if (isForbidden(x, y, z)) return false;
            return world.isOccupied(x, y, z);
        }; // isTerrainOccupied()

        const applyPrimitive = (currentState, primitiveName) => {
            const primitive = primitiveByName.get(primitiveName);
            if (!primitive) {
                return {
                    ok: false,
                    error: "ERR_UNKNOWN_PRIMITIVE",
                    gate_debug: { reason_code: "unknown_primitive" },
                };
            }

            const currentHeading = normalizeVehicleHeading(currentState);
            const requiredHeading = primitive.match?.dir
                ? normalizeVehicleHeading({ vx: primitive.match.dir[0], vy: primitive.match.dir[1], vz: primitive.match.dir[2] })
                : null;

            if (requiredHeading && !sameHeading(currentHeading, requiredHeading)) {
                return {
                    ok: false,
                    error: "ERR_PRIMITIVE_DIR_MISMATCH",
                    gate_debug: {
                        kind: primitive.kind ?? "primitive",
                        reason_code: "wrong_heading",
                        current_heading: currentHeading,
                        required_heading: requiredHeading,
                    },
                };
            }

            const deltas = Array.isArray(primitive.effect?.pos_delta) ? primitive.effect.pos_delta : [0, 0, 0];
            const targetX = Number(currentState.x) + Number(deltas[0] ?? 0);
            const targetY = Number(currentState.y) + Number(deltas[1] ?? 0);
            const targetZ = Number(currentState.z) + Number(deltas[2] ?? 0);
            const targetFree = isFree(targetX, targetY, targetZ);
            const orthogonalOffsets = [
                { x: 1, y: 0, z: 0 },
                { x: -1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                { x: 0, y: -1, z: 0 },
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: -1 },
            ];
            const targetOrthogonalContacts = (() => {
                if (!canCheckTerrain) return [];
                const contacts = [];
                for (let i = 0; i < orthogonalOffsets.length; i++) {
                    const offset = orthogonalOffsets[i];
                    const cx = targetX + offset.x;
                    const cy = targetY + offset.y;
                    const cz = targetZ + offset.z;
                    if (isTerrainOccupied(cx, cy, cz)) {
                        contacts.push({ x: cx, y: cy, z: cz });
                    }
                }
                return contacts;
            })();
            const hasTargetContact = !canCheckTerrain || targetOrthogonalContacts.length > 0;

            for (let i = 0; i < (primitive.pre ?? []).length; i++) {
                const pre = primitive.pre[i];
                const rel = Array.isArray(pre?.cell) ? pre.cell : [0, 0, 0];
                const checkX = Number(currentState.x) + Number(rel[0] ?? 0);
                const checkY = Number(currentState.y) + Number(rel[1] ?? 0);
                const checkZ = Number(currentState.z) + Number(rel[2] ?? 0);
                const shouldBeFree = String(pre?.is ?? "free") === "free";
                const free = isFree(checkX, checkY, checkZ);
                const occupied = isTerrainOccupied(checkX, checkY, checkZ);
                if (shouldBeFree && !free) {
                    return {
                        ok: false,
                        error: "ERR_PRECONDITION_BLOCKED",
                        target: { x: targetX, y: targetY, z: targetZ },
                        contact: { x: checkX, y: checkY, z: checkZ },
                        gate_debug: {
                            kind: primitive.kind ?? "primitive",
                            reason_code: "precondition_blocked",
                            pre_index: i,
                            pre_cell: { x: checkX, y: checkY, z: checkZ, free: false },
                        },
                    };
                }
                if (!shouldBeFree && !occupied) {
                    return {
                        ok: false,
                        error: "ERR_PRECONDITION_BLOCKED",
                        target: { x: targetX, y: targetY, z: targetZ },
                        contact: { x: checkX, y: checkY, z: checkZ },
                        gate_debug: {
                            kind: primitive.kind ?? "primitive",
                            reason_code: "precondition_blocked",
                            pre_index: i,
                            pre_cell: { x: checkX, y: checkY, z: checkZ, free: true, occupied: false },
                        },
                    };
                }
            }

            if (primitive.kind === "move" && !targetFree) {
                return {
                    ok: false,
                    error: "ERR_TARGET_BLOCKED",
                    target: { x: targetX, y: targetY, z: targetZ },
                    contact: { x: targetX, y: targetY, z: targetZ },
                    gate_debug: {
                        kind: primitive.kind ?? "primitive",
                        reason_code: "target_blocked",
                        target: { x: targetX, y: targetY, z: targetZ, free: false },
                    },
                };
            }

            if (!hasTargetContact) {
                return {
                    ok: false,
                    error: "ERR_NO_CONTACT",
                    target: { x: targetX, y: targetY, z: targetZ },
                    contact: null,
                    gate_debug: {
                        kind: primitive.kind ?? "primitive",
                        reason_code: "no_orthogonal_contact",
                        target: {
                            x: targetX,
                            y: targetY,
                            z: targetZ,
                            free: targetFree,
                        },
                        orthogonal_contacts: targetOrthogonalContacts,
                        can_use: false,
                    },
                };
            }

            const nextHeading = primitive.effect?.dir
                ? normalizeVehicleHeading({ vx: primitive.effect.dir[0], vy: primitive.effect.dir[1], vz: primitive.effect.dir[2] })
                : currentHeading;

            return {
                ok: true,
                state: makeVehicleState({
                    x: targetX,
                    y: targetY,
                    z: targetZ,
                    dir: nextHeading,
                    support: null,
                    edge: null,
                }),
                cost: Number(primitive.cost ?? 1),
                gate_debug: {
                    kind: primitive.kind ?? "primitive",
                    reason_code: "ok",
                },
            };
        }; // applyPrimitive()

        const expandState = (currentState, currentKey, currentG) => {
            const neighbors = [];
            for (let i = 0; i < primitiveOrder.length; i++) {
                const primitiveName = primitiveOrder[i];
                generatedNodes++;

                const transition = applyPrimitive(currentState, primitiveName);
                if (!transition.ok) {
                    recordRejection(currentState, primitiveName, transition);
                    continue;
                }

                const nextState = makeVehicleState(transition.state);
                const nextKey = buildStateKey(nextState);
                const stepCost = Number(transition.cost ?? primitiveCosts[primitiveName] ?? 1);
                const tentativeG = currentG + stepCost;
                const knownG = gScore.get(nextKey);

                if (knownG !== undefined && tentativeG >= knownG) {
                    continue;
                }

                neighbors.push({
                    primitive: primitiveName,
                    state: nextState,
                    key: nextKey,
                    g: tentativeG,
                    h: heuristic(nextState),
                    fromKey: currentKey,
                    trace: [cloneVehicleState(currentState), nextState],
                    actions: [primitiveName],
                });
            }
            return neighbors;
        }; // expandState()

        const reconstructPath = (terminalKey) => {
            const statesRev = [];
            const actionsRev = [];
            let cursor = terminalKey;

            while (cursor !== null && cursor !== undefined) {
                const state = stateByKey.get(cursor);
                if (state) {
                    statesRev.push(cloneVehicleState(state));
                }

                const parent = cameFrom.get(cursor);
                const action = actionFrom.get(cursor);
                if (parent !== undefined && parent !== null && action) {
                    actionsRev.push(action);
                }

                cursor = parent ?? null;
            }

            statesRev.reverse();
            actionsRev.reverse();

            return {
                states: includeStart ? statesRev : statesRev.slice(1),
                states_full: statesRev,
                actions: actionsRev,
                total_cost: gScore.get(terminalKey) ?? actionsRev.length,
                terminal_key: terminalKey,
                terminal_state: stateByKey.get(terminalKey) ?? null,
                heuristic: hScore.get(terminalKey) ?? null,
                f_score: fScore.get(terminalKey) ?? null,
            };
        }; // reconstructPath()

        const headingLabelFromVector = (state) => {
            const vx = Number(state?.vx ?? 0);
            const vy = Number(state?.vy ?? 0);
            const vz = Number(state?.vz ?? 0);
            if (vx === 1 && vy === 0 && vz === 0) return "PX";
            if (vx === -1 && vy === 0 && vz === 0) return "XN";
            if (vx === 0 && vy === 0 && vz === 1) return "ZP";
            if (vx === 0 && vy === 0 && vz === -1) return "ZN";
            if (vx === 0 && vy === 0 && vz === 0) return "\u2014";
            return `[${vx},${vy},${vz}]`;
        }; // headingLabelFromVector()

        const supportModeFromPrimitiveName = (primitiveName) => {
            const name = String(primitiveName ?? "");
            return name.startsWith("WALL_") ? "wall" : "floor";
        }; // supportModeFromPrimitiveName()

        const serializeVehicleState = (state, supportMode = null) => {
            if (!state) return null;
            const vx = Number(state.vx ?? 0);
            const vy = Number(state.vy ?? 0);
            const vz = Number(state.vz ?? 0);
            return {
                x: Number(state.x ?? 0),
                y: Number(state.y ?? 0),
                z: Number(state.z ?? 0),
                vx,
                vy,
                vz,
                dir: headingLabelFromVector({ vx, vy, vz }),
                support_mode: String(supportMode ?? state.support ?? "floor"),
            };
        }; // serializeVehicleState()

        const interpolateStateBetweenPrimitiveSteps = (beforeState, primitiveName) => {
            const primitive = primitiveByName.get(String(primitiveName ?? ""));
            const deltaInter = primitive?.effect?.pos_delta_inter;
            const dirInter = primitive?.effect?.dir_inter;
            if (!Array.isArray(deltaInter) || deltaInter.length < 3) return [];

            const midState = cloneVehicleState(beforeState, {
                x: Number(beforeState?.x ?? 0) + Number(deltaInter[0] ?? 0),
                y: Number(beforeState?.y ?? 0) + Number(deltaInter[1] ?? 0),
                z: Number(beforeState?.z ?? 0) + Number(deltaInter[2] ?? 0),
                dir: Array.isArray(dirInter) && dirInter.length >= 3
                    ? { x: Number(dirInter[0] ?? 0), y: Number(dirInter[1] ?? 0), z: Number(dirInter[2] ?? 0) }
                    : undefined,
                support: "floor",
            });
            return midState ? [midState] : [];
        }; // interpolateStateBetweenPrimitiveSteps()

        const decoratePathDataForOutput = (pathData) => {
            if (!pathData) return null;
            const rawStates = Array.isArray(pathData.states_full)
                ? pathData.states_full
                : Array.isArray(pathData.states)
                    ? pathData.states
                    : [];
            const rawActions = Array.isArray(pathData.actions) ? pathData.actions : [];
            const publicStates = [];

            if (rawStates.length > 0) {
                publicStates.push(serializeVehicleState(rawStates[0], rawStates[0]?.support ?? "floor"));
            }

            for (let i = 0; i < rawActions.length; i++) {
                const beforeState = rawStates[i] ?? null;
                const afterState = rawStates[i + 1] ?? null;
                const primitiveName = String(rawActions[i] ?? "");
                const supportMode = supportModeFromPrimitiveName(primitiveName);
                const midStates = beforeState
                    ? interpolateStateBetweenPrimitiveSteps(beforeState, primitiveName)
                    : [];

                for (let j = 0; j < midStates.length; j++) {
                    publicStates.push(serializeVehicleState(midStates[j], "floor"));
                }

                if (afterState) {
                    publicStates.push(serializeVehicleState(afterState, supportMode));
                }
            }

            const publicStatesOut = includeStart ? publicStates : publicStates.slice(1);
            const publicStatesFull = publicStates.slice();
            const lastPublicState = publicStatesOut.length > 0 ? publicStatesOut[publicStatesOut.length - 1] : null;
            const firstPublicState = publicStatesOut.length > 0 ? publicStatesOut[0] : null;

            return {
                ...pathData,
                states: publicStatesOut,
                states_full: publicStatesFull,
                terminal_state: lastPublicState ?? serializeVehicleState(pathData.terminal_state ?? null, null),
                start_state: firstPublicState ?? serializeVehicleState(pathData.states_full?.[0] ?? pathData.states?.[0] ?? null, null),
            };
        }; // decoratePathDataForOutput()

        const buildFinalResult = (pathData, extra = {}) => {
            const publicPathData = decoratePathDataForOutput(pathData);
            const dominantBlockReason = (() => {
                let bestReason = null;
                let bestCount = -1;
                for (const [reason, count] of rejectionCounts.entries()) {
                    if (count > bestCount) {
                        bestReason = reason;
                        bestCount = count;
                    }
                }
                return bestReason;
            })();

            const goalReachedExplicit = Boolean(
                goalState &&
                publicPathData &&
                publicPathData.terminal_state &&
                goalMatches(pathData.terminal_state ?? publicPathData.terminal_state)
            );

            const lastReachableState = publicPathData?.terminal_state ?? null;
            const lastReachableActions = publicPathData?.actions ?? [];
            const publicStartState = serializeVehicleState(startState, startState?.support ?? null);
            const publicGoalState = serializeVehicleState(goalState, goalState?.support ?? null);
            const errorStats = Object.fromEntries(rejectionCounts.entries());

            const result = {
                ok: Boolean(extra.ok),
                answer: "calc_vehicle_kinematics_path",
                error: extra.error ?? null,
                error_code: extra.ok ? null : (extra.error ?? "PATH_NOT_FOUND"),
                path_found: Boolean(extra.ok),
                dominant_block_reason: dominantBlockReason,
                start_state: publicStartState,
                goal_state: publicGoalState,
                states: publicPathData?.states ?? [],
                states_full: publicPathData?.states,
                actions: publicPathData?.actions ?? [],
                actions_full: publicPathData?.actions,
                path: publicPathData?.path ?? [],
                path_full: publicPathData?.path,
                terminal_state: publicPathData?.terminal_state ?? null,
                terminal_state_full: publicPathData?.terminal_state,
                expanded_nodes: expandedNodes,
                generated_nodes: generatedNodes,
                rejection_counts: errorStats,
                dominant_block_reason: dominantBlockReason,
                best_partial_path: extra.best_partial ?? null,
                best_partial_path_full: extra.best_partial,
                start_state_full: startState,
                goal_state_full: goalState,
                world: world,
                world_bounds: null,
                debug: {
                    open_set_size: openSet.size,
                    closed_set_size: closedSet.size,
                    expanded_nodes: expandedNodes,
                    generated_nodes: generatedNodes,
                    rejection_counts: errorStats,
                    dominant_block_reason: dominantBlockReason,
                    best_partial_key: bestPartialKey,
                    best_partial_g: bestPartialKey ? (gScore.get(bestPartialKey) ?? null) : null,
                    best_partial_h: bestPartialKey ? (hScore.get(bestPartialKey) ?? null) : null,
                    best_partial_f: bestPartialKey ? (fScore.get(bestPartialKey) ?? null) : null,
                },
            };

            // Add non-enumerable properties for full data access
            Object.defineProperties(result, {
                states_full: { value: publicPathData?.states, enumerable: false, writable: true },
                generated_nodes: { value: generatedNodes, enumerable: false, writable: true },
                debug_rejections: { value: errorStats, enumerable: false, writable: true },
                special_gate_trace: { value: null, enumerable: false, writable: true },
                debug: { value: result.debug, enumerable: false, writable: true },
                _world_access: { value: world, enumerable: false, writable: true },
            });

            return result;
        } // buildFinalResult()



        // ========================================================================
        //  A* MAIN LOOP
        // ========================================================================

        const startKey = buildStateKey(startState);
        openSet.add(startKey);
        openKeys.push(startKey);
        stateByKey.set(startKey, startState);
        cameFrom.set(startKey, null);
        actionFrom.set(startKey, null);
        gScore.set(startKey, 0);
        hScore.set(startKey, heuristic(startState));
        fScore.set(startKey, 0 + heuristic(startState));

        considerBestPartial(startKey);

        while (openKeys.length > 0) {
            // Sort by fScore (ascending) - simple priority queue
            openKeys.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
            const bestKey = openKeys.shift();
            openSet.delete(bestKey);

            if (closedSet.has(bestKey)) {
                continue;
            }

            const currentState = stateByKey.get(bestKey);
            if (!currentState) {
                continue;
            }

            closedSet.add(bestKey);
            expandedNodes++;

            if (goalMatches(currentState)) {
                const successPath = reconstructPath(bestKey);
                return buildFinalResult(successPath, {
                    ok: true,
                    error: null,
                    best_partial: null,
                });
            }

            const currentG = gScore.get(bestKey) ?? Infinity;
            const nextStates = expandState(currentState, bestKey, currentG);

            for (let i = 0; i < nextStates.length; i++) {
                const next = nextStates[i];
                cameFrom.set(next.key, next.fromKey);
                actionFrom.set(next.key, next.actions?.[0] ?? next.primitive);
                stateByKey.set(next.key, next.state);
                gScore.set(next.key, next.g);
                hScore.set(next.key, next.h);
                fScore.set(next.key, next.g + next.h);

                if (closedSet.has(next.key)) {
                    closedSet.delete(next.key);
                }

                if (!openSet.has(next.key)) {
                    openSet.add(next.key);
                    openKeys.push(next.key);
                }

                considerBestPartial(next.key);
            } // for nextStates
        } // while

        const partialKey = bestPartialKey ?? startKey;
        const partialPath = reconstructPath(partialKey);
        return buildFinalResult(null, {
            ok: false,
            error: "PATH_NOT_FOUND",
            best_partial: partialPath,
        });
    } // _calcVehicleKinematicsPath()



    // ========================================================================
    //  stepMorph() - Main wave loop
    //  Adapted from MorphBFSWavefront.stepMorph(), but uses
    //  _buildWorldAndPlanPath() instead of planPath3D().
    // ========================================================================

    //
    // stepMorph()
    //
    stepMorph(caller, finishHandler) {

        this.debugLog("=== stepMorph() called ===");

        let plannedCells = JSON.parse(JSON.stringify(this.cells));

        if (this.areAllBotsHappy(this.cluster_target, plannedCells)) {
            this.debugLog("All bots are happy! Morphing complete.");
            this.log("All bots are happy! Morphing complete.");
            this.progress = 100;
            finishHandler(this.morphLog, true);
            return;
        }

        const attemptedPairs = new Set();
        const reservedTargets = new Set();
        const movedBotsInWave = new Set();

        this.bot_start = null;
        this.bot_target = null;
        this.bot_id = null;

    // --- Wave loop: find and move bots until all targets are occupied or no more pairs found ---
    let round = 0;
    while (true) {
        round++;
        this.debugLog(`=== choosePair round ${round} ===`);
        const pathResult = {};
        const success = this.choosePair(plannedCells, attemptedPairs, reservedTargets, movedBotsInWave, pathResult);

        let logMsg = `choosePair round=${round}: success=${success}`;
        if (success && this.bot_start && this.bot_target) {
            logMsg += ` bot_id=${this.bot_id}`;
            logMsg += ` from=(${this.bot_start.x},${this.bot_start.y},${this.bot_start.z})`;
            logMsg += ` to=(${this.bot_target.x},${this.bot_target.y},${this.bot_target.z})`;
            logMsg += ` orientation=(${this.bot_start.vx ?? 0},${this.bot_start.vy ?? 0},${this.bot_start.vz ?? 1})`;

            // Use the path already computed by choosePair (stored in pathResult.vkResult)
            const vkResult = pathResult.vkResult || null;
            const pathValid = vkResult && vkResult.ok && vkResult.states && vkResult.states.length >= 2;
            logMsg += ` path_valid=${pathValid}`;
            if (pathValid) {
                logMsg += ` path_len=${vkResult.states.length}`;
                logMsg += ` error=${vkResult.error ?? 'none'}`;
            } else {
                logMsg += ` error=${vkResult ? (vkResult.error ?? 'PATH_NOT_FOUND') : 'vkResult_null'}`;
            }

            // Mark bot as moved in this wave so choosePair() skips it in the next round
            movedBotsInWave.add(this.bot_id);

            // Move the bot to its target position in plannedCells for the next round
            // Use the goal orientation from bot_target (set by choosePair / _buildWorldAndPlanPath)
            // instead of the last state from the path planner, because the path planner may
            // return PATH_NOT_FOUND with best_partial where the last state has wrong orientation.
            let targetVx = Number(this.bot_target.vx ?? 0);
            let targetVy = Number(this.bot_target.vy ?? 0);
            let targetVz = Number(this.bot_target.vz ?? 0);
            // Fallback: if bot_target has no explicit orientation from the structure JSON,
            // use the goal orientation from the path planner result (which includes auto-orientation).
            // Only if even that fails, fall back to start orientation.
            if (targetVx === 0 && targetVy === 0 && targetVz === 0) {
                // Use goal orientation from path planner (auto-orientation calculated by _buildWorldAndPlanPath)
                if (vkResult && vkResult.goal_state) {
                    targetVx = Number(vkResult.goal_state.vx ?? 0);
                    targetVy = Number(vkResult.goal_state.vy ?? 0);
                    targetVz = Number(vkResult.goal_state.vz ?? 0);
                }
                // Ultimate fallback: if even goal_state has no orientation, use start orientation
                if (targetVx === 0 && targetVy === 0 && targetVz === 0) {
                    targetVx = Number(this.bot_start.vx ?? 0);
                    targetVy = Number(this.bot_start.vy ?? 0);
                    targetVz = Number(this.bot_start.vz ?? 1);
                }
            }
            this.addBotToCells({
                id: this.bot_id,
                x: this.bot_target.x,
                y: this.bot_target.y,
                z: this.bot_target.z,
                vx: targetVx,
                vy: targetVy,
                vz: targetVz
            }, plannedCells);
            logMsg += ` moved_to_target=(${this.bot_target.x},${this.bot_target.y},${this.bot_target.z}) orientation=(${targetVx},${targetVy},${targetVz})`;

            // Register this single move as its own wave in morphLog (one move per wave)
            if (vkResult && vkResult.ok && vkResult.states && vkResult.states.length >= 2) {
                const coordPath = vkResult.states.map(s => [Number(s.x), Number(s.y), Number(s.z)]);
                const singleWavePath = [{
                    path: coordPath,
                    botStart: { x: this.bot_start.x, y: this.bot_start.y, z: this.bot_start.z, vx: Number(this.bot_start.vx ?? 0), vy: Number(this.bot_start.vy ?? 0), vz: Number(this.bot_start.vz ?? 1) },
                    botTarget: { x: this.bot_target.x, y: this.bot_target.y, z: this.bot_target.z, vx: targetVx, vy: targetVy, vz: targetVz },
                    botId: this.bot_id,
                    pathStates: vkResult.states
                }];
                this.wavecnt++;
                this.registerMorphStepForExport(singleWavePath, this.wavecnt);
                this.debugLog(`stepMorph: registered move for bot=${this.bot_id} as wave ${this.wavecnt}`);
            }
        } else {
            logMsg += ` bot_start=${JSON.stringify(this.bot_start)} bot_target=${JSON.stringify(this.bot_target)}`;
        }

        this.debugLog(logMsg);
        this.log(logMsg);

        // Stop if no pair was found in this round
        if (!success) {
            this.debugLog(`stepMorph: no more pairs found after ${round} rounds.`);
            this.log(`stepMorph: no more pairs found after ${round} rounds.`);
            break;
        }

        // Stop if all bots are happy
        if (this.areAllBotsHappy(this.cluster_target, plannedCells)) {
            this.debugLog(`stepMorph: all bots happy after ${round} rounds.`);
            this.log(`stepMorph: all bots happy after ${round} rounds.`);
            break;
        }
    } // while (true)

    // Call finishHandler to complete this morph step
    // success=true if all bots are happy, false otherwise
    const allHappy = this.areAllBotsHappy(this.cluster_target, plannedCells);
    finishHandler(this.morphLog, allHappy);
    return;
    } // stepMorph()



    // ========================================================================
    //  run() - Entry point for the morph algorithm
    // ========================================================================

    //
    // Main-handler for the morph-algo
    //
    run(caller, finishHandler) {
        this.progress = 0;

        if (typeof finishHandler === "function") {
            this.stepMorph(caller, finishHandler);
        } else {
            console.warn("Finishhandler is NOT a function");
        }
    } // run()


} // class MorphVehicleKinematics


module.exports = MorphVehicleKinematics;
