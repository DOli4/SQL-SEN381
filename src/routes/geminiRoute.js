import express from "express";
import { answerWithRAG } from "../services/assistant.js";
import { countDocs } from "../utils/vstore.js";
import { geminiHealthCheck } from "../services/providers/gemini.js";

const router = express.Router();

// Safety: ensure JSON parsing even if server order changes
router.use(express.json());

// Health endpoints
router.get("/ping", async (_req, res) => {
  try {
    const hc = await geminiHealthCheck();
    res.json({ ok: true, ...hc });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.get("/status", async (_req, res) => {
  try {
    res.json({ chunks: countDocs(), ...(await geminiHealthCheck()) });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Chat
router.post("/chat", async (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = (body.message ?? "").toString().trim();

    if (!message) {
      return res.status(400).json({ error: "message field is required" });
    }

    const { text, sources, debug } = await answerWithRAG(message);
    res.json({ reply: text, sources, debug });
  } catch (err) {
    console.error("[Gemini Chat] Error:", err?.response ?? err);
    const msg = err?.message || "Something went wrong while contacting Gemini.";
    if (process.env.NODE_ENV !== "production") {
      return res.status(500).json({ error: msg, stack: String(err?.stack || err) });
    }
    res.status(500).json({ error: "Something went wrong while contacting Gemini." });
  }
});

export default router;
