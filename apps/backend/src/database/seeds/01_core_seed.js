import bcrypt from 'bcryptjs';

export async function seed(knex) {
  // Clear existing (urutan FK safe)
  const tables = [
    'sys_user_role', 'sys_user', 'sys_permission', 'sys_role',
    'sys_print', 'sys_company', 'sys_currency', 'sys_workflow',
    'sys_state', 'sys_action',
    'sys_workspace', 'sys_menu', 'sys_docfield', 'sys_doctype', 'sys_module',
    'sys_translation', 'sys_language'
  ];

  for (const table of tables) {
    if (table !== 'sys_docfield') {
      await knex(`${table}_logs`).del().catch(() => {});
      await knex(`${table}_version`).del().catch(() => {});
    }
    await knex(table).del();
  }


  // 1. Language
  await knex('sys_language').insert([
    { id: 1, code: 'LANG-2607-0001', name: 'English', is_deleted: false, status: 'Saved' },
    { id: 2, code: 'LANG-2607-0002', name: 'Indonesian', is_deleted: false, status: 'Saved' }
  ]);

  // 2. Module
  await knex('sys_module').insert([
    { id: 1, code: 'MODU-2607-0001', name: 'Dashboard', slug: 'dashboard', icon: 'LayoutDashboard', is_deleted: false, status: 'Saved' },
    { id: 2, code: 'MODU-2607-0002', name: 'Core', slug: 'core', icon: 'Cube', is_deleted: false, status: 'Saved' },
    { id: 3, code: 'MODU-2607-0003', name: 'System', slug: 'system', icon: 'Cubes', is_deleted: false, status: 'Saved' },
    { id: 4, code: 'MODU-2607-0004', name: 'Settings', slug: 'settings', icon: 'Settings', is_deleted: false, status: 'Saved' }
  ]);

  // 3. Workflow States (sys_state)
  await knex('sys_state').insert([
    { id: 1, code: 'STAT-2607-0001', name: 'New', style: 'default', is_terminal: false, is_deleted: false, status: 'Saved' },
    { id: 2, code: 'STAT-2607-0002', name: 'Saved', style: 'success', is_terminal: false, is_deleted: false, status: 'Saved' },
    { id: 3, code: 'STAT-2607-0003', name: 'Draft', style: 'warning', is_terminal: false, is_deleted: false, status: 'Saved' },
    { id: 4, code: 'STAT-2607-0004', name: 'Updated', style: 'info', is_terminal: false, is_deleted: false, status: 'Saved' },
    { id: 5, code: 'STAT-2607-0005', name: 'Deleted', style: 'danger', is_terminal: true, is_deleted: false, status: 'Saved' }
  ]);

  // 4. Workflow Actions (sys_action)
  await knex('sys_action').insert([
    { id: 1, code: 'ACTI-2607-0001', name: 'Save', key: 'Save', style: 'primary', is_deleted: false, status: 'Saved' },
    { id: 2, code: 'ACTI-2607-0002', name: 'Unlock', key: 'Unlock', style: 'success', is_deleted: false, status: 'Saved' },
    { id: 3, code: 'ACTI-2607-0003', name: 'Lock', key: 'Lock', style: 'danger', is_deleted: false, status: 'Saved' },
    { id: 4, code: 'ACTI-2607-0004', name: 'Update', key: 'Update', style: 'warning', is_deleted: false, status: 'Saved' },
    { id: 5, code: 'ACTI-2607-0005', name: 'Delete', key: 'Delete', style: 'danger', is_deleted: false, status: 'Saved' }
  ]);

  // 5. Doctype
  const doctypes = [
    { id: 1, code: 'DOCT-2607-0001', name: 'Language', slug: 'language', table_name: 'sys_language', module_id: 1, icon: 'Globe', auto_code: 'LANG-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 2, code: 'DOCT-2607-0002', name: 'Translation', slug: 'translation', table_name: 'sys_translation', module_id: 1, icon: 'Type', auto_code: 'TRAN-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 3, code: 'DOCT-2607-0003', name: 'Doctype', slug: 'doctype', table_name: 'sys_doctype', module_id: 1, icon: 'Database', auto_code: 'DOCT-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 4, code: 'DOCT-2607-0004', name: 'Module', slug: 'module', table_name: 'sys_module', module_id: 1, icon: 'Package', auto_code: 'MODU-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 5, code: 'DOCT-2607-0005', name: 'Workspace', slug: 'workspace', table_name: 'sys_workspace', module_id: 4, icon: 'Layout', auto_code: 'WORK-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 6, code: 'DOCT-2607-0006', name: 'Role', slug: 'role', table_name: 'sys_role', module_id: 1, icon: 'Shield', auto_code: 'ROLE-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 7, code: 'DOCT-2607-0007', name: 'Permission', slug: 'permission', table_name: 'sys_permission', module_id: 1, icon: 'Lock', auto_code: 'PERM-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 8, code: 'DOCT-2607-0008', name: 'User', slug: 'user', table_name: 'sys_user', module_id: 1, icon: 'Users', auto_code: 'USER-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 9, code: 'DOCT-2607-0009', name: 'User Role', slug: 'user_role', table_name: 'sys_user_role', module_id: 1, icon: 'UserCheck', auto_code: 'UROL-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 10, code: 'DOCT-2607-0010', name: 'Company', slug: 'company', table_name: 'sys_company', module_id: 4, icon: 'Building', auto_code: 'COMP-.YY..MM.-.XXXX', is_single: true, is_deleted: false, status: 'Saved' },
    { id: 11, code: 'DOCT-2607-0011', name: 'State', slug: 'state', table_name: 'sys_state', module_id: 4, icon: 'GitCommit', auto_code: 'STAT-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 12, code: 'DOCT-2607-0012', name: 'Action', slug: 'action', table_name: 'sys_action', module_id: 4, icon: 'Play', auto_code: 'ACTI-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 13, code: 'DOCT-2607-0013', name: 'Workflow', slug: 'workflow', table_name: 'sys_workflow', module_id: 4, icon: 'GitMerge', auto_code: 'WKFW-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 14, code: 'DOCT-2607-0014', name: 'Print', slug: 'print', table_name: 'sys_print', module_id: 1, icon: 'Printer', auto_code: 'PRIN-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 15, code: 'DOCT-2607-0015', name: 'Menu', slug: 'menu', table_name: 'sys_menu', module_id: 1, icon: 'Menu', auto_code: 'MENU-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 16, code: 'DOCT-2607-0016', name: 'Welcome', slug: 'welcome', table_name: 'sys_welcome', module_id: 3, icon: 'Home', auto_code: 'WELC-.YY..MM.-.XXXX', is_single: true, is_deleted: false, status: 'Saved' },
    { id: 17, code: 'DOCT-2607-0017', name: 'Currency', slug: 'currency', table_name: 'sys_currency', module_id: 4, icon: 'DollarSign', auto_code: 'CURR-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' },
    { id: 18, code: 'DOCT-2607-0018', name: 'Docfield', slug: 'docfield', table_name: 'sys_docfield', module_id: 1, icon: 'List', auto_code: 'FLD-.YY..MM.-.XXXX', is_deleted: false, status: 'Saved' }
  ];
  await knex('sys_doctype').insert(doctypes);

  // 6. Workflow & Transitions
  let transitionId = 1;
  for (const dt of doctypes) {
    if (dt.is_single) continue;
    
    await knex('sys_workflow').insert([
      {
        id: transitionId++,
        code: `WKFW-2607-${String(transitionId).padStart(4, '0')}`,
        name: `${dt.name}: New → Saved`,
        doctype: dt.table_name,
        from_state: 'New',
        to_state: 'Saved',
        action: 'Save',
        log_status: 'Created',
        allow_roles: JSON.stringify([1]),
        is_deleted: false,
        status: 'Saved'
      },
      {
        id: transitionId++,
        code: `WKFW-2607-${String(transitionId).padStart(4, '0')}`,
        name: `${dt.name}: Saved → Draft`,
        doctype: dt.table_name,
        from_state: 'Saved',
        to_state: 'Draft',
        action: 'Unlock',
        log_status: 'Unlocked',
        allow_roles: JSON.stringify([1]),
        is_deleted: false,
        status: 'Saved'
      },
      {
        id: transitionId++,
        code: `WKFW-2607-${String(transitionId).padStart(4, '0')}`,
        name: `${dt.name}: Draft → Saved`,
        doctype: dt.table_name,
        from_state: 'Draft',
        to_state: 'Saved',
        action: 'Lock',
        log_status: 'Locked',
        allow_roles: JSON.stringify([1]),
        is_deleted: false,
        status: 'Saved'
      },
      {
        id: transitionId++,
        code: `WKFW-2607-${String(transitionId).padStart(4, '0')}`,
        name: `${dt.name}: Draft → Saved`,
        doctype: dt.table_name,
        from_state: 'Draft',
        to_state: 'Saved',
        action: 'Update',
        log_status: 'Updated',
        allow_roles: JSON.stringify([1]),
        is_deleted: false,
        status: 'Saved'
      },
      {
        id: transitionId++,
        code: `WKFW-2607-${String(transitionId).padStart(4, '0')}`,
        name: `${dt.name}: Draft → Deleted`,
        doctype: dt.table_name,
        from_state: 'Draft',
        to_state: 'Deleted',
        action: 'Delete',
        log_status: 'Deleted',
        allow_roles: JSON.stringify([1]),
        is_deleted: false,
        status: 'Saved'
      }
    ]);
  }

  // 7. Roles
  await knex('sys_role').insert([
    { id: 1, code: 'ROLE-2607-0001', name: 'System Administrator', is_deleted: false, status: 'Saved' },
    { id: 2, code: 'ROLE-2607-0002', name: 'User', is_deleted: false, status: 'Saved' }
  ]);

  // 8. User
  const passwordHash = await bcrypt.hash('Admin123', 10);
  await knex('sys_user').insert([
    {
      id: 1,
      code: 'USER-2607-0001',
      name: 'Administrator',
      email: 'admin@framee.com',
      password_hash: passwordHash,
      is_system_user: true,
      is_deleted: false,
      status: 'Saved'
    }
  ]);

  await knex('sys_user_role').insert([
    { user_id: 1, role_id: 1, is_deleted: false, status: 'Saved' }
  ]);

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
  await knex('sys_permission').insert(permissionsData);

  // 9. Menu & Workspace
  await knex('sys_menu').insert([
    {
      id: 1,
      code: 'MENU-2607-0001',
      name: 'User',
      doctype: 'sys_user',
      is_deleted: false,
      status: 'Saved'
    },
    {
      id: 2,
      code: 'MENU-2607-0002',
      name: 'Menu',
      doctype: 'sys_menu',
      is_deleted: false,
      status: 'Saved'
    }
  ]);

  await knex('sys_workspace').insert([
    { id: 1, code: 'WORK-2607-0001', name: 'System', module_id: 3, doctype: 'sys_language', sort_order: 301, is_deleted: false, status: 'Saved' },
    { id: 2, code: 'WORK-2607-0002', name: 'System', module_id: 3, doctype: 'sys_translation', sort_order: 302, is_deleted: false, status: 'Saved' },
    { id: 3, code: 'WORK-2607-0003', name: 'System', module_id: 3, doctype: 'sys_module', sort_order: 303, is_deleted: false, status: 'Saved' },
    { id: 4, code: 'WORK-2607-0004', name: 'Settings', module_id: 4, doctype: 'sys_workspace', sort_order: 405, is_deleted: false, status: 'Saved' },
    { id: 5, code: 'WORK-2607-0005', name: 'System', module_id: 3, doctype: 'sys_role', sort_order: 304, is_deleted: false, status: 'Saved' },
    { id: 6, code: 'WORK-2607-0006', name: 'System', module_id: 4, doctype: 'sys_permission', sort_order: 404, is_deleted: false, status: 'Saved' },
    { id: 7, code: 'WORK-2607-0007', name: 'System', module_id: 4, doctype: 'sys_user', sort_order: 402, is_deleted: false, status: 'Saved' },
    { id: 8, code: 'WORK-2607-0008', name: 'System', module_id: 4, doctype: 'sys_user_role', sort_order: 403, is_deleted: false, status: 'Saved' },
    { id: 9, code: 'WORK-2607-0009', name: 'System', module_id: 2, doctype: 'sys_print', sort_order: 203, is_deleted: false, status: 'Saved' },
    { id: 11, code: 'WORK-2607-0011', name: 'Core', module_id: 2, doctype: 'sys_doctype', sort_order: 201, is_deleted: false, status: 'Saved' },
    { id: 12, code: 'WORK-2607-0012', name: 'Core', module_id: 2, doctype: 'sys_docfield', sort_order: 202, is_deleted: false, status: 'Saved' },
    { id: 13, code: 'WORK-2607-0013', name: 'Dashboard', module_id: 1, doctype: 'sys_welcome', sort_order: 101, is_deleted: false, status: 'Saved' },
    { id: 14, code: 'WORK-2607-0014', name: 'Settings', module_id: 4, doctype: 'sys_company', sort_order: 401, is_deleted: false, status: 'Saved' },
    { id: 15, code: 'WORK-2607-0015', name: 'Settings', module_id: 2, doctype: 'sys_state', sort_order: 204, is_deleted: false, status: 'Saved' },
    { id: 16, code: 'WORK-2607-0016', name: 'Settings', module_id: 2, doctype: 'sys_action', sort_order: 205, is_deleted: false, status: 'Saved' },
    { id: 17, code: 'WORK-2607-0017', name: 'Settings', module_id: 2, doctype: 'sys_workflow', sort_order: 206, is_deleted: false, status: 'Saved' },
    { id: 18, code: 'WORK-2607-0018', name: 'Settings', module_id: 3, doctype: 'sys_currency', sort_order: 305, is_deleted: false, status: 'Saved' }
  ]);
  
  // 10. Docfields (Full population for tables 1-8)
  const docfields = [];
  
  // Helper to push fields
  const pushFields = (table_name, fields) => {
    // Prepend system ID column to all tables in sys_docfield seed
    const allFields = [{ fieldname: 'id', label: 'ID', fieldtype: 'Int', in_list: true }, ...fields];

    allFields.forEach((f, idx) => {
      let is_hidden = f.is_hidden || false;
      let in_list = f.in_list;
      let in_filter = f.in_filter;
      
      if (f.fieldname === 'id') {
        is_hidden = f.is_hidden ?? true;
        in_list = f.in_list ?? true;
        in_filter = f.in_filter ?? true;
      } else if (f.fieldname === 'code' || f.fieldname === 'name') {
        in_list = f.in_list ?? true;
        in_filter = f.in_filter ?? true;
      } else if (f.fieldname === 'is_deleted' || f.fieldname === 'status') {
        is_hidden = f.is_hidden ?? true;
        in_list = f.in_list ?? false;
        in_filter = f.in_filter ?? false;
      } else {
        in_list = f.in_list ?? false;
        in_filter = f.in_filter ?? false;
      }

      docfields.push({
        doctype: table_name,
        label: f.label || f.fieldname,
        fieldname: f.fieldname,
        fieldtype: f.fieldtype || 'Text',
        options: f.options || null,
        is_required: f.reqd || false,
        in_list: in_list,
        in_filter: in_filter,
        in_search: f.in_search || false,
        is_hidden: is_hidden,
        sort_order: idx
      });
    });
  };

  // 1. sys_language
  pushFields('sys_language', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 2. sys_translation
  pushFields('sys_translation', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'language_id', label: 'Language', fieldtype: 'Link', options: 'sys_language', reqd: true },
    { fieldname: 'translated_text', label: 'Translated Text', fieldtype: 'Text', reqd: true },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 3. sys_doctype
  pushFields('sys_doctype', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'slug', label: 'Slug', fieldtype: 'Data', reqd: true },
    { fieldname: 'table_name', label: 'Table Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'module_id', label: 'Module', fieldtype: 'Link', options: 'sys_module' },
    { fieldname: 'icon', label: 'Icon', fieldtype: 'Data', in_list: false },
    { fieldname: 'auto_code', label: 'Auto Code', fieldtype: 'Data' },
    { fieldname: 'type', label: 'Type', fieldtype: 'Select', options: 'Standard,Child Table,Single,Page', default_value: 'Standard' },
    { fieldname: 'parent_id', label: 'Parent DocType', fieldtype: 'Link', options: 'sys_doctype' },
    { fieldname: 'is_tree', label: 'Is Tree', fieldtype: 'Check' },
    { fieldname: 'is_single', label: 'Is Single', fieldtype: 'Check' },
    { fieldname: 'fields', label: 'Fields', fieldtype: 'Table', options: 'sys_docfield' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 4. sys_module
  pushFields('sys_module', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'slug', label: 'Slug', fieldtype: 'Data', reqd: true },
    { fieldname: 'icon', label: 'Icon', fieldtype: 'Data', in_list: false },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 5. sys_menu
  pushFields('sys_menu', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Link', options: 'sys_doctype' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 5.5 sys_workspace
  pushFields('sys_workspace', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'module_id', label: 'Module', fieldtype: 'Link', options: 'sys_module' },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Data' },
    { fieldname: 'sort_order', label: 'Sort Order', fieldtype: 'Int', in_list: false },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 6. sys_role
  pushFields('sys_role', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'parent_role_id', label: 'Parent Role', fieldtype: 'Link', options: 'sys_role' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 7. sys_permission
  pushFields('sys_permission', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'role_id', label: 'Role', fieldtype: 'Link', options: 'sys_role', reqd: true },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Link', options: 'sys_doctype', reqd: true },
    { fieldname: 'can_read', label: 'Can Read', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_update', label: 'Can Update', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_create', label: 'Can Create', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_delete', label: 'Can Delete', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_lock', label: 'Can Lock', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_unlock', label: 'Can Unlock', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_import', label: 'Can Import', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_export', label: 'Can Export', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_print', label: 'Can Print', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_share', label: 'Can Share', fieldtype: 'Check', in_list: false },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 8. sys_user
  pushFields('sys_user', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true, is_hidden: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'email', label: 'Email', fieldtype: 'Data', reqd: true },
    { fieldname: 'password_hash', label: 'Password', fieldtype: 'Password', in_list: false },
    { fieldname: 'pin_hash', label: 'PIN', fieldtype: 'Password', in_list: false },
    { fieldname: 'google_id', label: 'Google ID', fieldtype: 'Data', in_list: false, is_hidden: true },
    { fieldname: 'avatar_url', label: 'Avatar', fieldtype: 'Data', in_list: false, is_hidden: true },
    { fieldname: 'phone', label: 'Phone', fieldtype: 'Data' },
    { fieldname: 'language_id', label: 'Language', fieldtype: 'Link', options: 'sys_language' },
    { fieldname: 'timezone', label: 'Timezone', fieldtype: 'Select', options: 'Asia/Jakarta,Asia/Singapore,Asia/Kuala_Lumpur,Asia/Tokyo,UTC,Europe/London,America/New_York,America/Los_Angeles', in_list: false },
    { fieldname: 'date_format', label: 'Date Format', fieldtype: 'Select', options: 'DD/MM/YYYY,MM/DD/YYYY,YYYY-MM-DD,DD-MM-YYYY', in_list: false },
    { fieldname: 'is_system_user', label: 'Is System User', fieldtype: 'Check' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_user_role
  pushFields('sys_user_role', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: false },
    { fieldname: 'user_id', label: 'User', fieldtype: 'Link', options: 'sys_user', reqd: true },
    { fieldname: 'role_id', label: 'Role', fieldtype: 'Link', options: 'sys_role', reqd: true },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_welcome
  pushFields('sys_welcome', [
    { fieldname: 'title', label: 'Welcome Title', fieldtype: 'Data', reqd: true },
    { fieldname: 'message', label: 'Welcome Message', fieldtype: 'Text' },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false }
  ]);

  // sys_company
  pushFields('sys_company', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'currency_id', label: 'Currency', fieldtype: 'Link', options: 'sys_currency' },
    { fieldname: 'timezone', label: 'Timezone', fieldtype: 'Select', options: 'Asia/Jakarta\nUTC\nAmerica/New_York\nEurope/London\nAustralia/Sydney' },
    { fieldname: 'date_format', label: 'Date Format', fieldtype: 'Select', options: 'dd/MM/yyyy\nMM/dd/yyyy\nyyyy-MM-dd' },
    { fieldname: 'enable_registration', label: 'Enable Registration', fieldtype: 'Check' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_currency
  pushFields('sys_currency', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'symbol', label: 'Symbol', fieldtype: 'Data' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_state
  pushFields('sys_state', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'style', label: 'Style', fieldtype: 'Data' },
    { fieldname: 'is_terminal', label: 'Is Terminal', fieldtype: 'Check' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_action
  pushFields('sys_action', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'key', label: 'Key', fieldtype: 'Data', reqd: true },
    { fieldname: 'style', label: 'Style', fieldtype: 'Data' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_workflow
  pushFields('sys_workflow', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Data', reqd: true },
    { fieldname: 'initial_state', label: 'Initial State', fieldtype: 'Data', reqd: true },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);
  
  // sys_workflow_transition 
  pushFields('sys_workflow_transition', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data' },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Data' },
    { fieldname: 'from_state', label: 'From State', fieldtype: 'Data', reqd: true },
    { fieldname: 'to_state', label: 'To State', fieldtype: 'Data', reqd: true },
    { fieldname: 'action', label: 'Action', fieldtype: 'Data', reqd: true },
    { fieldname: 'allow_roles', label: 'Allow Roles', fieldtype: 'Data' },
    { fieldname: 'sort_order', label: 'Sort Order', fieldtype: 'Int' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // sys_print
  pushFields('sys_print', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Data', reqd: true },
    { fieldname: 'html_template', label: 'HTML Template', fieldtype: 'Text' },
    { fieldname: 'is_default', label: 'Is Default', fieldtype: 'Check' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 9. sys_docfield
  pushFields('sys_docfield', [
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Link', options: 'sys_doctype', reqd: true },
    { fieldname: 'label', label: 'Label', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'fieldname', label: 'Fieldname', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'fieldtype', label: 'Fieldtype', fieldtype: 'Select', options: 'Data,Int,Float,Currency,Check,Select,Link,Text,Password,Date,Datetime', reqd: true },
    { fieldname: 'options', label: 'Options', fieldtype: 'Data' },
    { fieldname: 'placeholder', label: 'Placeholder', fieldtype: 'Data' },
    { fieldname: 'doc_url', label: 'Doc URL', fieldtype: 'Data' },
    { fieldname: 'width', label: 'Width', fieldtype: 'Data' },
    { fieldname: 'icon', label: 'Icon', fieldtype: 'Data' },
    { fieldname: 'default_value', label: 'Default Value', fieldtype: 'Data' },
    { fieldname: 'is_required', label: 'Is Required', fieldtype: 'Check' },
    { fieldname: 'is_read_only', label: 'Is Read Only', fieldtype: 'Check' },
    { fieldname: 'is_hidden', label: 'Is Hidden', fieldtype: 'Check' },
    { fieldname: 'is_unique', label: 'Is Unique', fieldtype: 'Check' },
    { fieldname: 'is_indexed', label: 'Is Indexed', fieldtype: 'Check' },
    { fieldname: 'in_list', label: 'In List', fieldtype: 'Check' },
    { fieldname: 'in_filter', label: 'In Filter', fieldtype: 'Check' },
    { fieldname: 'in_search', label: 'In Search', fieldtype: 'Check' },
    { fieldname: 'sort_order', label: 'Sort Order', fieldtype: 'Int' }
  ]);

  await knex('sys_docfield').insert(docfields);

  // 11. Translations
  const idDictionary = {
    'Save': 'Simpan',
    'Update': 'Perbarui',
    'Timezone': 'Zona Waktu',
    'Date Format': 'Format Tanggal',
    'Action': 'Aksi',
    'Bulk Action': 'Tindakan Massal',
    'No records found.': 'Tidak ada data ditemukan.',
    'Loading data...': 'Memuat data...',
    'No activity yet.': 'Belum ada aktivitas.',
    'Loading activity...': 'Memuat aktivitas...',
    'Currency': 'Mata Uang',
    'Company': 'Perusahaan',
    'Dashboard': 'Beranda',
    'Symbol': 'Simbol',
    'System': 'Sistem',
    'Core': 'Inti',
    'Language': 'Bahasa',
    'Translation': 'Terjemahan',
    'Doctype': 'Tipe Dokumen',
    'Module': 'Modul',
    'Workspace': 'Ruang Kerja',
    'Role': 'Peran',
    'Permission': 'Izin',
    'User': 'Pengguna',
    'User Role': 'Peran Pengguna',
    'Settings': 'Pengaturan',
    'Workflow State': 'Status Alur Kerja',
    'Workflow Action': 'Aksi Alur Kerja',
    'Workflow': 'Alur Kerja',
    'Workflow Transition': 'Transisi Alur Kerja',
    'Print': 'Cetak',
    'Code': 'Kode',
    'Name': 'Nama',
    'Is Deleted': 'Dihapus',
    'Status': 'Status',
    'Translated Text': 'Teks Terjemahan',
    'Table Name': 'Nama Tabel',
    'Icon': 'Ikon',
    'Auto Code': 'Kode Otomatis',
    'Is Single': 'Tunggal',
    'Type': 'Tipe',
    'Target': 'Target',
    'Sort Order': 'Urutan',
    'Parent Role': 'Peran Induk',
    'Can Read': 'Bisa Baca',
    'Can Write': 'Bisa Tulis',
    'Can Create': 'Bisa Buat',
    'Can Delete': 'Bisa Hapus',
    'Can Submit': 'Bisa Submit',
    'Can Cancel': 'Bisa Batal',
    'Can Import': 'Bisa Impor',
    'Can Export': 'Bisa Ekspor',
    'Can Print': 'Bisa Cetak',
    'Can Share': 'Bisa Bagikan',
    'Email': 'Email',
    'Password': 'Kata Sandi',
    'PIN': 'PIN',
    'Google ID': 'Google ID',
    'Avatar': 'Avatar',
    'Phone': 'Telepon',
    'Timezone': 'Zona Waktu',
    'Date Format': 'Format Tanggal',
    'Is System User': 'Pengguna Sistem',
    'Draft': 'Draf',
    'Submitted': 'Disubmit',
    'Saved': 'Disimpan',
    'Active': 'Aktif',
    'Submit': 'Submit',
    'Cancel': 'Batal',

    'Delete Record': 'Hapus Data',
    'Are you sure you want to delete this record?': 'Apakah Anda yakin ingin menghapus data ini?',
    'Failed to delete record': 'Gagal menghapus data',
    'Delete Selected': 'Hapus yang Dipilih',
    'Record saved successfully!': 'Data berhasil disimpan!',
    'Welcome': 'Selamat Datang',
    'Failed to save record.': 'Gagal menyimpan data.',
    'Unlock Record': 'Buka Kunci Data',
    'Are you sure you want to unlock this record to Draft?': 'Apakah Anda yakin ingin membuka kunci data ini menjadi Draf?',
    'Failed to unlock record': 'Gagal membuka kunci data',
    'Lock Record': 'Kunci Data',
    'Are you sure you want to lock this record to Saved?': 'Apakah Anda yakin ingin mengunci data ini menjadi Tersimpan?',
    'Failed to lock record': 'Gagal mengunci data',
    'Confirm': 'Konfirmasi',
    'Saving...': 'Menyimpan...',
    'Key': 'Kunci',
    'Style': 'Gaya Tampilan',
    'Write a comment...': 'Tulis komentar...',
    'Send': 'Kirim',
    'Like': 'Suka',
    'Unlike': 'Batal Suka',
    'Loading view...': 'Memuat tampilan...',
    'Cancelled': 'Dibatalkan',
    'Liked': 'Menyukai',
    'Unliked': 'Batal Menyukai',
    'Commented': 'Berkomentar',
    'Loading...': 'Memuat...',
    'Import CSV': 'Impor CSV',
    'Export XLSX': 'Ekspor XLSX',
    'Export PDF': 'Ekspor PDF',
    'Fields View': 'Tampilan Kolom',
    'Fields Filter': "Filter Kolom",
    'Fields View Configuration': "Konfigurasi Tampilan Kolom",
    'Fields Filter Configuration': "Konfigurasi Filter Kolom",
    'Select All': "Pilih Semua",
    'Print Selected': "Cetak yang Dipilih",
    'You are trying to print more than 5 records. This will open multiple tabs. Continue?': "Anda mencoba mencetak lebih dari 5 data. Ini akan membuka banyak tab. Lanjutkan?",
    'Cannot delete Submitted or Cancelled records.': "Tidak dapat menghapus data yang sudah Disubmit atau Dibatalkan.",
    'Successfully deleted': "Berhasil menghapus",
    'records.': "data.",
    'records, but': "data, tetapi",
    'failed.': "gagal.",
    'Are you sure you want to delete these records?': "Apakah Anda yakin ingin menghapus data-data ini?",
    'Progress': "Progres",
    'Deleting...': "Menghapus..."
  };

  const termsToTranslate = new Set([

    'Delete Record',
    'Are you sure you want to delete this record?',
    'Failed to delete record',
    'Delete Selected',
    'Record saved successfully!',
    'Save',
    'Update',
    'Action',
    'Bulk Action',
    'No records found.',
    'Loading data...',
    'No activity yet.',
    'Loading activity...',
    'Welcome',
    'Failed to save record.',
    'Unlock Record',
    'Are you sure you want to unlock this record to Draft?',
    'Failed to unlock record',
    'Lock Record',
    'Are you sure you want to lock this record to Saved?',
    'Failed to lock record',
    'Confirm',
    'Saving...',
    'Key',
    'Style',
    'Write a comment...',
    'Send',
    'Like',
    'Unlike',
    'Loading view...',
    'Cancelled',
    'Liked',
    'Unliked',
    'Commented',
    'Loading...',
    'Import CSV',
    'Export XLSX',
    'Export PDF',
    'Fields View',
    'Fields Filter',
    'Fields View Configuration',
    'Fields Filter Configuration',
    'Select All',
    'Print Selected',
    'You are trying to print more than 5 records. This will open multiple tabs. Continue?',
    'Cannot delete Submitted or Cancelled records.',
    'Successfully deleted',
    'records.',
    'records, but',
    'failed.',
    'Are you sure you want to delete these records?',
    'Progress',
    'Deleting...'
  ]);
  
  // Extract from Module
  const modules = await knex('sys_module').select('name');
  modules.forEach(m => termsToTranslate.add(m.name));
  
  // Extract from Doctype
  const dts = await knex('sys_doctype').select('name');
  dts.forEach(d => termsToTranslate.add(d.name));
  
  // Extract from Docfield
  const dfs = await knex('sys_docfield').select('label');
  dfs.forEach(d => termsToTranslate.add(d.label));
  
  // Extract from Workflow State
  const states = await knex('sys_state').select('name');
  states.forEach(s => termsToTranslate.add(s.name));
  
  // Extract from Workflow Action
  const actions = await knex('sys_action').select('name');
  actions.forEach(a => termsToTranslate.add(a.name));

  const translations = [];
  let translationCounter = 1;
  for (const term of termsToTranslate) {
    if (idDictionary[term]) {
      translations.push({
        code: `TRAN-2607-${String(translationCounter).padStart(4, '0')}`,
        name: term, // source text
        language_id: 2, // Indonesian
        translated_text: idDictionary[term],
        is_deleted: false,
        status: 'Saved'
      });
      translationCounter++;
    }
  }

  if (translations.length > 0) {
    await knex('sys_translation').insert(translations);
  }
}
