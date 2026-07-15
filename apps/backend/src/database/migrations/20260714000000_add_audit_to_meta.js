export async function up(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.datetime('deleted_at').nullable();
    table.uuid('deleted_by').nullable();
    table.string('delete_reason', 255).nullable();
  });

  await knex.schema.alterTable('sys_docfield', (table) => {
    table.string('status', 50).defaultTo('Active');
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.datetime('deleted_at').nullable();
    table.uuid('deleted_by').nullable();
    table.string('delete_reason', 255).nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
    table.dropColumn('deleted_at');
    table.dropColumn('deleted_by');
    table.dropColumn('delete_reason');
  });

  await knex.schema.alterTable('sys_docfield', (table) => {
    table.dropColumn('status');
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
    table.dropColumn('created_at');
    table.dropColumn('updated_at');
    table.dropColumn('deleted_at');
    table.dropColumn('deleted_by');
    table.dropColumn('delete_reason');
  });
}
