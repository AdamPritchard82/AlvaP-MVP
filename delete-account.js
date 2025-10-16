const { Pool } = require('pg');

// Use Railway's DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/alvap'
});

async function deleteAccount(email) {
  try {
    console.log(`🔍 Looking for account: ${email}`);
    
    // Find user by email
    const userResult = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Account not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found account: ${user.name} (${user.email}) - ID: ${user.id}`);
    
    // Delete in order to respect foreign key constraints
    console.log('🗑️ Deleting related data...');
    
    // Delete auth sessions
    const sessionsResult = await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [user.id]);
    console.log(`   Deleted ${sessionsResult.rowCount} auth sessions`);
    
    // Delete audit logs
    const auditResult = await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [user.id]);
    console.log(`   Deleted ${auditResult.rowCount} audit logs`);
    
    // Delete candidates
    const candidatesResult = await pool.query('DELETE FROM candidates WHERE created_by = $1', [user.id]);
    console.log(`   Deleted ${candidatesResult.rowCount} candidates`);
    
    // Delete taxonomy data
    const taxonomySkillsResult = await pool.query('DELETE FROM taxonomy_skills WHERE taxonomy_id IN (SELECT id FROM taxonomies WHERE created_by = $1)', [user.id]);
    console.log(`   Deleted ${taxonomySkillsResult.rowCount} taxonomy skills`);
    
    const taxonomyRolesResult = await pool.query('DELETE FROM taxonomy_roles WHERE taxonomy_id IN (SELECT id FROM taxonomies WHERE created_by = $1)', [user.id]);
    console.log(`   Deleted ${taxonomyRolesResult.rowCount} taxonomy roles`);
    
    const taxonomiesResult = await pool.query('DELETE FROM taxonomies WHERE created_by = $1', [user.id]);
    console.log(`   Deleted ${taxonomiesResult.rowCount} taxonomies`);
    
    // Delete billing data
    const invoicesResult = await pool.query('DELETE FROM billing_invoices WHERE org_id IN (SELECT id FROM billing_orgs WHERE created_by = $1)', [user.id]);
    console.log(`   Deleted ${invoicesResult.rowCount} billing invoices`);
    
    const orgsResult = await pool.query('DELETE FROM billing_orgs WHERE created_by = $1', [user.id]);
    console.log(`   Deleted ${orgsResult.rowCount} billing orgs`);
    
    // Finally delete the user
    const userDeleteResult = await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log(`   Deleted user account`);
    
    console.log('🎉 Account deletion complete! You can now create a new account.');
    
  } catch (error) {
    console.error('❌ Error deleting account:', error.message);
  } finally {
    await pool.end();
  }
}

// Delete the account
deleteAccount('info@door10.co.uk');
