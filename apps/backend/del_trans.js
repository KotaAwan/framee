import knexModule from 'knex';
import knexfile from './knexfile.js';

async function run() {
  const db = knexModule(knexfile.development);
  const deleted = await db('sys_translation').where('source_text', 'like', '%Redirecting%').del();
  console.log('Deleted ' + deleted + ' translations.');
  process.exit(0);
}
run().catch(console.error);
