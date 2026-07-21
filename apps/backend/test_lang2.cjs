const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [cols] = await conn.query('SHOW COLUMNS FROM sys_language');
  console.log(cols.map(c => c.Field));
  conn.end();
}
run().catch(console.error);
