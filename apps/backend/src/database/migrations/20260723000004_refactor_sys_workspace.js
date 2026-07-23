export const up = async (knex) => {
  const hasMenuId = await knex.schema.hasColumn('sys_workspace', 'menu_id');
  const hasDoctype = await knex.schema.hasColumn('sys_workspace', 'doctype');
  
  await knex.schema.alterTable('sys_workspace', (table) => {
    if (hasMenuId) {
      table.dropForeign('menu_id');
      table.dropColumn('menu_id');
    }
    if (!hasDoctype) {
      table.string('doctype', 100).nullable();
    }
  });

  const hasMenuIdVersion = await knex.schema.hasColumn('sys_workspace_version', 'menu_id');
  const hasDoctypeVersion = await knex.schema.hasColumn('sys_workspace_version', 'doctype');
  
  await knex.schema.alterTable('sys_workspace_version', (table) => {
    if (hasMenuIdVersion) {
      table.dropColumn('menu_id'); // version tables don't have FK
    }
    if (!hasDoctypeVersion) {
      table.string('doctype', 100).nullable();
    }
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable('sys_workspace', (table) => {
    table.integer('menu_id').unsigned().nullable().references('id').inTable('sys_menu');
    table.dropColumn('doctype');
  });

  await knex.schema.alterTable('sys_workspace_version', (table) => {
    table.integer('menu_id').unsigned().nullable();
    table.dropColumn('doctype');
  });
};
