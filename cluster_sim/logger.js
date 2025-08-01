//
// logger.js — Sven Pohl <sven.pohl@zen-systems.de> — MIT License © 2025
//

const fs = require('fs');
const path = require('path');

class Logger {
  static logFile = path.join(__dirname, 'logs/log.txt');

  static log(msg) {
    const time = new Date().toISOString();
    const entry = `[INFO] ${time} - ${msg}\n`;
    fs.appendFileSync(Logger.logFile, entry);
  }

  static error(msg) {
    const time = new Date().toISOString();
    const entry = `[ERROR] ${time} - ${msg}\n`;
    fs.appendFileSync(Logger.logFile, entry);
  }
  
  
  static reset() {
    fs.writeFileSync(Logger.logFile, ''); // leert die Datei
  }

}

module.exports = Logger;
