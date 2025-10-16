/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('taxonomies', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.uuid('created_by').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('taxonomy_skills', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('taxonomy_id').notNullable();
      table.string('name').notNullable();
      table.integer('weight').defaultTo(1);
      table.integer('scale_max').defaultTo(5);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.foreign('taxonomy_id').references('id').inTable('taxonomies').onDelete('CASCADE');
    })
    .createTable('taxonomy_roles', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('taxonomy_id').notNullable();
      table.string('name').notNullable();
      table.integer('sort_order').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.foreign('taxonomy_id').references('id').inTable('taxonomies').onDelete('CASCADE');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('taxonomy_roles')
    .dropTable('taxonomy_skills')
    .dropTable('taxonomies');
};
