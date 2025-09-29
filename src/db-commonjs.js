const sqlite3 = require('sqlite3');
const { join } = require('path');
const { mkdirSync } = require('fs');

let db;
let isInitialized = false;

function initDatabase() {
  if (isInitialized) return;
  
  try {
  const dataDir = join(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'app.db');
  db = new sqlite3.Database(file);
  
  // Enable WAL mode to avoid Windows locks
  db.run('PRAGMA journal_mode = WAL');

    console.log('Connected to SQLite');
    isInitialized = true;
  } catch (err) {
    console.error('Error initializing SQLite:', err);
    throw err;
  }
}

function getDb() {
  if (!db) {
    throw new Error('SQLite not initialized');
  }
  return db;
}

module.exports = { getDb, initDatabase };