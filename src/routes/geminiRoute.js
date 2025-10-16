  // src/routes/geminiRoute.js
  import express from "express";
  import path from "path";
  import { answerWithRAG } from "../services/assistant.js";
  import {
    countDocs,
    reloadFromDisk,
    replaceFile
  } from "../utils/vstore.js";
  import {
    ingestFolder,
    ingestFile
  } from "../utils/ingestLocalFolder.js";
  import { geminiHealthCheck } from "../services/providers/gemini.js";

  const router = express.Router();
  router.use(express.json());

  // --- Health checks ---
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

  // --- Chat route (main AI query) ---
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

  // --- NEW: rebuild all materials (slow but full refresh) ---
  router.post("/ingest-all", async (_req, res) => {
    try {
      await ingestFolder();          // re-parse all PDFs/TXTs
      const total = reloadFromDisk();// reload the in-memory KB
      res.json({ ok: true, total });
    } catch (e) {
      console.error("[/ingest-all] error", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // --- NEW: ingest a single file after backend upload ---
  router.post("/ingest-file", async (req, res) => {
    try {
      const { filename } = req.body || {};
      if (!filename) return res.status(400).json({ ok: false, error: "filename is required" });

      const baseDir = process.env.STUDYDOCS_DIR || "./data/studydocs";
      const full = path.join(baseDir, filename);
      const rows = await ingestFile(full);

      if (!rows.length) {
        return res.status(400).json({ ok: false, error: "file empty/unreadable" });
      }

      const stat = replaceFile(filename, rows); // upsert in-memory + persist
      const total = countDocs();
      res.json({ ok: true, ...stat, total });
    } catch (e) {
      console.error("[/ingest-file] error", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  export default router;
