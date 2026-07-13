export async function up(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.boolean('is_single').defaultTo(false).after('is_tree');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.dropColumn('is_single');
  });
}
