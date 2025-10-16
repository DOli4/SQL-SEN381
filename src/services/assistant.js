import { getChatModel, embedTexts } from "./providers/gemini.js";
import { topK, countDocs } from "../utils/vstore.js";

const SYS_RULES = `You are CampusLearn's study assistant.
- Prefer answers grounded in the provided CONTEXT.
- If the material doesn't cover the question, say so briefly and answer from general knowledge.
- Always include a short "Sources" line with file names and chunk ids used.`;

export async function answerWithRAG(userMsg) {
  const debug = {};
  try {
    // 1) Embed the question (fallback if it fails)
    let qEmbedding = null;
    try {
      const arr = await embedTexts([userMsg]);
      qEmbedding = arr?.[0] || null;
      debug.embedOk = Boolean(qEmbedding);
    } catch (e) {
      console.warn("[assistant] embedTexts failed, proceeding without retrieval:", e?.message || e);
      debug.embedOk = false;
    }

    // 2) Retrieve topK if we have an embedding and any docs
    let kdocs = [];
    if (qEmbedding && countDocs() > 0) {
      kdocs = topK(qEmbedding, 6);
    }
    debug.retrieved = kdocs.map(d => d.id);

    const context = kdocs.map(d => `● (${d.id}) [${d.file}]\n${d.content}`).join("\n\n");
    const sources = kdocs.map(d => `(${d.id.split("#")[1]}) ${d.file}`).join("; ") || "None";

    // 3) Build prompt
    const promptText = `${SYS_RULES}\n\nCONTEXT:\n${context || "(no relevant context)"}\n\nQUESTION:\n${userMsg}`;
    debug.promptPreview = promptText.slice(0, 600);

    // 4) Call Gemini
    const model = getChatModel();
    const contents = [{ role: "user", parts: [{ text: promptText }] }];

    const resp = await model.generateContent({ contents });
    const text = resp?.response?.text?.() || "(no response text)";

    // 5) Return
    return {
      text: text + `\n\nSources: ${sources}`,
      sources,
      debug: process.env.NODE_ENV !== "production" ? debug : undefined,
    };
  } catch (e) {
    console.error("[assistant] fatal error:", e?.response ?? e);
    throw e;
  }
}
