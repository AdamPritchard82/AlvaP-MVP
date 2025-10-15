const knex = require('knex');

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './candidates.db'
  },
  useNullAsDefault: true
});

async function checkTables() {
  try {
    const tables = await db.raw("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables in database:', tables.map(row => row.name));
    
    // Check if billing tables exist
    const billingTables = ['billing_plans', 'billing_orgs', 'billing_invoices', 'billing_promo_codes', 'auth_sessions'];
    for (const table of billingTables) {
      const exists = await db.schema.hasTable(table);
      console.log(`${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    }
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await db.destroy();
  }
}

checkTables();
