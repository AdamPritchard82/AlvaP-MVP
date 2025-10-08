const knex = require('knex');
const config = require('../knexfile');

// Get the appropriate config based on environment
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const hasPostgresUrl = Boolean(process.env.DATABASE_URL);

let dbConfig;
if (isProduction && hasPostgresUrl) {
  dbConfig = config.production;
} else {
  dbConfig = config.development;
}

const db = knex(dbConfig);

// Migration utilities
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    await db.migrate.latest();
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Health check for database
async function healthCheck() {
  try {
    await db.raw('SELECT 1');
    return { status: 'healthy', database: dbConfig.client };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

// Get database instance
function getDb() {
  return db;
}

// Close database connection
async function closeDb() {
  await db.destroy();
}

module.exports = {
  db,
  getDb,
  runMigrations,
  healthCheck,
  closeDb
};
