// Simple Candidate Server - Bulletproof Version
console.log('=== SIMPLE CANDIDATE SERVER STARTING ===');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://alvap-mvp-production.up.railway.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Simple in-memory storage (will persist during server uptime)
let candidates = [];
let nextId = 1;

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Simple Candidate Server is running!',
    candidatesCount: candidates.length,
    timestamp: new Date().toISOString()
  });
});

// Create candidate - SIMPLE VERSION
app.post('/api/candidates', (req, res) => {
  console.log('=== CREATE CANDIDATE ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { firstName, lastName, email, phone, currentTitle, currentEmployer } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'First name, last name, and email are required'
      });
    }
    
    // Create candidate
    const candidate = {
      id: nextId++,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      currentTitle: currentTitle || '',
      currentEmployer: currentEmployer || '',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    };
    
    // Add to array
    candidates.push(candidate);
    
    console.log('✅ Candidate created:', candidate);
    console.log('Total candidates:', candidates.length);
    
    res.status(201).json({
      success: true,
      data: candidate,
      message: 'Candidate created successfully'
    });
    
  } catch (error) {
    console.error('❌ Create candidate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create candidate',
      message: error.message
    });
  }
});

// Get candidates - SIMPLE VERSION
app.get('/api/candidates', (req, res) => {
  console.log('=== GET CANDIDATES ===');
  console.log('Total candidates in memory:', candidates.length);
  
  try {
    // Return all candidates (newest first)
    const sortedCandidates = [...candidates].reverse();
    
    console.log('✅ Returning candidates:', sortedCandidates.length);
    
    res.json({
      success: true,
      candidates: sortedCandidates,
      total: sortedCandidates.length
    });
    
  } catch (error) {
    console.error('❌ Get candidates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get candidates',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Candidate Server is running!',
    status: 'success',
    candidatesCount: candidates.length,
    endpoints: {
      health: '/health',
      create: 'POST /api/candidates',
      list: 'GET /api/candidates'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== SIMPLE CANDIDATE SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Create: POST http://0.0.0.0:${PORT}/api/candidates`);
  console.log(`✅ List: GET http://0.0.0.0:${PORT}/api/candidates`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
