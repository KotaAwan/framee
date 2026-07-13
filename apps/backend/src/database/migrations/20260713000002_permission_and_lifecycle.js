export async function up(knex) {
  // 1. Alter sys_doctype to add lifecycle metadata
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.boolean('has_lifecycle').defaultTo(false);
    table.string('initial_status', 20).defaultTo('Draft');
    table.boolean('allow_edit_after_submit').defaultTo(false);
    table.boolean('allow_cancel').defaultTo(true);
    table.boolean('allow_amend').defaultTo(false);
    table.boolean('allow_duplicate').defaultTo(true);
    table.boolean('allow_delete').defaultTo(true);
    table.boolean('lock_on_submit').defaultTo(false);
    table.json('lock_fields_after_submit').nullable();
    table.boolean('require_delete_reason').defaultTo(false);
  });

  // 2. sys_role
  await knex.schema.createTable('sys_role', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('name', 100).notNullable();
    table.string('label', 150).nullable();
    table.uuid('parent_role_id').nullable();
    table.boolean('is_system_role').defaultTo(false);
    table.string('status', 50).defaultTo('Active');
    table.boolean('is_deleted').defaultTo(false);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'name'], 'idx_role_name');
  });

  // 3. sys_permission
  await knex.schema.createTable('sys_permission', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('role_id').notNullable().references('id').inTable('sys_role').onDelete('CASCADE');
    table.string('doctype', 100).notNullable();
    table.boolean('can_read').defaultTo(false);
    table.boolean('can_write').defaultTo(false);
    table.boolean('can_create').defaultTo(false);
    table.boolean('can_delete').defaultTo(false);
    table.boolean('can_submit').defaultTo(false);
    table.boolean('can_cancel').defaultTo(false);
    table.boolean('can_export').defaultTo(false);
    table.boolean('can_share').defaultTo(false);
    table.boolean('if_owner').defaultTo(false);
    table.string('condition_field', 100).nullable();
    table.string('condition_value', 255).nullable();
    table.string('status', 50).defaultTo('Active');
    table.boolean('is_deleted').defaultTo(false);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'role_id', 'doctype'], 'idx_perm_role_doctype');
  });

  // 4. sys_docfield_permission
  await knex.schema.createTable('sys_docfield_permission', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('permission_id').notNullable().references('id').inTable('sys_permission').onDelete('CASCADE');
    table.string('fieldname', 100).notNullable();
    table.boolean('can_read').defaultTo(true);
    table.boolean('can_write').defaultTo(true);

    table.unique(['permission_id', 'fieldname'], 'idx_dfperm_field');
  });

  // 5. sys_user_role
  await knex.schema.createTable('sys_user_role', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('user_id').notNullable(); // We don't have sys_user table yet, so no strict FK
    table.uuid('role_id').notNullable().references('id').inTable('sys_role').onDelete('CASCADE');

    table.unique(['tenant_id', 'user_id', 'role_id'], 'idx_user_role_unique');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_user_role');
  await knex.schema.dropTableIfExists('sys_docfield_permission');
  await knex.schema.dropTableIfExists('sys_permission');
  await knex.schema.dropTableIfExists('sys_role');
  
  await knex.schema.alterTable('sys_doctype', (table) => {
    table.dropColumns(
      'has_lifecycle', 'initial_status', 'allow_edit_after_submit',
      'allow_cancel', 'allow_amend', 'allow_duplicate', 'allow_delete',
      'lock_on_submit', 'lock_fields_after_submit', 'require_delete_reason'
    );
  });
}
