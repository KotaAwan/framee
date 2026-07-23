export async function up(knex) {
  const hasCol = await knex.schema.hasColumn('sys_company', 'default_currency');
  if (hasCol) {
    await knex.raw('ALTER TABLE sys_company CHANGE default_currency currency_id INT UNSIGNED NULL');
  }
  
  const hasColVer = await knex.schema.hasColumn('sys_company_version', 'default_currency');
  if (hasColVer) {
    await knex.raw('ALTER TABLE sys_company_version CHANGE default_currency currency_id INT UNSIGNED NULL');
  }
}

export async function down(knex) {
  const hasCol = await knex.schema.hasColumn('sys_company', 'currency_id');
  if (hasCol) {
    await knex.raw('ALTER TABLE sys_company CHANGE currency_id default_currency VARCHAR(10) NULL');
  }
  
  const hasColVer = await knex.schema.hasColumn('sys_company_version', 'currency_id');
  if (hasColVer) {
    await knex.raw('ALTER TABLE sys_company_version CHANGE currency_id default_currency VARCHAR(10) NULL');
  }
}
