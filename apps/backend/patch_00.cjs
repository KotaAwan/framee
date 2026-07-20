const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const filePath = path.join(__dirname, 'src', 'database', 'seeds', '00_system_doctypes.js');
let content = fs.readFileSync(filePath, 'utf8');

const idMap = {};
function getUuid(oldId) {
  if (!idMap[oldId]) idMap[oldId] = crypto.randomUUID();
  return idMap[oldId];
}

const knownIds = [
  '2607-00001', '2607-00002', '2607-00003', '2607-00004', '2607-00005', 
  '2607-00006', '2607-00007', '2607-00008', '2607-00090', '2607-00091', '2607-00092'
];

knownIds.forEach(id => getUuid(id));

// 1. Replace the const declarations with UUIDs, but store the old string for `code`
// Actually, it's easier to change the const values to UUIDs.
// But we need to add `code: '...'` into the doctypes and modules array.
// For doctypes array: `id: MODULE_DT_ID,` -> `id: MODULE_DT_ID, code: '2607-00001',`
// How do we know which code? We map the const names to codes.

const constToCode = {
  'TENANT_SYSTEM': '2607-00001',
  'SYSTEM_MOD_ID': '2607-00001',
  'SETTINGS_MOD_ID': '2607-00002',
  'DASHBOARD_MOD_ID': '2607-00003',
  'MODULE_DT_ID': '2607-00001',
  'DOCTYPE_DT_ID': '2607-00002',
  'DOCFIELD_DT_ID': '2607-00003',
  'ROLE_DT_ID': '2607-00004',
  'USER_DT_ID': '2607-00005',
  'LANGUAGE_DT_ID': '2607-00006',
  'TRANSLATION_DT_ID': '2607-00007',
  'TENANT_DT_ID': '2607-00008',
  'WORKFLOW_DT_ID': '2607-00090',
  'WORKFLOW_STATE_DT_ID': '2607-00091',
  'WORKFLOW_TRANSITION_DT_ID': '2607-00092'
};

// Replace const values with their UUIDs
Object.entries(constToCode).forEach(([constName, codeStr]) => {
  const uuid = getUuid(codeStr);
  content = content.replace(new RegExp(`const ${constName} = '${codeStr}';`), `const ${constName} = '${uuid}'; const ${constName}_CODE = '${codeStr}';`);
});

// Now insert `code: MODULE_DT_ID_CODE,` after `id: MODULE_DT_ID,`
Object.keys(constToCode).forEach(constName => {
  content = content.replace(new RegExp(`id: ${constName},`), `id: ${constName},\n      code: ${constName}_CODE,`);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched 00_system_doctypes.js');
