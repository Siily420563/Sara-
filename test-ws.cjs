const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/live');
ws.on('open', () => {
  console.log("Connected to local server!");
  ws.send(JSON.stringify({
    clientContent: {
      turns: [{ role: "user", parts: [{ text: "Hello SARA." }] }],
      turnComplete: true
    }
  }));
});
ws.on('message', (data) => {
  console.log("Message:", data.toString().substring(0, 100));
});
ws.on('close', (code, reason) => {
  console.log("Closed:", code, reason.toString());
});
ws.on('error', (e) => {
  console.log("Error:", e);
});
