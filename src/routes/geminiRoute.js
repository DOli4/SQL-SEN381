// src/routes/geminiRoute.js
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();
router.get("/chatbot", (req, res) => res.render("chatbot"));

const TRIGGERS = {
  tutor: [
    "ask a tutor", "contact a tutor", "need help", "help with", "assistance", "tutor"
  ],
  materials: [
    "find study material", "notes", "slides", "resources", "pdf"
  ],
  upload: [
    "upload", "submit assignment", "attach file", "how do i upload"
  ],
  hours: [
    "when are tutors available", "tutor availability", "office hours", "book a session"
  ],
};

function whichIntent(text) {
  const s = (text||"").toLowerCase();
  const hit = (list)=> list.some(p => s.includes(p));
  if (hit(TRIGGERS.tutor)) return "tutor";
  if (hit(TRIGGERS.materials)) return "materials";
  if (hit(TRIGGERS.upload)) return "upload";
  if (hit(TRIGGERS.hours)) return "hours";
  return "open";
}

router.post("/chatbot", async (req, res) => {
  try {
    const { message="", name="", email="", module="" } = req.body || {};
    const intent = whichIntent(message);

    // Compose a guided prompt (acts like Copilot "topic" + "variables")
    const system = `You are CampusLearnHelper, a friendly assistant for Belgium Campus students.
Respond clearly, step-by-step, with short paragraphs and bullet points.`;
    let task = "";

    if (intent === "tutor") {
      task = `Student is requesting tutor help.
Name: ${name || "Unknown"}  Email: ${email || "Unknown"}  Module: ${module || "Unknown"}
Ask for any missing details (name/email/module/question). Then acknowledge and outline next steps.
End with: "I can log a tutor request if you'd like."`;
    } else if (intent === "materials") {
      task = `Student needs study material for ${module || "an unspecified module"}.
Explain where to find materials in CampusLearn: Courses → Module → Resources (PDFs/slides/links). Ask a quick clarifier if module missing.`;
    } else if (intent === "upload") {
      task = `Student needs help uploading an assignment.
Give concise steps: go to module → Assignments → Upload → choose file (PDF/DOCX/ZIP) → Submit.
Mention common errors and how to fix.`;
    } else if (intent === "hours") {
      task = `Provide a generic mock schedule:
- Monday–Friday: 09:00–16:00
- Tutors reachable via CampusLearn chat or email during these hours.
Invite the student to share preferred time.`;
    } else {
      task = `General CampusLearn question. Answer helpfully. If unrelated to CampusLearn, say so briefly and ask a clarifying question.`;
    }

    const prompt = `${system}\n\nUser message: "${message}"\n\n${task}`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    return res.json({ reply: result.response.text(), intent });
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({ error: "Gemini API call failed" });
  }
});

export default router;
