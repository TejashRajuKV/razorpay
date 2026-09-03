/**
 * Detects whether better-sqlite3 native bindings load in this environment.
 * DB-backed suites use `describeDb` so they SKIP (not fail) where the
 * native module cannot load (e.g. Node version without prebuilds).
 */
function isDbAvailable() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    return true;
  } catch {
    return false;
  }
}

module.exports = { isDbAvailable };
