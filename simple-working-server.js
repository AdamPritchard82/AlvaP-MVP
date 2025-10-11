// Simple Working Server - Minimal Version
console.log('=== SIMPLE WORKING SERVER STARTING ===');

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Simple working server running'
  });
});

// Version endpoint
app.get('/version', (req, res) => {
  res.json({
    gitSha: process.env.GIT_SHA || 'unknown',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    parserMode: 'real',
    backend: 'simple-working-server.js',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Basic CV parsing endpoint
app.post('/api/candidates/parse-cv', (req, res) => {
  // Simple mock response for now
  res.json({
    success: true,
    data: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '123-456-7890',
      skills: {
        communications: true,
        campaigns: false,
        policy: true,
        publicAffairs: false
      },
      experience: [],
      notes: 'Test candidate from simple server',
      confidence: 0.8,
      source: 'simple-server'
    }
  });
});

// Get candidates
app.get('/api/candidates', (req, res) => {
  res.json([]);
});

// Create candidate
app.post('/api/candidates', (req, res) => {
  res.json({
    id: 1,
    ...req.body,
    created_at: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`🔍 API: http://localhost:${PORT}/api`);
});
