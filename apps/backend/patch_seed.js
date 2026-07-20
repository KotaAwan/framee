const fs = require('fs');
let fileContent = fs.readFileSync('src/database/seeds/01_core_seed.js', 'utf8');

// Add sys_menu to tables array
fileContent = fileContent.replace(
  "    'sys_workspace', 'sys_docfield', 'sys_doctype', 'sys_module',",
  "    'sys_workspace', 'sys_menu', 'sys_docfield', 'sys_doctype', 'sys_module',"
);

// Add slug to sys_module
fileContent = fileContent.replace(
  "{ id: 1, code: 'MODU-2607-0001', name: 'System', icon: 'Settings', is_deleted: false, status: 'Active' },",
  "{ id: 1, code: 'MODU-2607-0001', name: 'System', slug: 'system', icon: 'Settings', is_deleted: false, status: 'Active' },"
);
fileContent = fileContent.replace(
  "{ id: 2, code: 'MODU-2607-0002', name: 'Core', icon: 'Database', is_deleted: false, status: 'Active' }",
  "{ id: 2, code: 'MODU-2607-0002', name: 'Core', slug: 'core', icon: 'Database', is_deleted: false, status: 'Active' }"
);

// We need to inject slug into every doctype in the array, and add sys_menu.
const doctypeSlugMap = {
  'Language': 'sys_language',
  'Translation': 'sys_translation',
  'Doctype': 'sys_doctype',
  'Module': 'sys_module',
  'Workspace': 'sys_workspace',
  'Role': 'sys_role',
  'Permission': 'sys_permission',
  'User': 'sys_user',
  'User Role': 'sys_user_role',
  'Settings': 'sys_settings',
  'Workflow State': 'sys_workflow_state',
  'Workflow Action': 'sys_workflow_action',
  'Workflow': 'sys_workflow',
  'Workflow Transition': 'sys_workflow_transition',
  'Print': 'sys_print',
  'Menu': 'sys_menu'
};

const newDoctypes = [
  "{ id: 1, code: 'DOCT-2607-0001', name: 'Language', slug: 'sys_language', table_name: 'sys_language', module_id: 1, icon: 'Globe', auto_code: 'LANG-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 2, code: 'DOCT-2607-0002', name: 'Translation', slug: 'sys_translation', table_name: 'sys_translation', module_id: 1, icon: 'Type', auto_code: 'TRAN-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 3, code: 'DOCT-2607-0003', name: 'Doctype', slug: 'sys_doctype', table_name: 'sys_doctype', module_id: 1, icon: 'Database', auto_code: 'DOCT-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 4, code: 'DOCT-2607-0004', name: 'Module', slug: 'sys_module', table_name: 'sys_module', module_id: 1, icon: 'Package', auto_code: 'MODU-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 5, code: 'DOCT-2607-0005', name: 'Workspace', slug: 'sys_workspace', table_name: 'sys_workspace', module_id: 1, icon: 'Layout', auto_code: 'WORK-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 6, code: 'DOCT-2607-0006', name: 'Role', slug: 'sys_role', table_name: 'sys_role', module_id: 1, icon: 'Shield', auto_code: 'ROLE-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 7, code: 'DOCT-2607-0007', name: 'Permission', slug: 'sys_permission', table_name: 'sys_permission', module_id: 1, icon: 'Lock', auto_code: 'PERM-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 8, code: 'DOCT-2607-0008', name: 'User', slug: 'sys_user', table_name: 'sys_user', module_id: 1, icon: 'Users', auto_code: 'USER-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 9, code: 'DOCT-2607-0009', name: 'User Role', slug: 'sys_user_role', table_name: 'sys_user_role', module_id: 1, icon: 'UserCheck', auto_code: 'UROL-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 10, code: 'DOCT-2607-0010', name: 'Settings', slug: 'sys_settings', table_name: 'sys_settings', module_id: 1, icon: 'Settings', auto_code: 'SETI-.YY..MM.-.XXXX', is_single: true, is_deleted: false, status: 'Active' },",
  "    { id: 11, code: 'DOCT-2607-0011', name: 'Workflow State', slug: 'sys_workflow_state', table_name: 'sys_workflow_state', module_id: 1, icon: 'GitCommit', auto_code: 'WSTA-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 12, code: 'DOCT-2607-0012', name: 'Workflow Action', slug: 'sys_workflow_action', table_name: 'sys_workflow_action', module_id: 1, icon: 'Play', auto_code: 'WACT-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 13, code: 'DOCT-2607-0013', name: 'Workflow', slug: 'sys_workflow', table_name: 'sys_workflow', module_id: 1, icon: 'GitMerge', auto_code: 'WORK-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 14, code: 'DOCT-2607-0014', name: 'Workflow Transition', slug: 'sys_workflow_transition', table_name: 'sys_workflow_transition', module_id: 1, icon: 'GitPullRequest', auto_code: 'WTRA-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 15, code: 'DOCT-2607-0015', name: 'Print', slug: 'sys_print', table_name: 'sys_print', module_id: 1, icon: 'Printer', auto_code: 'PRIN-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' },",
  "    { id: 16, code: 'DOCT-2607-0016', name: 'Menu', slug: 'sys_menu', table_name: 'sys_menu', module_id: 1, icon: 'Menu', auto_code: 'MENU-.YY..MM.-.XXXX', is_deleted: false, status: 'Active' }"
].join('\n');

