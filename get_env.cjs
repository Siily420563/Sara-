const fs = require('fs');
try {
  const env = fs.readFileSync('/proc/1522/environ', 'utf8');
  const vars = env.split('\0');
  for (const v of vars) {
    if (v.startsWith('GEMINI')) console.log("Found:", v.substring(0, 20) + "...");
  }
} catch(e) { console.log(e.message); }
