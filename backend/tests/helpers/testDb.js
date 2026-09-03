/**
 * Isolated test database helper.
 * Creates a TEMP SQLite file per test file, applies database/schema.sql,
 * and points the app's database module at it via DB_PATH.
 * Never touches development/production data (default data/revenue_recovery.db).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

let tmpFile = null;

function initIsolatedDb() {
  jest.resetModules();
  tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rz-test-')), 'test.db');
  process.env.DB_TYPE = 'sqlite';
  process.env.DB_PATH = tmpFile;

  const Database = require('better-sqlite3');
  const db = new Database(tmpFile);
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'database', 'schema.sql'),
    'utf8',
  );
  db.exec(schema);
  db.close();

  const dbModule = require('../../src/config/database');
  return dbModule;
}

async function closeIsolatedDb() {
  try {
    const dbModule = require('../../src/config/database');
    await dbModule.closeDatabase();
  } catch { /* best-effort */ }
  delete process.env.DB_PATH;
  delete process.env.DB_TYPE;
  if (tmpFile) {
    try {
      fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
    } catch { /* best-effort */ }
    tmpFile = null;
  }
}

module.exports = { initIsolatedDb, closeIsolatedDb };
