const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  
  // Collect unique strings
  const strings = new Set();
  
  // 1. sys_docfield labels
  const [fields] = await conn.query('SELECT DISTINCT label FROM sys_docfield WHERE label IS NOT NULL AND label != ""');
  fields.forEach(f => strings.add(f.label));
  
  // 2. sys_module names
  const [modules] = await conn.query('SELECT DISTINCT name FROM sys_module WHERE name IS NOT NULL AND name != ""');
  modules.forEach(m => strings.add(m.name));
  
  // 3. sys_menu names
  const [menus] = await conn.query('SELECT DISTINCT name FROM sys_menu WHERE name IS NOT NULL AND name != ""');
  menus.forEach(m => strings.add(m.name));
  
  // 4. sys_action names
  const [actions] = await conn.query('SELECT DISTINCT name FROM sys_action WHERE name IS NOT NULL AND name != ""');
  actions.forEach(a => strings.add(a.name));
  
  // 5. sys_state names
  const [states] = await conn.query('SELECT DISTINCT name FROM sys_state WHERE name IS NOT NULL AND name != ""');
  states.forEach(s => strings.add(s.name));
  
  // 6. sys_workflow statuses
  const [workflows] = await conn.query('SELECT DISTINCT log_status FROM sys_workflow WHERE log_status IS NOT NULL AND log_status != ""');
  workflows.forEach(w => strings.add(w.log_status));

  // Also add some static ones
  const staticStrings = [
    'General', 'Basic Details', 'Auto', 'Showing', 'of', 'rows', 'Page', 'pages',
    'LoadMore', 'Versions', 'Show', 'Hide', 'Activity Timeline', 'Create New', 'View',
    'Print', 'Edit', 'Change Password', 'New Password', 'System'
  ];
  staticStrings.forEach(s => strings.add(s));

  // Get current max code
  const [rows] = await conn.query('SELECT code FROM sys_translation ORDER BY id DESC LIMIT 1');
  let nextCodeNum = 1;
  if (rows.length > 0 && rows[0].code) {
    const match = rows[0].code.match(/TRAN-\d{4}-(\d{4})/);
    if (match) nextCodeNum = parseInt(match[1], 10) + 1;
  }
  
  const currentMonthYear = new Date().toLocaleDateString('en-GB', {month: '2-digit', year: '2-digit'}).replace('/', '');
  const language_id = 2; // Indonesian

  let added = 0;
  for (const str of strings) {
    const [existing] = await conn.query('SELECT id FROM sys_translation WHERE name = ? AND language_id = ?', [str, language_id]);
    
    if (existing.length === 0) {
      const codeStr = `TRAN-${currentMonthYear}-${String(nextCodeNum).padStart(4, '0')}`;
      await conn.query(`
        INSERT INTO sys_translation 
        (code, name, language_id, translated_text, is_deleted, status)
        VALUES (?, ?, ?, ?, 0, 'Saved')
      `, [codeStr, str, language_id, str]); // default to original text if no translation
      nextCodeNum++;
      added++;
    }
  }

  console.log(`Successfully added ${added} missing translations to sys_translation.`);
  conn.end();
}
run().catch(console.error);
