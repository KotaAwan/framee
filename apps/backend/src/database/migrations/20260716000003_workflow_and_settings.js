export async function up(knex) {
  async function createTrackingTables(tableName, knex, tableBuilderCallback) {
    await knex.schema.createTable(tableName, tableBuilderCallback);
    
    await knex.schema.createTable(`${tableName}_logs`, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('doc_id').unsigned().notNullable();
      table.string('status', 100).nullable();
      table.text('content').nullable();
      table.integer('created_by').unsigned().nullable();
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

  // 1. sys_workflow_state
  await createTrackingTables('sys_workflow_state', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.string('style', 50).nullable();
    table.boolean('is_terminal').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 2. sys_workflow_action
  await createTrackingTables('sys_workflow_action', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.string('key', 100).notNullable();
    table.string('style', 50).nullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 3. sys_workflow
  await createTrackingTables('sys_workflow', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.string('doctype', 100).notNullable(); // refers to sys_doctype.table_name
    table.string('initial_state', 100).notNullable(); // refers to sys_workflow_state.name
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 4. sys_workflow_transition
  await createTrackingTables('sys_workflow_transition', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).nullable();
    table.string('doctype', 100).nullable(); // refers to sys_doctype.table_name
    table.string('from_state', 100).notNullable();
    table.string('to_state', 100).notNullable();
    table.string('action', 100).notNullable();
    table.json('allow_roles').nullable();
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 5. sys_settings
  await createTrackingTables('sys_settings', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.string('default_currency', 10).nullable();
    table.string('date_format', 50).nullable();
    table.boolean('enable_registration').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 6. sys_print
  await createTrackingTables('sys_print', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.string('doctype', 100).notNullable();
    table.text('html_template').nullable();
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });
}

export async function down(knex) {
  const tables = [
    'sys_print', 'sys_settings', 'sys_workflow_transition', 
    'sys_workflow', 'sys_workflow_action', 'sys_workflow_state'
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(`${table}_version`);
    await knex.schema.dropTableIfExists(`${table}_logs`);
    await knex.schema.dropTableIfExists(table);
  }
}
