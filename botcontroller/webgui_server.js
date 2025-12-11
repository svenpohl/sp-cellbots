// webgui_server.js
//
// WebGUI-Server for BotController
// Promise-based Static File Server + WebSocket-Binder
//

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

function startWebGUI(botcontrollerInstance) {

    console.log("Starting BotController WebGUI...");

    const server = http.createServer(async (req, res) => {

        console.log("REQUEST:", req.url);

        let filePath = req.url;
        if (filePath === "/") filePath = "/index.html";

        const absPath = path.join(__dirname, "webguicontroller", filePath);

        try {
            const data = await fs.readFile(absPath);

            const ext = path.extname(absPath).toLowerCase();
            const mime = {
                ".html": "text/html",
                ".js": "application/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml"
            }[ext] || "application/octet-stream";

            res.writeHead(200, { "Content-Type": mime });
            res.end(data);

        } catch (err) {
            console.log("404 Not Found:", absPath);
            res.writeHead(404);
            res.end("404 Not Found");
        }
    });

    const wss = new WebSocket.Server({ server });

    wss.on("connection", ws => {
        console.log("GUI connected.");

        // ws-connection to BotController 
        botcontrollerInstance.attachGUIWebSocket(ws);
    });

    server.listen(3010, () => {
        console.log("BotController WebGUI available at http://localhost:3010");
    });
}

module.exports = { startWebGUI };
