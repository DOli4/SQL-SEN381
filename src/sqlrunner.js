// src/sqlrunner.js (ESM)
// Purpose:
//   Thin wrapper around `sqlcmd` to execute SQL Server commands safely from Node.
//   - Reads connection settings from environment variables at call time (not at import time).
//   - Supports Windows or SQL authentication, TCP/LPC/NP transports, TLS encryption and trust options.
//   - Provides three execution modes:
//       * runSqlText   : run ad-hoc SQL and return raw stdout
//       * runSqlFile   : run a .sql file with optional :setvar variables
//       * runJson      : run a SELECT ... FOR JSON ... and return parsed JSON
//   - Includes a quick connection probe (2s) before each call to fail fast on connectivity issues.
//   - Cleans typical `sqlcmd` noise and tolerantly extracts JSON.
// Environment variables:
//   SQLCMD_PATH           : optional path to sqlcmd (default "sqlcmd")
//   SQL_SERVER            : e.g., "tcp:100.94.59.10,1433" | "lpc:." | "np:\\\\.\\pipe\\sql\\query"
//   SQL_DB                : database name (default "master")
//   SQL_AUTH              : "windows" or "sql" (default "windows")
//   SQL_USER              : SQL login (when SQL_AUTH=sql)
//   SQL_PASS              : SQL password (when SQL_AUTH=sql)
//   SQL_ENCRYPT           : "true" to request encryption (-N), else false
//   SQL_TRUST_CERT        : "true" to trust server cert (-C), else false
//   SQLCMD_LOGIN_SECONDS  : login timeout in seconds (default 10; probe uses 2s)
//   SQLCMD_TIMEOUT_MS     : hard kill timeout for the child process (default 120000)
//
// Notes:
//   - Set DEBUG_SQL=1 to print effective `sqlcmd` arguments (password is masked).

import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";

const SQLCMD = process.env.SQLCMD_PATH || "sqlcmd";

/**
 * Snapshot the current environment at call time.
 * This avoids import-order issues (e.g., when .env loads after this module is imported).
 */
function cfg() {
  const rawSrv = process.env.SQL_SERVER || "lpc:.";
  // Normalize server to include an explicit transport prefix unless already present.
  const server = /^(lpc:|np:|tcp:)/i.test(rawSrv) ? rawSrv : `tcp:${rawSrv}`;

  return {
    server,
    db: process.env.SQL_DB || "master",
    auth: (process.env.SQL_AUTH || "windows").toLowerCase(), // "windows" | "sql"
    user: process.env.SQL_USER || "",
    pass: process.env.SQL_PASS || "",
    encrypt: (process.env.SQL_ENCRYPT || "false").toLowerCase() === "true",
    trustCert: (process.env.SQL_TRUST_CERT || "false").toLowerCase() === "true",
    loginSeconds: String(process.env.SQLCMD_LOGIN_SECONDS || 10),
    procTimeoutMs: Number(process.env.SQLCMD_TIMEOUT_MS || 120000),
  };
}

/* ---------- low-level runner ---------- */

/**
 * Build the base argument vector for sqlcmd.
 * @param {Object} opts
 * @param {boolean} opts.shortLogin - if true, use a short login timeout (2s) for probes.
 */
function makeBaseArgs({ shortLogin = false } = {}) {
  const c = cfg();
  const args = [];

  // Authentication: Windows (-E) or SQL (-U/-P)
  if (c.auth === "windows") {
    args.push("-E");
  } else {
    args.push("-U", c.user, "-P", c.pass);
  }

  // Core options:
  // -S server        : target server/transport
  // -d db           : database
  // -l seconds      : login timeout
  // -b              : exit with nonzero code on SQL error
  // -r 1            : redirect errors to stderr
  // -w 65535        : very wide output to avoid wrapping
  // -y 0, -Y 0      : no truncation for variable/long types
  args.push(
    "-S", c.server,
    "-d", c.db,
    "-l", shortLogin ? "2" : c.loginSeconds,
    "-b",
    "-r", "1",
    "-w", "65535",
    "-y", "0",
    "-Y", "0"
  );

  // TLS controls
  if (c.encrypt) args.push("-N");
  if (c.trustCert) args.push("-C");

  return args;
}

