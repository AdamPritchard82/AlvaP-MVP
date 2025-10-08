/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('candidates', function(table) {
    table.string('id').primary();
    table.string('full_name').notNullable();
    table.string('email').unique();
    table.string('phone');
    table.string('current_title');
    table.string('current_employer');
    table.integer('salary_min');
    table.integer('salary_max');
    table.string('seniority');
    table.json('tags').defaultTo('[]');
    table.text('notes');
    table.json('skills').defaultTo('{"communications":false,"campaigns":false,"policy":false,"publicAffairs":false}');
    table.string('cv_original_path');
    table.text('cv_light');
    table.text('parsed_raw');
    table.string('parse_status').defaultTo('unparsed');
    table.boolean('needs_review').defaultTo(false);
    table.boolean('email_ok').defaultTo(true);
    table.string('unsubscribe_token').unique();
    table.timestamp('welcome_sent_at');
    table.string('created_by').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Add indexes for performance
    table.index('email');
    table.index('created_at');
    table.index('parse_status');
    table.index('needs_review');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('candidates');
};
