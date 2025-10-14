// src/routes/geminiRoute.js
import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const router = express.Router();

// Render a simple page to chat (GET /chatbot)
router.get("/chatbot", (req, res) => {
  return res.render("chatbot"); // views/chatbot.ejs
});

// API endpoint (POST /chatbot)
router.post("/chatbot", async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // free & fast
    const userInput = req.body.message ?? "";

    const result = await model.generateContent(userInput);
    const reply = result.response.text();

    res.json({ reply });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({ error: "Gemini API call failed" });
  }
});

export default router;
