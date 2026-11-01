const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "process.on('uncaughtException', (err) => console.log('Uncaught Exception:', err));",
  "process.on('uncaughtException', (err) => { if (err && typeof err === 'object' && '_errorEmitted' in err) return; console.log('Uncaught Exception:', err?.message || String(err)); });"
);

fs.writeFileSync('server.ts', code);
