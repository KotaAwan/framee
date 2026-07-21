const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  
  // Read localDict from useTranslation.js (parse roughly)
  const code = fs.readFileSync('../frontend/src/hooks/useTranslation.js', 'utf8');
  const idMatch = code.match(/id: \{([\s\S]*?)\n  \}/);
  
  if (!idMatch) {
    console.log("Could not find 'id' dict");
    return;
  }

  const idLines = idMatch[1].split('\n').filter(l => l.trim().includes(':'));
  const dict = {};
  for (let line of idLines) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      let key = parts[0].trim().replace(/^['"]|['"]$/g, '');
      let val = parts.slice(1).join(':').trim().replace(/^['"]|['"]$/g, '').replace(/,$/, '');
      dict[key] = val;
    }
  }

  // Get current max code
  const [rows] = await conn.query('SELECT code FROM sys_translation ORDER BY id DESC LIMIT 1');
  let nextCodeNum = 1;
  if (rows.length > 0 && rows[0].code) {
    const match = rows[0].code.match(/TRAN-\d{4}-(\d{4})/);
    if (match) nextCodeNum = parseInt(match[1], 10) + 1;
  }
  
  const currentMonthYear = new Date().toLocaleDateString('en-GB', {month: '2-digit', year: '2-digit'}).replace('/', '');

  // We assume language_id 2 is Indonesian
  const language_id = 2;

  let added = 0;
  for (const [key, value] of Object.entries(dict)) {
    // Check if exists
    const [existing] = await conn.query('SELECT id FROM sys_translation WHERE name = ? AND language_id = ?', [key, language_id]);
    
    if (existing.length === 0) {
      const codeStr = `TRAN-${currentMonthYear}-${String(nextCodeNum).padStart(4, '0')}`;
      await conn.query(`
        INSERT INTO sys_translation 
        (code, name, language_id, translated_text, is_deleted, status)
        VALUES (?, ?, ?, ?, 0, 'Saved')
      `, [codeStr, key, language_id, value]);
      nextCodeNum++;
      added++;
    }
  }

  console.log(`Added ${added} new translations to sys_translation.`);
  conn.end();
}
run().catch(console.error);
