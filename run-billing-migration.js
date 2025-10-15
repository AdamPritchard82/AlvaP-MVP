const knex = require('knex');

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './candidates.db'
  },
  useNullAsDefault: true
});

async function runBillingMigration() {
  try {
    console.log('Creating billing tables...');
    
    // Create billing_plans table
    await db.schema.createTable('billing_plans', function(table) {
      table.string('id').primary();
      table.string('code').unique().notNullable();
      table.string('name').notNullable();
      table.enum('interval', ['monthly', 'annual']).notNullable();
      table.integer('amount_pence').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });
    console.log('✅ billing_plans table created');

    // Create billing_orgs table
    await db.schema.createTable('billing_orgs', function(table) {
      table.string('org_id').primary();
      table.string('plan_code').notNullable();
      table.integer('seat_quantity').defaultTo(0);
      table.timestamp('trial_started_at').nullable();
      table.timestamp('trial_ends_at').nullable();
      table.enum('status', ['trialing', 'active', 'past_due', 'canceled']).defaultTo('trialing');
      table.string('billing_email').nullable();
      table.text('billing_notes').nullable();
      table.string('promo_code_applied').nullable();
      table.timestamp('promo_expires_at').nullable();
      table.timestamps(true, true);
    });
    console.log('✅ billing_orgs table created');

    // Create billing_invoices table
    await db.schema.createTable('billing_invoices', function(table) {
      table.string('id').primary();
      table.string('org_id').notNullable();
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end').notNullable();
      table.integer('subtotal_pence').notNullable();
      table.integer('discount_pence').defaultTo(0);
      table.integer('total_pence').notNullable();
      table.json('line_items').nullable();
      table.timestamps(true, true);
    });
    console.log('✅ billing_invoices table created');

    // Create billing_promo_codes table
    await db.schema.createTable('billing_promo_codes', function(table) {
      table.string('code').primary();
      table.string('description').notNullable();
      table.integer('percent_off').notNullable();
      table.enum('duration', ['forever', 'repeating']).notNullable();
      table.integer('duration_in_months').nullable();
      table.string('allowed_customer_email').nullable();
      table.integer('max_redemptions').nullable();
      table.integer('redeemed_count').defaultTo(0);
      table.timestamp('expires_at').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });
    console.log('✅ billing_promo_codes table created');

    // Create auth_sessions table
    await db.schema.createTable('auth_sessions', function(table) {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('org_id').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('last_seen_at').defaultTo(db.fn.now());
      table.string('device_hash').nullable();
      table.string('ip_country').nullable();
      table.boolean('is_active').defaultTo(true);
    });
    console.log('✅ auth_sessions table created');

    console.log('🎉 All billing tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    await db.destroy();
  }
}

runBillingMigration();
