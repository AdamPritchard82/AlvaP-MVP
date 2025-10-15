/**
 * Candidate Soft Delete Migration
 * 
 * Adds soft delete functionality to candidates table
 */

exports.up = function(knex) {
  return knex.schema
    // Add deleted_at column to candidates table
    .alterTable('candidates', function(table) {
      table.timestamp('deleted_at').nullable();
    })
    .then(() => {
      // Create partial index for non-deleted candidates
      return knex.raw('CREATE INDEX idx_candidates_active ON candidates(id) WHERE deleted_at IS NULL');
    })
    .then(() => {
      // Create audit log table for delete/restore actions
      return knex.schema.createTable('audit_logs', function(table) {
        table.string('id').primary();
        table.string('table_name').notNullable();
        table.string('record_id').notNullable();
        table.string('action').notNullable(); // 'delete', 'restore', 'create', 'update'
        table.string('user_id').nullable();
        table.json('old_data').nullable();
        table.json('new_data').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        
        table.index(['table_name', 'record_id']);
        table.index(['user_id', 'created_at']);
      });
    });
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTable('audit_logs'),
    knex.raw('DROP INDEX IF EXISTS idx_candidates_active'),
    knex.schema.alterTable('candidates', function(table) {
      table.dropColumn('deleted_at');
    })
  ]);
};
