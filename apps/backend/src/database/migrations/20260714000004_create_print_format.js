export async function up(knex) {
  await knex.schema.createTable('sys_print_format', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('name', 150).notNullable();
    table.string('doctype_name', 100).notNullable(); // Which doctype this format belongs to
    table.text('html_template').notNullable();
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    
    table.string('status', 20).defaultTo('Active');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    table.index(['tenant_id', 'doctype_name'], 'idx_print_format_doctype');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_print_format');
}
