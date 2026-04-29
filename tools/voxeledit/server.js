#!/usr/bin/env node
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5175;
const ROOT = __dirname;

// JSON body parser
app.use(express.json({ limit: "10mb" }));

// Statische Dateien ausliefern (kein Cache für Entwicklung)
app.use(express.static(ROOT, {
    index: "index.html",
    extensions: ["html"],
    maxAge: 0,
    etag: false,
    lastModified: false
}));

// ---------- API: Constructs (XML) ----------

function listConstructs() {
    const dir = path.join(ROOT, "constructs");
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".xml"));
    return files.sort();
} // listConstructs()

function loadConstruct(filename) {
    const filePath = path.join(ROOT, "constructs", filename);
    // Prüfe auf Path-Traversal
    if (!filePath.startsWith(path.join(ROOT, "constructs"))) {
        return null;
    }
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
} // loadConstruct()

function saveConstruct(filename, content) {
    const filePath = path.join(ROOT, "constructs", filename);
    if (!filePath.startsWith(path.join(ROOT, "constructs"))) {
        return false;
    }
    fs.writeFileSync(filePath, content, "utf8");
    return true;
} // saveConstruct()

// ---------- API: Structures (JSON) ----------

function listStructures() {
    const dir = path.join(ROOT, "structures");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return [];
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    return files.sort();
} // listStructures()

function loadStructure(filename) {
    const filePath = path.join(ROOT, "structures", filename);
    if (!filePath.startsWith(path.join(ROOT, "structures"))) {
        return null;
    }
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
} // loadStructure()

function saveStructure(filename, data) {
    const filePath = path.join(ROOT, "structures", filename);
    if (!filePath.startsWith(path.join(ROOT, "structures"))) {
        return false;
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
} // saveStructure()

// ---------- REST-Routen ----------

// Constructs
app.get("/api/constructs", (req, res) => {
    res.json({ ok: true, files: listConstructs() });
}); // GET /api/constructs

app.get("/api/constructs/:file", (req, res) => {
    const content = loadConstruct(req.params.file);
    if (content === null) {
        return res.status(404).json({ ok: false, reason: "not found" });
    }
    res.json({ ok: true, content: content });
}); // GET /api/constructs/:file

app.post("/api/constructs/:file", (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ ok: false, reason: "missing content" });
    }
    const ok = saveConstruct(req.params.file, content);
    if (!ok) {
        return res.status(400).json({ ok: false, reason: "invalid path" });
    }
    res.json({ ok: true });
}); // POST /api/constructs/:file

// Structures
app.get("/api/structures", (req, res) => {
    res.json({ ok: true, files: listStructures() });
}); // GET /api/structures

app.get("/api/structures/:file", (req, res) => {
    const data = loadStructure(req.params.file);
    if (data === null) {
        return res.status(404).json({ ok: false, reason: "not found" });
    }
    res.json({ ok: true, data: data });
}); // GET /api/structures/:file

app.post("/api/structures/:file", (req, res) => {
    const { data } = req.body;
    if (!data) {
        return res.status(400).json({ ok: false, reason: "missing data" });
    }
    const ok = saveStructure(req.params.file, data);
    if (!ok) {
        return res.status(400).json({ ok: false, reason: "invalid path" });
    }
    res.json({ ok: true });
}); // POST /api/structures/:file

// Healthcheck
app.get("/healthz", (_req, res) => res.type("text").send("ok"));

// Fallback
app.use((req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, () => {
    console.log(`VoxelEdit-Server läuft: http://localhost:${PORT}`);
}); // listen()
