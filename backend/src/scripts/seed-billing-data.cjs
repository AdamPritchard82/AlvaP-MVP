/**
 * Seed Billing Data
 * 
 * Seeds the database with initial billing plans and promo codes
 * for AlvaP Seat system.
 */

const knex = require('knex');

// Simple database configuration for seeding
const dbConfig = {
  client: 'sqlite3',
  connection: {
    filename: './candidates.db'
  },
  useNullAsDefault: true
};

const db = knex(dbConfig);

async function seedBillingData() {
  console.log('🌱 Seeding billing data...');

  try {
    // Seed billing plans
    console.log('📋 Creating billing plans...');
    
    const plans = [
      {
        id: 'plan_monthly',
        code: 'SEAT_MONTHLY',
        name: 'Monthly Plan',
        interval: 'monthly',
        amount_pence: 3900, // £39.00
        is_active: true
      },
      {
        id: 'plan_annual',
        code: 'SEAT_ANNUAL', 
        name: 'Annual Plan',
        interval: 'annual',
        amount_pence: 38400, // £32.00 * 12 = £384.00
        is_active: true
      }
    ];

    for (const plan of plans) {
      await db('billing_plans')
        .insert(plan)
        .onConflict('code')
        .merge();
    }

    console.log('✅ Billing plans created');

    // Seed promo codes
    console.log('🎟️ Creating promo codes...');
    
    const promoCodes = [
      {
        code: 'ADAM-FREE',
        description: '100% off forever for Adam',
        percent_off: 100,
        duration: 'forever',
        duration_in_months: null,
        allowed_customer_email: 'adam@door10.co.uk',
        max_redemptions: 1,
        redeemed_count: 0,
        expires_at: null,
        is_active: true
      },
      {
        code: 'ADAM-29-6MO',
        description: '25% off for 6 months',
        percent_off: 25,
        duration: 'repeating',
        duration_in_months: 6,
        allowed_customer_email: null,
        max_redemptions: 10,
        redeemed_count: 0,
        expires_at: null,
        is_active: true
      }
    ];

    for (const promo of promoCodes) {
      await db('billing_promo_codes')
        .insert(promo)
        .onConflict('code')
        .merge();
    }

    console.log('✅ Promo codes created');

    // Create default billing org if it doesn't exist
    console.log('🏢 Creating default billing organization...');
    
    const defaultOrg = {
      org_id: 'default',
      plan_code: 'SEAT_MONTHLY',
      seat_quantity: 0,
      trial_started_at: new Date(),
      trial_ends_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      status: 'trialing',
      billing_email: 'adam@door10.co.uk',
      billing_notes: 'Default organization for development',
      promo_code_applied: null,
      promo_expires_at: null
    };

    await db('billing_orgs')
      .insert(defaultOrg)
      .onConflict('org_id')
      .merge();

    console.log('✅ Default billing organization created');

    console.log('🎉 Billing data seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding billing data:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run if called directly
if (require.main === module) {
  seedBillingData()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedBillingData;
