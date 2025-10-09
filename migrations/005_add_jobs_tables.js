/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('jobs', function(table) {
      table.string('id').primary();
      table.string('title').notNullable();
      table.text('description');
      table.json('required_skills').defaultTo('{}');
      table.integer('salary_min');
      table.integer('salary_max');
      table.string('location');
      table.string('company');
      table.boolean('is_public').defaultTo(false);
      table.string('public_slug').unique();
      table.text('public_summary');
      table.string('client_public_name');
      table.string('employment_type').defaultTo('Full-time');
      table.string('status').defaultTo('New');
      table.string('created_by').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Add indexes for performance
      table.index('status');
      table.index('is_public');
      table.index('created_at');
      table.index('company');
    })
    .createTable('job_matches', function(table) {
      table.string('id').primary();
      table.string('job_id').notNullable();
      table.string('candidate_id').notNullable();
      table.string('stage').defaultTo('New');
      table.integer('match_score').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Foreign key constraints
      table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      
      // Add indexes for performance
      table.index('job_id');
      table.index('candidate_id');
      table.index('stage');
      table.unique(['job_id', 'candidate_id']); // Prevent duplicate matches
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('job_matches')
    .dropTable('jobs');
};
