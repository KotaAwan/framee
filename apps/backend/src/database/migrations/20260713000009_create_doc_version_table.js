/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.schema.createTable('sys_doc_version', (table) => {
    table.string('id', 36).primary();
    table.string('tenant_id', 36).notNullable();
    table.string('doctype', 100).notNullable();
    table.string('doc_id', 36).notNullable();
    table.integer('version_number').notNullable();
    table.specificType('snapshot', 'longtext').notNullable();
    table.text('change_summary').nullable();
    table.string('saved_by', 36).nullable();
    table.string('saved_by_name', 200).nullable();
    table.datetime('saved_at').notNullable();
    table.boolean('is_current').defaultTo(false);
    table.boolean('is_protected').defaultTo(false);
    table.string('trigger_event', 50).nullable();

    // Indexes
    table.index(['tenant_id', 'doctype', 'doc_id', 'version_number'], 'idx_version_doc');
    table.index(['tenant_id', 'doctype', 'doc_id', 'is_current'], 'idx_version_current');
    table.index(['tenant_id', 'saved_by', 'saved_at'], 'idx_version_user');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.schema.dropTableIfExists('sys_doc_version');
};
