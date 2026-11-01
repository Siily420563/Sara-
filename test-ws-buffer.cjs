const { WebSocketServer, WebSocket } = require('ws');
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', async (ws) => {
  console.log("Server: Client connected");
  await new Promise(r => setTimeout(r, 1000));
  ws.on('message', (msg) => console.log("Server received:", msg.toString()));
});
const client = new WebSocket('ws://localhost:8080');
client.on('open', () => {
  console.log("Client connected, sending message");
  client.send("Hello before listener");
});
