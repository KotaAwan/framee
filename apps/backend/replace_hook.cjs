const fs = require('fs');
const p = '../frontend/src/hooks/useTranslation.js';
let content = fs.readFileSync(p, 'utf8');
content = content.replace(/\/\/ A temporary fallback dictionary[\s\S]*?};\n\n/, "import translationsData from '@/locales/translations.json';\n\nconst localDict = translationsData || { en: {}, id: {} };\n\n");
fs.writeFileSync(p, content);
console.log('done replacing');
