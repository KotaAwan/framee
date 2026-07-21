const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  const [permCols] = await conn.query('SHOW COLUMNS FROM sys_permission');
  console.log('sys_permission:', permCols.map(c => c.Field));
  
  const [docCols] = await conn.query('SHOW COLUMNS FROM sys_doctype');
  console.log('sys_doctype:', docCols.map(c => c.Field));
  
  const [modCols] = await conn.query('SHOW COLUMNS FROM sys_module');
  console.log('sys_module:', modCols.map(c => c.Field));
  
  conn.end();
}
run().catch(console.error);
