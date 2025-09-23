import sqlite3 from 'sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { promisify } from 'util';

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function initDatabase() {
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
      role TEXT NOT NULL CHECK (role IN ('consultant','admin')),
      password_hash TEXT NOT NULL,
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
      skills TEXT NOT NULL DEFAULT '{"communications":0,"campaigns":0,"policy":0,"publicAffairs":0}',
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT,
      body_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      job_id TEXT,
      client_id TEXT,
      candidate_id TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      source TEXT NOT NULL DEFAULT 'system',
      assigned_to TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS inbound_emails (
      id TEXT PRIMARY KEY,
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT,
      text_content TEXT,
      html_content TEXT,
      original_sender_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (original_sender_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'bg-gray-100',
      border_color TEXT NOT NULL DEFAULT 'border-gray-200',
      position INTEGER NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_first INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_subscription_id TEXT,
      stripe_customer_id TEXT,
      current_period_start TEXT,
      current_period_end TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price_monthly INTEGER NOT NULL,
      price_yearly INTEGER,
      features TEXT NOT NULL DEFAULT '[]',
      limits TEXT NOT NULL DEFAULT '{}',
      stripe_price_id TEXT,
      stripe_yearly_price_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ];

  // Create tables and seed data
  createTablesAndSeed(tables);
}

function createTablesAndSeed(tables) {
  console.log(`Total tables to create: ${tables.length}`);
  
  // Create tables one by one and wait for completion
  let completedTables = 0;
  
  tables.forEach((tableSQL, index) => {
    try {
      console.log(`Creating table ${index + 1}...`);
      console.log(`SQL length: ${tableSQL.length}`);
      
      db.run(tableSQL, (err) => {
        if (err) {
          console.error(`Error creating table ${index + 1}:`, err);
          console.error('SQL:', tableSQL);
        } else {
          console.log(`Table ${index + 1} created successfully`);
        }
        
        completedTables++;
        
        // When all tables are created, seed the pipeline stages and plans
        if (completedTables === tables.length) {
        console.log('All tables created, seeding data...');
        
        // Email fields are already included in the CREATE TABLE statement above
        console.log('Email fields (email_ok, unsubscribe_token, welcome_sent_at) are included in table schema');
        
        setTimeout(() => {
          try {
            seedDefaultPipelineStages();
            seedDefaultPlans();
          } catch (err) {
            console.error('Error seeding data:', err);
          }
        }, 1000); // Increased delay to ensure tables are fully committed
        }
      });
    } catch (err) {
      console.error(`Error creating table ${index + 1}:`, err);
      console.error('SQL:', tableSQL);
      completedTables++;
      
      // Still check if we're done
      if (completedTables === tables.length) {
        console.log('All tables processed, seeding pipeline stages...');
        setTimeout(() => {
          try {
            seedDefaultPipelineStages();
          } catch (err) {
            console.error('Error seeding pipeline stages:', err);
          }
        }, 100);
      }
    }
  });
}

function seedDefaultPipelineStages() {
  // First check if the table exists
  try {
    db.prepare('SELECT COUNT(*) as count FROM pipeline_stages').get();
  } catch (err) {
    console.log('Pipeline stages table not ready yet, skipping seed');
    return;
  }

  const defaultStages = [
    { id: 'new_opportunities', name: 'New Opportunities', color: 'bg-blue-100', border_color: 'border-blue-200', position: 0, is_default: 1, is_first: 1 },
    { id: 'sales_approaches', name: 'Sales Approaches', color: 'bg-purple-100', border_color: 'border-purple-200', position: 1, is_default: 1, is_first: 0 },
    { id: 'commissioned', name: 'Commissioned', color: 'bg-green-100', border_color: 'border-green-200', position: 2, is_default: 1, is_first: 0 },
    { id: 'interview_stage_1', name: 'Interview Stage 1', color: 'bg-yellow-100', border_color: 'border-yellow-200', position: 3, is_default: 1, is_first: 0 },
    { id: 'interview_stage_2', name: 'Interview Stage 2', color: 'bg-orange-100', border_color: 'border-orange-200', position: 4, is_default: 1, is_first: 0 },
    { id: 'offered', name: 'Offered', color: 'bg-indigo-100', border_color: 'border-indigo-200', position: 5, is_default: 1, is_first: 0 },
    { id: 'placed', name: 'Placed', color: 'bg-emerald-100', border_color: 'border-emerald-200', position: 6, is_default: 1, is_first: 0 },
    { id: 'rejected', name: 'Rejected', color: 'bg-red-100', border_color: 'border-red-200', position: 7, is_default: 1, is_first: 0 },
  ];

  const now = new Date().toISOString();
  
  defaultStages.forEach(stage => {
    try {
      // Check if stage already exists
      const existing = db.prepare('SELECT id FROM pipeline_stages WHERE id = ?').get(stage.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO pipeline_stages (id, name, color, border_color, position, is_default, is_first, created_at, updated_at)
          VALUES (@id, @name, @color, @border_color, @position, @is_default, @is_first, @created_at, @updated_at)
        `).run({
          ...stage,
          created_at: now,
          updated_at: now
        });
        console.log(`Seeded pipeline stage: ${stage.name}`);
      }
    } catch (err) {
      console.error('Error seeding pipeline stage:', stage.name, err);
    }
  });
  
  console.log('Pipeline stages seeding completed');
}

function seedDefaultPlans() {
  // First check if the table exists
  try {
    db.prepare('SELECT COUNT(*) as count FROM plans').get();
  } catch (err) {
    console.log('Plans table not ready yet, skipping seed');
    return;
  }

  const defaultPlans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for getting started',
      price_monthly: 0,
      price_yearly: 0,
      features: JSON.stringify([
        'Up to 10 candidates',
        'Up to 5 jobs',
        'Basic CV parsing',
        'Email templates'
      ]),
      limits: JSON.stringify({
        candidates: 10,
        jobs: 5,
        cv_parsing: true,
        email_templates: true
      }),
      stripe_price_id: null,
      stripe_yearly_price_id: null,
      is_default: 1
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'For growing recruitment teams',
      price_monthly: 2900, // £29.00 in pence
      price_yearly: 29000, // £290.00 in pence
      features: JSON.stringify([
        'Unlimited candidates',
        'Unlimited jobs',
        'Advanced CV parsing',
        'Email templates',
        'Priority support',
        'API access'
      ]),
      limits: JSON.stringify({
        candidates: -1, // unlimited
        jobs: -1, // unlimited
        cv_parsing: true,
        email_templates: true,
        api_access: true
      }),
      stripe_price_id: 'price_professional_monthly', // Will be set up in Stripe
      stripe_yearly_price_id: 'price_professional_yearly',
      is_default: 0
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations',
      price_monthly: 9900, // £99.00 in pence
      price_yearly: 99000, // £990.00 in pence
      features: JSON.stringify([
        'Everything in Professional',
        'Custom integrations',
        'Dedicated support',
        'Advanced analytics',
        'White-label options'
      ]),
      limits: JSON.stringify({
        candidates: -1,
        jobs: -1,
        cv_parsing: true,
        email_templates: true,
        api_access: true,
        custom_integrations: true,
        analytics: true
      }),
      stripe_price_id: 'price_enterprise_monthly',
      stripe_yearly_price_id: 'price_enterprise_yearly',
      is_default: 0
    }
  ];

  const now = new Date().toISOString();
  
  defaultPlans.forEach(plan => {
    try {
      // Check if plan already exists
      const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(plan.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO plans (id, name, description, price_monthly, price_yearly, features, limits, stripe_price_id, stripe_yearly_price_id, is_active, created_at, updated_at)
          VALUES (@id, @name, @description, @price_monthly, @price_yearly, @features, @limits, @stripe_price_id, @stripe_yearly_price_id, @is_active, @created_at, @updated_at)
        `).run({
          ...plan,
          created_at: now,
          updated_at: now
        });
        console.log(`Seeded plan: ${plan.name}`);
      }
    } catch (err) {
      console.error('Error seeding plan:', plan.name, err);
    }
  });
  
  console.log('Plans seeding completed');
}


