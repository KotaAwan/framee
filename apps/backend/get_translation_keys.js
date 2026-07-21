const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'framee_dev'
  });

  const [modules] = await conn.query('SELECT DISTINCT name FROM sys_module');
  const [menus] = await conn.query('SELECT DISTINCT name FROM sys_menu');
  const [fields] = await conn.query('SELECT DISTINCT label FROM sys_docfield');

  const keys = new Set([
    ...modules.map(r => r.name),
    ...menus.map(r => r.name),
    ...fields.map(r => r.label)
  ]);

  console.log(JSON.stringify(Array.from(keys), null, 2));
  conn.end();
}

run().catch(console.error);
