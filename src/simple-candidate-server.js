// Simple Candidate Server - Clean Version with .NET Parser Integration
console.log('=== SIMPLE CANDIDATE SERVER STARTING - CLEAN VERSION WITH .NET PARSER v4 ===');

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { randomUUID } = require('crypto');
// const { parseRoute } = require('./routes/parse'); // Temporarily disabled - TypeScript issue
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Import billing services - using relative paths from src/
const pricing = require('../backend/src/services/pricing.cjs');
const billingProvider = require('../backend/src/services/billingProvider.cjs');
const sessionManager = require('../backend/src/services/sessionManager.cjs');

// Import .NET parser from reference
const { DotNetCvParser } = require('./parsers/dotnetCvParser');

const app = express();
const PORT = process.env.PORT || 3001;
// WebSocket server
const http = require('http');
const server = http.createServer(app);
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server, path: '/ws' });

// Track active websocket clients
const wsClients = new Set();

wss.on('connection', (socket) => {
  wsClients.add(socket);
  try {
    socket.send(JSON.stringify({
      type: 'SYSTEM_UPDATE',
      data: { message: 'Connected to real-time updates' },
      timestamp: Date.now(),
      id: `system_${Date.now()}`
    }));
  } catch {}

  socket.on('close', () => {
    wsClients.delete(socket);
  });
});

function broadcastWs(event) {
  const payload = typeof event === 'string' ? event : JSON.stringify(event);
  for (const client of wsClients) {
    try {
      client.send(payload);
    } catch {}
  }
}

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth middleware
const requireAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Helper function to sign JWT
const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
    }
  }
});

// Initialize .NET parser
let dotNetParser = null;
const enableDotNetParser = process.env.ENABLE_DOTNET_PARSER === 'true' || process.env.ENABLE_DOTNET_PARSER === '1' || process.env.NODE_ENV === 'production';
const dotNetApiUrl = process.env.DOTNET_CV_API_URL || 'https://positive-bravery-production.up.railway.app';

if (enableDotNetParser) {
  try {
    dotNetParser = new DotNetCvParser();
    console.log('✅ .NET CV Parser enabled:', dotNetApiUrl);
  } catch (error) {
    console.warn('⚠️ .NET CV Parser disabled:', error.message);
  }
} else {
  console.log('ℹ️ .NET CV Parser disabled (ENABLE_DOTNET_PARSER=false)');
}

// Database setup - use PostgreSQL in production, SQLite locally
let db;

// Initialize database function
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // Use PostgreSQL for production (Railway)
      const { Pool } = require('pg');
      db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      console.log('✅ Using PostgreSQL database');
      
      // PostgreSQL initialization - First check if table exists and what columns it has
      db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'candidates'`, (err, result) => {
        if (err) {
          console.error('❌ Error checking table structure:', err);
          reject(err);
          return;
        }
        
        const existingColumns = result.rows.map(row => row.column_name);
        console.log('📋 Existing columns:', existingColumns);
        
        // If table doesn't exist or has wrong structure, add missing columns
        if (existingColumns.length === 0 || !existingColumns.includes('first_name')) {
          console.log('🔧 Adding missing columns to existing candidates table...');
          
          // Add missing columns one by one
          const addColumns = [
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_employer TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_min TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_max TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skills TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS experience TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notes TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_ok BOOLEAN DEFAULT true`
          ];
          
          let completed = 0;
          const total = addColumns.length;
          
          addColumns.forEach((sql, index) => {
            db.query(sql, (err) => {
              if (err) {
                console.error(`❌ Error adding column ${index + 1}:`, err);
                reject(err);
                return;
              }
              
              completed++;
              console.log(`✅ Added column ${index + 1}/${total}`);
              
              if (completed === total) {
                // Set default UUID generation for created_by column
                db.query(`ALTER TABLE candidates ALTER COLUMN created_by SET DEFAULT gen_random_uuid()`, (uuidErr) => {
                  if (uuidErr) {
                    console.warn('⚠️ Could not set UUID default (column may not exist):', uuidErr.message);
                  } else {
                    console.log('✅ Set UUID default for created_by column');
                  }
                  
                  // Try to drop the foreign key constraint if it exists
                  db.query(`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_created_by_fkey`, (fkErr) => {
                    if (fkErr) {
                      console.warn('⚠️ Could not drop foreign key constraint:', fkErr.message);
                    } else {
                      console.log('✅ Dropped foreign key constraint for created_by');
                    }
                    console.log('✅ PostgreSQL database schema updated successfully');
                    resolve();
                  });
                });
              }
            });
          });
        } else {
          // Even if columns exist, ensure UUID default is set
          console.log('🔧 Ensuring UUID default is set for created_by column...');
          db.query(`ALTER TABLE candidates ALTER COLUMN created_by SET DEFAULT gen_random_uuid()`, (uuidErr) => {
            if (uuidErr) {
              console.warn('⚠️ Could not set UUID default:', uuidErr.message);
            } else {
              console.log('✅ Set UUID default for created_by column');
            }
            
            // Try to drop the foreign key constraint if it exists
            db.query(`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_created_by_fkey`, (fkErr) => {
              if (fkErr) {
                console.warn('⚠️ Could not drop foreign key constraint:', fkErr.message);
              } else {
                console.log('✅ Dropped foreign key constraint for created_by');
              }
              
              // Create users table if it doesn't exist
              db.query(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'consultant',
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )`, (userErr) => {
                if (userErr) {
                  console.error('❌ Error creating users table:', userErr);
                  reject(userErr);
                } else {
                  console.log('✅ Users table created/verified');
                  console.log('✅ PostgreSQL database table structure is correct');
                  resolve();
                }
              });
            });
          });
        }
      });
    } else {
      // Use SQLite for local development
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, '../candidates.db');
      db = new sqlite3.Database(dbPath);
      console.log('✅ Using SQLite database');
      
      // SQLite initialization
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          current_title TEXT,
          current_employer TEXT,
          salary_min TEXT,
          salary_max TEXT,
          skills TEXT,
          experience TEXT,
          notes TEXT,
          email_ok BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Database initialization failed:', err);
            reject(err);
            return;
          }
          
          // Create users table
          db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'consultant',
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (userErr) => {
            if (userErr) {
              console.error('❌ Users table creation failed:', userErr);
              reject(userErr);
            } else {
              console.log('✅ SQLite database initialized with users table');
              resolve();
            }
          });
        });
      });
    }
  });
}

// Helper function to get database connection
const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

// Simple CV parsing function (local fallback)
function parseCVContent(text) {
  console.log('Parsing CV content locally...');
  
  // Extract basic information using regex
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(\+?[0-9\s\-\(\)]{10,})/);
  
  // Extract name (first line that looks like a name)
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const nameLine = lines[0] || '';
  const nameParts = nameLine.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Simple skill detection
  const allText = text.toLowerCase();
  const skills = {
    communications: /communications?|comms?|media|press|pr|public relations|marketing|social media|content|writing|editorial|journalism|brand|advertising/i.test(allText),
    campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach|community|organizing|mobilization|political|election/i.test(allText),
    policy: /policy|policies|briefing|consultation|legislative|regulatory|government|public policy|research|analysis|strategy|planning/i.test(allText),
    publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying|government relations|political|advocacy|corporate affairs/i.test(allText)
  };

  return {
    firstName,
    lastName,
    email: emailMatch ? emailMatch[1] : '',
    phone: phoneMatch ? phoneMatch[1].trim() : '',
    skills,
    experience: [],
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.7,
    source: 'local-parser'
  };
}

// Routes

// Health check
app.get('/health', (req, res) => {
        res.json({
    status: 'ok', 
    timestamp: new Date().toISOString(),
    dotnetParser: dotNetParser ? 'enabled' : 'disabled'
  });
});

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  const db = getDb();
  db.query('SELECT id, email, name, role, password_hash FROM users WHERE email = $1', [email], (err, result) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check session limit (max 2 concurrent sessions)
    db.query('SELECT COUNT(*) as count FROM auth_sessions WHERE user_id = $1 AND expires_at > NOW()', [user.id], (err, sessionResult) => {
      if (err) {
        console.error('Error checking sessions:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const activeSessions = parseInt(sessionResult.rows[0].count);
      
      if (activeSessions >= 2) {
        // Kill oldest session
        db.query('DELETE FROM auth_sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at ASC LIMIT 1', [user.id], (err) => {
          if (err) {
            console.error('Error removing oldest session:', err);
          }
        });
      }
      
      // Create new session
      const sessionId = require('crypto').randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      db.query('INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, NOW(), $3)', 
        [sessionId, user.id, expiresAt], (err) => {
          if (err) {
            console.error('Error creating session:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role, sessionId });
          return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
        }
      );
    });
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, role = 'consultant' } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  
  const db = getDb();
  
  // Check if user already exists
  db.query('SELECT id FROM users WHERE email = $1', [email], (err, result) => {
    if (err) {
      console.error('Error checking existing user:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Continue with user creation
    createUser();
  });
  
  function createUser() {
    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);
    
    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    db.query(`
      INSERT INTO users (id, email, name, role, password_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, email, name, role, passwordHash, now], (err, result) => {
      if (err) {
        console.error('Error creating user:', err);
        return res.status(500).json({ error: 'Failed to create user' });
      }
      
      const token = signToken({ userId, email, name, role });
      return res.json({ 
        token, 
        user: { id: userId, email, name, role },
        message: 'User created successfully' 
      });
    });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = getDb();
  db.query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user.userId], (err, result) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({ user: result.rows[0] });
  });
});

