/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Enable pg_trgm extension for PostgreSQL (if using PostgreSQL)
  if (knex.client.config.client === 'postgresql') {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    
    // Add GIN indexes for full-text search on name, skills, and tags
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_candidates_full_name_gin 
      ON candidates USING gin (full_name gin_trgm_ops)
    `);
    
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_candidates_skills_gin 
      ON candidates USING gin (skills gin_trgm_ops)
    `);
    
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_candidates_tags_gin 
      ON candidates USING gin (tags gin_trgm_ops)
    `);
    
    // Add composite index for common search patterns
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_candidates_search_composite 
      ON candidates (full_name, email, current_title, current_employer)
    `);
  }
  
  // For SQLite, add basic indexes
  if (knex.client.config.client === 'sqlite3') {
    await knex.schema.alterTable('candidates', function(table) {
      table.index('full_name');
      table.index('current_title');
      table.index('current_employer');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  if (knex.client.config.client === 'postgresql') {
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_full_name_gin');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_skills_gin');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_tags_gin');
    await knex.raw('DROP INDEX IF EXISTS idx_candidates_search_composite');
  }
  
  if (knex.client.config.client === 'sqlite3') {
    // SQLite doesn't support dropping indexes easily, so we'll leave them
    console.log('Note: SQLite indexes will remain (they will be ignored if table is recreated)');
  }
};
