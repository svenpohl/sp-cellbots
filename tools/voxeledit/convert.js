#!/usr/bin/env node
/**
 * convert.js – Voxel structure converter (XML → JSON)
 *
 * Converts a ClusterSim constructs XML file into a BotController structures
 * JSON file. Each <cell> entry becomes an {x, y, z, vx, vy, vz} object.
 * Inactive bots (<inactive>true</inactive>) are skipped.
 * IDs and colors are not carried over.
 *
 * Usage:
 *   node convert.js <input.xml> <output.json>
 *
 * Example:
 *   node convert.js constructs/base_401.xml structures/base_401.json
 */

const fs = require('fs');
const path = require('path');

// --- Arguments ---
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node convert.js <input.xml> <output.json>');
    process.exit(1);
}

const inputFile = path.resolve(args[0]);
const outputFile = path.resolve(args[1]);

// --- Format check: only XML → JSON ---
if (!inputFile.toLowerCase().endsWith('.xml')) {
    console.error('Input file must be .xml – JSON → XML conversion is not supported yet.');
    process.exit(1);
}

if (!fs.existsSync(inputFile)) {
    console.error('Input file not found: ' + inputFile);
    process.exit(1);
}

// --- Read XML ---
const xml = fs.readFileSync(inputFile, 'utf8');

// --- Helper: extract value from an XML block ---
function extractValue(content, tag) {
    const m = content.match(new RegExp('<\\s*' + tag + '\\s*>\\s*([^<]*?)\\s*<\\s*/\\s*' + tag + '\\s*>', 'i'));
    return m ? m[1].trim() : null;
}

// --- Extract all <cell> blocks ---
const cells = [];
const skippedInactive = [];
const cellRegex = /<\s*cell\s*>([\s\S]*?)<\s*\/\s*cell\s*>/gi;
let match;

while ((match = cellRegex.exec(xml)) !== null) {
    const content = match[1];

    // Skip inactive bots (remember their ID for the summary)
    const inactiveRaw = extractValue(content, 'inactive');
    if (inactiveRaw !== null) {
        const inact = String(inactiveRaw).toLowerCase();
        if (inact === 'true' || inact === '1' || inact === 'yes') {
            skippedInactive.push(extractValue(content, 'id') || '?');
            continue;
        }
    }

    // Read position and orientation
    const x = extractValue(content, 'x');
    const y = extractValue(content, 'y');
    const z = extractValue(content, 'z');

    // Position is mandatory – cells without x/y/z are skipped silently
    if (x === null || y === null || z === null) {
        continue;
    }

    const vx = extractValue(content, 'vx');
    const vy = extractValue(content, 'vy');
    const vz = extractValue(content, 'vz');

    cells.push({
        x: Number(x),
        y: Number(y),
        z: Number(z),
        vx: vx !== null ? Number(vx) : 0,
        vy: vy !== null ? Number(vy) : 0,
        vz: vz !== null ? Number(vz) : 0
    });
}

if (cells.length === 0) {
    console.error('No <cell> entries found in XML file.');
    process.exit(1);
}

// --- Validation (warnings only – never aborts conversion) ---
const seen = new Set();
const duplicatePositions = [];
let invalidOrientations = 0;
let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;
let minZ = Infinity, maxZ = -Infinity;

for (const c of cells) {
    const key = c.x + ',' + c.y + ',' + c.z;
    if (seen.has(key)) {
        duplicatePositions.push(key);
    }
    seen.add(key);

    const len = Math.hypot(c.vx, c.vy, c.vz);
    if (len !== 1) {
        invalidOrientations++;
    }

    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
}

if (duplicatePositions.length > 0) {
    console.warn('Warning: duplicate positions: ' + duplicatePositions.join(' | '));
}
if (invalidOrientations > 0) {
    console.warn('Warning: ' + invalidOrientations + ' cell(s) with non-unit orientation vector (vx,vy,vz).');
}

// --- Write JSON ---
const json = JSON.stringify(cells, null, 2) + '\n';
fs.writeFileSync(outputFile, json, 'utf8');

// --- Summary ---
console.log(`Converted ${cells.length} cells → ${outputFile}`);
console.log(`  Bounding box: x[${minX}..${maxX}] y[${minY}..${maxY}] z[${minZ}..${maxZ}]`);
if (skippedInactive.length > 0) {
    console.log(`  Skipped ${skippedInactive.length} inactive cell(s): ${skippedInactive.join(', ')}`);
}
