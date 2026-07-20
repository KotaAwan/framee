export async function up(knex) {
  // Add slug to sys_module
  await knex.schema.alterTable('sys_module', (table) => {
    table.string('slug', 100).after('name');
  });
  await knex.schema.alterTable('sys_module_version', (table) => {
    table.string('slug', 100).after('name').nullable();
  });

  // Add slug to sys_doctype
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.string('slug', 100).after('name');
  });
  await knex.schema.alterTable('sys_doctype_version', (table) => {
    table.string('slug', 100).after('name').nullable();
  });

  // Create sys_menu tables
  const createMenuTable = (tableName) => {
    return knex.schema.createTable(tableName, (table) => {
      table.increments('id').primary();
      table.string('code', 50).notNullable().unique();
      table.string('name', 150).notNullable();
      table.string('doctype', 100).notNullable(); // Reference to sys_doctype.table_name
      
      table.boolean('is_deleted').defaultTo(false);
      table.string('status', 50).defaultTo('Active');
    });
  };

  await createMenuTable('sys_menu');
  
  // sys_menu_logs
  await knex.schema.createTable('sys_menu_logs', (table) => {
    table.increments('id').primary();
    table.integer('doc_id').unsigned().notNullable(); // Link to main table id
    table.string('status', 100).nullable();
    table.text('content').nullable();
    table.integer('created_by').unsigned().nullable(); // user_id
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // sys_menu_version
  await knex.schema.createTable('sys_menu_version', (table) => {
    table.increments('id').unsigned().primary();
    table.integer('doc_id').unsigned().notNullable(); // Link to main table id
    table.string('code', 50).nullable();
    table.string('name', 150).nullable();
    table.string('doctype', 100).nullable();
    table.boolean('is_deleted').nullable();
    table.string('status', 50).nullable();
    table.integer('backup_by').unsigned().nullable();
    table.timestamp('backup_at').defaultTo(knex.fn.now());
  });

  // Alter sys_workspace to remove old fields and add role_id and menu_id
  const alterWorkspace = async (tableName) => {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('module_id');
      table.dropColumn('type');
      table.dropColumn('target');
      table.dropColumn('icon');
      
      if (tableName === 'sys_workspace') {
        table.integer('role_id').unsigned().after('name').references('id').inTable('sys_role').onDelete('CASCADE');
        table.integer('menu_id').unsigned().after('role_id').references('id').inTable('sys_menu').onDelete('CASCADE');
      } else {
        table.integer('role_id').unsigned().after('name').nullable();
        table.integer('menu_id').unsigned().after('role_id').nullable();
      }
    });
  };

  await alterWorkspace('sys_workspace');
  await alterWorkspace('sys_workspace_version');
}

export async function down(knex) {
  // Revert sys_workspace
  const revertWorkspace = async (tableName) => {
    await knex.schema.alterTable(tableName, (table) => {
      if (tableName === 'sys_workspace') {
        table.dropForeign('role_id');
        table.dropForeign('menu_id');
      }
      table.dropColumn('role_id');
      table.dropColumn('menu_id');
      
      if (tableName === 'sys_workspace') {
        table.integer('module_id').unsigned().references('id').inTable('sys_module');
      } else {
        table.integer('module_id').unsigned().nullable();
      }
      table.string('type', 50).nullable();
      table.string('target', 100).nullable();
      table.string('icon', 50).nullable();
    });
  };

  await revertWorkspace('sys_workspace');
  await revertWorkspace('sys_workspace_version');

  // Drop sys_menu
  await knex.schema.dropTableIfExists('sys_menu_version');
  await knex.schema.dropTableIfExists('sys_menu_logs');
  await knex.schema.dropTableIfExists('sys_menu');

  // Drop slugs
  await knex.schema.alterTable('sys_doctype_version', t => t.dropColumn('slug'));
  await knex.schema.alterTable('sys_doctype', t => t.dropColumn('slug'));

  await knex.schema.alterTable('sys_module_version', t => t.dropColumn('slug'));
  await knex.schema.alterTable('sys_module', t => t.dropColumn('slug'));
}
