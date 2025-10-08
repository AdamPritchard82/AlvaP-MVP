/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('candidates', function(table) {
    table.string('band_label');
    table.index('band_label');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('candidates', function(table) {
    table.dropIndex('band_label');
    table.dropColumn('band_label');
  });
};
