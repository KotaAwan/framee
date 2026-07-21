const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  
  const [existing] = await conn.query('SELECT id FROM sys_translation WHERE name = "Select" AND language_id = 2');
  if (existing.length === 0) {
    const currentMonthYear = new Date().toLocaleDateString('en-GB', {month: '2-digit', year: '2-digit'}).replace('/', '');
    const codeStr = `TRAN-${currentMonthYear}-9998`; // random high number
    await conn.query(`
      INSERT INTO sys_translation 
      (code, name, language_id, translated_text, is_deleted, status)
      VALUES (?, 'Select', 2, 'Pilih', 0, 'Saved')
    `, [codeStr]);
    console.log('Added "Select" -> "Pilih"');
  }
  
  conn.end();
}
run().catch(console.error);
