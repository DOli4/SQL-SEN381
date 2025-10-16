    // src/utils/vstore.js
    import fs from "fs";
    import path from "path";

    const FILE = process.env.VSTORE_FILE || "./data/kb.jsonl";

    export function appendMany(rows) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const out = rows.map(r => JSON.stringify(r)).join("\n") + "\n";
    fs.appendFileSync(FILE, out, "utf8");
    }

    export function* readAll() {
    if (!fs.existsSync(FILE)) return;
    const lines = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean);
    for (const line of lines) yield JSON.parse(line);
    }

    export function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na  += a[i] * a[i];
        nb  += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    export function topK(queryEmbedding, k = 6) {
    const all = Array.from(readAll());
    return all
        .map(r => ({ ...r, score: cosine(queryEmbedding, r.embedding) }))
        .sort((x, y) => y.score - x.score)
        .slice(0, k);
    }

    // (nice for a /status endpoint later)
    export function countDocs() {
    let n = 0;
    for (const _ of readAll()) n++;
    return n;
    }
