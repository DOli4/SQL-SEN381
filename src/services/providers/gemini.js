    // src/services/providers/gemini.js
    import dotenv from "dotenv";
    import path from "path";

    // Load .env BEFORE touching process.env (works when imported by any script)
    dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

    import { GoogleGenerativeAI } from "@google/generative-ai";

    // ---- Config ----
    const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
    const CHAT_MODEL = (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim(); // stable default
    const EMBED_MODEL = (process.env.EMBED_MODEL || "text-embedding-004").trim();

    if (!API_KEY) {
    throw new Error(
        "GEMINI_API_KEY not set in .env. Please add GEMINI_API_KEY=YOUR_KEY to your project root .env"
    );
    }

    const genAI = new GoogleGenerativeAI(API_KEY);

    /**
     * Returns a chat-capable model instance.
     * Usage: const model = getChatModel(); const resp = await model.generateContent({ contents: [...] });
     */
    export function getChatModel() {
    try {
        return genAI.getGenerativeModel({ model: CHAT_MODEL });
    } catch (e) {
        console.error("[Gemini] Failed to init chat model:", CHAT_MODEL, e);
        throw e;
    }
    }

    /**
     * Embeds an array of strings with Gemini embeddings.
     * Returns: number[][] (one embedding vector per input string).
     * Tries batch API first; falls back to per-item embedding for older SDKs.
     */
    export async function embedTexts(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return [];

    // Construct content objects once
    const requests = texts.map((t) => ({
        content: { parts: [{ text: String(t || "") }] },
    }));

    // Try batch embeddings first
    try {
        const embedModel = genAI.getGenerativeModel({ model: EMBED_MODEL });
        // Newer SDKs
        if (typeof embedModel.batchEmbedContents === "function") {
        const res = await embedModel.batchEmbedContents({ requests });
        const out = res?.embeddings?.map((e) => e?.values) || [];
        if (out.length === texts.length) return out;
        console.warn(
            "[Gemini] batchEmbedContents returned unexpected shape; falling back to per-item embed."
        );
        }
    } catch (err) {
        // fall through to single embeds
        console.warn("[Gemini] batchEmbedContents failed, falling back to single:", err?.message || err);
    }

    // Fallback: single item embedding (works across SDK versions)
    try {
        const embedModel = genAI.getGenerativeModel({ model: EMBED_MODEL });
        const vectors = [];
        for (const req of requests) {
        // Try both call shapes to cover SDK differences
        let res;
        if (typeof embedModel.embedContent === "function") {
            // Newer SDK prefers object with 'content'
            res = await embedModel.embedContent(req);
        } else if (typeof genAI.embedContent === "function") {
            // Very old SDK shape
            res = await genAI.embedContent({ model: EMBED_MODEL, ...req });
        } else {
            throw new Error("No embedContent API available on this @google/generative-ai version.");
        }

        const vec =
            res?.embedding?.values ??
            res?.data?.embedding?.values ??
            res?.data?.[0]?.embedding?.values;

        if (!vec) throw new Error("Embedding response missing 'values'.");
        vectors.push(vec);
        }
        return vectors;
    } catch (e) {
        console.error("[Gemini] Single embedContent failed:", e);
        throw e;
    }
    }

    /** Optional: quick self-test you can call from a status route if you want */
    export async function geminiHealthCheck() {
    return {
        ok: true,
        chatModel: CHAT_MODEL,
        embedModel: EMBED_MODEL,
        keyLoaded: Boolean(API_KEY),
    };
    }
