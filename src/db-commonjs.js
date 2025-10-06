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

    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'consultant',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        current_title TEXT,
        current_employer TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        seniority TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        skills TEXT NOT NULL DEFAULT '{"communications":false,"campaigns":false,"policy":false,"publicAffairs":false}',
        cv_original_path TEXT,
        cv_light TEXT,
        parsed_raw TEXT,
        parse_status TEXT NOT NULL DEFAULT 'unparsed',
        needs_review INTEGER NOT NULL DEFAULT 0,
        email_ok INTEGER NOT NULL DEFAULT 1,
        unsubscribe_token TEXT UNIQUE,
        welcome_sent_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website TEXT,
        careers_url TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        contacts TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        title TEXT NOT NULL,
        salary_min INTEGER,
        salary_max INTEGER,
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        stage TEXT NOT NULL DEFAULT 'new',
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`
    ];

    // Create tables sequentially
    tables.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          console.error(`Error creating table ${index + 1}:`, err);
        }
      });
    });

    console.log('Connected to SQLite');
    console.log('Database tables initialized');
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