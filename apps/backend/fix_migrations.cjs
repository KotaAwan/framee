const fs = require('fs');
const path = require('path');

const dir = './src/database/migrations';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith('.js')) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    const targetOld = `    await knex.schema.alterTable(\`\${tableName}_version\`, (table) => {
      table.dropPrimary();
      table.renameColumn('id', 'doc_id');
    });`;
    
    const replacement = `    await knex.raw(\`ALTER TABLE ?? MODIFY id INT UNSIGNED NOT NULL\`, [\`\${tableName}_version\`]);
    await knex.schema.alterTable(\`\${tableName}_version\`, (table) => {
      table.dropPrimary();
      table.renameColumn('id', 'doc_id');
    });`;
    
    content = content.replace(targetOld, replacement);
    fs.writeFileSync(fullPath, content);
  }
}
console.log('Done!');
