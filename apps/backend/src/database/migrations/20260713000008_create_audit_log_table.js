/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.schema.createTable('sys_audit_log', (table) => {
    table.string('id', 36).primary();
    table.string('tenant_id', 36).notNullable();
    table.string('doctype', 100).nullable();
    table.string('doc_id', 36).nullable();
    table.string('doc_name', 255).nullable();
    table.string('action', 30).notNullable();
    table.string('user_id', 36).nullable();
    table.string('user_name', 200).nullable();
    table.string('ip_address', 45).nullable();
    table.text('user_agent').nullable();
    table.json('diff').nullable();
    table.text('change_summary').nullable();
    table.json('metadata').nullable();
    table.datetime('created_at').notNullable();

    // Indexes
    table.index(['tenant_id', 'doctype', 'doc_id', 'created_at'], 'idx_audit_doc');
    table.index(['tenant_id', 'user_id', 'created_at'], 'idx_audit_user');
    table.index(['tenant_id', 'action', 'created_at'], 'idx_audit_action');
    table.index(['tenant_id', 'created_at'], 'idx_audit_tenant');
    // MySQL FULLTEXT index can be added manually if needed for change_summary
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.schema.dropTableIfExists('sys_audit_log');
};
