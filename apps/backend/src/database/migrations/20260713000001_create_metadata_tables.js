export async function up(knex) {
  // 1. sys_doctype
  await knex.schema.createTable('sys_doctype', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('name', 100).notNullable();
    table.uuid('module_id').nullable();
    table.string('label', 150).nullable();
    table.text('description').nullable();
    table.boolean('is_submittable').defaultTo(false);
    table.boolean('is_tree').defaultTo(false);
    table.boolean('track_changes').defaultTo(false);
    table.string('title_field', 100).nullable();
    table.text('search_fields').nullable();
    table.boolean('is_active').defaultTo(true);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.boolean('is_deleted').defaultTo(false);
    table.string('status', 50).defaultTo('Active');

    // Indexes
    table.index(['tenant_id', 'name'], 'idx_doctype_tenant_name');
    table.index(['tenant_id', 'is_deleted'], 'idx_doctype_tenant_deleted');
    table.index(['module_id'], 'idx_doctype_module');
    
    // Ensure uniqueness per tenant
    table.unique(['tenant_id', 'name'], 'unq_doctype_tenant_name');
  });

  // 2. sys_docfield
  await knex.schema.createTable('sys_docfield', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('doctype_id').notNullable().references('id').inTable('sys_doctype').onDelete('CASCADE');
    table.string('fieldname', 100).notNullable();
    table.string('label', 150).nullable();
    table.string('fieldtype', 50).notNullable();
    table.text('options').nullable();
    table.string('default_value', 255).nullable();
    table.boolean('is_required').defaultTo(false);
    table.boolean('is_read_only').defaultTo(false);
    table.boolean('is_hidden').defaultTo(false);
    table.boolean('in_list_view').defaultTo(false);
    table.boolean('in_standard_filter').defaultTo(false);
    table.text('description').nullable();
    table.string('hint', 255).nullable();
    table.integer('sort_order').defaultTo(0);
    table.string('section', 100).nullable();
    table.tinyint('column_width').defaultTo(12);
    
    // Indexes
    table.index(['doctype_id'], 'idx_docfield_doctype');
    table.index(['doctype_id', 'sort_order'], 'idx_docfield_sort');
    
    // Unique fieldname per doctype per tenant
    table.unique(['tenant_id', 'doctype_id', 'fieldname'], 'idx_docfield_unique');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_docfield');
  await knex.schema.dropTableIfExists('sys_doctype');
}
