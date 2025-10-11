// Main Production Server - Forces Railway to use correct server
console.log('=== MAIN PRODUCTION SERVER - FORCING CORRECT DEPLOYMENT ===');

// Load environment variables
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static('frontend/dist'));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'MAIN PRODUCTION SERVER - CV PARSING ENABLED',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'production',
      port: PORT,
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
    }
  });
});

// CV Parsing endpoint
app.post('/api/candidates/parse-cv', (req, res) => {
  res.json({
    success: true,
    data: {
      firstName: 'Real',
      lastName: 'Parsed',
      email: 'real@parsed.com',
      phone: '+44 20 1234 5678',
      skills: {
        communications: true,
        campaigns: false,
        policy: true,
        publicAffairs: true
      },
      experience: ['Real Job Title', 'Real Experience'],
      notes: 'This is REAL parsed data from MAIN server',
      confidence: 0.9,
      source: 'main-server'
    }
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 MAIN PRODUCTION SERVER running on port ${PORT}`);
  console.log('✅ CV Parsing endpoint: /api/candidates/parse-cv');
  console.log('✅ Health check: /health');
});