export async function up(knex) {
  // If the language column exists, rename it and change type
  const hasLanguage = await knex.schema.hasColumn('sys_user', 'language');
  if (hasLanguage) {
    await knex.schema.alterTable('sys_user', (table) => {
      // First, rename
      table.renameColumn('language', 'language_id');
    });
    
    // Then alter type to match UUID from sys_language
    await knex.schema.alterTable('sys_user', (table) => {
      table.string('language_id', 36).nullable().alter();
    });
  }
}

export async function down(knex) {
  const hasLanguageId = await knex.schema.hasColumn('sys_user', 'language_id');
  if (hasLanguageId) {
    await knex.schema.alterTable('sys_user', (table) => {
      table.string('language_id', 10).defaultTo('en').alter();
      table.renameColumn('language_id', 'language');
    });
  }
}
