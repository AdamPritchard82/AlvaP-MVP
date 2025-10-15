const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

// Simple script to create an admin user
// Run with: node scripts/create-admin-user.js

const createAdminUser = async () => {
  const email = process.argv[2] || 'admin@door10.com';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin User';

  console.log('Creating admin user...');
  console.log(`Email: ${email}`);
  console.log(`Name: ${name}`);
  console.log(`Password: ${password}`);

  // Hash the password
  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = nanoid();
  const now = new Date().toISOString();

  // SQL to create the user
  const sql = `
    INSERT INTO users (id, email, name, role, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  console.log('\nSQL to run:');
  console.log(sql);
  console.log('\nParameters:');
  console.log(`[${userId}, ${email}, ${name}, admin, ${passwordHash}, ${now}]`);

  console.log('\nTo run this in your database:');
  console.log(`1. Connect to your database`);
  console.log(`2. Run the SQL above with the parameters`);
  console.log(`3. Or use the API endpoint: POST /api/auth/register`);
  console.log(`   Body: { "email": "${email}", "password": "${password}", "name": "${name}", "role": "admin" }`);
};

createAdminUser().catch(console.error);
