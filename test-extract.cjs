const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({});
async function run() {
  const prompt = `Analyze this user message: "I am a NEET aspirant studying hard"
Current System Date and Time: 2026-07-04 (Timezone: UTC)
Extract any personal facts...
Respond ONLY with a valid JSON object.
`;
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  console.log(result.text);
}
run();
