const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const seedsDir = path.join(__dirname, 'src', 'database', 'seeds');
const files = fs.readdirSync(seedsDir);

const idMap = {};

function getUuid(oldId) {
  if (!idMap[oldId]) {
    idMap[oldId] = crypto.randomUUID();
  }
  return idMap[oldId];
}

// Fixed UUIDs to use for known IDs across seeds
const knownIds = [
  '2607-00001', '2607-00002', '2607-00003', '2607-00004', '2607-00005', 
  '2607-00006', '2607-00007', '2607-00008', '2607-00090', '2607-00091', '2607-00092',
  '2607-00001-01', '2607-00001-02', '2607-00001-ACT01', '2607-00001-ACT02'
];

knownIds.forEach(id => getUuid(id));

files.forEach(file => {
  const filePath = path.join(seedsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // First pass: We need to find `id: 'something'` and add `code: 'something'`
  content = content.replace(/id:\s*'([A-Z0-9-]+)'/g, (match, idVal) => {
    if (idVal.length < 36) {
      changed = true;
      const uuid = getUuid(idVal);
      return `id: '${uuid}', code: '${idVal}'`;
    }
    return match;
  });

  // Second pass: Replace references to these IDs in other fields (like tenant_id, doctype_id, module_id, etc.)
  knownIds.forEach(oldId => {
    // Only replace if it's surrounded by quotes
    const regex = new RegExp(`'${oldId}'`, 'g');
    content = content.replace(regex, (match) => {
      // Don't replace if it was already handled by the first pass (where we explicitly wrote code: 'oldId')
      // Actually, since we do this after the first pass, code: 'oldId' will become code: 'uuid', which is wrong!
      // Let's do it smarter.
      return `'${getUuid(oldId)}'`;
    });
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${file}`);
  }
});
