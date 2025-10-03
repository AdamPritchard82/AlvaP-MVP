// Minimal test server
console.log('=== MINIMAL SERVER STARTING ===');

const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Minimal server is working!'
  });
});

// Test candidates endpoint
app.get('/api/candidates', (req, res) => {
  res.json({ 
    success: true,
    message: 'Candidates endpoint is working!',
    data: []
  });
});

// Test POST candidates endpoint
app.post('/api/candidates', (req, res) => {
  console.log('POST /api/candidates called with:', req.body);
  res.json({ 
    success: true,
    message: 'Candidate creation endpoint is working!',
    id: 'test-123'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Minimal AlvaP Server is running!',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('=====================================');
  console.log(`✅ Minimal Server running on port ${PORT}`);
  console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Candidates: http://0.0.0.0:${PORT}/api/candidates`);
  console.log('=====================================');
});
