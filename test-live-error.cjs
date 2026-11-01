process.on('unhandledRejection', (r) => console.log('unhandled', Object.keys(r), JSON.stringify(r)));
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: "INVALID_KEY_THAT_IS_LONG_ENOUGH_12345678" });
async function run() {
  try {
    const s = await ai.live.connect({ model: "gemini-3.1-flash-live-preview" });
    console.log("Connected");
    await new Promise(r => setTimeout(r, 2000));
    console.log("Done waiting");
  } catch(e) {
    console.log("Caught keys:", Object.keys(e || {}));
    console.log("Message type:", typeof e?.message);
    console.log("Raw:", String(e));
  }
}
run();