const oldDoctypesRegex = /const doctypes = \[\s+([\s\S]+?)\];\s+await knex\('sys_doctype'\)\.insert\(doctypes\);/m;
fileContent = fileContent.replace(oldDoctypesRegex, `const doctypes = [\n    ${newDoctypes}\n  ];\n  await knex('sys_doctype').insert(doctypes);`);

// Replace Workspace with Menu & Workspace
const oldWorkspaceRegex = /\/\/ 9\. Workspace\s+await knex\('sys_workspace'\)\.insert\(\[\s+([\s\S]+?)\s+\]\);/m;

const newMenuWorkspace = `// 9. Menu & Workspace
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
  ]);`;

fileContent = fileContent.replace(oldWorkspaceRegex, newMenuWorkspace);

// Add slug to sys_doctype fields
const oldSysDoctypeFieldsRegex = /\/\/ 3\. sys_doctype\s+pushFields\('sys_doctype', \[\s+([\s\S]+?)\s+\]\);/m;
fileContent = fileContent.replace(oldSysDoctypeFieldsRegex, `// 3. sys_doctype
  pushFields('sys_doctype', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Text', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Text', reqd: true },
    { fieldname: 'slug', label: 'Slug', fieldtype: 'Text', reqd: true },
    { fieldname: 'table_name', label: 'Table Name', fieldtype: 'Text', reqd: true },
    { fieldname: 'module_id', label: 'Module', fieldtype: 'Link', options: 'sys_module' },
    { fieldname: 'icon', label: 'Icon', fieldtype: 'Text', in_list: false },
    { fieldname: 'auto_code', label: 'Auto Code', fieldtype: 'Text' },
    { fieldname: 'is_single', label: 'Is Single', fieldtype: 'Check' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Text' }
  ]);`);

// Add slug to sys_module fields
const oldSysModuleFieldsRegex = /\/\/ 4\. sys_module\s+pushFields\('sys_module', \[\s+([\s\S]+?)\s+\]\);/m;
fileContent = fileContent.replace(oldSysModuleFieldsRegex, `// 4. sys_module
  pushFields('sys_module', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Text', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Text', reqd: true },
    { fieldname: 'slug', label: 'Slug', fieldtype: 'Text', reqd: true },
    { fieldname: 'icon', label: 'Icon', fieldtype: 'Text', in_list: false },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Text' }
  ]);`);

// Add sys_menu fields
const oldSysWorkspaceFieldsRegex = /\/\/ 5\. sys_workspace\s+pushFields\('sys_workspace', \[\s+([\s\S]+?)\s+\]\);/m;
fileContent = fileContent.replace(oldSysWorkspaceFieldsRegex, `// 5. sys_menu
  pushFields('sys_menu', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Text', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Text', reqd: true },
    { fieldname: 'doctype', label: 'Doctype', fieldtype: 'Link', options: 'sys_doctype' },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Text' }
  ]);

  // 5.5 sys_workspace
  pushFields('sys_workspace', [
    { fieldname: 'code', label: 'Code', fieldtype: 'Text', reqd: true },
    { fieldname: 'name', label: 'Name', fieldtype: 'Text', reqd: true },
    { fieldname: 'role_id', label: 'Role', fieldtype: 'Link', options: 'sys_role' },
    { fieldname: 'menu_id', label: 'Menu', fieldtype: 'Link', options: 'sys_menu' },
    { fieldname: 'sort_order', label: 'Sort Order', fieldtype: 'Int', in_list: false },
    { fieldname: 'is_deleted', label: 'Is Deleted', fieldtype: 'Check', in_list: false },
    { fieldname: 'status', label: 'Status', fieldtype: 'Text' }
  ]);`);

fs.writeFileSync('src/database/seeds/01_core_seed.js', fileContent);
console.log('Seed updated');
