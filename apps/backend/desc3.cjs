const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [tables] = await conn.query('SHOW TABLES');
  console.log(tables);
  conn.end();
}
run().catch(console.error);
