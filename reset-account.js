const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/alvap',
});

async function resetAccount() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting account reset...');
    
    // Get all users to find the one to reset
    const usersResult = await client.query('SELECT id, email, name FROM users ORDER BY created_at DESC');
    console.log('\n📋 Found users:');
    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) - ID: ${user.id}`);
    });
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    // For now, let's reset the most recent user (you can modify this)
    const userToReset = usersResult.rows[0];
    console.log(`\n🎯 Resetting account for: ${userToReset.email} (${userToReset.name})`);
    
    // Start transaction
    await client.query('BEGIN');
    
    // Delete in order to respect foreign key constraints
    console.log('🗑️  Deleting user sessions...');
    await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [userToReset.id]);
    
    console.log('🗑️  Deleting audit logs...');
    await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userToReset.id]);
    
    console.log('🗑️  Deleting candidates...');
    await client.query('DELETE FROM candidates WHERE created_by = $1', [userToReset.id]);
    
    console.log('🗑️  Deleting taxonomy data...');
    await client.query('DELETE FROM taxonomy_skills WHERE taxonomy_id IN (SELECT id FROM taxonomies WHERE created_by = $1)', [userToReset.id]);
    await client.query('DELETE FROM taxonomy_roles WHERE taxonomy_id IN (SELECT id FROM taxonomies WHERE created_by = $1)', [userToReset.id]);
    await client.query('DELETE FROM taxonomies WHERE created_by = $1', [userToReset.id]);
    
    console.log('🗑️  Deleting billing data...');
    await client.query('DELETE FROM billing_invoices WHERE org_id IN (SELECT id FROM billing_orgs WHERE created_by = $1)', [userToReset.id]);
    await client.query('DELETE FROM billing_orgs WHERE created_by = $1', [userToReset.id]);
    
    console.log('🗑️  Deleting user...');
    await client.query('DELETE FROM users WHERE id = $1', [userToReset.id]);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Account reset complete!');
    console.log('🎉 You can now create a fresh account with the same email');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error resetting account:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the reset
resetAccount()
  .then(() => {
    console.log('\n🚀 Ready for fresh start!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Reset failed:', error);
    process.exit(1);
  });
