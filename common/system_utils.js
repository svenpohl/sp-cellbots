
//
// system_utils.js — Sven Pohl / CellBots
// Runtime- & Environment-Utilities
// Version 1.0
// MIT License
//

/**
 * Compare two semantic version strings "major.minor.patch".
 * Returns:
 *  -1  if a < b
 *   0  if a == b
 *  +1  if a > b
 */
function compareVersions(a, b) {
    const pa = String(a).replace(/[^\d.]/g, "").split(".").map(Number);
    const pb = String(b).replace(/[^\d.]/g, "").split(".").map(Number);

    // Normalize to 3 parts
    while (pa.length < 3) pa.push(0);
    while (pb.length < 3) pb.push(0);

    for (let i = 0; i < 3; i++) {
        if (pa[i] > pb[i]) return 1;
        if (pa[i] < pb[i]) return -1;
    }
    return 0;
}

/**
 * Colored console output
 */
function color(text, code) {
    return `\x1b[${code}m${text}\x1b[0m`;
}

const COLORS = {
    red:    s => color(s, "31"),
    yellow: s => color(s, "33"),
    green:  s => color(s, "32"),
    cyan:   s => color(s, "36")
};

/**
 * Check Node.js version consistency.
 * Prints a warning if too old or too new.
 */
function check_nodejs_version(requiredVersion = "23.11.0") {
    const current = process.version.replace(/^v/, "");  // strip "v"

    console.log(COLORS.cyan(`[CellBots] Checking Node.js version...`));
    console.log(`→ Installed: ${current}`);
    console.log(`→ Required:  ${requiredVersion}`);

    const cmp = compareVersions(current, requiredVersion);

    if (cmp === 0) {
        console.log(COLORS.green("[OK] Version matches the recommended version."));
        return true;
    }

    if (cmp < 0) {
        console.warn(
            COLORS.red(
                `[WARNING] Your Node.js version (${current}) is OLDER than recommended (${requiredVersion}).\n` +
                "This may cause unexpected errors (crypto, fs, WebSocket, timing issues).\n" +
                "Please consider updating Node.js."
            )
        );
        return false;
    }

    if (cmp > 0) {
        console.warn(
            COLORS.yellow(
                `[WARNING] Your Node.js version (${current}) is NEWER than the recommended version (${requiredVersion}).\n` +
                "Future-breaking changes are possible (OpenSSL, fs/promises behavior, WebSocket changes).\n" +
                "If errors appear, try Node.js " + requiredVersion + "."
            )
        );
        return true; // newer is usually okay, but warn
    }
}

module.exports = {
    check_nodejs_version
};

