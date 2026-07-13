export async function up(knex) {
  await knex.schema.alterTable('sys_user', (table) => {
    table.string('pin_hash', 255).nullable().after('password_hash');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_user', (table) => {
    table.dropColumn('pin_hash');
  });
}
