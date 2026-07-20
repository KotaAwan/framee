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

Object.values(constToCode).forEach(id => getUuid(id));

// Replace const values with their UUIDs
Object.entries(constToCode).forEach(([constName, codeStr]) => {
  const uuid = getUuid(codeStr);
  content = content.replace(new RegExp(`const ${constName} = '${codeStr}';`), `const ${constName} = '${uuid}'; const ${constName}_CODE = '${codeStr}';`);
});

// Insert code only when matching exactly `id: CONST_NAME,`
Object.keys(constToCode).forEach(constName => {
  // \b ensures we only match 'id' and not 'module_id' or 'tenant_id'
  content = content.replace(new RegExp(`\\bid: ${constName},`), `id: ${constName},\n      code: ${constName}_CODE,`);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched 00_system_doctypes.js correctly');
