export async function up(knex) {
  await knex.schema.createTable('sys_module', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('name', 100).notNullable();
    table.string('icon', 100).nullable();
    table.text('description').nullable();
    
    // Standard status and tracking fields
    table.string('status', 20).defaultTo('Active');
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.unique(['tenant_id', 'name']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_module');
}
