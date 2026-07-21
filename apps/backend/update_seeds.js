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
  console.log('Inserting Dashboard module...');
  await db('sys_module').insert([
    { id: 3, code: 'MODU-2607-0003', name: 'Dashboard', slug: 'dashboard', icon: 'LayoutDashboard', is_deleted: false, status: 'Saved' }
  ]).onConflict('id').ignore();

  console.log('Inserting Welcome doctype...');
  await db('sys_doctype').insert([
    { id: 16, code: 'DOCT-2607-0016', name: 'Welcome', slug: 'sys_welcome', table_name: 'sys_welcome', module_id: 3, icon: 'Home', auto_code: 'WELC-.YY..MM.-.XXXX', is_single: true, is_deleted: false, status: 'Saved' }
  ]).onConflict('id').ignore();

  console.log('Clearing and inserting permissions...');
  await db('sys_permission').del();
  const permissionDoctypes = [
    'sys_language', 'sys_translation', 'sys_module', 'sys_doctype', 
    'sys_role', 'sys_user', 'sys_user_role', 'sys_permission', 'sys_welcome'
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
