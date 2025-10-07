const { Pool } = require('pg');

let pool;
let isInitialized = false;

function initDatabase() {
  if (isInitialized) return;
  
  try {
  pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Test connection and create table if needed
  pool.query('SELECT NOW()', async (err, result) => {
    if (err) {
        console.error('PostgreSQL connection failed:', err);
      throw err;
    }
      console.log('Connected to PostgreSQL');
    console.log('Database time:', result.rows[0].now);
    
    // Create candidates table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS candidates (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(50),
          current_title VARCHAR(255),
          current_employer VARCHAR(255),
          salary_min INTEGER,
          salary_max INTEGER,
          seniority VARCHAR(50),
          tags TEXT DEFAULT '[]',
          notes TEXT,
          skills TEXT DEFAULT '{"communications":0,"campaigns":0,"policy":0,"publicAffairs":0}',
          cv_original_path VARCHAR(500),
          cv_light TEXT,
          parsed_raw TEXT,
          parse_status VARCHAR(50) DEFAULT 'pending',
          needs_review BOOLEAN DEFAULT false,
          email_ok BOOLEAN DEFAULT true,
          unsubscribe_token VARCHAR(255),
          welcome_sent_at TIMESTAMP,
          created_by VARCHAR(100) DEFAULT 'system',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Candidates table ready');
    } catch (tableErr) {
      console.error('Error creating candidates table:', tableErr);
    }
  });

    isInitialized = true;
  } catch (err) {
    console.error('Error initializing PostgreSQL:', err);
    throw err;
  }
}

function getDb() {
  if (!pool) {
    throw new Error('PostgreSQL not initialized');
  }
  return pool;
}

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = { getDb, initDatabase, query };