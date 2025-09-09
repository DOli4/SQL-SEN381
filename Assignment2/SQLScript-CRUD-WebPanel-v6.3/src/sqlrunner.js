import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';

const SERVER = process.env.SQL_SERVER || 'lpc:.';
const DB     = process.env.SQL_DB     || 'master';
const AUTH   = (process.env.SQL_AUTH || 'windows').toLowerCase();
const USER   = process.env.SQL_USER || '';
const PASS   = process.env.SQL_PASS || '';

function buildArgs(extra=[]) {
  // -w sets console width; -y/-Y unlimited lengths to avoid truncation
  const base = ['-S', SERVER, '-d', DB, '-b', '-r', '1', '-W', '-h', '-1', '-w', '65535', '-Y', '0', '-y', '0'];
  if (AUTH === 'windows') base.push('-E'); else { base.push('-U', USER, '-P', PASS); }
  return base.concat(extra);
}

async function spawnSqlcmd(extraArgs, inputFile) {
  return new Promise((resolve, reject) => {
    const args = buildArgs(extraArgs);
    const child = spawn('sqlcmd', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err || `sqlcmd exited ${code}`));
      resolve(out.trim());
    });
  });
}

export function runSqlFile(filePath, vars = {}) {
  const extra = ['-i', filePath];
  for (const [k, v] of Object.entries(vars)) extra.push('-v', `${k}=${JSON.stringify(String(v))}`);
  return spawnSqlcmd(extra);
}

export async function runSqlText(sqlText, vars = {}) {
  const tmp = path.join(os.tmpdir(), `sql_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
  await fs.writeFile(tmp, sqlText, 'utf-8');
  try { return await runSqlFile(tmp, vars); }
  finally { fs.unlink(tmp).catch(()=>{}); }
}

export async function runJson(sqlText, vars = {}) {
  // Build SQL with NOCOUNT and JSON wrapper
  let text = 'SET NOCOUNT ON; SET ANSI_WARNINGS OFF;\n' + sqlText.trim();
  if (!/FOR\s+JSON\s+/i.test(text)) {
    if (!/;\s*$/.test(text)) text += ' ';
    text += 'FOR JSON PATH, INCLUDE_NULL_VALUES;';
  }
  const sqlFile = path.join(os.tmpdir(), `json_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
  const outFile = path.join(os.tmpdir(), `json_${Date.now()}_${Math.random().toString(36).slice(2)}.out`);
  await fs.writeFile(sqlFile, text, 'utf-8');
  try {
    const extra = ['-i', sqlFile, '-o', outFile];
    for (const [k, v] of Object.entries(vars)) extra.push('-v', `${k}=${JSON.stringify(String(v))}`);
    await spawnSqlcmd(extra);
    const raw = await fs.readFile(outFile, 'utf-8');
    const start = raw.indexOf('[');
    const end   = raw.lastIndexOf(']');
    const jsonStr = (start !== -1 && end !== -1 && end > start) ? raw.slice(start, end+1) : raw;
    return JSON.parse(jsonStr);
  } catch (e) {
    const raw = await fs.readFile(outFile).catch(()=>Buffer.from(''));
    throw new Error('Failed to parse JSON from sqlcmd: ' + e.message + '\nRaw: ' + raw.toString('utf-8').slice(0, 4000));
  } finally {
    fs.unlink(sqlFile).catch(()=>{});
    fs.unlink(outFile).catch(()=>{});
  }
}
