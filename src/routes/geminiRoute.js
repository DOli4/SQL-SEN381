// src/routes/chatbot.js  (or geminiRoute.js)
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { matchIntentRuleFirst, SUGGESTIONS } from "../utils/intents.js";
import { classifyAndExtract } from "../utils/nlu.js";
import { setVars } from "../utils/memory.js";
import {
  handleAskTutor,
  handleFindMaterial,
  handleUploadHelp,
  handleTutorHours,
} from "../services/assistant.js";

const router = express.Router();

// Page: GET /chatbot
router.get("/chatbot", (req, res) => {
  res.locals.pageClass = "theme-dark";     // make layout dark just for this page
  return res.render("chatbot");            // views/chatbot.ejs
});

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// API: POST /chatbot  (unified chat endpoint)
router.post("/chatbot", async (req, res) => {
  const userId = req.user?.sub || req.ip;
  const msg = (req.body?.message || "").trim();
  if (!msg) {
    return res.json({
      reply: "Say something and I’ll help!",
      suggestedReplies: SUGGESTIONS.fallback,
    });
  }

  try {
    // 1) rule-first intent
    let intent = matchIntentRuleFirst(msg);
    let slots = {};

    // 2) LLM backstop for intent + slot extraction
    if (!intent) {
      const nlu = await classifyAndExtract(msg);
      intent = nlu.intent || "unknown";
      slots = nlu.slots || {};
      if (slots.module) slots.module = String(slots.module).toUpperCase().trim();
    }

    // keep extracted vars
    setVars(userId, slots);

    // 3) route to handler
    let payload;
    switch (intent) {
      case "ask_tutor":
        payload = await handleAskTutor(userId, slots);
        break;
      case "find_material":
        payload = await handleFindMaterial(userId, slots);
        break;
      case "upload_help":
        payload = await handleUploadHelp();
        break;
      case "tutor_hours":
        payload = await handleTutorHours();
        break;
      default: {
        // generative fallback
        const sys = `You are CampusLearnHelper. Be concise, step-by-step.`;
        const r = await model.generateContent(`${sys}\nUser: ${msg}`);
        const text = r.response.text();
        payload = { reply: text, suggestedReplies: SUGGESTIONS.fallback };
      }
    }

    return res.json(payload);
  } catch (err) {
    console.error("BOT ERROR:", err);
    return res.status(500).json({
      reply: "Sorry—something went wrong on my side.",
      suggestedReplies: SUGGESTIONS.fallback,
    });
  }
});

export default router;
