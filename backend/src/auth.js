import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireRole(role) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function seedAdminUser() {
  const db = getDb();
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || 'Admin';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || 'placeholder-dev-only';
  if (!email) return;
  
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, existing) => {
    if (err) {
      console.error('Error checking for existing admin user:', err);
      return;
    }
    if (existing) return;
    
    const now = new Date().toISOString();
    const id = nanoid();
    db.run(
      'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, name, 'admin', passwordHash, now],
      (err) => {
        if (err) {
          console.error('Error creating admin user:', err);
        } else {
          console.log('Admin user created successfully');
        }
      }
    );
  });
}





