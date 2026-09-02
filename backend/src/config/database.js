/**
 * Database Configuration and Connection Manager
 * Supports both SQLite (development) and PostgreSQL (production)
 * Implements connection pooling and error handling
 */

const path = require('path');

// Environment-aware configuration
const config = {
  type: process.env.DB_TYPE || 'sqlite',
  sqlite: {
    filename: process.env.DB_PATH || path.join(__dirname, '../../data/revenue_recovery.db')
  },
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'revenue_recovery',
    user: process.env.DB_USER || 'recovery_user',
    password: process.env.DB_PASSWORD || '',
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  }
};

let dbInstance = null;

/**
 * Initialize database connection based on configuration
 * @returns {Object} Database instance (SQLite or PostgreSQL client)
 */
async function initializeDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (config.type === 'postgres') {
      const { Pool } = require('pg');
      dbInstance = new Pool(config.postgres);
      
      // Verify connection
      const client = await dbInstance.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('[DB] PostgreSQL connection established');
    } else {
      // SQLite for development and testing
      const Database = require('better-sqlite3');
      const fs = require('fs');
      const dbDir = path.dirname(config.sqlite.filename);
      
      // Ensure data directory exists
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      dbInstance = new Database(config.sqlite.filename);
      dbInstance.pragma('journal_mode = WAL'); // Better concurrency
      
      console.log('[DB] SQLite connection established:', config.sqlite.filename);
    }
    
    return dbInstance;
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error.message);
    throw error;
  }
}

/**
 * Execute a query with error handling
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
  const db = await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    try {
      if (config.type === 'postgres') {
        db.query(sql, params)
          .then(result => resolve(result.rows))
          .catch(error => reject(error));
      } else {
        const stmt = db.prepare(sql);
        const result = stmt.all(...params);
        resolve(result);
      }
    } catch (error) {
      console.error('[DB] Query error:', error.message, 'SQL:', sql);
      reject(error);
    }
  });
}

/**
 * Execute a transaction with rollback on failure
 * @param {Function} callback - Async function containing transaction operations
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
  const db = await initializeDatabase();
  
  if (config.type === 'postgres') {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    return db.transaction(callback)();
  }
}

/**
 * Close database connection gracefully
 */
async function closeDatabase() {
  if (dbInstance) {
    if (config.type === 'postgres') {
      await dbInstance.end();
    } else {
      dbInstance.close();
    }
    dbInstance = null;
    console.log('[DB] Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  query,
  transaction,
  closeDatabase,
  config
};
