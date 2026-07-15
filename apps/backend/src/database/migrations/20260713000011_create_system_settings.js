export async function up(knex) {
  // Global System Settings
  await knex.schema.createTable('sys_settings', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    
    // Some basic settings fields
    table.string('app_name', 100).defaultTo('Framee');
    table.string('company_name', 150).nullable();
    table.string('default_currency', 10).defaultTo('USD');
    table.string('date_format', 20).defaultTo('yyyy-mm-dd');
    table.boolean('enable_registration').defaultTo(false);
    
    // Standard status and tracking fields
    table.string('status', 20).defaultTo('Active');
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    table.unique(['tenant_id']); // Ensure only 1 record per tenant
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_settings');
}
