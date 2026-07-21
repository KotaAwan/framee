const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [rows] = await conn.query('SELECT name, table_name, is_printable FROM sys_doctype WHERE table_name = "sys_user" OR name = "User"');
  console.log(rows);
  conn.end();
}
run().catch(console.error);
