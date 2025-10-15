/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('taxonomies', function(table) {
      table.string('id').primary();
      table.string('org_id').notNullable();
      table.string('name').notNullable();
      table.boolean('is_active').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Ensure only one active taxonomy per org
      table.unique(['org_id', 'is_active'], { 
        predicate: knex.where('is_active', true) 
      });
    })
    .createTable('taxonomy_roles', function(table) {
      table.string('id').primary();
      table.string('taxonomy_id').notNullable();
      table.string('name').notNullable();
      table.integer('sort_order').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.foreign('taxonomy_id').references('id').inTable('taxonomies').onDelete('CASCADE');
      table.index(['taxonomy_id', 'sort_order']);
    })
    .createTable('taxonomy_skills', function(table) {
      table.string('id').primary();
      table.string('role_id').notNullable();
      table.string('name').notNullable();
      table.integer('weight').defaultTo(1);
      table.integer('scale_max').defaultTo(5);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.foreign('role_id').references('id').inTable('taxonomy_roles').onDelete('CASCADE');
      table.index(['role_id', 'weight']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('taxonomy_skills')
    .dropTable('taxonomy_roles')
    .dropTable('taxonomies');
};
