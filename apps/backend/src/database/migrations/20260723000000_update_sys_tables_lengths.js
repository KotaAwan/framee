export async function up(knex) {
  // 1. Get all tables starting with 'sys_'
  const [rows] = await knex.raw(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name LIKE 'sys_%'
  `);
  
  for (const row of rows) {
    const tableName = row.TABLE_NAME || row.table_name;
    
    // Check columns
    const hasContent = await knex.schema.hasColumn(tableName, 'content');
    const hasStatus = await knex.schema.hasColumn(tableName, 'status');
    const hasCode = await knex.schema.hasColumn(tableName, 'code');
    const hasName = await knex.schema.hasColumn(tableName, 'name');
    
    if (tableName.endsWith('_logs')) {
      if (hasContent || hasStatus) {
        await knex.schema.alterTable(tableName, (table) => {
          if (hasContent) table.string('content', 100).alter();
          if (hasStatus) table.string('status', 30).alter();
        });
      }
    } else {
      // Main table or _version table
      if (hasCode || hasName || hasStatus) {
        await knex.schema.alterTable(tableName, (table) => {
          if (hasCode) table.string('code', 30).alter();
          if (hasName) table.string('name', 100).alter();
          if (hasStatus) table.string('status', 30).alter();
        });
      }
    }
  }
}

export async function down(knex) {
  // Reverting is omitted for simplicity in this structural update
}