/**
 * Spawn `sqlcmd` and capture stdout/stderr with a hard kill timeout.
 * @param {string[]} extraArgs - additional args (-Q, -i, -o, etc.)
 * @param {Object} opts
 * @param {boolean} opts.shortLogin - use 2s login timeout (for probe).
 * @returns {{stdout:string, stderr:string, code:number}}
 */
function runSqlcmd(extraArgs, { shortLogin = false } = {}) {
  const c = cfg();

  return new Promise((resolve) => {
    const args = [...makeBaseArgs({ shortLogin }), ...extraArgs];
    if (process.env.DEBUG_SQL) {
      // Avoid printing credentials. Everything else is logged to aid troubleshooting.
      const safeArgs = args.map((a, i) => (a === "-P" ? "<PASSWORD>" : a));
      console.log("sqlcmd args =>", safeArgs.join(" "));
    }

    const cp = spawn(SQLCMD, args, { windowsHide: true });
    let out = "";
    let err = "";
    let done = false;

    const finish = (code) => {
      if (!done) {
        done = true;
        resolve({ stdout: out, stderr: err, code });
      }
    };

    // Kill the process if it hangs longer than procTimeoutMs.
    const t = setTimeout(() => {
      try { cp.kill("SIGKILL"); } catch { /* ignore */ }
      if (!err) err = `sqlcmd timeout after ${c.procTimeoutMs}ms`;
      finish(1);
    }, c.procTimeoutMs);

    cp.stdout.on("data", (b) => { out += b.toString("utf8"); });
    cp.stderr.on("data", (b) => { err += b.toString("utf8"); });
    cp.on("close", (code) => { clearTimeout(t); finish(code); });
    cp.on("error", (e) => { clearTimeout(t); err += String(e); finish(1); });
  });
}

/* ---------- helpers ---------- */

/**
 * Build a :setvar header for use at the top of a temp script.
 * - Newlines are stripped from values to keep the header single-line per var.
 */
function buildSetvars(vars = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(vars)) {
    const val = String(v).replace(/\r?\n/g, " ");
    lines.push(`:setvar ${k} ${val}`);
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}

/**
 * Normalize `sqlcmd` textual output before JSON extraction:
 * - Remove CR/LF to make it a single line.
 * - Remove UTF-8 BOM if present.
 * - Remove "(N rows affected)" tails injected by sqlcmd.
 */
function cleanJsonText(buf) {
  return buf
    .replace(/\r?\n/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/\(\d+\s+rows?\s+affected\)/gi, "")
    .trim();
}

/**
 * Tolerant JSON extractor.
 * Handles:
 *  - Extra text before/after the JSON payload
 *  - Missing closing `]` for arrays (best-effort)
 *  - Concatenated object payloads (`}{`) by converting to an array
 */
function extractJson(rawText) {
  const t = cleanJsonText(rawText);

  // Prefer arrays: they are the typical output of "FOR JSON PATH"
  const a = t.indexOf("[");
  const az = t.lastIndexOf("]");
  if (a !== -1) {
    if (az === -1) {
      return t.slice(a) + "]"; // best-effort close
    } else {
      return t.slice(a, az + 1);
    }
  }

  // Fallback: detect a single object and wrap/glue if necessary
  const o = t.indexOf("{");
  const oz = t.lastIndexOf("}");
  if (o !== -1 && oz > o) {
    let chunk = t.slice(o, oz + 1);
    if (chunk.includes("}{")) {
      chunk = "[" + chunk.replace(/}\s*{/g, "},{") + "]";
    }
    return chunk;
  }

  return "[]";
}

/**
 * Quick probe (2s login timeout) to fail fast if connectivity/auth is broken.
 * Uses the same transport/auth/TLS flags as real calls.
 */
