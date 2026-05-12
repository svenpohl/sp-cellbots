//
// logger.js — Sven Pohl <sven.pohl@zen-systems.de> — MIT License © 2025
//

const fs = require('fs');
const path = require('path');

class Logger {
  static logFile = path.join(__dirname, 'logs/log.txt');
  static timezone = "Europe/Berlin"; // Default, kann via setTimezone() geändert werden

  static setTimezone(tz) {
    if (tz && typeof tz === "string" && tz.trim() !== "") {
      Logger.timezone = tz.trim();
    }
  }

  static formatTimestamp(date) {
    try {
      const options = {
        timeZone: Logger.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('de-DE', options);
      const parts = formatter.formatToParts(date);
      let y, mo, d, h, mi, s;
      for (const p of parts) {
        if (p.type === 'year') y = p.value;
        else if (p.type === 'month') mo = p.value;
        else if (p.type === 'day') d = p.value;
        else if (p.type === 'hour') h = p.value;
        else if (p.type === 'minute') mi = p.value;
        else if (p.type === 'second') s = p.value;
      }
      // Offset in Stunden ermitteln
      const utcDate = new Date(date.toISOString().slice(0, 19));
      const localDate = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
      const offsetMs = localDate.getTime() - utcDate.getTime();
      const offsetHours = Math.round(offsetMs / 3600000);
      const offsetSign = offsetHours >= 0 ? '+' : '';
      const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:00`;
      return `${y}-${mo}-${d}T${h}:${mi}:${s}${offsetStr}`;
    } catch (e) {
      return date.toISOString(); // Fallback auf UTC
    }
  }

  static log(msg) {
    const time = Logger.formatTimestamp(new Date());
    const entry = `[INFO] ${time} - ${msg}\n`;
    fs.appendFileSync(Logger.logFile, entry);
  }

  static error(msg) {
    const time = Logger.formatTimestamp(new Date());
    const entry = `[ERROR] ${time} - ${msg}\n`;
    fs.appendFileSync(Logger.logFile, entry);
  }
  
  
  static reset() {
    fs.writeFileSync(Logger.logFile, ''); // leert die Datei
  }

}

module.exports = Logger;
