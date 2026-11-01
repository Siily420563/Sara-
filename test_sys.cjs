const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: "TEST" });
async function run() {
  try {
    await ai.live.connect({ 
        model: "gemini-3.1-flash-live-preview",
        config: { systemInstruction: "Hello" },
        callbacks: { onclose: (e) => console.log(e.reason) }
    });
  } catch(e) {
    console.log("ERR", e.message || e);
  }
}
run();
