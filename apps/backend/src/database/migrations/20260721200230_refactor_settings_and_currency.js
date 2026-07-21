export function up(knex) {
  return knex.schema
    // 1. Rename sys_settings to sys_company
    .renameTable('sys_settings', 'sys_company')
    .renameTable('sys_settings_logs', 'sys_company_logs')
    .renameTable('sys_settings_version', 'sys_company_version')
    
    // 2. Create sys_currency and its versions/logs
    .createTable('sys_currency', table => {
      table.string('id', 36).primary();
      table.string('code', 50).unique().notNullable();
      table.string('name', 100).notNullable();
      table.string('symbol', 10).nullable();
      table.boolean('is_deleted').defaultTo(false);
      table.string('status', 50).defaultTo('Saved');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('sys_currency_logs', table => {
      table.string('id', 36).primary();
      table.string('doc_id', 36).notNullable();
      table.string('action', 50).notNullable();
      table.string('user_id', 36).nullable();
      table.text('changes').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['doc_id']);
    })
    .createTable('sys_currency_version', table => {
      table.string('id', 36).primary();
      table.string('doc_id', 36).notNullable();
      table.integer('version_number').notNullable();
      table.json('doc_data').notNullable();
      table.string('created_by', 36).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['doc_id']);
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('sys_currency_version')
    .dropTableIfExists('sys_currency_logs')
    .dropTableIfExists('sys_currency')
    .renameTable('sys_company_version', 'sys_settings_version')
    .renameTable('sys_company_logs', 'sys_settings_logs')
    .renameTable('sys_company', 'sys_settings');
}
