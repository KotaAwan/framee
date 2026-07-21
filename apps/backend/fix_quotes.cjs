const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  
  const [rows] = await conn.query('SELECT id, name, translated_text FROM sys_translation');
  let updated = 0;
  
  for (const row of rows) {
    let nameFixed = row.name;
    let textFixed = row.translated_text;
    
    let changed = false;
    if (nameFixed && typeof nameFixed === 'string' && nameFixed.endsWith("'")) {
      nameFixed = nameFixed.slice(0, -1);
      changed = true;
    }
    if (textFixed && typeof textFixed === 'string' && textFixed.endsWith("'")) {
      textFixed = textFixed.slice(0, -1);
      changed = true;
    }
    
    if (changed) {
      await conn.query('UPDATE sys_translation SET name = ?, translated_text = ? WHERE id = ?', [nameFixed, textFixed, row.id]);
      updated++;
    }
  }
  
  console.log(`Fixed ${updated} rows.`);
  conn.end();
}
run().catch(console.error);
