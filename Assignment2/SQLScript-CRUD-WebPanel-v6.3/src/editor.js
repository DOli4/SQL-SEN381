import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { runSqlFile } from './sqlrunner.js';

const router = express.Router();
const scriptsDir = path.resolve(process.cwd(), process.env.SCRIPTS_DIR || 'scripts');

function toPairs(text=''){
  const vars={};
  for (const line of text.split(/\r?\n/)) {
    const s=line.trim();
    if(!s || s.startsWith('#') || s.startsWith('//')) continue;
    const m = s.match(/^([^=]+)=(.*)$/);
    if(m){ vars[m[1].trim()] = m[2].trim(); }
  }
  return vars;
}

router.get('/panel', async (req, res) => {
  try {
    await fs.mkdir(scriptsDir, { recursive: true });
    const dirents = await fs.readdir(scriptsDir, { withFileTypes: true });
    const files = dirents.filter(d => d.isFile() && d.name.toLowerCase().endsWith('.sql')).map(d => d.name);
    res.render('panel', { files });
  } catch (e) {
    res.status(500).render('panel', { files: [], error: e.message });
  }
});

router.get('/script/:name', async (req, res) => {
  const name = req.params.name;
  const filePath = path.join(scriptsDir, name);
  const content = await fs.readFile(filePath, 'utf-8');
  res.render('script', { name, content, output: null, varsText: '', isError: false });
});

router.post('/script/:name/save', async (req, res) => {
  const name = req.params.name;
  const filePath = path.join(scriptsDir, name);
  await fs.writeFile(filePath, req.body.sql || '', 'utf-8');
  res.redirect('/script/' + encodeURIComponent(name));
});

router.post('/script/:name/run', async (req, res) => {
  const name = req.params.name;
  const filePath = path.join(scriptsDir, name);
  const varsText = req.body.vars || '';
  const vars = toPairs(varsText);
  if (req.body.sql) await fs.writeFile(filePath, req.body.sql, 'utf-8');
  try{
    const output = await runSqlFile(filePath, vars);
    const content = await fs.readFile(filePath, 'utf-8');
    res.render('script', { name, content, output, varsText, isError: false });
  }catch(e){
    const content = await fs.readFile(filePath, 'utf-8');
    res.status(500).render('script', { name, content, output: 'ERROR:\n' + e.message, varsText, isError: true });
  }
});

export default router;
