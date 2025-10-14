export const TRIGGERS = [
  { intent: 'ask_tutor',       patterns: [/ask a tutor/i, /need help/i, /tutor/i] },
  { intent: 'find_material',   patterns: [/find study material/i, /notes/i, /resources/i] },
  { intent: 'upload_help',     patterns: [/upload.*(assignment|pdf|file)/i, /how.*upload/i] },
  { intent: 'tutor_hours',     patterns: [/tutor.*(hours|available|schedule)/i, /(when|what).*tutor/i] },
];

export function matchIntentRuleFirst(text) {
  for (const trig of TRIGGERS) {
    if (trig.patterns.some(p => p.test(text))) return trig.intent;
  }
  return null; // let LLM classify
}

export const SUGGESTIONS = {
  ask_tutor: [
    "I need help with PRG381",
    "Here’s my error message…",
    "Can I get a tutor tomorrow morning?"
  ],
  find_material: [
    "Show me the notes for Database Systems",
    "Find SQL practice questions",
    "Where are lecture slides?"
  ],
  upload_help: [
    "How to upload a PDF",
    "Where is the upload button?",
    "What file types are accepted?"
  ],
  tutor_hours: [
    "When are tutors available?",
    "How do I contact a tutor?",
    "Can I book a slot?"
  ],
  fallback: [
    "Ask a tutor",
    "Find study material",
    "How do I upload an assignment?"
  ]
};
