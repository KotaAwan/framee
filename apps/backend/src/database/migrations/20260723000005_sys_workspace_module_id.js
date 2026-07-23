export const up = async (knex) => {
  const hasModuleId = await knex.schema.hasColumn('sys_workspace', 'module_id');
  const hasRoleId = await knex.schema.hasColumn('sys_workspace', 'role_id');
  
  await knex.schema.alterTable('sys_workspace', (table) => {
    if (!hasModuleId) {
      // Add module_id
      table.integer('module_id').unsigned().nullable().after('name').references('id').inTable('sys_module').onDelete('CASCADE');
    }
    if (hasRoleId) {
      // Drop role_id foreign key then column
      table.dropForeign('role_id');
      table.dropColumn('role_id');
    }
  });

  const hasModuleIdVersion = await knex.schema.hasColumn('sys_workspace_version', 'module_id');
  const hasRoleIdVersion = await knex.schema.hasColumn('sys_workspace_version', 'role_id');
  
  await knex.schema.alterTable('sys_workspace_version', (table) => {
    if (!hasModuleIdVersion) {
      table.integer('module_id').unsigned().nullable().after('name');
    }
    if (hasRoleIdVersion) {
      table.dropColumn('role_id');
    }
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable('sys_workspace', (table) => {
    table.dropForeign('module_id');
    table.dropColumn('module_id');
    table.integer('role_id').unsigned().nullable().references('id').inTable('sys_role');
  });

  await knex.schema.alterTable('sys_workspace_version', (table) => {
    table.dropColumn('module_id');
    table.integer('role_id').unsigned().nullable();
  });
};
