export async function up(knex) {
  await knex.schema.alterTable('sys_role', table => {
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
  });
  await knex.schema.alterTable('sys_permission', table => {
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
  });
  await knex.schema.alterTable('sys_user_role', table => {
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_role', table => {
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
  });
  await knex.schema.alterTable('sys_permission', table => {
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
  });
  await knex.schema.alterTable('sys_user_role', table => {
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
  });
}
