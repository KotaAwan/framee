export async function up(knex) {
  // Helper to create _logs and _version tables
  async function createTrackingTables(tableName, knex, tableBuilderCallback) {
    // 1. Create Main Table
    await knex.schema.createTable(tableName, tableBuilderCallback);
    
    if (tableName === 'sys_docfield' || tableName === 'sys_audit_log' || tableName === 'sys_event_log') return; // Exclusions

    // 2. Create _logs Table
    await knex.schema.createTable(`${tableName}_logs`, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('doc_id').unsigned().notNullable(); // Link to main table id
      table.string('status', 100).nullable();
      table.text('content').nullable();
      table.integer('created_by').unsigned().nullable(); // user_id
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // We do not set foreign keys here to avoid ordering issues across multiple migration files,
      // but conceptually doc_id -> tableName.id and created_by -> sys_user.id
    });

    // 3. Create _version Table (Dynamic structure based on main table columns)
    // To copy the exact structure of the main table into the _version table via Knex schema builder
    // is tricky without raw SQL, but we can execute a raw CREATE TABLE ... LIKE ... query in MySQL.
    await knex.raw(`CREATE TABLE ?? SELECT * FROM ?? WHERE 1=0`, [`${tableName}_version`, tableName]);
    
    // Now alter the version table to add backup_by and backup_at, and change primary key.
    // wait, if we use CREATE TABLE LIKE, it copies the primary key. We need to drop the primary key,
    // rename `id` to `doc_id`, add a new `id` as auto increment.
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

  // 1. sys_language
  await createTrackingTables('sys_language', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 100).notNullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 2. sys_translation
  await createTrackingTables('sys_translation', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).nullable();
    table.integer('language_id').unsigned().nullable();
    table.text('translated_text').nullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 3. sys_module
  await createTrackingTables('sys_module', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.string('icon', 50).nullable();
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 4. sys_doctype
  await createTrackingTables('sys_doctype', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable(); // Previously label
    table.string('table_name', 100).notNullable().unique(); // Previously name
    table.integer('module_id').unsigned().nullable();
    table.string('icon', 50).nullable();
    table.string('auto_code', 150).nullable(); // Previously autoname
    table.boolean('is_printable').defaultTo(false);
    table.boolean('is_tree').defaultTo(false);
    table.boolean('is_single').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });

  // 5. sys_docfield (No logs or version tables)
  await knex.schema.createTable('sys_docfield', (table) => {
    table.increments('id').unsigned().primary();
    table.string('doctype', 100).notNullable(); // Link -> sys_doctype.table_name
    table.string('label', 100).notNullable();
    table.string('fieldname', 100).notNullable();
    table.string('fieldtype', 50).notNullable();
    table.string('options', 255).nullable();
    table.string('icon', 50).nullable();
    table.text('default_value').nullable();
    table.boolean('is_required').defaultTo(false);
    table.boolean('is_read_only').defaultTo(false);
    table.boolean('is_hidden').defaultTo(false);
    table.boolean('in_list').defaultTo(false);
    table.boolean('in_filter').defaultTo(false);
    table.boolean('in_search').defaultTo(false);
    table.integer('sort_order').defaultTo(0);
  });

  // 6. sys_workspace (replaces sys_workspace_shortcut)
  await createTrackingTables('sys_workspace', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('code', 50).nullable().unique();
    table.string('name', 100).notNullable();
    table.integer('module_id').unsigned().nullable();
    table.string('type', 50).nullable();
    table.string('target', 255).nullable();
    table.string('icon', 50).nullable();
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 100).nullable();
  });
  
  // 7. Retain sys_audit_log
  await knex.schema.createTable('sys_audit_log', (table) => {
    table.uuid('id').primary();
    table.string('tenant_id', 50).nullable(); // tenant string? No tenant table anymore
    table.string('doctype', 100).nullable();
    table.string('doc_id', 100).nullable();
    table.string('doc_name', 255).nullable();
    table.string('action', 100).notNullable();
    table.integer('user_id').unsigned().nullable();
    table.string('user_name', 150).nullable();
    table.string('ip_address', 50).nullable();
    table.string('user_agent', 255).nullable();
    table.json('diff').nullable();
    table.text('change_summary').nullable();
    table.json('metadata').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 8. Retain sys_event_log
  await knex.schema.createTable('sys_event_log', (table) => {
    table.uuid('id').primary(); // EventEngine uses randomUUID()
    table.string('tenant_id', 50).nullable();
    table.string('event_name', 255).notNullable();
    table.string('publisher', 100).nullable();
    table.text('payload_summary').nullable();
    table.integer('subscriber_count').defaultTo(0);
    table.integer('user_id').unsigned().nullable();
    table.string('doc_id', 100).nullable();
    table.string('doctype', 100).nullable();
    table.integer('duration_ms').defaultTo(0);
    table.boolean('had_errors').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  const tables = [
    'sys_workspace', 'sys_docfield', 'sys_doctype', 'sys_module', 
    'sys_translation', 'sys_language'
  ];
  
  for (const table of tables) {
    if (table !== 'sys_docfield') {
      await knex.schema.dropTableIfExists(`${table}_version`);
      await knex.schema.dropTableIfExists(`${table}_logs`);
    }
    await knex.schema.dropTableIfExists(table);
  }
  
  await knex.schema.dropTableIfExists('sys_event_log');
  await knex.schema.dropTableIfExists('sys_audit_log');
}
