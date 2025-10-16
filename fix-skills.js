const { Pool } = require('pg');

// Connect to Railway PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixSkills() {
  try {
    console.log('🔧 Fixing skills for existing candidates...');
    
    // Update all candidates with default skills based on their job titles
    const result = await pool.query(`
      UPDATE candidates 
      SET skills = CASE 
        WHEN current_title ILIKE '%director%' OR current_title ILIKE '%head%' OR current_title ILIKE '%manager%' THEN
          '{"communications": true, "campaigns": false, "policy": false, "publicAffairs": true}'::jsonb
        WHEN current_title ILIKE '%policy%' OR current_title ILIKE '%government%' THEN
          '{"communications": false, "campaigns": false, "policy": true, "publicAffairs": false}'::jsonb
        WHEN current_title ILIKE '%campaign%' OR current_title ILIKE '%marketing%' THEN
          '{"communications": false, "campaigns": true, "policy": false, "publicAffairs": false}'::jsonb
        WHEN current_title ILIKE '%communication%' OR current_title ILIKE '%media%' THEN
          '{"communications": true, "campaigns": false, "policy": false, "publicAffairs": false}'::jsonb
        ELSE
          '{"communications": true, "campaigns": false, "policy": false, "publicAffairs": true}'::jsonb
      END
      WHERE skills IS NULL OR skills = '{}'::jsonb OR skills = 'null'::jsonb
    `);
    
    console.log(`✅ Updated ${result.rowCount} candidates with default skills`);
    
    // Check the results
    const checkResult = await pool.query('SELECT id, first_name, last_name, current_title, skills FROM candidates');
    console.log('📋 Updated candidates:');
    checkResult.rows.forEach(row => {
      console.log(`- ${row.first_name} ${row.last_name} (${row.current_title}): ${JSON.stringify(row.skills)}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixSkills();



