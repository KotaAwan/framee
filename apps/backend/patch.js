import knex from 'knex';
import config from './knexfile.js';

const db = knex(config.default || config);

async function patch() {
  await db('sys_docfield').where('fieldname', 'status').update({ in_list: false });
  await db('sys_docfield').where('fieldname', 'is_deleted').update({ in_list: false });
  
  await db('sys_workflow_state').where('name', 'Draft').update({ style: 'danger' });
  
  const records = await db('sys_user').select('*');
  console.log('sys_user records:', records);
  
  console.log('Patch complete.');
  process.exit(0);
}

patch().catch(console.error);
