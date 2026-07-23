import knexModule from 'knex';
import knexfile from './knexfile.js';

const db = knexModule(knexfile.development);
async function run() {
  await db.schema.dropTableIfExists('sys_welcome_version');
  await db.schema.dropTableIfExists('sys_welcome_logs');
  await db.schema.dropTableIfExists('sys_welcome');
  console.log('Tables dropped');
  process.exit(0);
}
run();
