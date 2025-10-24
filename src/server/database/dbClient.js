/**
 * Database Client Abstraction Layer
 * 
 * This module provides a unified interface for database operations,
 * supporting both SQLite and PostgreSQL through feature toggling.
 */

const config = require('../config');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const logger = require('../utils/logger');

// Database type configuration
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'postgres'

// Client instances
let pgPool;
let sqliteDb;

/**
 * Initialize database connections based on configuration
 */
async function initialize() {
  if (DB_TYPE === 'postgres') {
    logger.info('Initializing PostgreSQL connection');
    
    pgPool = new Pool({
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DATABASE || 'emrsim',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'postgres',
      max: parseInt(process.env.PG_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '5000'),
    });
    
    // Test the connection
    try {
      const client = await pgPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection successful');
    } catch (err) {
      logger.error('PostgreSQL connection failed', err);
      throw err;
    }
  } else {
    logger.info('Initializing SQLite connection');
    
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../../data/database.sqlite');
    
    try {
      sqliteDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      
      // Enable foreign keys
      await sqliteDb.run('PRAGMA foreign_keys = ON');
      logger.info('SQLite connection successful');
    } catch (err) {
      logger.error('SQLite connection failed', err);
      throw err;
    }
  }
}

/**
 * Execute a query with parameters
 */
async function query(sql, params = []) {
  try {
    if (DB_TYPE === 'postgres') {
      // PostgreSQL query
      const result = await pgPool.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount
      };
    } else {
      // SQLite query
      // Determine if this is a SELECT query or a modification query
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      
      if (isSelect) {
        const rows = await sqliteDb.all(sql, params);
        return {
          rows,
          rowCount: rows.length
        };
      } else {
        const result = await sqliteDb.run(sql, params);
        return {
          rows: [],
          rowCount: result.changes,
          lastID: result.lastID
        };
      }
    }
  } catch (err) {
    logger.error(`Database query failed: ${sql}`, err);
    throw err;
  }
}

/**
 * Get a single row from a query
 */
async function queryOne(sql, params = []) {
  try {
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query(sql, params);
      return result.rows[0] || null;
    } else {
      return await sqliteDb.get(sql, params);
    }
  } catch (err) {
    logger.error(`Database queryOne failed: ${sql}`, err);
    throw err;
  }
}

/**
 * Begin a transaction
 */
async function beginTransaction() {
  try {
    if (DB_TYPE === 'postgres') {
      const client = await pgPool.connect();
      await client.query('BEGIN');
      return client;
    } else {
      await sqliteDb.run('BEGIN TRANSACTION');
      return sqliteDb;
    }
  } catch (err) {
    logger.error('Failed to begin transaction', err);
    throw err;
  }
}

/**
 * Commit a transaction
 */
async function commitTransaction(client) {
  try {
    if (DB_TYPE === 'postgres') {
      await client.query('COMMIT');
      client.release();
    } else {
      await client.run('COMMIT');
    }
  } catch (err) {
    logger.error('Failed to commit transaction', err);
    throw err;
  }
}

/**
 * Rollback a transaction
 */
async function rollbackTransaction(client) {
  try {
    if (DB_TYPE === 'postgres') {
      await client.query('ROLLBACK');
      client.release();
    } else {
      await client.run('ROLLBACK');
    }
  } catch (err) {
    logger.error('Failed to rollback transaction', err);
    // Don't rethrow as this is likely being called from a catch block
  }
}

/**
 * Close database connections
 */
async function close() {
  try {
    if (DB_TYPE === 'postgres' && pgPool) {
      await pgPool.end();
      logger.info('PostgreSQL connection pool closed');
    } else if (sqliteDb) {
      await sqliteDb.close();
      logger.info('SQLite connection closed');
    }
  } catch (err) {
    logger.error('Failed to close database connections', err);
    throw err;
  }
}

/**
 * Get the type of database being used
 */
function getDatabaseType() {
  return DB_TYPE;
}

/**
 * Create a SQL query that works with both PostgreSQL and SQLite
 * @param {Object} options Query parts for different database types
 * @param {string} options.sqlite SQLite version of the query
 * @param {string} options.postgres PostgreSQL version of the query
 */
function createPortableQuery(options) {
  return DB_TYPE === 'postgres' ? options.postgres : options.sqlite;
}

// Export the database client interface
module.exports = {
  initialize,
  query,
  queryOne,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  close,
  getDatabaseType,
  createPortableQuery
};
