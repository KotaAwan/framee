import { v4 as uuidv4 } from 'uuid';

export async function seed(knex) {
  // Use the same tenant_id as 00_system_doctypes.js
  const TENANT_ID = '2607-00001';
  
  // 1. Clear existing
  await knex('sys_doctype').where({ name: 'sys_settings', tenant_id: TENANT_ID }).del();
  
  const SETTINGS_ID = '2607-00009';
  
  // 2. Insert DocType
  await knex('sys_doctype').insert([
    {
      id: SETTINGS_ID,
      tenant_id: TENANT_ID,
      name: 'sys_settings',
      label: 'System Settings',
      module_id: null, // Global
      is_submittable: false,
      is_single: true,
      title_field: 'app_name',
    }
  ]);

  // 3. Insert Fields
  const fields = [
    { doctype_id: SETTINGS_ID, fieldname: 'app_name', label: 'App Name', fieldtype: 'Data', default_value: 'Framee', is_required: true, section: 'Branding', column_width: 6, sort_order: 1 },
    { doctype_id: SETTINGS_ID, fieldname: 'company_name', label: 'Company Name', fieldtype: 'Data', section: 'Branding', column_width: 6, sort_order: 2 },
    { doctype_id: SETTINGS_ID, fieldname: 'default_currency', label: 'Default Currency', fieldtype: 'Select', options: 'USD\nIDR\nEUR', default_value: 'USD', section: 'Defaults', column_width: 6, sort_order: 3 },
    { doctype_id: SETTINGS_ID, fieldname: 'date_format', label: 'Date Format', fieldtype: 'Select', options: 'yyyy-mm-dd\ndd-mm-yyyy\nmm/dd/yyyy', default_value: 'yyyy-mm-dd', section: 'Defaults', column_width: 6, sort_order: 4 },
    { doctype_id: SETTINGS_ID, fieldname: 'enable_registration', label: 'Enable Registration', fieldtype: 'Check', default_value: '0', section: 'Security', column_width: 12, sort_order: 5 }
  ];

  const fieldRows = fields.map(f => ({
    id: uuidv4(),
    tenant_id: TENANT_ID,
    ...f
  }));

  await knex('sys_docfield').insert(fieldRows);
}
