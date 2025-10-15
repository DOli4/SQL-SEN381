import { setVars, getState } from "../utils/memory.js";
import { SUGGESTIONS } from "../utils/intents.js";
import { getPool } from "../db/mssql.js";

export async function handleAskTutor(userId, slots = {}) {
  // persist variables; ask for missing ones
  setVars(userId, slots);
  const { vars } = getState(userId);

  // Collect required fields
  const missing = [];
  if (!vars.module) missing.push("your module code (e.g., PRG381)");
  if (!vars.issue)  missing.push("a short description of the issue");

  if (missing.length) {
    return {
      reply:
        `I can connect you with a tutor.\n\nPlease provide ${missing.join(" and ")}.`,
      suggestedReplies: [
        "Module: PRG381",
        "Issue: I get a NullReferenceException in line 42",
      ]
    };
  }

  // Create a tutor ticket in DB (simplified)
  const pool = await getPool();
  const result = await pool.request()
    .input('UserId', userId)
    .input('Module', vars.module)
    .input('Issue', vars.issue)
    .query(`
      INSERT INTO TutorRequests(UserId, Module, Issue, Status, CreatedAt)
      OUTPUT inserted.Id
      VALUES(@UserId, @Module, @Issue, 'Open', SYSDATETIME());
    `);

  const ticketId = result.recordset[0]?.Id ?? "T-NEW";
  return {
    reply:
`Got it! I’ve logged your tutor request (#${ticketId}) for ${vars.module}.
A tutor will contact you during office hours (Mon–Fri, 09:00–16:00).
If you want, share code or screenshots for faster help.`,
    suggestedReplies: [
      "Here’s my error message…",
      "When can I expect a reply?",
      "Add a screenshot"
    ]
  };
}

export async function handleFindMaterial(userId, slots = {}) {
  setVars(userId, slots);
  const { vars } = getState(userId);
  const keyword = vars.topic || vars.module || "Database Systems";

  const pool = await getPool();
  const rs = await pool.request()
    .input('q', `%${keyword}%`)
    .query(`
      SELECT TOP 5 Title, Url
      FROM Resources
      WHERE Title LIKE @q OR Description LIKE @q
      ORDER BY CreatedAt DESC
    `);

  if (!rs.recordset.length) {
    return {
      reply: `I couldn’t find materials for “${keyword}”. Try another topic or module code.`,
      suggestedReplies: [
        "Find SQL joins practice",
        "Show me SEN381 lecture slides",
        "Find PRG381 tutorials"
      ]
    };
  }
  const lines = rs.recordset.map(r => `• ${r.Title}\n  ${r.Url}`).join('\n');
  return {
    reply: `Here are recent resources for **${keyword}**:\n\n${lines}`,
    suggestedReplies: [
      "More like this",
      "Open the first one",
      "Find video lectures"
    ]
  };
}

export async function handleUploadHelp() {
  return {
    reply:
`**How to upload on CampusLearn**
1. Go to your module.
2. Open **Assignments** → **Upload**.
3. Choose the file (PDF/DOCX/ZIP allowed, ≤ 25 MB).
4. Click **Submit**. You’ll see “File uploaded successfully”.`,
    suggestedReplies: [
      "What file types are allowed?",
      "Where is the upload button?",
      "Troubleshooting upload errors"
    ]
  };
}

export async function handleTutorHours() {
  return {
    reply:
`**Tutor availability**
• Monday—Friday: 09:00–16:00  
• Contact via CampusLearn chat or email during these hours.`,
    suggestedReplies: [
      "Book me a slot tomorrow morning",
      "How do I contact a tutor?",
      "Can I get help now?"
    ]
  };
}
