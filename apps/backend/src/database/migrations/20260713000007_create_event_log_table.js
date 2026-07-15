/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.schema.createTable('sys_event_log', (table) => {
    table.string('id', 36).primary();
    table.string('tenant_id', 36).notNullable();
    table.string('event_name', 200).notNullable();
    table.string('publisher', 100).nullable();
    table.json('payload_summary').nullable();
    table.integer('subscriber_count').defaultTo(0);
    table.string('user_id', 36).nullable();
    table.string('doc_id', 36).nullable();
    table.string('doctype', 100).nullable();
    table.integer('duration_ms').defaultTo(0);
    table.boolean('had_errors').defaultTo(false);
    table.datetime('created_at').notNullable();

    // Indexes
    table.index(['tenant_id', 'event_name'], 'idx_event_tenant_name');
    table.index(['tenant_id', 'doctype', 'doc_id'], 'idx_event_tenant_doc');
    table.index(['tenant_id', 'created_at'], 'idx_event_created');
    table.index(['had_errors', 'created_at'], 'idx_event_errors');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.schema.dropTableIfExists('sys_event_log');
};
