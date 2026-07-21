const auth = require('fs').readFileSync('apps/backend/src/core/AuthEngine/AuthEngine.js', 'utf-8');
console.log(auth.substring(0, 800));
