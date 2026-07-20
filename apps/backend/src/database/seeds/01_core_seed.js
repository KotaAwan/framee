import bcrypt from 'bcryptjs';

export async function seed(knex) {
  // Clear existing
  const tables = [
    'sys_user_role', 'sys_user', 'sys_permission', 'sys_role',
    'sys_print', 'sys_settings', 'sys_workflow_transition', 
    'sys_workflow', 'sys_workflow_action', 'sys_workflow_state',
    'sys_workspace', 'sys_menu', 'sys_docfield', 'sys_doctype', 'sys_module',
    'sys_translation', 'sys_language'
  ];

  for (const table of tables) {
    if (table !== 'sys_docfield') {
      await knex(`${table}_logs`).del();
      await knex(`${table}_version`).del();
    }
    await knex(table).del();
  }

  // 1. Language
  await knex('sys_language').insert([
    { id: 1, code: 'LANG-2607-0001', name: 'English', is_deleted: false, status: 'Active' },
    { id: 2, code: 'LANG-2607-0002', name: 'Indonesian', is_deleted: false, status: 'Active' }
  ]);

  // 2. Module
  await knex('sys_module').insert([
    { id: 1, code: 'MODU-2607-0001', name: 'System', slug: 'system', icon: 'Settings', is_deleted: false, status: 'Active' },
    { id: 2, code: 'MODU-2607-0002', name: 'Core', slug: 'core', icon: 'Database', is_deleted: false, status: 'Active' }
  ]);

  // 3. Workflow States
  await knex('sys_workflow_state').insert([
    { id: 1, code: 'WSTA-2607-0001', name: 'Draft', style: 'default', is_terminal: false, is_deleted: false, status: 'Active' },
    { id: 2, code: 'WSTA-2607-0002', name: 'Submitted', style: 'success', is_terminal: true, is_deleted: false, status: 'Active' },
    { id: 3, code: 'WSTA-2607-0003', name: 'Active', style: 'primary', is_terminal: true, is_deleted: false, status: 'Active' }
  ]);

  // 4. Workflow Actions
  await knex('sys_workflow_action').insert([
    { id: 1, code: 'WACT-2607-0001', name: 'Submit', key: 'submit', style: 'primary', is_deleted: false, status: 'Active' },
    { id: 2, code: 'WACT-2607-0002', name: 'Cancel', key: 'cancel', style: 'danger', is_deleted: false, status: 'Active' }
  ]);

  // 5. Doctype
  const doctypes = [
    { id: 1, code: 'DOCT-2607-0001', name: 'Language', slug: 'sys_language', table_name: 'sys_language', module_id: 1, icon: 'Globe', auto_code: 'LANG-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 2, code: 'DOCT-2607-0002', name: 'Translation', slug: 'sys_translation', table_name: 'sys_translation', module_id: 1, icon: 'Type', auto_code: 'TRAN-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 3, code: 'DOCT-2607-0003', name: 'Doctype', slug: 'sys_doctype', table_name: 'sys_doctype', module_id: 1, icon: 'Database', auto_code: 'DOCT-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 4, code: 'DOCT-2607-0004', name: 'Module', slug: 'sys_module', table_name: 'sys_module', module_id: 1, icon: 'Package', auto_code: 'MODU-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 5, code: 'DOCT-2607-0005', name: 'Workspace', slug: 'sys_workspace', table_name: 'sys_workspace', module_id: 1, icon: 'Layout', auto_code: 'WORK-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 6, code: 'DOCT-2607-0006', name: 'Role', slug: 'sys_role', table_name: 'sys_role', module_id: 1, icon: 'Shield', auto_code: 'ROLE-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 7, code: 'DOCT-2607-0007', name: 'Permission', slug: 'sys_permission', table_name: 'sys_permission', module_id: 1, icon: 'Lock', auto_code: 'PERM-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 8, code: 'DOCT-2607-0008', name: 'User', slug: 'sys_user', table_name: 'sys_user', module_id: 1, icon: 'Users', auto_code: 'USER-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 9, code: 'DOCT-2607-0009', name: 'User Role', slug: 'sys_user_role', table_name: 'sys_user_role', module_id: 1, icon: 'UserCheck', auto_code: 'UROL-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 10, code: 'DOCT-2607-0010', name: 'Settings', slug: 'sys_settings', table_name: 'sys_settings', module_id: 1, icon: 'Settings', auto_code: 'SETI-.YY..MM.-.XXXX', is_single: true, is_deleted: false, status: 'Active' },
    { id: 11, code: 'DOCT-2607-0011', name: 'Workflow State', slug: 'sys_workflow_state', table_name: 'sys_workflow_state', module_id: 1, icon: 'GitCommit', auto_code: 'WSTA-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 12, code: 'DOCT-2607-0012', name: 'Workflow Action', slug: 'sys_workflow_action', table_name: 'sys_workflow_action', module_id: 1, icon: 'Play', auto_code: 'WACT-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 13, code: 'DOCT-2607-0013', name: 'Workflow', slug: 'sys_workflow', table_name: 'sys_workflow', module_id: 1, icon: 'GitMerge', auto_code: 'WORK-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 14, code: 'DOCT-2607-0014', name: 'Workflow Transition', slug: 'sys_workflow_transition', table_name: 'sys_workflow_transition', module_id: 1, icon: 'GitPullRequest', auto_code: 'WTRA-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 15, code: 'DOCT-2607-0015', name: 'Print', slug: 'sys_print', table_name: 'sys_print', module_id: 1, icon: 'Printer', auto_code: 'PRIN-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },
    { id: 16, code: 'DOCT-2607-0016', name: 'Menu', slug: 'sys_menu', table_name: 'sys_menu', module_id: 1, icon: 'Menu', auto_code: 'MENU-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' }
  ];
  await knex('sys_doctype').insert(doctypes);

  // 6. Workflow & Transitions
  for (const dt of doctypes) {
    if (dt.is_single) continue;
    
    await knex('sys_workflow').insert({
      id: dt.id,
      code: `WORK-2607-${String(dt.id).padStart(4, '0')}`,
      name: `Standard ${dt.name} Workflow`,
      doctype: dt.table_name, // table_name string instead of id
      initial_state: 'Draft', // Draft
      is_deleted: false,
      status: 'Active'
    });

    await knex('sys_workflow_transition').insert([
      {
        doctype: dt.table_name, // string instead of id
        from_state: 'Draft', // Draft
        to_state: 'Submitted', // Submitted
        action: 'Submit', // Submit
        allow_roles: JSON.stringify([1]), // System Administrator role ID
        is_deleted: false,
        status: 'Active'
      },
      {
        doctype: dt.table_name,
        from_state: 'Submitted', // Submitted
        to_state: 'Draft', // Draft
        action: 'Cancel', // Cancel
        allow_roles: JSON.stringify([1]),
        is_deleted: false,
        status: 'Active'
      }
    ]);
  }

  // 7. Roles
  await knex('sys_role').insert([
    { id: 1, code: 'ROLE-2607-0001', name: 'System Administrator', is_deleted: false, status: 'Active' },
    { id: 2, code: 'ROLE-2607-0002', name: 'User', is_deleted: false, status: 'Active' }
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
      status: 'Submitted' // Starts as submitted
    }
  ]);

  await knex('sys_user_role').insert([
    { user_id: 1, role_id: 1, is_deleted: false, status: 'Active' }
  ]);

  await knex('sys_permission').insert([
    {
      id: 1,
      code: 'PERM-2607-0001',
      name: 'Admin - User',
      role_id: 1,
      doctype: 'sys_user',
      can_read: true,
      can_write: true,
      can_create: true,
      can_delete: true,
      can_submit: true,
      can_cancel: true,
      can_import: true,
      can_export: true,
      can_print: true,
      can_share: true,
      is_deleted: false,
      status: 'Active'
    }
  ]);

  // 9. Menu & Workspace
  await knex('sys_menu').insert([
    {
      id: 1,
      code: 'MENU-2607-0001',
      name: 'User',
      doctype: 'sys_user',
      is_deleted: false,
      status: 'Active'
    },
    {
      id: 2,
      code: 'MENU-2607-0002',
      name: 'Menu',
      doctype: 'sys_menu',
      is_deleted: false,
      status: 'Active'
    }
  ]);

  await knex('sys_workspace').insert([
    {
      id: 1,
      code: 'WORK-2607-0001',
      name: 'Admin User Menu',
      role_id: 1,
      menu_id: 1,
      sort_order: 1,
      is_deleted: false,
      status: 'Active'
    },
    {
      id: 2,
      code: 'WORK-2607-0002',
      name: 'Admin Menu Management',
      role_id: 1,
      menu_id: 2,
      sort_order: 2,
      is_deleted: false,
      status: 'Active'
    }
  ]);
  
  // 10. Docfields (Full population for tables 1-8)
  const docfields = [];
  
  // Helper to push fields
  const pushFields = (table_name, fields) => {
    fields.forEach((f, idx) => {
      let is_hidden = f.is_hidden || false;
      let in_list = f.in_list;
      let in_filter = f.in_filter;
      
      if (f.fieldname === 'id') {
        is_hidden = f.is_hidden ?? true;
        in_list = f.in_list ?? false;
        in_filter = f.in_filter ?? false;
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
        sort_order: idx + 1
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
    { fieldname: 'is_single', label: 'Is Single', fieldtype: 'Check' },
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
    { fieldname: 'role_id', label: 'Role', fieldtype: 'Link', options: 'sys_role' },
    { fieldname: 'menu_id', label: 'Menu', fieldtype: 'Link', options: 'sys_menu' },
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
    { fieldname: 'can_write', label: 'Can Write', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_create', label: 'Can Create', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_delete', label: 'Can Delete', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_submit', label: 'Can Submit', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_cancel', label: 'Can Cancel', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_import', label: 'Can Import', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_export', label: 'Can Export', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_print', label: 'Can Print', fieldtype: 'Check', in_list: false },
    { fieldname: 'can_share', label: 'Can Share', fieldtype: 'Check', in_list: false },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  // 8. sys_user
  pushFields('sys_user', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Data', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Data', reqd: true, in_search: true },
    { fieldname: 'email', label: 'Email', fieldtype: 'Data', reqd: true },
    { fieldname: 'password_hash', label: 'Password', fieldtype: 'Password', in_list: false },
    { fieldname: 'pin_hash', label: 'PIN', fieldtype: 'Password', in_list: false },
    { fieldname: 'google_id', label: 'Google ID', fieldtype: 'Data', in_list: false },
    { fieldname: 'avatar_url', label: 'Avatar', fieldtype: 'Data', in_list: false },
    { fieldname: 'phone', label: 'Phone', fieldtype: 'Data' },
    { fieldname: 'language_id', label: 'Language', fieldtype: 'Link', options: 'sys_language' },
    { fieldname: 'timezone', label: 'Timezone', fieldtype: 'Data', in_list: false },
    { fieldname: 'date_format', label: 'Date Format', fieldtype: 'Data', in_list: false },
    { fieldname: 'is_system_user', label: 'Is System User', fieldtype: 'Check' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Data' }
  ]);

  await knex('sys_docfield').insert(docfields);

  // 11. Translations
  const idDictionary = {
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
    'Active': 'Aktif',
    'Submit': 'Submit',
    'Cancel': 'Batal'
  };

  const termsToTranslate = new Set();
  
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
  const states = await knex('sys_workflow_state').select('name');
  states.forEach(s => termsToTranslate.add(s.name));
  
  // Extract from Workflow Action
  const actions = await knex('sys_workflow_action').select('name');
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
        status: 'Active'
      });
      translationCounter++;
    }
  }

  if (translations.length > 0) {
    await knex('sys_translation').insert(translations);
  }
}
