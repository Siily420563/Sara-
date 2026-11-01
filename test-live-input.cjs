const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({});
async function run() {
  try {
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      callbacks: {
        onmessage: (msg) => { console.log("Message:", JSON.stringify(msg).substring(0, 50)); },
        onclose: (e) => { console.log("Closed:", e?.reason || String(e)); },
        onerror: (e) => { console.log("Error:", e?.message || String(e)); }
      }
    });
    console.log("Connected!");
    session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hello SARA." }] }], turnComplete: true });
    await new Promise(r => setTimeout(r, 2000));
    session.close();
  } catch(e) {
    console.error("Connect error:", e);
  }
}
run();
