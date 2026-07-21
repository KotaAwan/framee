import knex from 'knex';

const db = knex({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'framee_dev'
  }
});

async function run() {
  console.log('Inserting Settings module...');
  await db('sys_module').insert([
    { id: 4, code: 'MODU-2607-0004', name: 'Settings', slug: 'settings', icon: 'Settings', is_deleted: false, status: 'Saved' }
  ]).onConflict('id').merge();

  console.log('Updating doctypes...');
  // Move action, state, workflow to Settings (module 4)
  await db('sys_doctype').whereIn('table_name', ['sys_action', 'sys_state', 'sys_workflow']).update({ module_id: 4 });
  
  // Update sys_settings to sys_company
  await db('sys_doctype').where({ table_name: 'sys_settings' }).update({
    name: 'Company',
    slug: 'sys_company',
    table_name: 'sys_company',
    module_id: 4,
    icon: 'Building'
  });

  console.log('Inserting Currency doctype...');
  await db('sys_doctype').insert([
    { id: 17, code: 'DOCT-2607-0017', name: 'Currency', slug: 'sys_currency', table_name: 'sys_currency', module_id: 4, icon: 'DollarSign', auto_code: 'CURR-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' }
  ]).onConflict('id').merge();

  console.log('Updating permissions...');
  await db('sys_permission').del();
  const permissionDoctypes = [
    'sys_language', 'sys_translation', 'sys_module', 'sys_doctype', 
    'sys_role', 'sys_user', 'sys_user_role', 'sys_permission', 'sys_welcome',
    'sys_company', 'sys_state', 'sys_action', 'sys_workflow', 'sys_currency'
  ];
  const permissionsData = permissionDoctypes.map((dt, index) => ({
    id: index + 1,
    code: `PERM-2607-${String(index + 1).padStart(4, '0')}`,
    name: `Admin - ${dt}`,
    role_id: 1,
    doctype: dt,
    can_read: true,
    can_update: true,
    can_create: true,
    can_delete: true,
    can_lock: true,
    can_unlock: true,
    can_import: true,
    can_export: true,
    can_print: true,
    can_share: true,
    is_deleted: false,
    status: 'Saved'
  }));
  await db('sys_permission').insert(permissionsData);
  
  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
