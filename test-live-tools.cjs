const { GoogleGenAI, Modality, Type } = require('@google/genai');
const ai = new GoogleGenAI({}); 
async function run() {
  try {
    console.log("Connecting...");
    const session = await ai.live.connect({ 
        model: "gemini-3.1-flash-live-preview",
        config: {
          tools: [
            { googleSearch: {} },
            {
               functionDeclarations: [{ name: "test", description: "test" }]
            }
          ]
        },
        callbacks: {
            onclose: (e) => console.log("Close:", e?.reason || String(e))
        }
    });
    console.log("URL:", session.conn?.ws?.url || "connected");
  } catch(e) {
    console.log("Caught:", e?.reason || e?.message || String(e));
  }
}
run();
