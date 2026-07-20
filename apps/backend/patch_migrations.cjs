const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
const files = fs.readdirSync(migrationsDir);

const tablesToPatch = [
  'sys_module', 'sys_doctype', 'sys_docfield', 'sys_role', 'sys_user', 'sys_tenant', 'sys_language', 'dt_'
];

files.forEach(file => {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add code column after id
  content = content.replace(/(table\.uuid\('id'\)\.primary\(\);|table\.string\('id', \d+\)\.primary\(\);)/g, (match) => {
    changed = true;
    return match + "\n    table.string('code', 50).nullable().unique(); // Added for series format";
  });
  
  // Convert any remaining string ids to uuid
  content = content.replace(/table\.string\('id', \d+\)\.primary\(\);/g, "table.uuid('id').primary();");

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${file}`);
  }
});
