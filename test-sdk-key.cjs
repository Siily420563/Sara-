const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: "TEST_KEY_123" });
async function run() {
  try {
    const session = await ai.live.connect({ 
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
            onclose: (e) => console.log("Close:", e?.reason || String(e))
        }
    });
    console.log("URL:", session.conn._url);
  } catch(e) {
    console.log(e);
  }
}
run();
