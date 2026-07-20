import knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root',
    database: process.env.DB_NAME || 'framee_db'
  }
});

async function run() {
  const doctypes = await db('sys_user').select('*');
  console.log('Users in DB:', doctypes);
  process.exit(0);
}

run();
