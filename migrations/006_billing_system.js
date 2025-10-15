/**
 * Billing System Migration
 * 
 * Creates tables for AlvaP Seat billing system:
 * - billing_plans: Plan definitions (monthly/annual)
 * - billing_orgs: Organization billing status and trial info
 * - billing_invoices: Invoice records (internal display)
 * - billing_promo_codes: Promotional codes
 * - auth_sessions: User session tracking for anti-sharing
 */

exports.up = function(knex) {
  return Promise.all([
    // Billing plans table
    knex.schema.createTable('billing_plans', function(table) {
      table.string('id').primary();
      table.string('code').unique().notNullable();
      table.string('name').notNullable();
      table.enum('interval', ['monthly', 'annual']).notNullable();
      table.integer('amount_pence').notNullable(); // Amount in pence
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    }),

    // Billing organizations table
    knex.schema.createTable('billing_orgs', function(table) {
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
      
      table.foreign('plan_code').references('code').inTable('billing_plans');
    }),

    // Billing invoices table
    knex.schema.createTable('billing_invoices', function(table) {
      table.string('id').primary();
      table.string('org_id').notNullable();
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end').notNullable();
      table.integer('subtotal_pence').notNullable();
      table.integer('discount_pence').defaultTo(0);
      table.integer('total_pence').notNullable();
      table.jsonb('line_items').nullable(); // Array of seat/plan/price objects
      table.timestamps(true, true);
      
      table.foreign('org_id').references('org_id').inTable('billing_orgs');
    }),

    // Billing promo codes table
    knex.schema.createTable('billing_promo_codes', function(table) {
      table.string('code').primary();
      table.string('description').notNullable();
      table.integer('percent_off').notNullable(); // 0-100
      table.enum('duration', ['forever', 'repeating']).notNullable();
      table.integer('duration_in_months').nullable();
      table.string('allowed_customer_email').nullable();
      table.integer('max_redemptions').nullable();
      table.integer('redeemed_count').defaultTo(0);
      table.timestamp('expires_at').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    }),

    // Auth sessions table for anti-sharing
    knex.schema.createTable('auth_sessions', function(table) {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('org_id').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('last_seen_at').defaultTo(knex.fn.now());
      table.string('device_hash').nullable();
      table.string('ip_country').nullable();
      table.boolean('is_active').defaultTo(true);
      
      table.foreign('user_id').references('id').inTable('users');
    })
  ]).then(() => {
    // Create indexes
    return Promise.all([
      knex.schema.raw('CREATE INDEX idx_billing_orgs_org_id ON billing_orgs(org_id)'),
      knex.schema.raw('CREATE INDEX idx_auth_sessions_user_org ON auth_sessions(user_id, org_id, is_active)'),
      knex.schema.raw('CREATE INDEX idx_auth_sessions_created_at ON auth_sessions(created_at)')
    ]);
  });
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTable('auth_sessions'),
    knex.schema.dropTable('billing_promo_codes'),
    knex.schema.dropTable('billing_invoices'),
    knex.schema.dropTable('billing_orgs'),
    knex.schema.dropTable('billing_plans')
  ]);
};
