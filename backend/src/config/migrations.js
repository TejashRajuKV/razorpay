/**
 * Additive, idempotent schema migrations for existing dev databases.
 * Fresh databases and tests build from database/schema.sql directly;
 * this only backfills columns/tables on older files. Never destructive.
 * Every statement is best-effort so startup is never blocked.
 */

const db = require('./database');

async function columnExists(table, column) {
  const type = (process.env.DB_TYPE || 'sqlite');
  if (type === 'postgres') {
    const rows = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
      [table, column]
    );
    return rows.length > 0;
  }
  const rows = await db.query(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function ensureColumn(table, column, ddl) {
  try {
    if (await columnExists(table, column)) return;
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    console.log(`[Migrate] Added ${table}.${column}`);
  } catch (err) {
    console.warn(`[Migrate] Skipped ${table}.${column}:`, err.message);
  }
}

async function runMigrations() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS action_probability_adjustments (
      action VARCHAR(50) NOT NULL,
      diagnosis_category VARCHAR(50) NOT NULL,
      adjustment DECIMAL(5, 4) DEFAULT 0.0000,
      sample_count INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (action, diagnosis_category)
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS system_config (
      key VARCHAR(100) PRIMARY KEY,
      value VARCHAR(255),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await ensureColumn('recovery_actions', 'incentive_amount', 'DECIMAL(10, 2) DEFAULT 0.00');
    await ensureColumn('recovery_actions', 'incentive_type', "VARCHAR(50) DEFAULT 'none'");
    await ensureColumn('recovery_actions', 'idempotency_key', 'VARCHAR(64)');
    await ensureColumn('recovery_cases', 'trace_id', 'VARCHAR(36)');
    await ensureColumn('audit_logs', 'trace_id', 'VARCHAR(36)');
    await ensureColumn('audit_logs', 'model_version', 'VARCHAR(50)');
    await ensureColumn('audit_logs', 'before_state', 'TEXT');
    await ensureColumn('audit_logs', 'after_state', 'TEXT');
  } catch (err) {
    console.warn('[Migrate] Migration run skipped:', err.message);
  }
}

module.exports = { runMigrations };
