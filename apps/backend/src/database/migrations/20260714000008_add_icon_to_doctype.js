export async function up(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.string('icon', 100).defaultTo('Circle').after('name');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.dropColumn('icon');
  });
}
