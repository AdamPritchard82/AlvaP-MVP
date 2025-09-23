// Ultra-simple test - no route imports, just basic functionality
console.log('=== ULTRA SIMPLE TEST STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Test basic imports
try {
  console.log('Testing basic imports...');
  await import('dotenv/config');
  const express = (await import('express')).default;
  console.log('✅ Basic imports work');
  
  // Test database import
  console.log('Testing database import...');
  const { initDatabase } = await import('./src/db.js');
  console.log('✅ Database import works');
  
  // Test auth import
  console.log('Testing auth import...');
  const { requireAuth } = await import('./src/auth.js');
  console.log('✅ Auth import works');
  
  // Test a simple route import
  console.log('Testing simple route import...');
  const dashboard = await import('./src/routes/dashboard.js');
  console.log('✅ Dashboard route import works');
  
  console.log('=== ALL TESTS PASSED ===');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
