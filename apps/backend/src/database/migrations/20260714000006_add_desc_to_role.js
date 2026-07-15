export async function up(knex) {
  await knex.schema.alterTable('sys_role', table => {
    table.text('description').nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_role', table => {
    table.dropColumn('description');
  });
}
