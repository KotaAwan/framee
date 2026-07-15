import { v4 as uuidv4 } from 'uuid';

export async function seed(knex) {
  const TENANT_SYSTEM = '2607-00001'; // Global System Tenant

  // Fixed UUIDs for System Modules
  const SYSTEM_MOD_ID = '2607-00001';
  const SETTINGS_MOD_ID = '2607-00002';
  const DASHBOARD_MOD_ID = '2607-00003';

  // Fixed UUIDs for DocTypes
  const MODULE_DT_ID = '2607-00001';
  const DOCTYPE_DT_ID = '2607-00002';
  const DOCFIELD_DT_ID = '2607-00003';
  const ROLE_DT_ID = '2607-00004';
  const USER_DT_ID = '2607-00005';
  const LANGUAGE_DT_ID = '2607-00006';
  const TRANSLATION_DT_ID = '2607-00007';
  const TENANT_DT_ID = '2607-00008';

  // Helper to ensure idempotency: Clear existing system tenant data
  await knex('sys_docfield').where('tenant_id', TENANT_SYSTEM).del();
  await knex('sys_doctype').where('tenant_id', TENANT_SYSTEM).del();

  // 1. Insert System DocTypes (Metadata about Metadata)
  const doctypes = [
    {
      id: MODULE_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_module',
      label: 'Module',
      module_id: SYSTEM_MOD_ID,
      description: 'System Modules Category',
      is_submittable: false,
      is_single: false,
      title_field: 'name',
      autoname: 'naming_series:.YY..MM.-.#####'
    },
    {
      id: DOCTYPE_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_doctype',
      label: 'DocType',
      module_id: SYSTEM_MOD_ID,
      description: 'Defines the structure of a document',
      is_submittable: false,
      is_single: false,
      title_field: 'name',
      autoname: 'naming_series:.YY..MM.-.#####'
    },
    {
      id: DOCFIELD_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_docfield',
      label: 'DocField',
      module_id: SYSTEM_MOD_ID,
      description: 'Defines fields within a DocType',
      is_submittable: false,
      is_single: false,
      title_field: 'fieldname',
    },
    {
      id: ROLE_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_role',
      label: 'Role',
      module_id: SETTINGS_MOD_ID,
      description: 'System Roles for authorization',
      is_submittable: false,
      is_single: false,
      title_field: 'name',
      autoname: 'naming_series:.YY..MM.-.#####'
    },
    {
      id: USER_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_user',
      label: 'User',
      module_id: SETTINGS_MOD_ID,
      description: 'System Users',
      is_submittable: false,
      is_single: false,
      title_field: 'full_name',
      autoname: 'naming_series:.YY..MM.-.#####'
    },
    {
      id: LANGUAGE_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_language',
      label: 'Language',
      module_id: SETTINGS_MOD_ID,
      description: 'System Languages',
      is_submittable: false,
      is_single: false,
      title_field: 'name',
    },
    {
      id: TRANSLATION_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_translation',
      label: 'Translation',
      module_id: SETTINGS_MOD_ID,
      description: 'System Translations Dictionary',
      is_submittable: false,
      title_field: 'source_text',
    },
    {
      id: TENANT_DT_ID,
      tenant_id: TENANT_SYSTEM,
      name: 'sys_tenant',
      label: 'Tenant',
      module_id: SYSTEM_MOD_ID,
      description: 'System Tenants',
      is_submittable: false,
      is_single: false,
      title_field: 'name',
      autoname: 'naming_series:.YY..MM.-.#####'
    }
  ];

  await knex('sys_doctype').insert(doctypes);

  // Helper to generate fields
  const makeField = (doctype_id, fieldname, label, fieldtype, req = false, order = 0, extra = {}) => ({
    id: uuidv4(),
    tenant_id: TENANT_SYSTEM,
    doctype_id,
    fieldname,
    label,
    fieldtype,
    is_required: req,
    sort_order: order,
    in_list_view: true,
    ...extra
  });

  // 2. Insert DocFields for the System DocTypes
  const docfields = [
    // Module Fields
    makeField(MODULE_DT_ID, 'name', 'Module Name', 'Data', true, 1),
    makeField(MODULE_DT_ID, 'icon', 'Icon', 'Data', false, 2),
    makeField(MODULE_DT_ID, 'description', 'Description', 'Text', false, 3),
    
    // DocType Fields
    makeField(DOCTYPE_DT_ID, 'name', 'Name', 'Data', true, 1),
    makeField(DOCTYPE_DT_ID, 'module_id', 'Module', 'Link', true, 2),
    makeField(DOCTYPE_DT_ID, 'label', 'Label', 'Data', false, 3),
    makeField(DOCTYPE_DT_ID, 'icon', 'Icon', 'Data', false, 4, { default_value: 'Circle' }),
    makeField(DOCTYPE_DT_ID, 'is_submittable', 'Is Submittable', 'Check', false, 5),
    makeField(DOCTYPE_DT_ID, 'is_single', 'Is Single (Settings)', 'Check', false, 6),

    // DocField Fields
    makeField(DOCFIELD_DT_ID, 'fieldname', 'Fieldname', 'Data', true, 1),
    makeField(DOCFIELD_DT_ID, 'fieldtype', 'Field Type', 'Select', true, 2),
    makeField(DOCFIELD_DT_ID, 'label', 'Label', 'Data', true, 3),
    makeField(DOCFIELD_DT_ID, 'is_required', 'Is Required', 'Check', false, 4),

    // Role Fields
    makeField(ROLE_DT_ID, 'name', 'Role Name', 'Data', true, 1),
    makeField(ROLE_DT_ID, 'description', 'Description', 'Text', false, 2),


    // Language Fields
    makeField(LANGUAGE_DT_ID, 'name', 'Language Name', 'Data', true, 1),
    makeField(LANGUAGE_DT_ID, 'code', 'Language Code', 'Data', true, 2),
    makeField(LANGUAGE_DT_ID, 'is_active', 'Is Active', 'Check', false, 3),

    // Translate Fields
    makeField(TRANSLATION_DT_ID, 'language_code', 'Language', 'Link', true, 1),
    makeField(TRANSLATION_DT_ID, 'source_text', 'Source Text', 'Text', true, 2),
    makeField(TRANSLATION_DT_ID, 'translated_text', 'Translated Text', 'Text', true, 3),

    // User Fields
    makeField(USER_DT_ID, 'full_name', 'Full Name', 'Data', true, 1),
    makeField(USER_DT_ID, 'email', 'Email Address', 'Data', true, 2),
    makeField(USER_DT_ID, 'password_hash', 'Password', 'Password', false, 3),
    makeField(USER_DT_ID, 'pin_hash', 'PIN', 'Password', false, 4),
    makeField(USER_DT_ID, 'google_id', 'Google ID', 'Data', false, 5, { is_hidden: true }),
    makeField(USER_DT_ID, 'avatar_url', 'Avatar URL', 'Attach', false, 6, { is_hidden: true }),
    makeField(USER_DT_ID, 'language_id', 'Language', 'Link', false, 7, { options: 'sys_language' }),
    makeField(USER_DT_ID, 'timezone', 'Timezone', 'Select', false, 8, { options: 'Asia/Jakarta\nUTC' }),
    makeField(USER_DT_ID, 'date_format', 'Date Format', 'Select', false, 9, { options: 'YYYY-MM-DD\nDD-MM-YYYY' }),
    makeField(USER_DT_ID, 'is_system_user', 'Is System User', 'Check', false, 10),

    // Tenant Fields
    makeField(TENANT_DT_ID, 'name', 'Tenant Name', 'Data', true, 1)
  ];

  await knex('sys_docfield').insert(docfields);
}
