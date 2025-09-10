// src/sqlrunner.js (ESM)
import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";

const SQLCMD = process.env.SQLCMD_PATH || "sqlcmd";

/** Read env at call time so .env load order never bites us */
function cfg() {
  const rawSrv = process.env.SQL_SERVER || "lpc:.";
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

function makeBaseArgs({ shortLogin = false } = {}) {
  const c = cfg();
  const args = [];

  if (c.auth === "windows") {
    args.push("-E");
  } else {
    args.push("-U", c.user, "-P", c.pass);
  }

  args.push(
    "-S", c.server,
    "-d", c.db,
    "-l", shortLogin ? "2" : c.loginSeconds, // probe uses 2s
    "-b",
    "-r", "1",
    "-w", "65535",
    "-y", "0",
    "-Y", "0"
  );

  if (c.encrypt) {
    args.push("-N");
  }
  if (c.trustCert) {
    args.push("-C");
  }

  return args;
}

function runSqlcmd(extraArgs, { shortLogin = false } = {}) {
  const c = cfg();

  return new Promise((resolve) => {
    const args = [...makeBaseArgs({ shortLogin }), ...extraArgs];
    if (process.env.DEBUG_SQL) {
      // Avoid printing credentials
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

    const t = setTimeout(() => {
      try {
        cp.kill("SIGKILL");
      } catch {
        // ignore
      }
      if (!err) {
        err = `sqlcmd timeout after ${c.procTimeoutMs}ms`;
      }
      finish(1);
    }, c.procTimeoutMs);

    cp.stdout.on("data", (b) => {
      out += b.toString("utf8");
    });
    cp.stderr.on("data", (b) => {
      err += b.toString("utf8");
    });
    cp.on("close", (code) => {
      clearTimeout(t);
      finish(code);
    });
    cp.on("error", (e) => {
      clearTimeout(t);
      err += String(e);
      finish(1);
    });
  });
}

/* ---------- helpers ---------- */

function buildSetvars(vars = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(vars)) {
    const val = String(v).replace(/\r?\n/g, " ");
    lines.push(`:setvar ${k} ${val}`);
  }
  if (lines.length > 0) {
    return lines.join("\n") + "\n";
  } else {
    return "";
  }
}

function cleanJsonText(buf) {
  return buf
    .replace(/\r?\n/g, "") // unwrap line breaks
    .replace(/^\uFEFF/, "") // BOM
    .replace(/\(\d+\s+rows?\s+affected\)/gi, "") // sqlcmd footer
    .trim();
}

/** Tolerant JSON extractor: handles headers, missing ']', glued objects. */
function extractJson(rawText) {
  const t = cleanJsonText(rawText);

  const a = t.indexOf("[");
  const az = t.lastIndexOf("]");
  if (a !== -1) {
    if (az === -1) {
      return t.slice(a) + "]";
    } else {
      return t.slice(a, az + 1);
    }
  }

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

// Quick 2s probe using the exact same flags
async function probe() {
  const { stderr, code } = await runSqlcmd(
    ["-Q", "SET NOCOUNT ON; SELECT 1 AS ok;"],
    { shortLogin: true }
  );
  if (code !== 0) {
    throw new Error(stderr || "probe failed");
  }
}

/* ---------- public API ---------- */

export async function runSqlFile(filePath, vars = {}) {
  await probe();

  const wrapper = path.join(
    os.tmpdir(),
    `wrap_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`
  );
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n:r "${filePath.replace(/"/g, '""')}"\n`;
  await fs.writeFile(wrapper, script, "utf8");

  try {
    const { stdout, stderr, code } = await runSqlcmd(["-i", wrapper]);
    if (code !== 0) {
      throw new Error(stderr || `sqlcmd exited ${code}`);
    }
    return stdout.trim();
  } finally {
    try {
      await fs.unlink(wrapper);
    } catch {
      // ignore
    }
  }
}

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
    if (code !== 0) {
      throw new Error(stderr || `sqlcmd exited ${code}`);
    }
    return stdout.trim();
  } finally {
    try {
      await fs.unlink(tmp);
    } catch {
      // ignore
    }
  }
}

export async function runJson(sqlText, vars = {}) {
  await probe();

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
  const script = `${buildSetvars(vars)}SET NOCOUNT ON;\n${body};\n`;
  await fs.writeFile(sqlFile, script, "utf8");

  try {
    const { stderr, code } = await runSqlcmd(["-i", sqlFile, "-o", outFile]);
    if (code !== 0) {
      throw new Error(stderr || `sqlcmd exited ${code}`);
    }

    let raw = "";
    try {
      raw = await fs.readFile(outFile, "utf8");
    } catch {
      raw = "";
    }

    const jsonStr = extractJson(raw);
    if (!jsonStr) {
      return [];
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    let raw = "";
    try {
      raw = await fs.readFile(outFile, "utf8");
    } catch {
      raw = "";
    }
    throw new Error(
      "Failed to parse JSON from sqlcmd: " +
        (e.message || e) +
        "\nRaw: " +
        (raw || "(no output)")
    );
  } finally {
    try {
      await fs.unlink(sqlFile);
    } catch {
      // ignore
    }
    try {
      await fs.unlink(outFile);
    } catch {
      // ignore
    }
  }
}
