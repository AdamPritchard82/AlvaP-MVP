// PostgreSQL database module for production
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool;

function getDb() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

function initDatabase() {
  console.log('Initializing PostgreSQL database...');
  
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Create connection pool
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Test connection
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.error('Database connection failed:', err);
      throw err;
    }
    console.log('✅ PostgreSQL connected successfully');
    console.log('Database time:', result.rows[0].now);
  });

  // Create tables
  createTablesAndSeed();
}

function createTablesAndSeed() {
  console.log('Creating PostgreSQL tables...');
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('consultant','admin')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS candidates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      current_title TEXT,
      current_employer TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      seniority TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      notes TEXT,
      skills JSONB NOT NULL DEFAULT '{"communications":false,"campaigns":false,"policy":false,"publicAffairs":false}',
      cv_original_path TEXT,
      cv_light TEXT,
      parsed_raw JSONB,
      parse_status TEXT NOT NULL DEFAULT 'unparsed',
      needs_review BOOLEAN NOT NULL DEFAULT false,
      email_ok BOOLEAN NOT NULL DEFAULT true,
      unsubscribe_token TEXT UNIQUE,
      welcome_sent_at TIMESTAMP WITH TIME ZONE,
      created_by UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      website TEXT,
      careers_url TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      contacts JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS email_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT,
      body_text TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL,
      title TEXT NOT NULL,
      salary_min INTEGER,
      salary_max INTEGER,
      tags TEXT[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL,
      candidate_id UUID NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      action TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      job_id UUID,
      client_id UUID,
      candidate_id UUID,
      priority TEXT NOT NULL DEFAULT 'normal',
      source TEXT NOT NULL DEFAULT 'system',
      assigned_to UUID,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS inbound_emails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT,
      text_content TEXT,
      html_content TEXT,
      original_sender_id UUID,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (original_sender_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'bg-gray-100',
      border_color TEXT NOT NULL DEFAULT 'border-gray-200',
      position INTEGER NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_first BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_subscription_id TEXT,
      stripe_customer_id TEXT,
      current_period_start TIMESTAMP WITH TIME ZONE,
      current_period_end TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price_monthly INTEGER NOT NULL,
      price_yearly INTEGER,
      features JSONB NOT NULL DEFAULT '[]',
      limits JSONB NOT NULL DEFAULT '{}',
      stripe_price_id TEXT,
      stripe_yearly_price_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`
  ];

  // Create tables sequentially
  createTablesSequentially(tables, 0);
}

async function createTablesSequentially(tables, index) {
  if (index >= tables.length) {
    console.log('All tables created, seeding data...');
    await seedDefaultData();
    return;
  }

  try {
    console.log(`Creating table ${index + 1}/${tables.length}...`);
    await pool.query(tables[index]);
    console.log(`✅ Table ${index + 1} created successfully`);
    
    // Create next table
    setTimeout(() => createTablesSequentially(tables, index + 1), 100);
  } catch (err) {
    console.error(`❌ Error creating table ${index + 1}:`, err);
    // Continue with next table
    setTimeout(() => createTablesSequentially(tables, index + 1), 100);
  }
}

async function seedDefaultData() {
  try {
    // Seed pipeline stages
    await seedPipelineStages();
    
    // Seed plans
    await seedPlans();
    
    // Create admin user if none exists
    await createAdminUser();
    
    console.log('✅ Database seeding completed');
  } catch (err) {
    console.error('❌ Error seeding database:', err);
  }
}

async function seedPipelineStages() {
  const defaultStages = [
    { id: 'new_opportunities', name: 'New Opportunities', color: 'bg-blue-100', border_color: 'border-blue-200', position: 0, is_default: true, is_first: true },
    { id: 'sales_approaches', name: 'Sales Approaches', color: 'bg-purple-100', border_color: 'border-purple-200', position: 1, is_default: true, is_first: false },
    { id: 'commissioned', name: 'Commissioned', color: 'bg-green-100', border_color: 'border-green-200', position: 2, is_default: true, is_first: false },
    { id: 'interview_stage_1', name: 'Interview Stage 1', color: 'bg-yellow-100', border_color: 'border-yellow-200', position: 3, is_default: true, is_first: false },
    { id: 'interview_stage_2', name: 'Interview Stage 2', color: 'bg-orange-100', border_color: 'border-orange-200', position: 4, is_default: true, is_first: false },
    { id: 'offered', name: 'Offered', color: 'bg-indigo-100', border_color: 'border-indigo-200', position: 5, is_default: true, is_first: false },
    { id: 'placed', name: 'Placed', color: 'bg-emerald-100', border_color: 'border-emerald-200', position: 6, is_default: true, is_first: false },
    { id: 'rejected', name: 'Rejected', color: 'bg-red-100', border_color: 'border-red-200', position: 7, is_default: true, is_first: false },
  ];

  for (const stage of defaultStages) {
    try {
      await pool.query(`
        INSERT INTO pipeline_stages (id, name, color, border_color, position, is_default, is_first, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [stage.id, stage.name, stage.color, stage.border_color, stage.position, stage.is_default, stage.is_first]);
      
      console.log(`✅ Seeded pipeline stage: ${stage.name}`);
    } catch (err) {
      console.error(`❌ Error seeding pipeline stage ${stage.name}:`, err);
    }
  }
}

