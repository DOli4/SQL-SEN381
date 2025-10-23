    // src/utils/vstore.js
    import fs from "fs";
    import path from "path";

    const VSTORE_FILE = process.env.VSTORE_FILE || "./data/kb.jsonl";

    // single global in-memory docs array
    export const DOCS = globalThis.__KB__ ||= [];

    // ---- persistence helpers ----
    function ensureDir() {
    const dir = path.dirname(VSTORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    function writeAllToDisk() {
    ensureDir();
    const out =
        DOCS.map(row => JSON.stringify(row)).join("\n") + (DOCS.length ? "\n" : "");
    fs.writeFileSync(VSTORE_FILE, out, "utf8");
    }

    // reload JSONL file into memory
    export function reloadFromDisk() {
    DOCS.length = 0;
    if (!fs.existsSync(VSTORE_FILE)) return 0;
    const lines = fs.readFileSync(VSTORE_FILE, "utf8").split(/\r?\n/).filter(Boolean);
    for (const ln of lines) {
        try { DOCS.push(JSON.parse(ln)); } catch {}
    }
    return DOCS.length;
    }

    // replace all chunks belonging to one file
    export function replaceFile(fileName, rows) {
    for (let i = DOCS.length - 1; i >= 0; i--) {
        if (DOCS[i].file === fileName) DOCS.splice(i, 1);
    }
    for (const r of rows) DOCS.push(r);
    writeAllToDisk();
    return { added: rows.length };
    }

    // append many rows (kept for compatibility)
    export function appendMany(rows) {
    for (const r of rows) DOCS.push(r);
    writeAllToDisk();
    }

    // simple cosine similarity
    function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    // find top-k most similar docs
    export function topK(queryEmbedding, k = 6) {
    const scored = DOCS.map(d => ({ d, s: cosine(queryEmbedding, d.embedding || []) }));
    scored.sort((x, y) => y.s - x.s);
    return scored.slice(0, k).map(x => x.d);
    }

    // for /status
    export function countDocs() {
    return DOCS.length;
    }
