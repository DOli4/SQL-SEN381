    // src/utils/ingestLocalFolder.js
    import fs from "fs";
    import path from "path";
    import dotenv from "dotenv";
    import { pathToFileURL } from "url";

    const envPath = path.resolve(process.cwd(), ".env");
    dotenv.config({ path: envPath, override: true });

    import { appendMany } from "./vstore.js";
    import { embedTexts } from "../services/providers/gemini.js";

    import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
    import { createRequire } from "module";
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

    const pdfjsBase = path.dirname(require.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
    const standardFontsDir = path.join(pdfjsBase, "../../standard_fonts/");
    const standardFontDataUrl = pathToFileURL(standardFontsDir + "/").href;

    const ROOT = process.env.STUDYDOCS_DIR || "./data/studydocs";

    // ---------- helpers ----------
    function chunkText(txt, chunkChars = 1200, overlap = 150) {
    const out = [];
    let i = 0;
    while (i < txt.length) {
        out.push(txt.slice(i, i + chunkChars));
        i += Math.max(1, chunkChars - overlap);
    }
    return out.map(t => t.trim()).filter(Boolean);
    }

    async function extractPdfTextFromBuffer(uint8) {
    const doc = await pdfjsLib.getDocument({ data: uint8, standardFontDataUrl }).promise;
    let full = "";
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const textItems = content.items.map(i => ("str" in i ? i.str : "")).filter(Boolean);
        full += textItems.join(" ") + "\n";
    }
    try { await doc.cleanup(); } catch {}
    return full;
    }

    async function extractText(fullPath) {
    const ext = path.extname(fullPath).toLowerCase();
    try {
        if (ext === ".pdf") {
        const buf = fs.readFileSync(fullPath);
        const uint8 = new Uint8Array(buf);
        const text = await extractPdfTextFromBuffer(uint8);
        return (text || "").toString();
        }
        if (ext === ".txt" || ext === ".md") {
        return fs.readFileSync(fullPath, "utf8");
        }
        return "";
    } catch (err) {
        console.warn(`[ingest] failed to parse ${fullPath}:`, err?.message || err);
        return "";
    }
    }

    // ---------- NEW: single-file ingest (returns rows) ----------
    export async function ingestFile(fullPath) {
    const name = path.basename(fullPath);
    const text = (await extractText(fullPath)).replace(/\s+\n/g, "\n").trim();
    if (!text) {
        console.log(`[ingest] skipped (empty/unreadable): ${name}`);
        return [];
    }
    const chunks = chunkText(text);
    const embeddings = await embedTexts(chunks);
    return chunks.map((content, i) => ({
        id: `${name}#${i}`,
        file: name,
        content,
        embedding: embeddings[i],
    }));
    }

    // ---------- existing folder ingest (kept) ----------
    export async function ingestFolder() {
    if (!fs.existsSync(ROOT)) {
        console.log("[ingest] creating", ROOT);
        fs.mkdirSync(ROOT, { recursive: true });
    }
    const files = fs.readdirSync(ROOT).filter(f => /\.(pdf|txt|md)$/i.test(f));
    if (!files.length) {
        console.log("[ingest] no PDFs/TXTs/MDs found in", ROOT);
        return;
    }

    for (const name of files) {
        const full = path.join(ROOT, name);
        console.log("[ingest] reading", full.replace(/\\/g, "/"));

        const text = (await extractText(full)).replace(/\s+\n/g, "\n").trim();
        if (!text) {
        console.log(`[ingest] skipped (empty/unreadable): ${name}`);
        continue;
        }

        const chunks = chunkText(text);
        const embeddings = await embedTexts(chunks);
        const rows = chunks.map((content, i) => ({
        id: `${name}#${i}`,
        file: name,
        content,
        embedding: embeddings[i],
        }));
        appendMany(rows);
        console.log(`[ingest] stored ${rows.length} chunks from ${name}`);
    }
    }

    // ---------- run if invoked directly ----------
    const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
    const isMain = import.meta.url === invokedUrl;

    if (isMain) {
    console.log("[ingest] CWD:", process.cwd());
    console.log("[ingest] ROOT:", ROOT);
    if (fs.existsSync(ROOT)) console.log("[ingest] files in ROOT:", fs.readdirSync(ROOT));
    else console.log("[ingest] ROOT does not exist");
    ingestFolder()
        .then(() => console.log("[ingest] done"))
        .catch(err => { console.error("[ingest] failed:", err); process.exitCode = 1; });
    }
