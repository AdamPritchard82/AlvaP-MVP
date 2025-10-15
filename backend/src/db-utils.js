import { getDb, isPostgres } from './db.js';

/**
 * Database abstraction layer to handle differences between PostgreSQL and SQLite
 */

/**
 * Execute a query with parameters
 * @param {string} sql - SQL query string
 * @param {Object|Array} params - Parameters for the query
 * @returns {Promise<Object>} - Query result
 */
export async function query(sql, params = {}) {
  const db = getDb();
  const isPostgreSQL = isPostgres();
  
  if (isPostgreSQL) {
    // Convert SQLite parameter format (@param) to PostgreSQL format ($1, $2, etc.)
    const convertedSql = convertSqliteToPostgres(sql);
    const paramArray = convertParamsToArray(params);
    
    try {
      const result = await db.query(convertedSql, paramArray);
      return {
        rows: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  } else {
    // SQLite handling
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(sql);
      try {
        const result = stmt.all(params);
        resolve({
          rows: Array.isArray(result) ? result : [],
          rowCount: Array.isArray(result) ? result.length : 0
        });
      } catch (error) {
        console.error('SQLite query error:', error);
        reject(error);
      }
    });
  }
}

/**
 * Execute a query and return a single row
 * @param {string} sql - SQL query string
 * @param {Object|Array} params - Parameters for the query
 * @returns {Promise<Object|null>} - Single row or null
 */
export async function queryOne(sql, params = {}) {
  const result = await query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Execute a query and return all rows
 * @param {string} sql - SQL query string
 * @param {Object|Array} params - Parameters for the query
 * @returns {Promise<Array>} - Array of rows
 */
export async function queryAll(sql, params = {}) {
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Execute a query that doesn't return data (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query string
 * @param {Object|Array} params - Parameters for the query
 * @returns {Promise<Object>} - Execution result
 */
export async function execute(sql, params = {}) {
  const db = getDb();
  const isPostgreSQL = isPostgres();
  
  if (isPostgreSQL) {
    const convertedSql = convertSqliteToPostgres(sql);
    const paramArray = convertParamsToArray(params);
    
    try {
      const result = await db.query(convertedSql, paramArray);
      return {
        rowCount: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      };
    } catch (error) {
      console.error('PostgreSQL execute error:', error);
      throw error;
    }
  } else {
    // SQLite handling
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(sql);
      try {
        const result = stmt.run(params);
        resolve({
          rowCount: result.changes,
          lastInsertRowid: result.lastInsertRowid
        });
      } catch (error) {
        console.error('SQLite execute error:', error);
        reject(error);
      }
    });
  }
}

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Function that receives a transaction object
 * @returns {Promise<any>} - Transaction result
 */
export async function transaction(callback) {
  const db = getDb();
  const isPostgreSQL = isPostgres();
  
  if (isPostgreSQL) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(createTransactionObject(client, true));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    // SQLite transaction
    return new Promise((resolve, reject) => {
      const tx = db.transaction((params) => {
        const txObj = createTransactionObject(db, false);
        return callback(txObj);
      });
      
      try {
        const result = tx();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * Create a transaction object with database-agnostic methods
 * @param {Object} db - Database connection
 * @param {boolean} isPostgreSQL - Whether using PostgreSQL
 * @returns {Object} - Transaction object
 */
function createTransactionObject(db, isPostgreSQL) {
  return {
    query: async (sql, params = {}) => {
      if (isPostgreSQL) {
        const convertedSql = convertSqliteToPostgres(sql);
        const paramArray = convertParamsToArray(params);
        const result = await db.query(convertedSql, paramArray);
        return {
          rows: result.rows,
          rowCount: result.rowCount
        };
      } else {
        return new Promise((resolve, reject) => {
          const stmt = db.prepare(sql);
          try {
            const result = stmt.all(params);
            resolve({
              rows: Array.isArray(result) ? result : [],
              rowCount: Array.isArray(result) ? result.length : 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    },
    
    execute: async (sql, params = {}) => {
      if (isPostgreSQL) {
        const convertedSql = convertSqliteToPostgres(sql);
        const paramArray = convertParamsToArray(params);
        const result = await db.query(convertedSql, paramArray);
        return {
          rowCount: result.rowCount,
          lastInsertRowid: result.rows[0]?.id || null
        };
      } else {
        return new Promise((resolve, reject) => {
          const stmt = db.prepare(sql);
          try {
            const result = stmt.run(params);
            resolve({
              rowCount: result.changes,
              lastInsertRowid: result.lastInsertRowid
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    }
  };
}

/**
 * Convert SQLite parameter format (@param) to PostgreSQL format ($1, $2, etc.)
 * @param {string} sql - SQL query with @param format
 * @returns {string} - SQL query with $1, $2 format
 */
function convertSqliteToPostgres(sql) {
  let paramIndex = 1;
  const paramMap = new Map();
  
  return sql.replace(/@(\w+)/g, (match, paramName) => {
    if (!paramMap.has(paramName)) {
      paramMap.set(paramName, paramIndex++);
    }
    return `$${paramMap.get(paramName)}`;
  });
}

/**
 * Convert parameter object to array for PostgreSQL
 * @param {Object} params - Parameter object
 * @returns {Array} - Parameter array
 */
function convertParamsToArray(params) {
  if (Array.isArray(params)) {
    return params;
  }
  
  // Extract parameter names in order they appear in the SQL
  const paramNames = Object.keys(params);
  return paramNames.map(name => params[name]);
}

/**
 * Generate a UUID (for SQLite compatibility)
 * @returns {string} - UUID string
 */
export function generateId() {
  const isPostgreSQL = isPostgres();
  
  if (isPostgreSQL) {
    // PostgreSQL will generate UUIDs automatically
    return null;
  } else {
    // Generate UUID for SQLite
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * Get the current timestamp
 * @returns {string} - Current timestamp
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Parse JSON fields from database results
 * @param {Object} row - Database row
 * @param {Array} jsonFields - Fields that contain JSON
 * @returns {Object} - Row with parsed JSON fields
 */
export function parseJsonFields(row, jsonFields = ['tags', 'skills', 'contacts', 'features', 'limits', 'metadata']) {
  const parsed = { ...row };
  
  for (const field of jsonFields) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (error) {
        console.warn(`Failed to parse JSON field ${field}:`, error);
        parsed[field] = null;
      }
    }
  }
  
  return parsed;
}

/**
 * Format JSON fields for database storage
 * @param {Object} data - Data object
 * @param {Array} jsonFields - Fields that should be JSON stringified
 * @returns {Object} - Data with JSON fields stringified
 */
export function formatJsonFields(data, jsonFields = ['tags', 'skills', 'contacts', 'features', 'limits', 'metadata']) {
  const formatted = { ...data };
  
  for (const field of jsonFields) {
    if (formatted[field] !== undefined && formatted[field] !== null) {
      if (typeof formatted[field] === 'object') {
        formatted[field] = JSON.stringify(formatted[field]);
      }
    }
  }
  
  return formatted;
}













