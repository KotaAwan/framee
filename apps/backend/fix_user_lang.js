import knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'framee_dev'
  }
});

async function run() {
  try {
    const defaultLang = await db('sys_language').where({ code: 'EN' }).first();
    if (defaultLang) {
      await db('sys_user').update({ language_id: defaultLang.id });
      console.log('Updated sys_user language_id to', defaultLang.id);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
