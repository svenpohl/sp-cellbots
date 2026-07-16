// voxeledit_controller.js
// In-memory voxel structure editor with Set support (v2.0).
// Multiple independent sets of voxels, set 0 = union of all sets.
// API prefix: ve_

class VoxelEditController {

    constructor() {
        this.reset();
    }

    // Resets all sets and emptyArea
    reset() {
        this.sets = { 0: [] }; // set 0 = union (always exists)
        this.emptyArea = null;
        return { ok: true, answer: "ve_new", count: 0, sets: { 0: 0 } };
    }

    // Helper: returns voxel array for a set, creating it if needed
    _ensureSet(setId) {
        const id = Number(setId);
        if (id === 0) return this._allVoxels(); // set 0 = computed union
        if (!this.sets[id]) this.sets[id] = [];
        return this.sets[id];
    }

    // Helper: computes union of all non-zero sets (deduplicated by position)
    _allVoxels() {
        const seen = new Set();
        const result = [];
        for (const id of Object.keys(this.sets)) {
            if (Number(id) === 0) continue; // skip 0 (would cause recursion)
            for (const v of this.sets[id]) {
                const key = `${v.x},${v.y},${v.z}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(v);
                }
            }
        }
        return result;
    }

    // Helper: count voxels in set 0 (union)
    _count() { return this._allVoxels().length; }

    // Build set info for status output
    _setInfo() {
        const info = {};
        for (const id of Object.keys(this.sets)) {
            info[id] = this.sets[id].length;
        }
        return info;
    }

    // Returns status with all sets
    getStatus() {
        const all = this._allVoxels();
        const count = all.length;
        let box = null;
        if (count > 0) {
            const xs = all.map(v => v.x);
            const ys = all.map(v => v.y);
            const zs = all.map(v => v.z);
            box = {
                x1: Math.min(...xs), x2: Math.max(...xs),
                y1: Math.min(...ys), y2: Math.max(...ys),
                z1: Math.min(...zs), z2: Math.max(...zs)
            };
        }
        return { ok: true, answer: "ve_get_status", count, bounding_box: box, emptyArea: this.emptyArea, sets: this._setInfo() };
    }

    // Sets a voxel in a specific set
    setVoxel(setId, x, y, z, vx, vy, vz) {
        const id = Number(setId);
        x = Number(x); y = Number(y); z = Number(z);
        const arr = this._ensureSet(id);
        if (id === 0) {
            // set 0: remove from ALL user sets, then add to first available
            for (const sid of Object.keys(this.sets)) {
                if (Number(sid) === 0) continue;
                this.sets[sid] = this.sets[sid].filter(v => !(v.x === x && v.y === y && v.z === z));
            }
        } else {
            // Remove from this set only
            this.sets[id] = this.sets[id].filter(v => !(v.x === x && v.y === y && v.z === z));
        }
        this.sets[id].push({
            x, y, z,
            vx: vx !== undefined ? Number(vx) : 0,
            vy: vy !== undefined ? Number(vy) : 0,
            vz: vz !== undefined ? Number(vz) : 1
        });
        return { ok: true, answer: "ve_set_voxel", set: id, position: { x, y, z }, count: this._count() };
    }

    // Removes a voxel from a specific set
    clearVoxel(setId, x, y, z) {
        const id = Number(setId);
        x = Number(x); y = Number(y); z = Number(z);
        let removed = false;
        if (id === 0) {
            // Remove from all sets
            for (const sid of Object.keys(this.sets)) {
                if (Number(sid) === 0) continue;
                const before = this.sets[sid].length;
                this.sets[sid] = this.sets[sid].filter(v => !(v.x === x && v.y === y && v.z === z));
                if (this.sets[sid].length < before) removed = true;
            }
        } else {
            this._ensureSet(id);
            const before = this.sets[id].length;
            this.sets[id] = this.sets[id].filter(v => !(v.x === x && v.y === y && v.z === z));
            removed = this.sets[id].length < before;
        }
        return { ok: true, answer: "ve_clear_voxel", set: id, position: { x, y, z }, removed, count: this._count() };
    }

    // Returns voxels of a specific set (0 = all)
    getVoxels(setId) {
        const id = Number(setId ?? 0);
        const voxels = id === 0 ? this._allVoxels() : (this.sets[id] || []);
        return { ok: true, answer: "ve_get_voxels", set: id, count: voxels.length, voxels };
    }

    // Clears an entire set
    clearSet(setId) {
        const id = Number(setId);
        if (id === 0) return { ok: false, answer: "ve_clear_set", error: "CANNOT_CLEAR_SET_0" };
        this.sets[id] = [];
        return { ok: true, answer: "ve_clear_set", set: id, count: this._count() };
    }

    // Translates (moves) an entire set by (dx, dy, dz)
    translate(setId, dx, dy, dz) {
        const id = Number(setId);
        dx = Number(dx); dy = Number(dy); dz = Number(dz);
        const arr = id === 0 ? this._allVoxels() : (this.sets[id] || []);
        if (id === 0) {
            // Move everything in all user sets
            for (const sid of Object.keys(this.sets)) {
                if (Number(sid) === 0) continue;
                this.sets[sid] = this.sets[sid].map(v => ({ ...v, x: v.x + dx, y: v.y + dy, z: v.z + dz }));
            }
        } else {
            this.sets[id] = this.sets[id].map(v => ({ ...v, x: v.x + dx, y: v.y + dy, z: v.z + dz }));
        }
        return { ok: true, answer: "ve_translate", set: id, delta: { dx, dy, dz }, count: this._count() };
    }

    // Creates a rectangular solid of voxels in a specific set
    createBox(setId, x1, y1, z1, x2, y2, z2) {
        const id = Number(setId);
        x1 = Number(x1); y1 = Number(y1); z1 = Number(z1);
        x2 = Number(x2); y2 = Number(y2); z2 = Number(z2);
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
        const arr = this._ensureSet(id);
        if (id === 0) return { ok: false, answer: "ve_create_box", error: "USE_A_NAMED_SET" };
        // Remove existing voxels in box area from this set
        this.sets[id] = this.sets[id].filter(v =>
            v.x < minX || v.x > maxX || v.y < minY || v.y > maxY || v.z < minZ || v.z > maxZ
        );
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    this.sets[id].push({ x, y, z, vx: 0, vy: 0, vz: 1 });
                }
            }
        }
        return { ok: true, answer: "ve_create_box", set: id, count: this._count(),
            box: { x1: minX, y1: minY, z1: minZ, x2: maxX, y2: maxY, z2: maxZ } };
    }

    // Duplicates a source set to a destination set
    duplicate(srcId, dstId) {
        const src = Number(srcId); const dst = Number(dstId);
        if (src === 0) return { ok: false, answer: "ve_duplicate", error: "CANNOT_DUPLICATE_SET_0" };
        if (dst === 0) return { ok: false, answer: "ve_duplicate", error: "CANNOT_DUPLICATE_TO_SET_0" };
        const sourceArr = this.sets[src];
        if (!sourceArr || sourceArr.length === 0) {
            return { ok: false, answer: "ve_duplicate", error: "SOURCE_SET_EMPTY", src, dst };
        }
        this.sets[dst] = sourceArr.map(v => ({ ...v }));
        return { ok: true, answer: "ve_duplicate", src, dst, count: this._count() };
    }

    // Save: serializes the union (set 0) for backward compatibility
    save(name) {
        const fs = require('fs');
        const path = require('path');
        const structuresDir = path.join(__dirname, '..', 'structures');
        const filePath = path.join(structuresDir, name + '.json');
        let output = this._allVoxels().map(v => ({ x: v.x, y: v.y, z: v.z, vx: v.vx, vy: v.vy, vz: v.vz }));
        if (this.emptyArea) {
            output = [{ emptyArea: this.emptyArea }, ...output];
        }
        const data = JSON.stringify(output, null, 2);
        fs.writeFileSync(filePath, data, 'utf8');
        return { ok: true, answer: "ve_save", name, file: filePath, count: this._count(), emptyArea: this.emptyArea };
    }

    // Import into set 0
    importFromController(controller, x1, y1, z1, x2, y2, z2) {
        // ... same as before, imports into set 0
        x1 = Number(x1); y1 = Number(y1); z1 = Number(z1);
        x2 = Number(x2); y2 = Number(y2); z2 = Number(z2);
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
        this.sets = { 0: [] };
        const bots = controller.bots || [];
        for (const bot of bots) {
            const bx = Number(bot.x), by = Number(bot.y), bz = Number(bot.z);
            if (bx >= minX && bx <= maxX && by >= minY && by <= maxY && bz >= minZ && bz <= maxZ) {
                this.sets[0].push({
                    x: bx, y: by, z: bz,
                    vx: Number(bot.vector_x ?? 0),
                    vy: Number(bot.vector_y ?? 0),
                    vz: Number(bot.vector_z ?? 1)
                });
            }
        }
        return { ok: true, answer: "ve_import", count: this.sets[0].length,
            region: { x1: minX, y1: minY, z1: minZ, x2: maxX, y2: maxY, z2: maxZ } };
    }

    // Load: loads into set 0
    load(name) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', 'structures', name + '.json');
        if (!fs.existsSync(filePath)) {
            return { ok: false, answer: "ve_load", error: "STRUCTURE_NOT_FOUND", name };
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.sets = { 0: [] };
        this.emptyArea = null;
        let entries = Array.isArray(data) ? data : (data.structure || []);
        if (Array.isArray(data) && data.length > 0 && data[0].emptyArea && !data[0].hasOwnProperty('x')) {
            this.emptyArea = data[0].emptyArea;
            entries = data.slice(1);
        }
        for (const entry of entries) {
            if (entry.x !== undefined && entry.y !== undefined && entry.z !== undefined) {
                this.sets[0].push({
                    x: Number(entry.x), y: Number(entry.y), z: Number(entry.z),
                    vx: Number(entry.vx ?? 0),
                    vy: Number(entry.vy ?? 0),
                    vz: Number(entry.vz ?? 1)
                });
            }
        }
        return { ok: true, answer: "ve_load", name, count: this.sets[0].length, emptyArea: this.emptyArea };
    }

    // Checks connectivity of the structure and cluster contact.
    // connected: true if all voxels form a single orthogonal component.
    // cluster_contact: true if at least one voxel has a neighbor in the controller's bot list.
    isConnected(controller) {
        const all = this._allVoxels();
        if (all.length === 0) return { ok: true, answer: "ve_is_connected", connected: false, cluster_contact: false, count: 0, details: { components: 0, isolated: [] } };

        // Build position set for quick lookup
        const posSet = new Set(all.map(v => `${v.x},${v.y},${v.z}`));
        const orthogonalDirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

        // BFS from first voxel to find connected component
        const firstKey = `${all[0].x},${all[0].y},${all[0].z}`;
        const visited = new Set();
        const queue = [all[0]];
        visited.add(firstKey);
        while (queue.length > 0) {
            const v = queue.shift();
            for (const [dx, dy, dz] of orthogonalDirs) {
                const nk = `${v.x + dx},${v.y + dy},${v.z + dz}`;
                if (posSet.has(nk) && !visited.has(nk)) {
                    visited.add(nk);
                    queue.push({ x: v.x + dx, y: v.y + dy, z: v.z + dz });
                }
            }
        }
        const allConnected = visited.size === all.length;

        // Find isolated components (clusters not connected to main component)
        const isolated = [];
        if (!allConnected) {
            for (const v of all) {
                const k = `${v.x},${v.y},${v.z}`;
                if (!visited.has(k)) isolated.push({ x: v.x, y: v.y, z: v.z });
            }
        }

        // Check cluster contact: at least one voxel with a neighbor in controller.bots
        const bots = controller && controller.bots ? controller.bots : [];
        const botPosSet = new Set(bots.map(b => `${Number(b.x)},${Number(b.y)},${Number(b.z)}`));
        let hasClusterContact = false;
        const contactPoints = [];
        for (const v of all) {
            for (const [dx, dy, dz] of orthogonalDirs) {
                const nk = `${v.x + dx},${v.y + dy},${v.z + dz}`;
                if (botPosSet.has(nk)) {
                    hasClusterContact = true;
                    contactPoints.push({ voxel: { x: v.x, y: v.y, z: v.z }, neighbor: { x: v.x + dx, y: v.y + dy, z: v.z + dz } });
                    break;
                }
            }
            if (hasClusterContact) break;
        }

        return {
            ok: true,
            answer: "ve_is_connected",
            connected: allConnected,
            cluster_contact: hasClusterContact,
            count: all.length,
            details: {
                components: allConnected ? 1 : 2,
                isolated: isolated.slice(0, 10),  // max 10 examples
                contact_points: contactPoints
            }
        };
    }

    // Gravity analysis on the union (set 0)
    gravity() {
        return this._gravityOn(this._allVoxels());
    }

    _gravityOn(voxels) {
        if (voxels.length === 0) {
            return { ok: true, answer: "ve_gravity", levels: [], total_voxels: 0 };
        }
        const levelMap = new Map();
        let minY = Infinity, maxY = -Infinity;
        for (const v of voxels) {
            const y = v.y;
            if (!levelMap.has(y)) levelMap.set(y, []);
            levelMap.get(y).push(v);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        let totalBots = 0;
        for (const [y, bots] of levelMap) totalBots += bots.length;
        const levels = [];
        let cumulativeBelow = 0;
        for (let y = minY; y <= maxY; y++) {
            const botsInLevel = levelMap.get(y);
            const count = botsInLevel ? botsInLevel.length : 0;
            if (count > 0) {
                const botsAbove = totalBots - cumulativeBelow - count;
                const weight = botsAbove / count;
                levels.push({ y, bots: count, bots_above: botsAbove, weight_per_bot: Math.round(weight * 100) / 100 });
            }
            cumulativeBelow += count;
        }
        return { ok: true, answer: "ve_gravity", total_voxels: voxels.length, min_y: minY, max_y: maxY, levels };
    }

    // Show in WebGUI: always shows the union
    show(controller) {
        const all = this._allVoxels();
        const events = [];
        events.push({ event: "voxeledit_clear" });
        for (const v of all) {
            events.push({
                event: "voxeledit_voxel",
                x: v.x, y: v.y, z: v.z,
                size: 1.05, color: "#9b59b6", opacity: 0.5
            });
        }
        const sent = controller.notify_frontend(events);
        return { ok: true, answer: "ve_show", count: all.length, frontend_attached: sent };
    }

    hide(controller) {
        const events = [];
        events.push({ event: "voxeledit_clear" });
        controller.notify_frontend(events);
        return { ok: true, answer: "ve_hide" };
    }

    // Used by morph_start :voxeledit
    getVoxelsAsArray() {
        return this._allVoxels().map(v => ({ x: v.x, y: v.y, z: v.z }));
    }
}

module.exports = VoxelEditController;
