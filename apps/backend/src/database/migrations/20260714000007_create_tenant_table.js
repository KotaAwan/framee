export async function up(knex) {
  await knex.schema.createTable('sys_tenant', (table) => {
    // Primary key can be string since we might use autoname (TEN-2607-00001) or UUID.
    // However, if the rest of the system expects tenant_id to be UUID in other tables, 
    // changing sys_tenant.id to string might conflict if it's used as a foreign key that expects UUID.
    // Wait, the NamingEngine handles IDs as string, but previously tenant_id in sys_doctype was set to uuid().
    // Let's use string('id', 50) and see, but wait, 20260713000001_create_metadata_tables.js sets tenant_id as uuid().
    // We can't easily change all tenant_id columns to string. Let's make id a string and let SQLite/MySQL handle the type affinity, or just use string. 
    // Actually, Knex uuid() in MySQL is binary(16) or char(36). In SQLite it's just text.
    // We will use string('id', 50).primary() because NamingEngine generates string.
    table.string('id', 50).primary();
    
    // Core fields
    table.string('name', 100).notNullable();
    
    // Audit fields
    table.boolean('is_active').defaultTo(true);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.string('status', 50).defaultTo('Active');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_tenant');
}
