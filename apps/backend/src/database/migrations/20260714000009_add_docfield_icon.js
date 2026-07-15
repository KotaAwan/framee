import { v4 as uuidv4 } from 'uuid';

export async function up(knex) {
  const TENANT_SYSTEM = '2607-00001';
  const DOCTYPE_DT_ID = '2607-00002';

  // Check if it exists
  const exists = await knex('sys_docfield')
    .where({ tenant_id: TENANT_SYSTEM, doctype_id: DOCTYPE_DT_ID, fieldname: 'icon' })
    .first();

  if (!exists) {
    await knex('sys_docfield').insert({
      id: uuidv4(),
      tenant_id: TENANT_SYSTEM,
      doctype_id: DOCTYPE_DT_ID,
      fieldname: 'icon',
      label: 'Icon',
      fieldtype: 'Data',
      is_required: 0,
      sort_order: 4,
      in_list_view: 1
    });
  }
}

export async function down(knex) {
  const TENANT_SYSTEM = '2607-00001';
  const DOCTYPE_DT_ID = '2607-00002';
  
  await knex('sys_docfield')
    .where({ tenant_id: TENANT_SYSTEM, doctype_id: DOCTYPE_DT_ID, fieldname: 'icon' })
    .del();
}
