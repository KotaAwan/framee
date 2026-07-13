export async function up(knex) {
  // 1. sys_language
  await knex.schema.createTable('sys_language', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('name', 100).notNullable();
    table.string('code', 10).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 50).defaultTo('Active');

    // Indexes
    table.index(['tenant_id', 'code'], 'idx_language_tenant_code');
    
    // Unique code per tenant
    table.unique(['tenant_id', 'code'], 'unq_language_code');
  });

  // 2. sys_translation
  await knex.schema.createTable('sys_translation', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('language_code', 10).notNullable();
    table.text('source_text').notNullable();
    table.text('translated_text').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 50).defaultTo('Active');

    // Indexes
    table.index(['tenant_id', 'language_code'], 'idx_translation_tenant_lang');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_translation');
  await knex.schema.dropTableIfExists('sys_language');
}
