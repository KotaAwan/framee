const auth = require('fs').readFileSync('apps/frontend/src/store/auth.store.js', 'utf-8');
console.log(auth.substring(0, 500));
