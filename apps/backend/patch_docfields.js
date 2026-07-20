import knex from 'knex';
import config from './knexfile.js';

const db = knex(config.default || config);

async function patch() {
  const fields = await db('sys_docfield').select('*');
  
  for (const field of fields) {
    let updates = {};
    if (field.fieldname === 'id') {
      updates.is_hidden = true;
      updates.in_list = false;
      updates.in_filter = false;
    } else if (field.fieldname === 'code' || field.fieldname === 'name') {
      updates.in_list = true;
      updates.in_filter = true;
    } else if (field.fieldname === 'is_deleted' || field.fieldname === 'status') {
      updates.is_hidden = true;
      updates.in_list = false;
      updates.in_filter = false;
    } else {
      // only update if not already set, or force? User said "yg lain : in_list: 0, in_filter: 0"
      updates.in_list = false;
      updates.in_filter = false;
    }
    
    await db('sys_docfield').where('id', field.id).update(updates);
  }
  
  console.log('Patch complete.');
  process.exit(0);
}

patch().catch(console.error);