// Billing routes
app.post('/api/billing/promo/apply', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const orgId = req.user.orgId || 'default';
    const actorUserId = req.user.userId;

    if (!code) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const result = await pricing.applyPromo(orgId, code, actorUserId);
    
    res.json({
      success: true,
      message: 'Promo code applied successfully',
      promo: result
    });
  } catch (error) {
    console.error('Error applying promo code:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/billing/summary', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId || 'default';
    const summary = await pricing.getBillingSummary(orgId);
    
    // Check for trial ending soon (7 days or less)
    if (summary.trialDays && summary.trialDays <= 7 && summary.trialDays > 0) {
      broadcastWs({
        type: 'TRIAL_ENDING',
        data: {
          daysLeft: summary.trialDays,
          plan: summary.plan,
          isAdmin: summary.isAdmin
        },
        timestamp: Date.now(),
        id: `trial_ending_${orgId}_${Date.now()}`
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting billing summary:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/billing/plan/switch', requireAuth, async (req, res) => {
  try {
    const { planCode } = req.body;
    const orgId = req.user.orgId || 'default';

    if (!planCode) {
      return res.status(400).json({ error: 'Plan code is required' });
    }

    const plan = await pricing.switchPlan(orgId, planCode);
    
    res.json({
      success: true,
      message: 'Plan switched successfully',
      plan
    });
  } catch (error) {
    console.error('Error switching plan:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/billing/trial/begin', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId || 'default';
    const result = await pricing.beginTrialForOrg(orgId);
    
    res.json({
      success: true,
      message: 'Trial started successfully',
      trial: result
    });
  } catch (error) {
    console.error('Error beginning trial:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/billing/plans', async (req, res) => {
  try {
    const knex = require('knex');
    const config = require('../backend/src/config/config');
    const db = knex(config.database);

    const plans = await db('billing_plans')
      .where('is_active', true)
      .select('*')
      .orderBy('interval', 'asc')
      .orderBy('amount_pence', 'asc');

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/billing/promo-codes', async (req, res) => {
  try {
    const knex = require('knex');
    const config = require('../backend/src/config/config');
    const db = knex(config.database);

    const promoCodes = await db('billing_promo_codes')
      .where('is_active', true)
      .select('code', 'description', 'percent_off', 'duration', 'expires_at', 'max_redemptions', 'redeemed_count')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: promoCodes
    });
  } catch (error) {
    console.error('Error getting promo codes:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/billing/trial/status', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId || 'default';
    const trialStatus = await pricing.getTrialStatus(orgId);
    const checkResult = await pricing.checkTrialStatus(orgId);
    
    res.json({
      success: true,
      data: {
        ...trialStatus,
        ...checkResult
      }
    });
  } catch (error) {
    console.error('Error checking trial status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/billing/provider/status', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: billingProvider.isEnabled(),
      provider: billingProvider.getProvider(),
      message: billingProvider.getProvider() === 'none' 
        ? 'Payment provider not connected yet — charging will start when connected.'
        : `Connected to ${billingProvider.getProvider()}`
    }
  });
});

// Account reset endpoint (for development/testing)
app.post('/api/reset-account', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email required' });
  }
  
  console.log(`🔄 Resetting account for: ${email}`);
  
  const db = getDb();
  
  // Find user by email
  db.query('SELECT id FROM users WHERE email = $1', [email], (err, userResult) => {
    if (err) {
      console.error('Error finding user:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    console.log(`Found user ID: ${userId}`);
    
    // Delete all user data: candidates, taxonomies, sessions
    const deleteCandidates = () => {
      db.query('DELETE FROM candidates WHERE created_by = $1', [userId], (err) => {
        if (err) {
          console.error('Error deleting candidates:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        console.log('✅ Deleted candidates');
        deleteTaxonomies();
      });
    };
    
    const deleteTaxonomies = () => {
      db.query('DELETE FROM taxonomy_roles WHERE taxonomy_id IN (SELECT id FROM taxonomies WHERE created_by = $1)', [userId], (err) => {
        if (err) {
          console.error('Error deleting taxonomy roles:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        console.log('✅ Deleted taxonomy roles');
        
        db.query('DELETE FROM taxonomies WHERE created_by = $1', [userId], (err) => {
          if (err) {
            console.error('Error deleting taxonomies:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
          }
          console.log('✅ Deleted taxonomies');
          deleteSessions();
        });
      });
    };
    
    const deleteSessions = () => {
      db.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId], (err) => {
        if (err) {
          console.error('Error deleting sessions:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        console.log('✅ Deleted sessions');
        
        // Finally delete the user
        db.query('DELETE FROM users WHERE id = $1', [userId], (err) => {
          if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
          }
          
          console.log(`✅ Account completely reset for: ${email}`);
          res.json({ 
            success: true, 
            message: 'Account completely reset. All data deleted. You can now register with the original email.'
          });
        });
      });
    };
    
    // Start the deletion process
    deleteCandidates();
  });
});

// Taxonomy/Industries endpoints
app.get('/api/taxonomy/active', requireAuth, (req, res) => {
  const db = getDb();
  
  db.query('SELECT * FROM taxonomies WHERE created_by = $1 ORDER BY created_at DESC LIMIT 1', [req.user.userId], (err, result) => {
    if (err) {
      console.error('Error fetching active taxonomy:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (result.rows.length === 0) {
      // Return empty taxonomy structure for new users
      return res.json({
        success: true,
        data: {
          id: null,
          name: 'Default',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          skills: [],
          roles: []
        }
      });
    }
    
    const taxonomy = result.rows[0];
    
    // Get skills and roles for this taxonomy
    db.query('SELECT * FROM taxonomy_skills WHERE taxonomy_id = $1', [taxonomy.id], (err, skillsResult) => {
      if (err) {
        console.error('Error fetching taxonomy skills:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      db.query('SELECT * FROM taxonomy_roles WHERE taxonomy_id = $1', [taxonomy.id], (err, rolesResult) => {
        if (err) {
          console.error('Error fetching taxonomy roles:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        res.json({
          success: true,
          data: {
            ...taxonomy,
            skills: skillsResult.rows,
            roles: rolesResult.rows
          }
        });
      });
    });
  });
});

// Focus Configuration endpoints (formerly taxonomy)
app.get('/api/focus/active', requireAuth, (req, res) => {
  const db = getDb();
  
  db.query('SELECT * FROM taxonomies WHERE created_by = $1 ORDER BY created_at DESC LIMIT 1', [req.user.userId], (err, result) => {
    if (err) {
      console.error('Error fetching active focus:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (result.rows.length === 0) {
      // Return empty focus structure for new users
      return res.json({
        success: true,
        industries: [],
        roles: [],
        hasActiveFocus: false
      });
    }
    
    const taxonomy = result.rows[0];
    
    // Get roles for this taxonomy (industries are stored in the taxonomy name/description)
    db.query('SELECT * FROM taxonomy_roles WHERE taxonomy_id = $1', [taxonomy.id], (err, rolesResult) => {
      if (err) {
        console.error('Error fetching focus roles:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      // Parse industries from taxonomy name or description
      const industries = taxonomy.industries ? JSON.parse(taxonomy.industries) : [];
      const roles = rolesResult.rows.map(role => role.name);
      
      res.json({
        success: true,
        industries: industries,
        roles: roles,
        hasActiveFocus: true
      });
    });
  });
});

app.post('/api/admin/focus', requireAuth, (req, res) => {
  const { industries, roles } = req.body;
  const db = getDb();
  
  if (!industries || !Array.isArray(industries) || industries.length === 0) {
    return res.status(400).json({ success: false, error: 'Industries are required' });
  }
  
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ success: false, error: 'Roles are required' });
  }
  
  const taxonomyId = uuidv4();
  const taxonomyName = `Focus: ${industries.join(', ')}`;
  
  // Create taxonomy record
  db.query(
    'INSERT INTO taxonomies (id, name, created_by, industries) VALUES ($1, $2, $3, $4)',
    [taxonomyId, taxonomyName, req.user.userId, JSON.stringify(industries)],
    (err) => {
      if (err) {
        console.error('Error creating focus taxonomy:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      // Insert roles
      const roleInserts = roles.map((role, index) => 
        db.query(
          'INSERT INTO taxonomy_roles (id, taxonomy_id, name, sort_order) VALUES ($1, $2, $3, $4)',
          [uuidv4(), taxonomyId, role, index]
        )
      );
      
      Promise.all(roleInserts)
        .then(() => {
          res.json({
            success: true,
            message: 'Focus configuration created successfully'
          });
        })
        .catch((err) => {
          console.error('Error creating focus roles:', err);
          res.status(500).json({ success: false, error: 'Database error' });
        });
    }
  );
});

app.post('/api/focus/roles', requireAuth, (req, res) => {
  const { role } = req.body;
  const db = getDb();
  
  if (!role || typeof role !== 'string') {
    return res.status(400).json({ success: false, error: 'Role name is required' });
  }
  
  // Get the user's active taxonomy
  db.query('SELECT id FROM taxonomies WHERE created_by = $1 ORDER BY created_at DESC LIMIT 1', [req.user.userId], (err, result) => {
    if (err) {
      console.error('Error fetching active taxonomy:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active focus configuration found' });
    }
    
    const taxonomyId = result.rows[0].id;
    
    // Insert new role
    db.query(
      'INSERT INTO taxonomy_roles (id, taxonomy_id, name, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM taxonomy_roles WHERE taxonomy_id = $2))',
      [uuidv4(), taxonomyId, role],
      (err) => {
        if (err) {
          console.error('Error adding focus role:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        res.json({
          success: true,
          message: 'Role added successfully'
        });
      }
    );
  });
});

app.delete('/api/focus/roles/:roleId', requireAuth, (req, res) => {
  const { roleId } = req.params;
  const db = getDb();
  
  // Check if role is in use by candidates
  db.query('SELECT COUNT(*) as count FROM candidates WHERE tags @> $1', [JSON.stringify([roleId])], (err, result) => {
    if (err) {
      console.error('Error checking role usage:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    const usageCount = parseInt(result.rows[0].count);
    if (usageCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete role: it is currently used by ${usageCount} candidate(s)` 
      });
    }
    
    // Delete the role
    db.query('DELETE FROM taxonomy_roles WHERE id = $1', [roleId], (err) => {
      if (err) {
        console.error('Error deleting focus role:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      res.json({
        success: true,
        message: 'Role deleted successfully'
      });
    });
  });
});

app.get('/api/focus/presets', (req, res) => {
  // Return industry-role presets
  const presets = [
    {
      industry: "Public Affairs",
      roles: ["Policy Advisor", "Government Relations Manager", "Public Affairs Director", "Regulatory Affairs Specialist", "Stakeholder Engagement Manager", "Political Campaign Manager", "Lobbyist", "Public Policy Analyst"]
    },
    {
      industry: "Communications", 
      roles: ["Communications Manager", "PR Director", "Media Relations Specialist", "Content Marketing Manager", "Brand Manager", "Social Media Manager", "Internal Communications Lead", "Crisis Communications Specialist"]
    },
    {
      industry: "Campaigns",
      roles: ["Campaign Manager", "Field Organizer", "Digital Campaign Specialist", "Volunteer Coordinator", "Fundraising Manager", "Political Strategist", "Election Campaign Director", "Grassroots Coordinator"]
    },
    {
      industry: "Policy",
      roles: ["Policy Analyst", "Research Director", "Legislative Assistant", "Policy Research Manager", "Think Tank Researcher", "Policy Advisor", "Regulatory Affairs Manager", "Government Affairs Specialist"]
    },
    {
      industry: "Healthcare",
      roles: ["Healthcare Policy Advisor", "Medical Affairs Manager", "Regulatory Affairs Specialist", "Health Communications Manager", "Patient Advocacy Manager", "Healthcare Lobbyist", "Clinical Research Manager", "Healthcare Consultant"]
    },
    {
      industry: "Technology",
      roles: ["Tech Policy Advisor", "Government Relations Manager", "Regulatory Affairs Specialist", "Public Affairs Manager", "Tech Communications Lead", "Policy Research Manager", "Digital Strategy Manager", "Tech Lobbyist"]
    },
    {
      industry: "Finance",
      roles: ["Financial Policy Advisor", "Regulatory Affairs Manager", "Government Relations Specialist", "Financial Communications Manager", "Compliance Manager", "Financial Lobbyist", "Policy Research Analyst", "Regulatory Compliance Specialist"]
    },
    {
      industry: "Energy",
      roles: ["Energy Policy Advisor", "Regulatory Affairs Manager", "Government Relations Specialist", "Environmental Policy Manager", "Energy Communications Lead", "Sustainability Manager", "Energy Lobbyist", "Climate Policy Analyst"]
    },
    {
      industry: "Education",
      roles: ["Education Policy Advisor", "Government Relations Manager", "Education Communications Lead", "Policy Research Manager", "Academic Affairs Manager", "Education Lobbyist", "Student Affairs Manager", "Curriculum Policy Specialist"]
    },
    {
      industry: "Non-Profit",
      roles: ["Advocacy Manager", "Policy Director", "Government Relations Specialist", "Communications Manager", "Program Manager", "Community Outreach Manager", "Policy Research Analyst", "Advocacy Campaign Manager"]
    }
  ];
  
  res.json({
    success: true,
    presets: presets
  });
});

app.get('/api/events/unread-count', requireAuth, (req, res) => {
  // For now, return 0 unread events since we don't have events implemented yet
  res.json({
    success: true,
    data: {
      unreadCount: 0
    }
  });
});

// Jobs endpoints
app.get('/api/jobs', requireAuth, (req, res) => {
  const { limit = 10 } = req.query;
  const db = getDb();
  
  // For now, return empty jobs array since we don't have jobs implemented yet
  res.json({
    success: true,
    data: []
  });
});

// Licensing/subscription endpoint
app.get('/api/licensing/subscription', requireAuth, (req, res) => {
  // For now, return basic subscription info
  res.json({
    success: true,
    data: {
      plan: 'trial',
      status: 'active',
      seats: 1,
      usage: {
        candidates: 0,
        jobs: 0
      }
    }
  });
});

// Matches endpoint
app.get('/api/matches', requireAuth, (req, res) => {
  const { limit = 100 } = req.query;
  const db = getDb();
  
  // For now, return empty matches array
  res.json({
    success: true,
    data: []
  });
});

// Force logout endpoint (for development/testing)
app.post('/api/force-logout', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email required' });
  }
  
  console.log(`🔄 Force logging out: ${email}`);
  
  const db = getDb();
  
  // Delete all sessions for this user
  db.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email], (err) => {
    if (err) {
      console.error('Error deleting sessions:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    console.log(`✅ Force logout complete for: ${email}`);
    res.json({ 
      success: true, 
      message: 'All sessions cleared. Please refresh and login again.' 
    });
  });
});

// Candidate soft delete endpoints
app.delete('/api/candidates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;
    const userId = req.user.userId;
    
    if (hard === 'true') {
      // Hard delete (admin only)
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for hard delete' });
      }
      
      const db = getDb();
      await db.query('DELETE FROM candidates WHERE id = $1', [id]);
      
      // Log audit
      await db.query(`
        INSERT INTO audit_logs (id, table_name, record_id, action, user_id, created_at)
        VALUES ($1, 'candidates', $2, 'hard_delete', $3, $4)
      `, [nanoid(), id, userId, new Date()]);
      
      res.json({ message: 'Candidate permanently deleted' });
    } else {
      // Soft delete
      const db = getDb();
      const now = new Date();
      
      // Get current data for audit
      const candidate = await db.query('SELECT * FROM candidates WHERE id = $1 AND deleted_at IS NULL', [id]);
      if (candidate.rows.length === 0) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      
      // Soft delete
      await db.query('UPDATE candidates SET deleted_at = $1 WHERE id = $2', [now, id]);
      
      // Log audit
      await db.query(`
        INSERT INTO audit_logs (id, table_name, record_id, action, user_id, old_data, created_at)
        VALUES ($1, 'candidates', $2, 'delete', $3, $4, $5)
      `, [nanoid(), id, userId, JSON.stringify(candidate.rows[0]), now]);
      
      res.json({ message: 'Candidate deleted', deletedAt: now });
    }
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

app.post('/api/candidates/:id/restore', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const db = getDb();
    
    // Check if candidate exists and is deleted
    const candidate = await db.query('SELECT * FROM candidates WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Deleted candidate not found' });
    }
    
    // Restore
    await db.query('UPDATE candidates SET deleted_at = NULL WHERE id = $1', [id]);
    
    // Log audit
    await db.query(`
      INSERT INTO audit_logs (id, table_name, record_id, action, user_id, new_data, created_at)
      VALUES ($1, 'candidates', $2, 'restore', $3, $4, $5)
    `, [nanoid(), id, userId, JSON.stringify(candidate.rows[0]), new Date()]);
    
    res.json({ message: 'Candidate restored' });
  } catch (error) {
    console.error('Error restoring candidate:', error);
    res.status(500).json({ error: 'Failed to restore candidate' });
  }
});

// Version endpoint for traceability
app.get('/meta/version', (req, res) => {
  res.status(200).json({
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    buildTime: process.env.RAILWAY_GIT_COMMIT_CREATED_AT || new Date().toISOString(),
    dotnetUrl: process.env.DOTNET_CV_API_URL || 'not-set',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Version endpoint
app.get('/version', (req, res) => {
    res.json({
    gitSha: process.env.GIT_SHA || 'unknown',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    parserMode: 'real',
    backend: 'src/simple-candidate-server.js',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    dotnetParser: dotNetParser ? 'enabled' : 'disabled'
  });
});

// Add the new parse route
// parseRoute(app); // Temporarily disabled - TypeScript issue

// Local parser function for fallback
async function parseWithLocalParser(buffer, mimetype, originalname) {
  console.log('🔧 Using local parser for:', originalname);
  
  let text = '';
  
  // Extract text based on file type
  if (mimetype === 'application/pdf') {
    const pdfData = await pdfParse(buffer);
    text = pdfData.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimetype === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimetype === 'text/plain') {
    text = buffer.toString('utf8');
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }
  
  // Clean and normalize text for better parsing
  text = text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')    // Convert remaining \r to \n
    .replace(/\n\s*\n/g, '\n\n')  // Normalize multiple newlines
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
  
  console.log('📄 Extracted text length:', text.length);
  console.log('📄 First 500 characters of extracted text:', text.substring(0, 500));
  
  // Look specifically for "Door 10" in the text
  const door10Match = text.match(/door\s*10/gi);
  console.log('🔍 Looking for "Door 10" in text:', door10Match);
  
  // Look for "Recruitment" in the text
  const recruitmentMatch = text.match(/recruitment/gi);
  console.log('🔍 Looking for "Recruitment" in text:', recruitmentMatch);
  
  // Look for the exact phrase "Door 10 Recruitment"
  const door10RecruitmentMatch = text.match(/door\s*10\s*recruitment/gi);
  console.log('🔍 Looking for "Door 10 Recruitment" in text:', door10RecruitmentMatch);
  
  // Show more of the text to find where company names might be
  console.log('📄 Text around line 10-20:', text.split('\n').slice(10, 20).join('\n'));
  
  // Parse the text using improved regex patterns
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  
  // Improved phone number patterns
  const phonePatterns = [
    /(\+44\s?\d{2,4}\s?\d{3,4}\s?\d{3,4})/g,  // UK format: +44 20 1234 5678
    /(\+44\s?\d{10})/g,                        // UK format: +44 2012345678
    /(0\d{2,4}\s?\d{3,4}\s?\d{3,4})/g,        // UK format: 020 1234 5678
    /(\+?[\d\s\-\(\)]{10,15})/g               // General international format
  ];
  
  // Extract basic information with validation
  const email = emailRegex.exec(text)?.[0] || '';
  
  let phone = '';
  let phoneConfidence = 0;
  
  for (const pattern of phonePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const candidatePhone = match[1].replace(/[^\d+]/g, '');
      if (candidatePhone.length >= 10 && candidatePhone.length <= 15) {
        phone = candidatePhone;
        phoneConfidence = 0.8;
        console.log('🔍 Found phone with high confidence:', phone);
        break;
      } else if (candidatePhone.length >= 7 && phoneConfidence < 0.5) {
        phone = candidatePhone;
        phoneConfidence = 0.5;
        console.log('🔍 Found phone with medium confidence:', phone);
      }
    }
  }
  
  // If no phone found, try more aggressive patterns
  if (!phone) {
    const aggressivePhonePatterns = [
      /(\+?[\d\s\-\(\)]{7,15})/g,
      /(\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4})/g
    ];
    
    for (const pattern of aggressivePhonePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const candidatePhone = match[1].replace(/[^\d+]/g, '');
        if (candidatePhone.length >= 7 && candidatePhone.length <= 15) {
          phone = candidatePhone;
          phoneConfidence = 0.3;
          console.log('🔍 Found phone with aggressive pattern:', phone);
          break;
        }
      }
    }
  }
  
  // Improved name extraction - look for common patterns
  let firstName = '';
  let lastName = '';
  let fullName = '';
  
  // Try multiple name patterns - improved for different CV formats including double-barreled names
  const namePatterns = [
    // Look for name at the very beginning of the document (including hyphenated names)
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)/m,
    // Look for name patterns with common prefixes
    /(?:name|full name|contact)[\s:]*([A-Za-z\s-]+?)(?:\n|$|email|phone|@)/i,
    // Look for standalone name patterns (first line that looks like a name)
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)(?:\s|$|\n)/m,
    // Look for name patterns in the first few lines
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)(?:\s|$|\n|email|phone|@)/m
  ];
  
  for (const pattern of namePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      fullName = match[1].trim();
      if (fullName.length > 2 && fullName.length < 50) { // Reasonable name length
        break;
      }
    }
  }
  
  // Split name into first and last with validation
  if (fullName) {
    const nameParts = fullName.split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
    
    // Validate name quality
    if (firstName.length < 2 || lastName.length < 2) {
      console.log('⚠️ Name quality low, trying alternative extraction');
      // Try extracting from email if name is poor quality
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+)@/);
      if (emailMatch) {
        const emailName = emailMatch[1].replace(/[._-]/g, ' ');
        if (/^[A-Za-z\s]+$/.test(emailName) && emailName.length > 2) {
          const emailParts = emailName.split(/\s+/);
          if (emailParts.length >= 2) {
            firstName = emailParts[0];
            lastName = emailParts.slice(1).join(' ');
            console.log('🔍 Using email-based name extraction:', firstName, lastName);
          }
        }
      }
    }
  }
  
  // Improved job title and company extraction - look in experience sections
  let jobTitle = '';
  let company = '';
  
  // First, try to find the experience/employment section
  const experienceSectionPatterns = [
    /(?:employment history|professional experience|work experience|career history|experience|employment|work history)[\s:]*([\s\S]*?)(?:\n\n|\n[A-Z][a-z]+\s+[A-Z]|$)/i,
    /(?:current role|current position|present role|present position)[\s:]*([\s\S]*?)(?:\n\n|\n[A-Z][a-z]+\s+[A-Z]|$)/i
  ];
  
  let experienceSection = '';
  for (const pattern of experienceSectionPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      experienceSection = match[1].trim();
      console.log('🔍 Found experience section:', experienceSection.substring(0, 200));
      break;
    }
  }
  
  // If we found an experience section, extract from it
  if (experienceSection) {
    console.log('🔍 Experience section found, looking for job title and company...');
    
    // Look for job title in the experience section - be more specific
    const jobTitlePatterns = [
      // Look for job titles that start a line (most common format)
      /^([A-Za-z\s&.,-]+(?:director|manager|engineer|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|advisor|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect))/im,
      // Look for "Title at Company" format
      /([A-Za-z\s&.,-]+(?:director|manager|engineer|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|advisor|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect))\s+(?:at|@|of|for)\s+[A-Za-z\s&.,-]+/i,
      // Look for explicit title/position labels
      /(?:title|position|role|job)[\s:]*([A-Za-z\s&.,-]+?)(?:\n|$|company|employer|at)/i
    ];
    
    for (const pattern of jobTitlePatterns) {
      const match = pattern.exec(experienceSection);
      if (match && match[1]) {
        const candidateTitle = match[1].trim();
        // More strict validation for job titles
        if (candidateTitle.length > 2 && candidateTitle.length < 100 && 
            !candidateTitle.includes('across') && !candidateTitle.includes('public') &&
            !candidateTitle.includes('philanthropic') && !candidateTitle.includes('level') &&
            !candidateTitle.includes('experience') && !candidateTitle.includes('heading') &&
            !candidateTitle.includes('governme') && !candidateTitle.includes('professional') &&
            !candidateTitle.includes('preparation') && !candidateTitle.includes('brexit') &&
            !candidateTitle.includes('wide') && !candidateTitle.includes('and') &&
            !candidateTitle.includes('the') && !candidateTitle.includes('with') &&
            !candidateTitle.includes('for') && !candidateTitle.includes('in') &&
            !candidateTitle.includes('of') && !candidateTitle.includes('at') &&
            !candidateTitle.includes('by') && !candidateTitle.includes('from') &&
            !candidateTitle.includes('to') && !candidateTitle.includes('on') &&
            !candidateTitle.includes('is') && !candidateTitle.includes('are') &&
            !candidateTitle.includes('was') && !candidateTitle.includes('were') &&
            !candidateTitle.includes('has') && !candidateTitle.includes('have') &&
            !candidateTitle.includes('had') && !candidateTitle.includes('will') &&
            !candidateTitle.includes('would') && !candidateTitle.includes('could') &&
            !candidateTitle.includes('should') && !candidateTitle.includes('may') &&
            !candidateTitle.includes('might') && !candidateTitle.includes('can') &&
            !candidateTitle.includes('must') && !candidateTitle.includes('shall')) {
          jobTitle = candidateTitle;
          console.log('🔍 Found job title in experience section:', jobTitle);
          break;
        } else {
          console.log('🔍 Rejected job title candidate:', candidateTitle);
        }
      }
    }
    
    // Look for company in the experience section
    const companyPatterns = [
      /(?:at|@|company|employer)[\s:]*([A-Za-z\s&.,-]{2,30}?)(?:\n|$|title|position|role|experience|with|preparation|brexit|professional|level|heading|governme|government|department|ministry|agency|authority)/i,
      /([A-Za-z\s&.,-]+(?:ltd|limited|inc|corp|corporation|llc|plc|group|company|software|solutions|systems|services|consulting|consultancy|recruitment|recruiting))(?:\s|$|\n)/i
    ];
    
    for (const pattern of companyPatterns) {
      const match = pattern.exec(experienceSection);
      if (match && match[1]) {
        const candidateCompany = match[1].trim();
        if (candidateCompany.length > 2 && candidateCompany.length < 40 && 
            !candidateCompany.includes('level') && !candidateCompany.includes('experience') &&
            !candidateCompany.includes('heading') && !candidateCompany.includes('governme') &&
            /[A-Z]/.test(candidateCompany)) {
          company = candidateCompany;
          console.log('🔍 Found company in experience section:', company);
          break;
        }
      }
    }
  }
  
  // Fallback: if no experience section found, try the old patterns
  if (!jobTitle || !company) {
    console.log('🔍 No experience section found, trying fallback patterns...');
    
    // Look for job title patterns
    const jobTitlePatterns = [
      /(?:title|position|role|job)[\s:]*([A-Za-z\s&.,-]+?)(?:\n|$|company|employer)/i,
      /([A-Za-z\s&.,-]+(?:director|manager|engineer|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|consultant))/i
    ];
    
    for (const pattern of jobTitlePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const candidateTitle = match[1].trim();
        if (candidateTitle.length > 2 && candidateTitle.length < 100 &&
            !candidateTitle.includes('across') && !candidateTitle.includes('public') &&
            !candidateTitle.includes('philanthropic')) {
          jobTitle = candidateTitle;
          break;
        }
      }
    }
  }
  
  // Handle unemployed candidates - if no job title found, check for unemployment indicators
  if (!jobTitle) {
    const unemploymentIndicators = [
      /(?:unemployed|job seeking|seeking employment|available for work|open to opportunities|between jobs|career break|sabbatical)/i
    ];
    
    for (const pattern of unemploymentIndicators) {
      if (pattern.test(text)) {
        jobTitle = 'Seeking Employment';
        console.log('🔍 Detected unemployed candidate');
        break;
      }
    }
  }
  
  // Fallback: if no company found in experience section, try old patterns
  if (!company) {
    console.log('🔍 No company found in experience section, trying fallback patterns...');
    
    const companyPatterns = [
      // Look specifically for "Door 10" pattern (standalone company name)
      /(door\s*10)/gi,
      // Look for company names with business suffixes - most reliable
      /([A-Za-z\s&.,-]+(?:ltd|limited|inc|corp|corporation|llc|plc|group|company|software|solutions|systems|services|consulting|consultancy|recruitment|recruiting))(?:\s|$|\n)/i
    ];
    
    for (let i = 0; i < companyPatterns.length; i++) {
      const pattern = companyPatterns[i];
      console.log(`🔍 Trying fallback pattern ${i + 1}:`, pattern);
      const match = pattern.exec(text);
      if (match && match[1]) {
        const candidateCompany = match[1].trim();
        console.log(`🔍 Found candidate company: "${candidateCompany}"`);
        // Only accept company names that look reasonable - strict but allow business words
        if (candidateCompany.length > 3 && 
            candidateCompany.length < 40 && 
            // Allow "Door 10" specifically
            (candidateCompany.toLowerCase().includes('door') || 
             !candidateCompany.includes('level')) &&
            !candidateCompany.includes('experience') &&
            !candidateCompany.includes('heading') &&
            !candidateCompany.includes('governme') &&
            !candidateCompany.includes('professional') &&
            !candidateCompany.includes('preparation') &&
            !candidateCompany.includes('brexit') &&
            !candidateCompany.includes('wide') &&
            !candidateCompany.includes('and') &&
            !candidateCompany.includes('the') &&
            !candidateCompany.includes('with') &&
            !candidateCompany.includes('for') &&
            !candidateCompany.includes('in') &&
            !candidateCompany.includes('of') &&
            !candidateCompany.includes('at') &&
            !candidateCompany.includes('by') &&
            !candidateCompany.includes('from') &&
            !candidateCompany.includes('to') &&
            !candidateCompany.includes('on') &&
            !candidateCompany.includes('is') &&
            !candidateCompany.includes('are') &&
            !candidateCompany.includes('was') &&
            !candidateCompany.includes('were') &&
            !candidateCompany.includes('has') &&
            !candidateCompany.includes('have') &&
            !candidateCompany.includes('had') &&
            !candidateCompany.includes('will') &&
            !candidateCompany.includes('would') &&
            !candidateCompany.includes('could') &&
            !candidateCompany.includes('should') &&
            !candidateCompany.includes('may') &&
            !candidateCompany.includes('might') &&
            !candidateCompany.includes('can') &&
            !candidateCompany.includes('must') &&
            !candidateCompany.includes('shall') &&
            // Must contain at least one capital letter (proper company name) OR be "door10"
            (/[A-Z]/.test(candidateCompany) || candidateCompany.toLowerCase() === 'door10')) {
          console.log(`✅ Accepted company: "${candidateCompany}"`);
          company = candidateCompany;
          break;
        } else {
          console.log(`❌ Rejected company: "${candidateCompany}" (failed validation)`);
        }
      } else {
        console.log(`❌ No match for fallback pattern ${i + 1}`);
      }
    }
  }
  
  // If no company found, leave it empty rather than showing nonsense
  if (!company) {
    console.log('❌ No company name found after trying all patterns');
    company = '';
  } else {
    console.log(`✅ Final company name: "${company}"`);
  }
  
  // Calculate confidence with detailed scoring
  let confidence = 0.1; // Base confidence for local parser
  
  // Name confidence (0-0.3)
  if (firstName && lastName) {
    if (firstName.length >= 2 && lastName.length >= 2) {
      confidence += 0.3;
    } else if (firstName.length >= 2 || lastName.length >= 2) {
      confidence += 0.2;
    }
  }
  
  // Email confidence (0-0.25)
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    confidence += 0.25;
  }
  
  // Phone confidence (0-0.2)
  if (phone) {
    if (phoneConfidence >= 0.8) {
      confidence += 0.2;
    } else if (phoneConfidence >= 0.5) {
      confidence += 0.15;
    } else {
      confidence += 0.1;
    }
  }
  
  // Job title confidence (0-0.15)
  if (jobTitle && jobTitle.length > 2 && !jobTitle.includes('across') && !jobTitle.includes('public')) {
    confidence += 0.15;
  }
  
  // Company confidence (0-0.1)
  if (company && company.length > 2) {
    confidence += 0.1;
  }
  
  confidence = Math.min(confidence, 0.9); // Cap at 0.9 for local parser
  
  console.log(`🔍 Overall confidence: ${confidence.toFixed(2)} (Name: ${firstName ? '✓' : '✗'}, Email: ${email ? '✓' : '✗'}, Phone: ${phone ? '✓' : '✗'}, Title: ${jobTitle ? '✓' : '✗'}, Company: ${company ? '✓' : '✗'})`);
  
  return {
    firstName: firstName,
    lastName: lastName,
    email: email,
    phone: phone,
    currentTitle: jobTitle,
    currentEmployer: company,
    skills: {},
    experience: [],
    notes: `Parsed locally from ${originalname}`,
    confidence,
    source: 'local-fallback',
    parseConfidence: confidence,
    textLength: text.length,
    duration: 0,
    metadata: {
      originalFileName: originalname,
      documentType: mimetype,
      parsedAt: new Date().toISOString(),
      parserUsed: 'local-fallback'
    },
    allResults: [],
    errors: []
  };
}

// CV parsing endpoint
app.post('/api/candidates/parse-cv', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();
    
    console.log(`Processing CV: ${originalname} (${mimetype})`);
    
    let parsedData;
    
    // Try .NET parser first if available
    if (dotNetParser && ['.pdf', '.docx', '.doc'].includes(fileExtension)) {
      try {
        console.log('🔧 Using .NET parser for:', originalname);
        console.log('🔧 File extension:', fileExtension);
        console.log('🔧 MIME type:', mimetype);
        parsedData = await dotNetParser.parseFile(buffer, mimetype, originalname);
        console.log('✅ .NET parser success - parsed data:', JSON.stringify(parsedData, null, 2));
      } catch (error) {
        console.error('❌ .NET parser failed:', error.message);
        console.error('❌ Error details:', error);
        console.log('🔄 Falling back to local parser...');
        
        // Fallback to local parser
        try {
          parsedData = await parseWithLocalParser(buffer, mimetype, originalname);
          console.log('✅ Local parser fallback success');
        } catch (fallbackError) {
          console.error('❌ Local parser fallback also failed:', fallbackError.message);
          return res.status(500).json({ 
            error: 'ParsingFailed',
            message: 'Both .NET and local parsers failed',
            details: `NET: ${error.message}, Local: ${fallbackError.message}`
          });
        }
      }
    } else {
      console.log('ℹ️ Using local parser for unsupported file type:', fileExtension);
      try {
        parsedData = await parseWithLocalParser(buffer, mimetype, originalname);
        console.log('✅ Local parser success');
      } catch (error) {
        console.error('❌ Local parser failed:', error.message);
        return res.status(500).json({ 
          error: 'ParsingFailed',
          message: 'Local parser failed',
          details: error.message
        });
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ CV parsing completed in ${duration}ms`);
    
    // Broadcast parsing complete notification
    const candidateName = parsedData.firstName && parsedData.lastName 
      ? `${parsedData.firstName} ${parsedData.lastName}`.trim()
      : originalname;
    
    broadcastWs({
      type: 'PARSING_COMPLETE',
      data: {
        candidateName: candidateName,
        fileName: originalname,
        duration: duration,
        parser: 'dotnet'
      },
      timestamp: Date.now(),
      id: `parsing_complete_${Date.now()}`
    });
    
    res.json({
      success: true,
      data: parsedData,
      duration,
      parser: 'dotnet'
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ CV parsing failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      duration
    });
  }
});

// Get all candidates
app.get('/api/candidates', async (req, res) => {
  try {

  const mapRow = (row) => {
    const parseJson = (v, fallback) => {
      if (v == null) return fallback;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return fallback; }
    };

    return {
      id: row.id,
      full_name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      email: row.email || '',
      phone: row.phone || '',
      current_title: row.current_title || '',
      current_employer: row.current_employer || '',
      salary_min: row.salary_min || '',
      salary_max: row.salary_max || '',
      skills: (() => {
        const skillsData = parseJson(row.skills, {});
        console.log('Raw skills data:', skillsData);
        console.log('Skills type:', typeof skillsData);
        
        // Handle both numeric and boolean values
        const result = {
          communications: false,
          campaigns: false,
          policy: false,
          publicAffairs: false
        };
        
        if (typeof skillsData === 'object' && skillsData !== null) {
          // If it's already boolean values
          if (typeof skillsData.communications === 'boolean') {
            result.communications = skillsData.communications;
            result.campaigns = skillsData.campaigns || false;
            result.policy = skillsData.policy || false;
            result.publicAffairs = skillsData.publicAffairs || false;
          } else {
            // If it's numeric values, convert 4+ to true
            result.communications = (skillsData.communications || 0) >= 4;
            result.campaigns = (skillsData.campaigns || 0) >= 4;
            result.policy = (skillsData.policy || 0) >= 4;
            result.publicAffairs = (skillsData.publicAffairs || 0) >= 4;
          }
        }
        
        console.log('Processed skills:', result);
        return result;
      })(),
      experience: parseJson(row.experience, []),
      tags: parseJson(row.tags, []),
      email_ok: row.email_ok || true,
      created_at: row.created_at || row.createdAt,
      updated_at: row.updated_at || row.updatedAt,
    };
  };

    // Use PostgreSQL connection directly (temporarily without deleted_at filter)
    const result = await db.query('SELECT * FROM candidates ORDER BY created_at DESC');
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const candidates = rows.map(mapRow);
    
    res.json({
      success: true,
      candidates,
      total: candidates.length,
      page: 1,
      pageSize: candidates.length,
      totalPages: 1
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      message: error.message 
    });
  }
});

// Fix existing candidates with default skills
app.post('/api/fix-skills', (req, res) => {
  const db = getDb();
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // Update all candidates with default skills based on their job titles
    db.query(`
      UPDATE candidates 
      SET skills = CASE 
        WHEN current_title ILIKE '%director%' OR current_title ILIKE '%head%' OR current_title ILIKE '%manager%' THEN
          '{"communications": true, "campaigns": false, "policy": false, "publicAffairs": true}'::jsonb
        WHEN current_title ILIKE '%policy%' OR current_title ILIKE '%government%' THEN
          '{"communications": false, "campaigns": false, "policy": true, "publicAffairs": false}'::jsonb
        WHEN current_title ILIKE '%campaign%' OR current_title ILIKE '%marketing%' THEN
          '{"communications": false, "campaigns": true, "policy": false, "publicAffairs": false}'::jsonb
        WHEN current_title ILIKE '%communication%' OR current_title ILIKE '%media%' THEN
          '{"communications": true, "campaigns": false, "policy": false, "publicAffairs": false}'::jsonb
        ELSE
          '{"communications": true, "campaigns": false, "policy": false, "publicAffairs": true}'::jsonb
      END
      WHERE skills IS NULL OR skills = '{}'::jsonb
    `, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        success: true, 
        message: `Updated ${result.rowCount} candidates with default skills`,
        rowCount: result.rowCount
      });
    });
  } else {
    res.json({ success: true, message: 'SQLite - no fix needed' });
  }
});

// Debug endpoint to check skills data
app.get('/api/debug/skills', (req, res) => {
  const db = getDb();
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    db.query('SELECT id, skills, first_name, last_name FROM candidates LIMIT 2', (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        success: true, 
        candidates: result.rows,
        sample: result.rows[0]?.skills,
        skillsType: typeof result.rows[0]?.skills,
        skillsString: JSON.stringify(result.rows[0]?.skills)
      });
    });
  } else {
    res.json({ success: true, message: 'SQLite - no debug needed' });
  }
});

// Get skill counts for Library
app.get('/api/skills/counts', (req, res) => {
  const db = getDb();
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query
    db.query(`
      SELECT 'Communications' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'communications')::int >= 4
      UNION ALL
      SELECT 'Campaigns' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'campaigns')::int >= 4
      UNION ALL
      SELECT 'Policy' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'policy')::int >= 4
      UNION ALL
      SELECT 'Public Affairs' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'publicAffairs')::int >= 4
    `, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const counts = {};
      result.rows.forEach(row => {
        if (row.skill) {
          counts[row.skill] = parseInt(row.count);
        }
      });
      
      res.json({ success: true, counts });
    });
  } else {
    // SQLite query - simplified for now
    res.json({ 
      success: true, 
      counts: {
        'Communications': 0,
        'Campaigns': 0,
        'Policy': 0,
        'Public Affairs': 0
      }
    });
  }
});

// Get bands for a skill
app.get('/api/skills/:skill/bands', (req, res) => {
  const skill = decodeURIComponent(req.params.skill);
  const db = getDb();
  
  // Map skill names to database field names
  const skillMap = {
    'Communications': 'communications',
    'Campaigns': 'campaigns', 
    'Policy': 'policy',
    'Public Affairs': 'publicAffairs'
  };
  
  const skillField = skillMap[skill];
  if (!skillField) {
    return res.status(400).json({ error: 'Invalid skill' });
  }
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // For now, return a simple band structure
    // In a real app, you'd calculate salary bands from salary_min/salary_max
    res.json({ 
      success: true, 
      bands: [
        { band: '£30k-£50k', count: 0 },
        { band: '£50k-£70k', count: 0 },
        { band: '£70k-£100k', count: 0 },
        { band: '£100k+', count: 0 }
      ]
    });
  } else {
    res.json({ 
      success: true, 
      bands: [
        { band: '£30k-£50k', count: 0 },
        { band: '£50k-£70k', count: 0 },
        { band: '£70k-£100k', count: 0 },
        { band: '£100k+', count: 0 }
      ]
    });
  }
});

// Get candidates by skill and band
app.get('/api/skills/:skill/bands/:band/candidates', (req, res) => {
  const skill = decodeURIComponent(req.params.skill);
  const band = decodeURIComponent(req.params.band);
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const offset = (page - 1) * pageSize;
  
  const db = getDb();
  
  // Map skill names to database field names
  const skillMap = {
    'Communications': 'communications',
    'Campaigns': 'campaigns', 
    'Policy': 'policy',
    'Public Affairs': 'publicAffairs'
  };
  
  const skillField = skillMap[skill];
  if (!skillField) {
    return res.status(400).json({ error: 'Invalid skill' });
  }
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // For now, just return all candidates with the skill
    // In a real app, you'd filter by salary band too
    db.query(`
      SELECT * FROM candidates 
      WHERE deleted_at IS NULL AND (skills->>'${skillField}')::int >= 4
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [pageSize, offset], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const mapRow = (row) => {
        const parseJson = (v, fallback) => {
          if (v == null) return fallback;
          if (typeof v !== 'string') return v;
          try { return JSON.parse(v); } catch { return fallback; }
        };

        return {
          id: row.id,
          full_name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          email: row.email || '',
          phone: row.phone || '',
          current_title: row.current_title || '',
          current_employer: row.current_employer || '',
          salary_min: row.salary_min || '',
          salary_max: row.salary_max || '',
          skills: (() => {
            const skillsData = parseJson(row.skills, {});
            return {
              communications: (skillsData.communications || 0) >= 4,
              campaigns: (skillsData.campaigns || 0) >= 4,
              policy: (skillsData.policy || 0) >= 4,
              publicAffairs: (skillsData.publicAffairs || 0) >= 4
            };
          })(),
          experience: parseJson(row.experience, []),
          tags: parseJson(row.tags, []),
          email_ok: row.email_ok || true,
          created_at: row.created_at || row.createdAt,
          updated_at: row.updated_at || row.updatedAt,
        };
      };
      
      const candidates = result.rows.map(mapRow);
      
      // Broadcast new match notification if there are candidates and it's the first page
      if (candidates.length > 0 && page === 1) {
        broadcastWs({
          type: 'NEW_MATCH',
          data: {
            count: candidates.length,
            skill: skill,
            band: band
          },
          timestamp: Date.now(),
          id: `new_match_${skill}_${band}_${Date.now()}`
        });
      }
      
      res.json({
        success: true,
        candidates,
        total: candidates.length, // Simplified - in real app you'd count total
        page,
        pageSize
      });
    });
  } else {
    res.json({ 
      success: true, 
      candidates: [],
      total: 0,
      page,
      pageSize
    });
  }
});

// Create candidate
app.post('/api/candidates', (req, res) => {
  const { firstName, lastName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skills, experience, notes, emailOk } = req.body;
  
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const skillsJson = JSON.stringify(skills || {});
  const experienceJson = JSON.stringify(experience || []);
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query - let PostgreSQL generate the UUID
    const fullName = `${firstName} ${lastName}`.trim();
    db.query(
      'INSERT INTO candidates (first_name, last_name, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, experience, notes, email_ok) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, created_by',
      [firstName, lastName, fullName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skillsJson, experienceJson, notes, emailOk],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const candidateId = result.rows[0].id;
        const candidateName = fullName;
        
        // Broadcast candidate created notification
        broadcastWs({
          type: 'CANDIDATE_MOVED',
          data: {
            candidateId: candidateId,
            candidateName: candidateName,
            action: 'created',
            newStatus: 'New Candidate'
          },
          timestamp: Date.now(),
          id: `candidate_created_${candidateId}`
        });
        
        res.json({
          success: true,
          id: candidateId,
          message: 'Candidate created successfully'
        });
      }
    );
  } else {
    // SQLite query - generate UUID for SQLite
    const fullName = `${firstName} ${lastName}`.trim();
    const createdBy = randomUUID(); // Generate a proper UUID for created_by
    db.run(
      'INSERT INTO candidates (first_name, last_name, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, experience, notes, email_ok, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, fullName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skillsJson, experienceJson, notes, emailOk, createdBy],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          success: true,
          id: this.lastID,
          message: 'Candidate created successfully'
        });
      }
    );
  }
});

// Test endpoint to broadcast a sample notification
app.post('/api/notifications/test-broadcast', requireAuth, (req, res) => {
  const sample = {
    type: 'SYSTEM_UPDATE',
    data: { message: 'This is a test broadcast from the server' },
    timestamp: Date.now(),
    id: `test_${Date.now()}`
  };
  broadcastWs(sample);
  res.json({ success: true });
});

// Account deletion endpoint
app.delete('/api/account/delete', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const userEmail = req.user.email;
  
  console.log(`🗑️ User ${userEmail} (${userId}) requesting account deletion`);
  
  const db = getDb();
  
  // Delete all user data: candidates, taxonomies, sessions
  const deleteCandidates = () => {
    db.query('DELETE FROM candidates WHERE created_by = $1', [userId], (err) => {
      if (err) {
        console.error('Error deleting candidates:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      console.log('✅ Deleted candidates');
      deleteTaxonomies();
    });
  };
  
  const deleteTaxonomies = () => {
    db.query('DELETE FROM taxonomy_roles WHERE taxonomy_id IN (SELECT id FROM taxonomies WHERE created_by = $1)', [userId], (err) => {
      if (err) {
        console.error('Error deleting taxonomy roles:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      console.log('✅ Deleted taxonomy roles');
      
      db.query('DELETE FROM taxonomies WHERE created_by = $1', [userId], (err) => {
        if (err) {
          console.error('Error deleting taxonomies:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        console.log('✅ Deleted taxonomies');
        deleteSessions();
      });
    });
  };
  
  const deleteSessions = () => {
    db.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId], (err) => {
      if (err) {
        console.error('Error deleting sessions:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      console.log('✅ Deleted sessions');
      
      // Finally delete the user
      db.query('DELETE FROM users WHERE id = $1', [userId], (err) => {
        if (err) {
          console.error('Error deleting user:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        console.log(`✅ Account completely deleted for: ${userEmail}`);
        res.json({ 
          success: true, 
          message: 'Account and all data deleted successfully'
        });
      });
    });
  };
  
  // Start the deletion process
  deleteCandidates();
});

// Serve frontend static assets (must be before wildcard route)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log('📁 Serving frontend static files from:', frontendDistPath);
  // Serve static files with proper MIME types
  app.use('/assets', express.static(path.join(frontendDistPath, 'assets')));
  app.use('/icons', express.static(path.join(frontendDistPath, 'icons')));
  app.use(express.static(frontendDistPath));
}

// Serve frontend (only if built assets exist). In Railway, frontend is a separate service.
// This must be LAST to avoid catching API routes
const frontendIndexPath = path.join(__dirname, '../frontend/dist/index.html');
let loggedMissingFrontend = false;

// Only catch non-API, non-asset routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Skip asset routes
  if (req.path.startsWith('/assets/') || req.path.startsWith('/icons/') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.png') || req.path.endsWith('.svg')) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  try {
    if (fs.existsSync(frontendIndexPath)) {
      return res.sendFile(frontendIndexPath);
    }
  } catch {}
  if (!loggedMissingFrontend) {
    loggedMissingFrontend = true;
    console.warn('Frontend dist not found. Skipping static serve for wildcard routes.');
  }
  return res.status(404).json({ ok: true, message: 'Frontend not served from backend. Use the frontend service.' });
});

// Start server after database initialization
async function startServer() {
  try {
    await initializeDatabase();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Database: ${process.env.DATABASE_URL ? 'PostgreSQL (Railway)' : 'SQLite (local)'}`);
      console.log(`🔧 .NET Parser: ${dotNetParser ? 'enabled' : 'disabled'}`);
      console.log(`🌐 Frontend: http://localhost:${PORT}`);
      console.log(`🔍 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
