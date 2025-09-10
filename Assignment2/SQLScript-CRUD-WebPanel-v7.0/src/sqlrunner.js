// src/sqlrunner.js (ESM)
// Purpose:
//   Minimal wrapper around the `sqlcmd` CLI to execute SQL Server work from Node.
//   - Reads connection settings from environment variables.
//   - Supports Windows or SQL authentication.
//   - Exposes three entry points:
//       * runSqlText : run ad-hoc SQL (returns raw stdout)
//       * runSqlFile : run a .sql file with optional :setvar variables (returns raw stdout)
//       * runJson    : run a SELECT ... FOR JSON ... and return parsed JSON
//   - Uses wide output and no truncation to keep JSON intact.
//   - Applies a hard process timeout to prevent hanging requests.
//
// Environment variables:
//   SQLCMD_PATH        : optional path to sqlcmd (default "sqlcmd")
//   SQL_SERVER         : server/instance, e.g. "lpc:.", "tcp:HOST,1433", "np:\\\\.\\pipe\\sql\\query"
//   SQL_DB             : database name (default "master")
//   SQL_AUTH           : "windows" | "sql" (default "windows")
//   SQL_USER / SQL_PASS: credentials when SQL_AUTH="sql"
//   SQLCMD_TIMEOUT_MS  : child process kill timeout in ms (default 30000)
// Notes:
//   - DEBUG_SQL=1 will print the effective sqlcmd arguments (including credentials).
//   - Do not combine `-h -1` with `-y/-Y`: we use `-y 0 -Y 0` to disable truncation.

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
  // Build common sqlcmd flags for non-truncated, single-line friendly output.
  // IMPORTANT: do not use -h -1 together with -y/-Y (they are mutually exclusive).
  // Here we use -y 0 and -Y 0 to disable max column length limits entirely.
  const args = [];
  if (AUTH === "windows") args.push("-E");
  else args.push("-U", USER, "-P", PASS);

  args.push(
    "-S", SERVER,   // server/instance
    "-d", DB,       // database
    "-l", "30",     // login timeout (seconds)
    "-b",           // bail out on errors (non-zero exit)
    "-r", "1",      // redirect errors to stderr
    "-w", "65535",  // very wide output to avoid wrapping
    "-y", "0",      // unlimited length for variable-length types
    "-Y", "0"       // unlimited length for wide types
  );
  // No -h here on purpose.
  return args;
}

function runSqlcmd(extraArgs) {
  // Spawn sqlcmd with a hard timeout; capture stdout/stderr verbatim.
  return new Promise((resolve) => {
    const args = [...makeBaseArgs(), ...extraArgs];
    if (process.env.DEBUG_SQL) console.log("sqlcmd args =>", args.join(" "));
    const cp = spawn(SQLCMD, args, { windowsHide: true });
    let out = "", err = "", done = false;

    const finish = (code) => { if (!done) { done = true; resolve({ stdout: out, stderr: err, code }); } };

    // Hard kill to prevent hanging child processes
    const t = setTimeout(() => {
      try { cp.kill("SIGKILL"); } catch {}
      err ||= `sqlcmd timeout after ${TIMEOUT}ms`;
      finish(1);
    }, TIMEOUT);

    cp.stdout.on("data", b => (out += b.toString("utf8")));
    cp.stderr.on("data", b => (err += b.toString("utf8")));
    cp.on("close", (code) => { clearTimeout(t); finish(code); });
    cp.on("error", (e) => { clearTimeout(t); err += String(e); finish(1); });
  });
}

/* ---------- helpers ---------- */

function buildSetvars(vars = {}) {
  // Convert { k: v } into a :setvar header. Newlines are stripped from values.
  const lines = [];
  for (const [k, v] of Object.entries(vars)) {
    const val = String(v).replace(/\r?\n/g, " ");
    lines.push(`:setvar ${k} ${val}`);
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}

function cleanJsonText(buf) {
  // Remove line breaks, BOM, and "(n rows affected)" tails that sqlcmd may add.
  return buf
    .replace(/\r?\n/g, "")                         // unwrap any line breaks
    .replace(/^\uFEFF/, "")                        // BOM
    .replace(/\(\d+\s+rows?\s+affected\)/gi, "")   // sqlcmd tail
    .trim();
}

/** Tolerant JSON extractor:
 *  - Prefers array slices [ ... ]
 *  - Falls back to object slice { ... } and stitches adjacent objects "}{"
 */
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

  // Nothing JSON-like found
  return "[]";
}

/* ---------- public API ---------- */

export async function runSqlFile(filePath, vars = {}) {
  // Execute a .sql file by generating a small wrapper that injects :setvar values
  // and includes the target file. Returns raw stdout.
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
  // Execute ad-hoc SQL by writing to a temp file (enables :setvar and consistent flags).
  // Returns raw stdout as text.
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
  // Execute a SELECT that returns JSON and parse it.
  // If the caller did not include FOR JSON, append PATH + INCLUDE_NULL_VALUES.
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
    // Surface the trimmed raw output to aid debugging malformed JSON
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
