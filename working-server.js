// Working server with login endpoint using CommonJS
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Working Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Working Server is running!',
    timestamp: new Date().toISOString(),
    status: 'success',
    endpoints: {
      health: '/health',
      login: '/api/auth/login (POST)'
    }
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {};
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  // For demo purposes, accept any email
  const token = jwt.sign(
    { userId: '1', email, name: 'Consultant', role: 'consultant' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return res.json({ token });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Working server running on port ${PORT}`);
});
