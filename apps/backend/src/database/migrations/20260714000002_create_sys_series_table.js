export async function up(knex) {
  // 1. sys_series table
  await knex.schema.createTable('sys_series', (table) => {
    table.uuid('tenant_id').notNullable();
    table.string('prefix', 100).notNullable();
    table.integer('current').defaultTo(0);
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    table.primary(['tenant_id', 'prefix']);
  });

  // 2. Add autoname to sys_doctype
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.string('autoname', 150).nullable().defaultTo('UUID');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.dropColumn('autoname');
  });
  
  await knex.schema.dropTableIfExists('sys_series');
}