async function probe() {
  const { stderr, code } = await runSqlcmd(
    ["-Q", "SET NOCOUNT ON; SELECT 1 AS ok;"],
    { shortLogin: true }
  );
  if (code !== 0) throw new Error(stderr || "probe failed");
}

/* ---------- public API ---------- */

/**
 * Execute a .sql file with optional :setvar variables.
 * The file path is wrapped with a small header to set NOCOUNT and inject variables.
 * Returns raw stdout from sqlcmd.
 */
export async function runSqlFile(filePath, vars = {}) {
  await probe();

  const wrapper = path.join(
    os.tmpdir(),
    `wrap_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`
  );

  // Include :setvar header + NOCOUNT + file include
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n:r "${filePath.replace(/"/g, '""')}"\n`;

  // NOTE: write the actual script contents, not the string "utf8".
  await fs.writeFile(wrapper, script, "utf8");

  try {
    const { stdout, stderr, code } = await runSqlcmd(["-i", wrapper]);
    if (code !== 0) throw new Error(stderr || `sqlcmd exited ${code}`);
    return stdout.trim();
  } finally {
    try { await fs.unlink(wrapper); } catch { /* ignore */ }
  }
}

/**
 * Execute ad-hoc SQL text by writing to a temp script and running it via sqlcmd.
 * Variables are injected via a :setvar header to keep quoting simple and safe.
 * Returns raw stdout from sqlcmd.
 */
export async function runSqlText(sqlText, vars = {}) {
  await probe();

  const tmp = path.join(
    os.tmpdir(),
    `sql_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`
  );
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n${sqlText}\n`;
  await fs.writeFile(tmp, script, "utf8");

  try {
    const { stdout, stderr, code } = await runSqlcmd(["-i", tmp]);
    if (code !== 0) throw new Error(stderr || `sqlcmd exited ${code}`);
    return stdout.trim();
  } finally {
    try { await fs.unlink(tmp); } catch { /* ignore */ }
  }
}

/**
 * Execute a SELECT ... FOR JSON ... query and return parsed JSON.
 * If the caller did not include FOR JSON, it is appended (PATH + INCLUDE_NULL_VALUES).
 * Output is written to a temp file (-o) to avoid stdout/CRLF issues, then parsed tolerantly.
 */
export async function runJson(sqlText, vars = {}) {
  await probe();

  // Ensure the statement ends with a FOR JSON clause; avoid duplicating semicolons.
  let body = sqlText.trim().replace(/;\s*$/, "");
  if (!/FOR\s+JSON\s+/i.test(body)) {
    body += " FOR JSON PATH, INCLUDE_NULL_VALUES";
  }

  const sqlFile = path.join(
    os.tmpdir(),
    `json_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`
  );
  const outFile = path.join(
    os.tmpdir(),
    `json_${Date.now()}_${Math.random().toString(36).slice(2)}.out`
  );

  // Keep the batch minimal and deterministic (NOCOUNT; single statement).
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n${body};\n`;
  await fs.writeFile(sqlFile, script, "utf8");

  try {
    const { stderr, code } = await runSqlcmd(["-i", sqlFile, "-o", outFile]);
    if (code !== 0) throw new Error(stderr || `sqlcmd exited ${code}`);

    // Read and parse the output file
    let raw = "";
    try { raw = await fs.readFile(outFile, "utf8"); } catch { raw = ""; }

    const jsonStr = extractJson(raw);
    if (!jsonStr) return [];
    return JSON.parse(jsonStr);
  } catch (e) {
    // Attach the raw output to help diagnose malformed JSON or sqlcmd errors.
    let raw = "";
    try { raw = await fs.readFile(outFile, "utf8"); } catch { raw = ""; }
    throw new Error(
      "Failed to parse JSON from sqlcmd: " +
        (e.message || e) +
        "\nRaw: " +
        (raw || "(no output)")
    );
  } finally {
    // Cleanup temp artifacts regardless of success/failure.
    try { await fs.unlink(sqlFile); } catch { /* ignore */ }
    try { await fs.unlink(outFile); } catch { /* ignore */ }
  }
}
