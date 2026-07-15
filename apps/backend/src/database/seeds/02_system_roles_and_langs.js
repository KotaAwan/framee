export async function seed(knex) {
  const TENANT_ID = '2607-00001';
  const ADMIN_USER_ID = '2607-00001';
  const SUPER_ADMIN_ROLE_ID = '2607-00001'; // using same sequence pattern for hardcoded system role

  // 1. Clear existing
  await knex('sys_translation').del();
  await knex('sys_language').del();
  await knex('sys_user_role').del();
  await knex('sys_permission').del();
  await knex('sys_role').del();

  // 2. Add Role
  await knex('sys_role').insert({
    id: SUPER_ADMIN_ROLE_ID,
    tenant_id: TENANT_ID,
    name: 'Super Admin',
    label: 'Super Administrator',
    is_system_role: true,
    status: 'Active',
    created_at: new Date(),
    updated_at: new Date()
  });

  // 3. Assign Role to Admin
  await knex('sys_user_role').insert({
    id: '2607-00001',
    tenant_id: TENANT_ID,
    user_id: ADMIN_USER_ID,
    role_id: SUPER_ADMIN_ROLE_ID
  });

  // 4. Grant Permissions to Super Admin
  const doctypesToGrant = ['sys_user', 'sys_role', 'sys_module', 'sys_user_role', 'sys_permission', 'sys_doctype'];
  const permissions = doctypesToGrant.map((doctype, idx) => ({
    id: `2607-0000${idx + 1}`,
    tenant_id: TENANT_ID,
    role_id: SUPER_ADMIN_ROLE_ID,
    doctype,
    can_read: true,
    can_write: true,
    can_create: true,
    can_delete: true,
    can_submit: true,
    can_cancel: true,
    can_export: true,
    can_share: true,
    status: 'Active',
    created_at: new Date(),
    updated_at: new Date()
  }));

  await knex('sys_permission').insert(permissions);

  // 5. Add Languages
  await knex('sys_language').insert([
    { id: '2607-00001', tenant_id: TENANT_ID, code: 'EN', name: 'English', is_active: true },
    { id: '2607-00002', tenant_id: TENANT_ID, code: 'ID', name: 'Bahasa Indonesia', is_active: true }
  ]);

  // 6. Add Translations (ID)
  // Base labels for UI pages
  const labelsToTranslate = {
    'Login': 'Masuk',
    'Email Address': 'Alamat Email',
    'Password': 'Kata Sandi',
    'Sign In': 'Masuk',
    'Home': 'Beranda',
    'User': 'Pengguna',
    'Sys User': 'Pengguna Sistem',
    'Role': 'Peran',
    'Sys Role': 'Peran Sistem',
    'Module': 'Modul',
    'Sys Module': 'Modul Sistem',
    'DocType': 'Tipe Dokumen',
    'Sys Doctype': 'Tipe Dokumen Sistem',
    'Add New': 'Tambah Baru',
    'Save': 'Simpan',
    'Search...': 'Cari...',
    'Cancel': 'Batal',
    'Delete': 'Hapus',
    'Full Name': 'Nama Lengkap',
    'Language': 'Bahasa',
    'Timezone': 'Zona Waktu',
    'Date Format': 'Format Tanggal',
    'Is System User': 'Pengguna Sistem'
  };

  const translations = Object.entries(labelsToTranslate).map(([source, translated], idx) => ({
    id: `2607-000${(idx + 1).toString().padStart(2, '0')}`,
    tenant_id: TENANT_ID,
    language_code: 'ID',
    source_text: source,
    translated_text: translated
  }));

  await knex('sys_translation').insert(translations);
}
