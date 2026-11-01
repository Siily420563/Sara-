const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "process.on('unhandledRejection', (reason) => console.log('Unhandled Rejection:', reason));",
  "process.on('unhandledRejection', (reason) => { if (reason && typeof reason === 'object' && '_errorEmitted' in reason) return; console.log('Unhandled Rejection:', reason && reason.message ? reason.message : String(reason)); });"
);

fs.writeFileSync('server.ts', code);
