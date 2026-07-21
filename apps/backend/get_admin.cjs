const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [rows] = await conn.query('SELECT email FROM sys_user LIMIT 1');
  console.log(rows);
  conn.end();
}
run().catch(console.error);
