import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Ask the model to classify and extract slots into strict JSON
export async function classifyAndExtract(message) {
  const sys = `You are an NLU engine. 
Return ONLY valid JSON: {"intent": "...", "slots": {...}}.
Allowed intents: "ask_tutor","find_material","upload_help","tutor_hours","unknown".
Slots may include: name, email, module, issue, topic, when (time), fileType.`;

  const prompt = `${sys}\nUser: ${message}\nJSON:`;
  const r = await model.generateContent(prompt);
  const text = r.response.text().trim();

  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    }
  } catch { /* swallow */ }
  return { intent: "unknown", slots: {} };
}
