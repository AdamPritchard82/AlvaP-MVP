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

  // Test connection
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('PostgreSQL connection failed:', err);
      throw err;
    }
      console.log('Connected to PostgreSQL');
    console.log('Database time:', result.rows[0].now);
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