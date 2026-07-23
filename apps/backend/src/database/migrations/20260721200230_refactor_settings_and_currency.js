export async function up(knex) {
  async function createTrackingTables(tableName, knex, tableBuilderCallback) {
    await knex.schema.createTable(tableName, tableBuilderCallback);
    
    await knex.schema.createTable(`${tableName}_logs`, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('doc_id').unsigned().notNullable(); // Link to main table id
      table.string('status', 100).nullable();
      table.text('content').nullable();
      table.integer('created_by').unsigned().nullable(); // user_id
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.raw(`CREATE TABLE ?? SELECT * FROM ?? WHERE 1=0`, [`${tableName}_version`, tableName]);
    await knex.raw(`ALTER TABLE ?? MODIFY id INT UNSIGNED NOT NULL`, [`${tableName}_version`]);
    await knex.schema.alterTable(`${tableName}_version`, (table) => {
      table.renameColumn('id', 'doc_id');
    });
    
    await knex.schema.alterTable(`${tableName}_version`, (table) => {
      table.increments('id').unsigned().primary().first();
      table.integer('backup_by').unsigned().nullable();
      table.timestamp('backup_at').defaultTo(knex.fn.now());
    });
  }

  // 1. Rename sys_settings to sys_company
  await knex.schema.renameTable('sys_settings', 'sys_company');
  await knex.schema.renameTable('sys_settings_logs', 'sys_company_logs');
  await knex.schema.renameTable('sys_settings_version', 'sys_company_version');
  
  // 2. Create sys_currency and its versions/logs
  await createTrackingTables('sys_currency', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).unique().notNullable();
    table.string('name', 100).notNullable();
    table.string('symbol', 10).nullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 50).defaultTo('Saved');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_currency_version');
  await knex.schema.dropTableIfExists('sys_currency_logs');
  await knex.schema.dropTableIfExists('sys_currency');
  await knex.schema.renameTable('sys_company_version', 'sys_settings_version');
  await knex.schema.renameTable('sys_company_logs', 'sys_settings_logs');
  await knex.schema.renameTable('sys_company', 'sys_settings');
}
