const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {',
  `if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
         errMsg = "You have exceeded your API quota. Please configure a valid billing-enabled API key in Settings.";
      } else if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
         errMsg = "The AI model is currently experiencing high demand. Please try again later.";
      } else if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {`
);

code = code.replace(
  'console.log("Fact extraction error:", e.message || "Unknown error");\n      res.json({ fact: null });',
  `console.log("Fact extraction error:", e.message || "Unknown error");
      if (String(e).includes("quota") || String(e).includes("429") || String(e).includes("RESOURCE_EXHAUSTED")) {
         console.log("Fact extraction quota exceeded");
      }
      res.json({ fact: null });`
);

code = code.replace(
  'console.log("Reminder extraction error:", e.message || "Unknown error");\n      res.json({ isReminder: false });',
  `console.log("Reminder extraction error:", e.message || "Unknown error");
      if (String(e).includes("quota") || String(e).includes("429") || String(e).includes("RESOURCE_EXHAUSTED")) {
         console.log("Reminder extraction quota exceeded");
      }
      res.json({ isReminder: false });`
);

fs.writeFileSync('server.ts', code);
