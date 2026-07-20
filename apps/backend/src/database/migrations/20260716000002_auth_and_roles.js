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

    await knex.raw(`CREATE TABLE ?? LIKE ??`, [`${tableName}_version`, tableName]);
    await knex.raw(`ALTER TABLE ?? MODIFY id INT UNSIGNED NOT NULL`, [`${tableName}_version`]);
    await knex.schema.alterTable(`${tableName}_version`, (table) => {
      table.dropPrimary();
      table.renameColumn('id', 'doc_id');
    });
    
    await knex.schema.alterTable(`${tableName}_version`, (table) => {
      table.increments('id').unsigned().primary().first();
      table.integer('backup_by').unsigned().nullable();
      table.timestamp('backup_at').defaultTo(knex.fn.now());
    });
  }

  // 1. sys_role
  await createTrackingTables('sys_role', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.integer('parent_role_id').unsigned().nullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 2. sys_permission
  await createTrackingTables('sys_permission', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.integer('role_id').unsigned().nullable();
    table.string('doctype', 100).notNullable(); // string because it might refer to table_name or doctype name, user specified string/int
    table.boolean('can_read').defaultTo(false);
    table.boolean('can_write').defaultTo(false);
    table.boolean('can_create').defaultTo(false);
    table.boolean('can_delete').defaultTo(false);
    table.boolean('can_submit').defaultTo(false);
    table.boolean('can_cancel').defaultTo(false);
    table.boolean('can_import').defaultTo(false);
    table.boolean('can_export').defaultTo(false);
    table.boolean('can_print').defaultTo(false);
    table.boolean('can_share').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 3. sys_user
  await createTrackingTables('sys_user', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 150).notNullable();
    table.string('email', 150).notNullable().unique();
    table.string('password_hash', 255).nullable();
    table.string('pin_hash', 255).nullable();
    table.string('google_id', 150).nullable();
    table.string('avatar_url', 255).nullable();
    table.string('phone', 50).nullable();
    table.integer('language_id').unsigned().nullable();
    table.string('timezone', 100).nullable();
    table.string('date_format', 50).nullable();
    table.boolean('is_system_user').defaultTo(false);
    table.timestamp('last_login_at').nullable();
    table.integer('failed_login_count').defaultTo(0);
    table.timestamp('locked_until').nullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 4. sys_user_role
  await createTrackingTables('sys_user_role', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 150).nullable();
    table.integer('user_id').unsigned().notNullable();
    table.integer('role_id').unsigned().notNullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });
}

export async function down(knex) {
  const tables = ['sys_user_role', 'sys_user', 'sys_permission', 'sys_role'];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(`${table}_version`);
    await knex.schema.dropTableIfExists(`${table}_logs`);
    await knex.schema.dropTableIfExists(table);
  }
}
