const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
const files = fs.readdirSync(migrationsDir);

files.forEach(file => {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Find all table.string('something_id', 36 or 50) and replace with table.uuid('something_id')
  content = content.replace(/table\.string\('([a-zA-Z0-9_]+_id)',\s*(36|50)\)/g, (match, colName) => {
    changed = true;
    return `table.uuid('${colName}')`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched FKs in ${file}`);
  }
});
