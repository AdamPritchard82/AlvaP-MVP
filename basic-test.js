// Basic test - no imports from our codebase
console.log('=== BASIC TEST STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Test only external dependencies
try {
  console.log('Testing dotenv...');
  await import('dotenv/config');
  console.log('✅ dotenv works');
  
  console.log('Testing express...');
  const express = (await import('express')).default;
  console.log('✅ express works');
  
  console.log('Testing cors...');
  const cors = (await import('cors')).default;
  console.log('✅ cors works');
  
  console.log('Testing helmet...');
  const helmet = (await import('helmet')).default;
  console.log('✅ helmet works');
  
  console.log('Testing cookie-parser...');
  const cookieParser = (await import('cookie-parser')).default;
  console.log('✅ cookie-parser works');
  
  console.log('Testing sqlite3...');
  const sqlite3 = (await import('sqlite3')).default;
  console.log('✅ sqlite3 works');
  
  console.log('Testing jsonwebtoken...');
  const jwt = (await import('jsonwebtoken')).default;
  console.log('✅ jsonwebtoken works');
  
  console.log('=== ALL EXTERNAL DEPENDENCIES WORK ===');
  
} catch (error) {
  console.error('❌ External dependency failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
