// src/sqlrunner.js (ESM)
import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";

const SQLCMD  = process.env.SQLCMD_PATH || "sqlcmd"; // full path if needed
const SERVER  = process.env.SQL_SERVER   || "lpc:.";
const DB      = process.env.SQL_DB       || "master";
const AUTH    = (process.env.SQL_AUTH    || "windows").toLowerCase(); // "windows" | "sql"
const USER    = process.env.SQL_USER     || "";
const PASS    = process.env.SQL_PASS     || "";
const TIMEOUT = Number(process.env.SQLCMD_TIMEOUT_MS || 30000);

/* ---------- low-level runner ---------- */

function makeBaseArgs() {
  // IMPORTANT: remove -h -1, add -y 0 -Y 0 to avoid truncation
  const args = [];
  if (AUTH === "windows") args.push("-E");
  else args.push("-U", USER, "-P", PASS);

  args.push(
    "-S", SERVER,
    "-d", DB,
    "-l", "30",    // login timeout
    "-b",          // stop on error
    "-r", "1",     // errors -> stderr
    "-w", "65535", // very wide so no wrapping
    "-y", "0",     // no max length for variable types
    "-Y", "0"      // no max length for wide types (NVARCHAR, etc.)
  );
  // Do NOT combine -h with -y/-Y.
  return args;
}

function runSqlcmd(extraArgs) {
  return new Promise((resolve) => {
    const args = [...makeBaseArgs(), ...extraArgs];
    if (process.env.DEBUG_SQL) console.log("sqlcmd args =>", args.join(" "));
    const cp = spawn(SQLCMD, args, { windowsHide: true });
    let out = "", err = "", done = false;

    const finish = (code) => { if (!done) { done = true; resolve({ stdout: out, stderr: err, code }); } };
    const t = setTimeout(() => { try { cp.kill("SIGKILL"); } catch {} err ||= `sqlcmd timeout after ${TIMEOUT}ms`; finish(1); }, TIMEOUT);

    cp.stdout.on("data", b => (out += b.toString("utf8")));
    cp.stderr.on("data", b => (err += b.toString("utf8")));
    cp.on("close", (code) => { clearTimeout(t); finish(code); });
    cp.on("error", (e) => { clearTimeout(t); err += String(e); finish(1); });
  });
}

/* ---------- helpers ---------- */

function buildSetvars(vars = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(vars)) {
    const val = String(v).replace(/\r?\n/g, " ");
    lines.push(`:setvar ${k} ${val}`);
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}

function cleanJsonText(buf) {
  return buf
    .replace(/\r?\n/g, "")                         // unwrap any line breaks
    .replace(/^\uFEFF/, "")                        // BOM
    .replace(/\(\d+\s+rows?\s+affected\)/gi, "")   // sqlcmd tail
    .trim();
}

/** Tolerant JSON extractor: handles headers, missing ']', glued objects. */
function extractJson(rawText) {
  const t = cleanJsonText(rawText);

  // Prefer array JSON
  const a = t.indexOf("[");
  const az = t.lastIndexOf("]");
  if (a !== -1) {
    return az === -1 ? t.slice(a) + "]" : t.slice(a, az + 1);
  }

  // Fallback: object JSON (or concatenated objects)
  const o = t.indexOf("{");
  const oz = t.lastIndexOf("}");
  if (o !== -1 && oz > o) {
    let chunk = t.slice(o, oz + 1);
    if (chunk.includes("}{")) chunk = "[" + chunk.replace(/}\s*{/g, "},{") + "]";
    return chunk;
  }

  return "[]";
}

/* ---------- public API ---------- */

export async function runSqlFile(filePath, vars = {}) {
  // Wrap with :setvar and include file so vars are available
  const wrapper = path.join(os.tmpdir(), `wrap_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n:r "${filePath.replace(/"/g, '""')}"\n`;
  await fs.writeFile(wrapper, script, "utf8");
  try {
    const { stdout, stderr, code } = await runSqlcmd(["-i", wrapper]);
    if (code !== 0) throw new Error(stderr || `sqlcmd exited ${code}`);
    return stdout.trim();
  } finally {
    fs.unlink(wrapper).catch(() => {});
  }
}

export async function runSqlText(sqlText, vars = {}) {
  const tmp = path.join(os.tmpdir(), `sql_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n${sqlText}\n`;
  await fs.writeFile(tmp, script, "utf8");
  try {
    const { stdout, stderr, code } = await runSqlcmd(["-i", tmp]);
    if (code !== 0) throw new Error(stderr || `sqlcmd exited ${code}`);
    return stdout.trim();
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
}

export async function runJson(sqlText, vars = {}) {
  // Keep caller batch intact; ensure final statement returns JSON
  let body = sqlText.trim().replace(/;\s*$/, "");
  if (!/FOR\s+JSON\s+/i.test(body)) {
    body += " FOR JSON PATH, INCLUDE_NULL_VALUES";
  }

  const sqlFile = path.join(os.tmpdir(), `json_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
  const outFile = path.join(os.tmpdir(), `json_${Date.now()}_${Math.random().toString(36).slice(2)}.out`);
  const script  = `${buildSetvars(vars)}SET NOCOUNT ON;\n${body};\n`;
  await fs.writeFile(sqlFile, script, "utf8");

  try {
    const { stderr, code } = await runSqlcmd(["-i", sqlFile, "-o", outFile]);
    if (code !== 0) throw new Error(stderr || `sqlcmd exited ${code}`);

    let raw = "";
    try { raw = await fs.readFile(outFile, "utf8"); } catch {}
    const jsonStr = extractJson(raw);

    if (!jsonStr) return [];
    return JSON.parse(jsonStr);
  } catch (e) {
    let raw = "";
    try { raw = await fs.readFile(outFile, "utf8"); } catch {}
    throw new Error(
      "Failed to parse JSON from sqlcmd: " + (e.message || e) +
      "\nRaw: " + (raw || "(no output)")
    );
  } finally {
    fs.unlink(sqlFile).catch(() => {});
    fs.unlink(outFile).catch(() => {});
  }
}


