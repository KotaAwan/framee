const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [rows] = await conn.query('SHOW TABLES LIKE "sys_%"');
  console.log(rows.map(r => Object.values(r)[0]));
  conn.end();
}
run().catch(console.error);
