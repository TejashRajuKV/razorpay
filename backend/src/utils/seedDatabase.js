require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/revenue_recovery.db');
const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, '../..', dbPath);
fs.mkdirSync(path.dirname(resolved), { recursive: true });

const Database = require('better-sqlite3');
const db = new Database(resolved);

const schema = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
db.exec(schema);

const count = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
if (count === 0) {
  const seed = fs.readFileSync(path.join(__dirname, '../../../database/seed.sql'), 'utf8');
  db.exec(seed);
  console.log('[Seed] Database seeded:', resolved);
} else {
  console.log('[Seed] Already seeded, skipping:', resolved);
}
db.close();
