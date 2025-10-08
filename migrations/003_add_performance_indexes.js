/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add unique constraint on email if it doesn't exist
  try {
    await knex.schema.alterTable('candidates', function(table) {
      table.unique('email');
    });
  } catch (error) {
    console.log('Email unique constraint may already exist:', error.message);
  }

  // Add performance indexes
  if (knex.client.config.client === 'postgresql') {
    // Enable pg_trgm extension for fuzzy text search
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    
    // Add GIN indexes for full-text search
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_full_name_trgm 
      ON candidates USING gin (full_name gin_trgm_ops)
    `);
    
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_current_title_trgm 
      ON candidates USING gin (current_title gin_trgm_ops)
    `);
    
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_current_employer_trgm 
      ON candidates USING gin (current_employer gin_trgm_ops)
    `);
    
    // Add GIN indexes for JSON fields (skills and tags)
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_skills_gin 
      ON candidates USING gin (skills)
    `);
    
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_tags_gin 
      ON candidates USING gin (tags)
    `);
    
    // Add composite indexes for common query patterns
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_search_composite 
      ON candidates (full_name, email, current_title, current_employer, created_at)
    `);
    
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_salary_range 
      ON candidates (salary_min, salary_max) WHERE salary_min IS NOT NULL OR salary_max IS NOT NULL
    `);
    
    // Add partial indexes for common filters
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_needs_review 
      ON candidates (created_at) WHERE needs_review = true
    `);
    
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_email_ok 
      ON candidates (created_at) WHERE email_ok = true
    `);
    
  } else if (knex.client.config.client === 'sqlite3') {
    // SQLite indexes (simpler but still effective)
    await knex.schema.alterTable('candidates', function(table) {
      table.index('full_name');
      table.index('current_title');
      table.index('current_employer');
      table.index('salary_min');
      table.index('salary_max');
      table.index('needs_review');
      table.index('email_ok');
      table.index('created_at');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  if (knex.client.config.client === 'postgresql') {
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_full_name_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_current_title_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_current_employer_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_skills_gin');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_tags_gin');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_search_composite');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_salary_range');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_needs_review');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_email_ok');
  }
  
  // Note: SQLite doesn't support dropping indexes easily
  console.log('Note: SQLite indexes will remain (they will be ignored if table is recreated)');
};
