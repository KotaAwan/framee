export async function up(knex) {
  // Helper to create _logs and _version tables
  async function createTrackingTables(tableName, knex, tableBuilderCallback) {
    await knex.schema.createTable(tableName, tableBuilderCallback);
    await knex.schema.createTable(`${tableName}_logs`, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('doc_id').unsigned().notNullable();
      table.string('status', 30).nullable();
      table.string('content', 100).nullable();
      table.integer('created_by').unsigned().nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
    await knex.raw(`CREATE TABLE ?? SELECT * FROM ?? WHERE 1=0`, [`${tableName}_version`, tableName]);
    await knex.raw(`ALTER TABLE ?? CHANGE id doc_id INT UNSIGNED NOT NULL`, [`${tableName}_version`]);
    await knex.raw(`ALTER TABLE ?? ADD id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY FIRST`, [`${tableName}_version`]);
    await knex.raw(`ALTER TABLE ?? ADD backup_by INT UNSIGNED NULL`, [`${tableName}_version`]);
    await knex.raw(`ALTER TABLE ?? ADD backup_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, [`${tableName}_version`]);
  }

  await createTrackingTables('sys_welcome', knex, (table) => {
    table.increments('id').unsigned().primary();
    table.string('title', 100).nullable();
    table.text('message').nullable();
    table.string('status', 30).defaultTo('Saved');
    table.boolean('is_deleted').defaultTo(false);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_welcome_version');
  await knex.schema.dropTableIfExists('sys_welcome_logs');
  await knex.schema.dropTableIfExists('sys_welcome');
}