async function seedPlans() {
  const defaultPlans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for getting started',
      price_monthly: 0,
      price_yearly: 0,
      features: ['Up to 10 candidates', 'Up to 5 jobs', 'Basic CV parsing', 'Email templates'],
      limits: { candidates: 10, jobs: 5, cv_parsing: true, email_templates: true },
      stripe_price_id: null,
      stripe_yearly_price_id: null,
      is_active: true
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'For growing recruitment teams',
      price_monthly: 2900,
      price_yearly: 29000,
      features: ['Unlimited candidates', 'Unlimited jobs', 'Advanced CV parsing', 'Email templates', 'Priority support', 'API access'],
      limits: { candidates: -1, jobs: -1, cv_parsing: true, email_templates: true, api_access: true },
      stripe_price_id: 'price_professional_monthly',
      stripe_yearly_price_id: 'price_professional_yearly',
      is_active: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations',
      price_monthly: 9900,
      price_yearly: 99000,
      features: ['Everything in Professional', 'Custom integrations', 'Dedicated support', 'Advanced analytics', 'White-label options'],
      limits: { candidates: -1, jobs: -1, cv_parsing: true, email_templates: true, api_access: true, custom_integrations: true, analytics: true },
      stripe_price_id: 'price_enterprise_monthly',
      stripe_yearly_price_id: 'price_enterprise_yearly',
      is_active: true
    }
  ];

  for (const plan of defaultPlans) {
    try {
      await pool.query(`
        INSERT INTO plans (id, name, description, price_monthly, price_yearly, features, limits, stripe_price_id, stripe_yearly_price_id, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [plan.id, plan.name, plan.description, plan.price_monthly, plan.price_yearly, JSON.stringify(plan.features), JSON.stringify(plan.limits), plan.stripe_price_id, plan.stripe_yearly_price_id, plan.is_active]);
      
      console.log(`✅ Seeded plan: ${plan.name}`);
    } catch (err) {
      console.error(`❌ Error seeding plan ${plan.name}:`, err);
    }
  }
}

async function createAdminUser() {
  try {
    // Check if any users exist
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(result.rows[0].count);
    
    if (userCount === 0) {
      // Create default admin user
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@alvap.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      // Hash password (you should use bcrypt in production)
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      await pool.query(`
        INSERT INTO users (email, name, role, password_hash, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [adminEmail, 'Admin User', 'admin', passwordHash]);
      
      console.log(`✅ Created admin user: ${adminEmail}`);
    } else {
      console.log(`✅ Users already exist (${userCount} users)`);
    }
  } catch (err) {
    console.error('❌ Error creating admin user:', err);
  }
}

// Helper function to run queries
async function query(text, params) {
  return await pool.query(text, params);
}

// Helper function to get a client from the pool
async function getClient() {
  return await pool.connect();
}

module.exports = {
  getDb,
  initDatabase,
  query,
  getClient
};
