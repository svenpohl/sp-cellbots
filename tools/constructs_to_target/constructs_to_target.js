#!/usr/bin/env node

/**
 * constructs_to_target.js
 * 
 * Konvertiert eine base_*.xml (Construct-XML) in eine base_*.json (Target-Struktur).
 * 
 * Usage:
 *   node constructs_to_target.js <input.xml> <output.json>
 * 
 * Beispiel:
 *   node constructs_to_target.js base_100.xml base_100.json
 * 
 * Das JSON-Format entspricht botcontroller/structures/*.json:
 *   [ { "x": ..., "y": ..., "z": ... }, ... ]
 * 
 * Nur <cell>-Einträge werden übernommen (kein <masterbot>).
 */

const fs = require("fs");
const path = require("path");

// --- Einfacher XML-Parser (ohne externe Dependencies) ---

function parseXml(xmlText)
{
    const cells = [];
    
    // Regex: <cell> ... </cell>
    const cellRegex = /<cell>([\s\S]*?)<\/cell>/gi;
    let match;
    
    while ((match = cellRegex.exec(xmlText)) !== null)
    {
        const cellContent = match[1];
        
        // x, y, z aus <pos> extrahieren
        const x = extractInt(cellContent, "x");
        const y = extractInt(cellContent, "y");
        const z = extractInt(cellContent, "z");
        
        if (x !== null && y !== null && z !== null)
        {
            cells.push({ x, y, z });
        }
    }
    
    return cells;
}

function extractInt(content, tag)
{
    const regex = new RegExp(`<${tag}>\\s*(-?\\d+)\\s*<\\/${tag}>`);
    const match = regex.exec(content);
    return match ? parseInt(match[1], 10) : null;
}

// --- Main ---

function main()
{
    const args = process.argv.slice(2);
    
    if (args.length < 2)
    {
        console.error("Usage: node constructs_to_target.js <input.xml> <output.json>");
        process.exit(1);
    }
    
    const inputPath = path.resolve(args[0]);
    const outputPath = path.resolve(args[1]);
    
    // XML lesen
    let xmlText;
    try
    {
        xmlText = fs.readFileSync(inputPath, "utf8");
    }
    catch (err)
    {
        console.error(`ERROR: Kann ${inputPath} nicht lesen: ${err.message}`);
        process.exit(1);
    }
    
    // Parsen
    const cells = parseXml(xmlText);
    
    if (cells.length === 0)
    {
        console.error("ERROR: Keine <cell>-Einträge gefunden.");
        process.exit(1);
    }
    
    // JSON schreiben (pretty-printed)
    const jsonContent = JSON.stringify(cells, null, 2);
    fs.writeFileSync(outputPath, jsonContent, "utf8");
    
    console.log(`OK: ${cells.length} Bots aus ${path.basename(inputPath)} nach ${path.basename(outputPath)} konvertiert.`);
}

main();
