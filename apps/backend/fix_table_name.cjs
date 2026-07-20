const fs = require('fs');
const glob = require('glob'); // Not available? Let's use child_process or just pure JS if no glob
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace variations of tableName derivation
      content = content.replace(/const tableName = (meta|childMeta|linkedMeta)\.(table_name|name)\.startsWith\('sys_'\) \? \1\.name : `dt_\$\{\1\.name\.toLowerCase\(\)\}`;/g, 'const tableName = $1.table_name;');
      
      content = content.replace(/const childTableName = (meta|childMeta|linkedMeta)\.(table_name|name)\.startsWith\('sys_'\) \? \1\.name : `dt_\$\{\1\.name\.toLowerCase\(\)\}`;/g, 'const childTableName = $1.table_name;');
      
      content = content.replace(/const linkedTableName = (meta|childMeta|linkedMeta)\.(table_name|name)\.startsWith\('sys_'\) \? \1\.name : `dt_\$\{\1\.name\.toLowerCase\(\)\}`;/g, 'const linkedTableName = $1.table_name;');

      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir('./src');
console.log('Done!');
