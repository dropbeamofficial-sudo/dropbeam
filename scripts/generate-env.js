const fs = require('fs');
const path = require('path');

// Create _env.js at project root for Vercel to serve
const backend = process.env.BACKEND_URL || '';
const out = `window.__BACKEND_URL__ = ${JSON.stringify(backend)};`;

fs.writeFileSync(path.join(__dirname, '..', '_env.js'), out);
console.log('Wrote _env.js with BACKEND_URL=', backend);
