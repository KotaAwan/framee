export async function up(knex) {
  await knex.schema.createTable('sys_workspace_shortcut', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('module_id').notNullable().references('id').inTable('sys_module').onDelete('CASCADE');
    table.string('type', 50).notNullable(); // 'DocType', 'Report', 'Page', 'Link'
    table.string('target', 255).notNullable(); // e.g., 'User', '/report/sales', 'https://google.com'
    table.string('label', 100).notNullable();
    table.string('icon', 100).nullable();
    table.string('color', 50).nullable();
    table.integer('sort_order').defaultTo(0);
    
    table.string('status', 20).defaultTo('Active');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    table.index(['tenant_id', 'module_id'], 'idx_shortcut_module');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_workspace_shortcut');
}
