import { v4 as uuidv4 } from 'uuid';

export async function seed(knex) {
  const SYSTEM_TENANT = '2607-00001';

  // Clear existing
  await knex('sys_workspace_shortcut').del();
  await knex('sys_module').del();

  const systemModuleId = '2607-00001';
  const settingsModuleId = '2607-00002';

  // Insert Modules
  await knex('sys_module').insert([
    {
      id: systemModuleId,
      tenant_id: SYSTEM_TENANT,
      name: 'System',
      icon: 'Server',
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: settingsModuleId,
      tenant_id: SYSTEM_TENANT,
      name: 'Settings',
      icon: 'Settings',
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  // Insert Shortcuts
  await knex('sys_workspace_shortcut').insert([
    // System Module
    {
      id: uuidv4(),
      tenant_id: SYSTEM_TENANT,
      module_id: systemModuleId,
      type: 'DocType',
      target: 'sys_doctype',
      label: 'DocType',
      icon: 'Database',
      sort_order: 1,
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      tenant_id: SYSTEM_TENANT,
      module_id: systemModuleId,
      type: 'DocType',
      target: 'sys_module',
      label: 'Module',
      icon: 'Box',
      sort_order: 2,
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      tenant_id: SYSTEM_TENANT,
      module_id: systemModuleId,
      type: 'DocType',
      target: 'sys_workspace_shortcut',
      label: 'Workspace Shortcut',
      icon: 'Link',
      sort_order: 3,
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    },
    // Settings Module
    {
      id: uuidv4(),
      tenant_id: SYSTEM_TENANT,
      module_id: settingsModuleId,
      type: 'DocType',
      target: 'sys_user',
      label: 'User',
      icon: 'Users',
      sort_order: 1,
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      tenant_id: SYSTEM_TENANT,
      module_id: settingsModuleId,
      type: 'DocType',
      target: 'sys_role',
      label: 'Role',
      icon: 'Key',
      sort_order: 2,
      status: 'Active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}
