// src/services/utils/text.js
// Extracts text from PDF, DOCX, PPTX, TXT, MD in Node.js (ESM-safe)

import mammoth from "mammoth";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/** Load pdf-parse in a way that works in ESM or CJS */
let _pdfParseFn = null;
async function pdfParseWrapper(buffer) {
  if (!_pdfParseFn) {
    try {
      // Try dynamic ESM import first
      const mod = await import("pdf-parse");
      _pdfParseFn = mod.default || mod;   // handle both shapes
    } catch {
      // Fallback to CJS require via createRequire
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const mod = require("pdf-parse");
      _pdfParseFn = mod.default || mod;
    }
  }
  return _pdfParseFn(buffer);
}

/** Split into overlapping chunks for embedding */
export function chunkText(text, size = 1200, overlap = 200) {
  const out = [];
  for (let i = 0; i < text.length; i += (size - overlap)) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

/** Extract text from PPTX by reading slide XML and pulling <a:t> text runs */
async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const slideFiles = Object.keys(zip.files)
    .filter(f => f.startsWith("ppt/slides/slide") && f.endsWith(".xml"))
    .sort();

  const texts = [];
  function collectAT(node) {
    if (!node || typeof node !== "object") return;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (k === "a:t") {
        if (Array.isArray(v)) v.forEach(x => texts.push(String(x)));
        else texts.push(String(v));
      } else {
        collectAT(v);
      }
    }
  }

  for (const f of slideFiles) {
    const xml = await zip.files[f].async("string");
    const json = parser.parse(xml);
    collectAT(json);
    texts.push(""); // blank line between slides
  }

  return texts.join("\n").trim();
}

/** Extract raw text based on file extension */
export async function extractText(buffer, filename = "") {
  const f = (filename || "").toLowerCase();

  // PDF
  if (f.endsWith(".pdf")) {
    const { text } = await pdfParseWrapper(buffer);   // <-- robust loader
    return text || "";
  }

  // DOCX
  if (f.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }

  // PPTX
  if (f.endsWith(".pptx")) {
    try {
      return await extractPptxText(buffer);
    } catch (e) {
      console.warn("PPTX parse failed:", e.message);
      return "";
    }
  }

  // Plain text / Markdown
  if (f.endsWith(".txt") || f.endsWith(".md")) {
    return Buffer.from(buffer).toString("utf8");
  }

  // Fallback
  return Buffer.from(buffer).toString("utf8");
}
