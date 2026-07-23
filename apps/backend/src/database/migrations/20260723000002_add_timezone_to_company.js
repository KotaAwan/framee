export async function up(knex) {
  const hasCol = await knex.schema.hasColumn('sys_company', 'timezone');
  if (!hasCol) {
    await knex.schema.alterTable('sys_company', table => {
      table.string('timezone', 100).nullable();
    });
  }
  
  const hasColVer = await knex.schema.hasColumn('sys_company_version', 'timezone');
  if (!hasColVer) {
    await knex.schema.alterTable('sys_company_version', table => {
      table.string('timezone', 100).nullable();
    });
  }
}

export async function down(knex) {
  const hasCol = await knex.schema.hasColumn('sys_company', 'timezone');
  if (hasCol) {
    await knex.schema.alterTable('sys_company', table => {
      table.dropColumn('timezone');
    });
  }
  
  const hasColVer = await knex.schema.hasColumn('sys_company_version', 'timezone');
  if (hasColVer) {
    await knex.schema.alterTable('sys_company_version', table => {
      table.dropColumn('timezone');
    });
  }
}
