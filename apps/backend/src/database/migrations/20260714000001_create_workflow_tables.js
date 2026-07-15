export async function up(knex) {
  // 1. sys_workflow
  await knex.schema.createTable('sys_workflow', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('name', 100).notNullable();
    table.string('label', 150).nullable();
    table.string('doctype', 100).notNullable();
    table.string('initial_state', 100).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.boolean('is_deleted').defaultTo(false);
    
    table.unique(['tenant_id', 'doctype', 'is_active'], 'unq_workflow_active');
  });

  // 2. sys_workflow_state
  await knex.schema.createTable('sys_workflow_state', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('workflow_id').notNullable().references('id').inTable('sys_workflow').onDelete('CASCADE');
    table.string('name', 100).notNullable(); // programmatic name
    table.string('label', 150).nullable();
    table.string('document_status', 20).defaultTo('Pending'); // Draft / Pending / Approved / Rejected / Cancelled
    table.string('style', 20).defaultTo('default');
    table.boolean('is_terminal').defaultTo(false);
    table.integer('sort_order').defaultTo(0);
    
    table.unique(['workflow_id', 'name'], 'unq_wfstate_name');
  });

  // 3. sys_workflow_transition
  await knex.schema.createTable('sys_workflow_transition', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('workflow_id').notNullable().references('id').inTable('sys_workflow').onDelete('CASCADE');
    table.string('from_state', 100).notNullable();
    table.string('to_state', 100).notNullable();
    table.string('action', 100).notNullable(); // UI label
    table.string('action_key', 100).notNullable(); // Programmatic key
    table.json('allowed_roles').nullable();
    table.boolean('require_comment').defaultTo(false);
    table.string('condition_field', 100).nullable();
    table.string('condition_value', 255).nullable();
    table.integer('sort_order').defaultTo(0);
  });

  // 4. sys_workflow_history
  await knex.schema.createTable('sys_workflow_history', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('doctype', 100).notNullable();
    table.uuid('doc_id').notNullable();
    table.uuid('workflow_id').notNullable().references('id').inTable('sys_workflow').onDelete('CASCADE');
    table.string('from_state', 100).notNullable();
    table.string('to_state', 100).notNullable();
    table.string('action', 100).nullable();
    table.uuid('user_id').notNullable();
    table.text('comment').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_workflow_history');
  await knex.schema.dropTableIfExists('sys_workflow_transition');
  await knex.schema.dropTableIfExists('sys_workflow_state');
  await knex.schema.dropTableIfExists('sys_workflow');
}
