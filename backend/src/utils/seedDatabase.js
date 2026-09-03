/**
 * Database Seed Script — AI Revenue Recovery Agent
 *
 * Populates SQLite with the base schema and realistic synthetic seed data.
 * Idempotent: safe to run multiple times (INSERT OR IGNORE).
 *
 * Run:
 *   npm run seed   (from backend/)
 *
 * Requires the DATABASE_URL / DB_PATH env vars or defaults to
 * backend/data/revenue_recovery.db (SQLite).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '../../data/revenue_recovery.db');

const SCHEMA_PATH = path.join(__dirname, '../../../database/schema.sql');
const SEED_PATH   = path.join(__dirname, '../../../database/seed.sql');


function run() {
  // Ensure the data directory exists.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('[Seed] Connected to:', DB_PATH);

  // Apply schema (CREATE TABLE IF NOT EXISTS is idempotent).
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  console.log('[Seed] Schema applied.');

  // Apply seed data (INSERT OR IGNORE keeps runs idempotent).
  // Replace standard INSERT with INSERT OR IGNORE for SQLite compatibility.
  const seedRaw = fs.readFileSync(SEED_PATH, 'utf8');
  const seedIdempotent = seedRaw.replace(/INSERT INTO/gi, 'INSERT OR IGNORE INTO');
  db.exec(seedIdempotent);
  console.log('[Seed] Seed data inserted.');

  // Summary counts.
  const tables = ['customers', 'payments', 'recovery_cases', 'recovery_actions', 'audit_logs', 'ml_predictions'];
  for (const table of tables) {
    try {
      const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
      console.log(`[Seed]   ${table.padEnd(20)} → ${count} rows`);
    } catch {
      // Table may not exist in older schema versions — skip silently.
    }
  }

  db.close();
  console.log('[Seed] Done.');
}

run();
