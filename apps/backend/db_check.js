import knex from 'knex';

const db = knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'framee_dev'
  }
});

async function run() {
  try {
    const tables = await db.raw('SHOW TABLES');
    console.log("TABLES:");
    console.log(tables[0].map(t => Object.values(t)[0]));

    const users = await db('sys_user').select('*');
    console.log("\nSYS_USER:");
    console.log(users);

    const roles = await db('sys_role').select('*');
    console.log("\nSYS_ROLE:");
    console.log(roles);
    
  } catch(e) {
    console.error(e);
  } finally {
    db.destroy();
  }
}

run();
