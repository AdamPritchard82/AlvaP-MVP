// Minimal server to test basic functionality
console.log('=== MINIMAL SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Test basic imports one by one
try {
  console.log('Testing dotenv...');
  await import('dotenv/config');
  console.log('✅ dotenv loaded');
} catch (error) {
  console.error('❌ dotenv failed:', error.message);
  process.exit(1);
}

try {
  console.log('Testing express...');
  const express = (await import('express')).default;
  console.log('✅ express loaded');
  
  const app = express();
  const PORT = process.env.PORT || 3001;
  
  app.get('/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });
  
  console.log('Starting server on port:', PORT);
  app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Minimal server started successfully');
  });
  
} catch (error) {
  console.error('❌ express failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
