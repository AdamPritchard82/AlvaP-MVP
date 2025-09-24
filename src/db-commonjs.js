// CommonJS database module for development (SQLite)
const sqlite3 = require('sqlite3');
const { join } = require('path');
const { mkdirSync } = require('fs');

let db;

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function initDatabase() {
  console.log('Initializing SQLite database...');
  
  const dataDir = join(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'app.db');
  db = new sqlite3.Database(file);
  
  // Enable WAL mode to avoid Windows locks
  db.run('PRAGMA journal_mode = WAL');

  // Create basic tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      skills TEXT NOT NULL DEFAULT '{"communications":false,"campaigns":false,"policy":false,"publicAffairs":false}',
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      parse_status TEXT NOT NULL DEFAULT 'unparsed',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'consultant',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Create tables
  tables.forEach((tableSQL, index) => {
    db.run(tableSQL, (err) => {
      if (err) {
        console.error(`Error creating table ${index + 1}:`, err);
      } else {
        console.log(`✅ Table ${index + 1} created successfully`);
      }
    });
  });

  console.log('✅ SQLite database initialized');
}

module.exports = {
  getDb,
  initDatabase
};
