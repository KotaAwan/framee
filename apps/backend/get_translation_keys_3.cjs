const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'framee_dev'
  });

  const [actions] = await conn.query('SELECT DISTINCT name FROM sys_action');
  const [states] = await conn.query('SELECT DISTINCT name FROM sys_state');
  const [workflows] = await conn.query('SELECT DISTINCT log_status FROM sys_workflow');

  const keys = new Set([
    ...actions.map(r => r.name),
    ...states.map(r => r.name),
    ...workflows.map(r => r.log_status)
  ]);

  console.log(JSON.stringify(Array.from(keys), null, 2));
  conn.end();
}

run().catch(console.error);
