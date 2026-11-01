const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({}); 
async function run() {
  try {
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("Connected!");
    session.close();
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
