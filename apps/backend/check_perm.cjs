const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [rows] = await conn.query('SELECT * FROM sys_permission LIMIT 5');
  console.log(rows);
  conn.end();
}
run().catch(console.error);
