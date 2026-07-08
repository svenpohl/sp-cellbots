/**
 * batch_controller.js – Sequential batch executor with condition matching.
 *
 * Reads a test.batch JSON array and executes each block sequentially.
 * Each block can specify conditions on previous blocks' responses.
 * If a condition fails, the batch aborts with an error message.
 *
 * Batch format:
 *   [
 *     { "id": "001", "cmd": "move_bot_to SB1 2 1 0" },
 *     { "condition": { "001:result": "succeeded" },
 *       "id": "002", "cmd": "move_bot_to SB2 4 1 0" }
 *   ]
 *
 * Condition format: "blockId:dot.path" → expected value
 *   "001:result"        → response.result === "succeeded"
 *   "001:position.x"    → response.position.x === 2
 *   Multiple keys = AND condition (all must match)
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

class BatchController {
    constructor(apiDir) {
        this.apiDir = apiDir || __dirname;
        this.blocks = [];
        this.results = {};   // blockId → response object
        this.failed = false;
        this.failReason = "";
    }

    // Load and parse a .batch JSON file
    // Supports filepath#label to jump to a specific block by id or label
    load(filepath) {
        // Parse #label suffix for jump-to-block
        let jumpTarget = null;
        let cleanPath = filepath;
        const hashIdx = filepath.indexOf('#');
        if (hashIdx !== -1) {
            jumpTarget = filepath.substring(hashIdx + 1).trim();
            cleanPath = filepath.substring(0, hashIdx);
        }

        let resolvedPath = path.resolve(this.apiDir, cleanPath);
        // Fallback: try tests/ subdirectory
        if (!fs.existsSync(resolvedPath)) {
            const testPath = path.resolve(this.apiDir, 'tests', cleanPath);
            if (fs.existsSync(testPath)) {
                resolvedPath = testPath;
            } else {
                // Try with .batch extension
                const batchPath = resolvedPath.endsWith('.batch') ? resolvedPath : resolvedPath + '.batch';
                if (fs.existsSync(batchPath)) {
                    resolvedPath = batchPath;
                } else {
                    const testBatchPath = path.resolve(this.apiDir, 'tests', cleanPath.endsWith('.batch') ? cleanPath : cleanPath + '.batch');
                    if (fs.existsSync(testBatchPath)) {
                        resolvedPath = testBatchPath;
                    }
                }
            }
        }
        const raw = fs.readFileSync(resolvedPath, 'utf8');
        this.blocks = JSON.parse(raw);

        if (!Array.isArray(this.blocks) || this.blocks.length === 0) {
            throw new Error("Batch file must contain a non-empty JSON array");
        }

        // Validate block structure
        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            if (!block.id) {
                throw new Error(`Block at index ${i} is missing "id"`);
            }
            if (!block.cmd && !block.parallel) {
                throw new Error(`Block "${block.id}" needs either "cmd" or "parallel"`);
            }
        }

        console.log(`[BATCH] Loaded ${this.blocks.length} blocks from ${path.basename(cleanPath)}`);

        // Jump to label/id if specified
        this.jumpTarget = jumpTarget;
    }

    // Run all blocks sequentially
    run() {
        let startIdx = 0;
        if (this.jumpTarget) {
            // Find block by id or label
            for (let i = 0; i < this.blocks.length; i++) {
                const b = this.blocks[i];
                if (b.id === this.jumpTarget || b.label === this.jumpTarget) {
                    startIdx = i;
                    console.log(`[BATCH] Jumping to block "${b.id}" (label="${b.label || ''}") at index ${i}`);
                    break;
                }
            }
            if (startIdx === 0) {
                console.warn(`[BATCH] Jump target "${this.jumpTarget}" not found – starting from beginning`);
            }
        }
        for (let i = startIdx; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            if (this.failed) break;

            // Check condition (if any)
            if (block.condition) {
                if (!this._evaluateCondition(block.condition)) {
                    this.failed = true;
                    this.failReason = `Block "${block.id}": condition not met – aborting`;
                    console.error(`[BATCH] ${this.failReason}`);
                    break;
                }
            }

            // Execute command
            this._executeBlock(block, i);
        }

        // Final summary
        if (this.failed) {
            console.error(`[BATCH] FAILED: ${this.failReason}`);
            process.exit(1);
        } else {
            console.log(`[BATCH] All ${this.blocks.length} blocks completed successfully.`);
        }
    }

    // Execute a single block
    _executeBlock(block, index) {
        // Parallel execution for blocks with "parallel" array
        if (block.parallel && Array.isArray(block.parallel)) {
            this._executeParallel(block, index);
            return;
        }

        const cmd = (block.cmd || "").trim();
        if (!cmd) return; // skip empty cmd blocks (e.g. parallel-only)
        console.log(`[BATCH] [${index + 1}/${this.blocks.length}] Running "${block.id}": node api.js ${cmd}`);

        try {
            const output = execSync(`node api.js ${cmd}`, {
                cwd: this.apiDir,
                encoding: 'utf8',
                timeout: 60000  // 60s max per command
            }).trim();

            // Parse JSON response
            let response;
            try {
                // The response might have multiple lines - find the last JSON object
                const lines = output.split('\n').filter(l => l.trim());
                response = JSON.parse(lines[lines.length - 1]);
            } catch (e) {
                // If not JSON, store raw output
                response = { raw: output };
            }

            this.results[block.id] = response;

            // Check if the command itself failed
            if (response && response.ok === false) {
                // Command reported an error – abort
                this.failed = true;
                this.failReason = `Block "${block.id}": command returned ok=false – ${response.reason || response.error || 'unknown error'}`;
                console.error(`[BATCH] ${this.failReason}`);
            } else {
                console.log(`[BATCH]   → ${JSON.stringify(response).substring(0, 120)}...`);
            }

        } catch (e) {
            this.failed = true;
            this.failReason = `Block "${block.id}": execution error – ${e.message}`;
            console.error(`[BATCH] ${this.failReason}`);
        }
    }

    // Execute multiple commands in parallel
    // block.parallel = ["set_mobility B1 false", "set_mobility B2 false"]
    // Uses shell backgrounding (& + wait) for true parallel execution
    _executeParallel(block, index) {
        const cmds = block.parallel;
        console.log(`[BATCH] [${index + 1}/${this.blocks.length}] Running "${block.id}": ${cmds.length} parallel commands`);

        try {
            // Build shell command: run all in parallel, wait for all, capture outputs
            const shellCmd = cmds.map(c => `node api.js ${c}`).join(' &\n') + ' &\nwait';
            const output = execSync(shellCmd, {
                cwd: this.apiDir,
                encoding: 'utf8',
                timeout: 120000,
                shell: '/bin/bash'
            }).trim();

            // Parse each line as individual JSON response
            const lines = output.split('\n').filter(l => l.trim());
            const responses = lines.map(line => {
                try { return JSON.parse(line); }
                catch (e) { return { raw: line }; }
            });

            const succeeded = responses.filter(r => r && r.ok === true);
            const failed = responses.filter(r => !r || r.ok !== true);

            const summary = {
                ok: failed.length === 0,
                result: "parallel",
                completed: succeeded.length,
                failed: failed.length,
                total: cmds.length,
                responses: responses
            };

            this.results[block.id] = summary;
            console.log(`[BATCH]   → ${succeeded.length}/${cmds.length} parallel commands succeeded`);

            if (failed.length > 0) {
                this.failed = true;
                this.failReason = `Block "${block.id}": ${failed.length}/${cmds.length} commands failed`;
                console.error(`[BATCH] ${this.failReason}`);
            }
        } catch (e) {
            this.failed = true;
            this.failReason = `Block "${block.id}": parallel execution error – ${e.message}`;
            console.error(`[BATCH] ${this.failReason}`);
        }
    }

    // Evaluate a condition object
    // condition = { "001:result": "succeeded", "001:position.x": 2 }
    // Returns true only if ALL keys match their expected values
    _evaluateCondition(condition) {
        for (const [key, expectedValue] of Object.entries(condition)) {
            // Parse "blockId:dot.path" → blockId = "001", dotPath = "result"
            const colonIdx = key.indexOf(':');
            if (colonIdx === -1) {
                console.error(`[BATCH] Invalid condition key "${key}" – missing "blockId:path" format`);
                return false;
            }
            const blockId = key.substring(0, colonIdx);
            const dotPath = key.substring(colonIdx + 1);

            const response = this.results[blockId];
            if (!response) {
                console.error(`[BATCH] Condition "${key}": block "${blockId}" has no result yet`);
                return false;
            }

            // Navigate the dot path into the response object
            const actualValue = this._getByDotPath(response, dotPath);

            if (actualValue === undefined) {
                console.error(`[BATCH] Condition "${key}": path "${dotPath}" not found in response`);
                return false;
            }

            // Compare (loose equality for numbers/strings)
            if (String(actualValue) !== String(expectedValue)) {
                console.error(`[BATCH] Condition "${key}": expected "${expectedValue}", got "${actualValue}"`);
                return false;
            }
        }
        return true;
    }

    // Navigate into an object using dot notation
    // _getByDotPath({a: {b: 5}}, "a.b") → 5
    _getByDotPath(obj, dotPath) {
        const parts = dotPath.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }
}

module.exports = BatchController;
