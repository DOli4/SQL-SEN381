// Panel/editor routes for working with .sql files on disk.
// Responsibilities:
// - List .sql scripts from the configured scripts directory
// - Open a script for editing
// - Save changes to a script
// - Execute a script via sqlcmd (using runSqlFile), with optional variables
//
// Notes:
// - Variables are provided as key=value lines and passed through to sqlcmd via :setvar.
// - Scripts are read/written under `scriptsDir` which defaults to ./scripts relative to process.cwd().
// - Basic, synchronous workflow intended for local/admin use, not multi-tenant scenarios.

import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { runSqlFile } from './sqlrunner.js';

const router = express.Router();

// Absolute path to the scripts directory (creates a stable root for all file operations).
// SCRIPTS_DIR can be set in the environment; otherwise default to ./scripts.
const scriptsDir = path.resolve(process.cwd(), process.env.SCRIPTS_DIR || 'scripts');

// Parse a multi-line "key=value" text into an object suitable for :setvar injection.
// - Ignores blank lines
// - Ignores lines starting with '#' or '//' (comments)
// - Keeps everything after the first '=' as the value (so values can contain '=')
function toPairs(text=''){
  const vars={};
  for (const line of text.split(/\r?\n/)) {
    const s=line.trim(); if(!s || s.startsWith('#') || s.startsWith('//')) continue;
    const m = s.match(/^([^=]+)=(.*)$/); if(m){ vars[m[1].trim()] = m[2].trim(); }
  }
  return vars;
}

// GET /panel
// Render the main panel with a list of available .sql files.
// Ensures the scripts directory exists, then lists files ending in .sql (case-insensitive).
router.get('/panel', async (req,res)=>{
  await fs.mkdir(scriptsDir, {recursive:true});
  const dirents = await fs.readdir(scriptsDir, { withFileTypes:true });
  const files = dirents.filter(d=>d.isFile() && d.name.toLowerCase().endsWith('.sql')).map(d=>d.name);
  res.render('panel', { files });
});

// GET /script/:name
// Open a specific script for viewing/editing.
// Reads the file contents and renders the editor view with empty output/vars.
router.get('/script/:name', async (req,res)=>{
  const name=req.params.name; const filePath=path.join(scriptsDir, name);
  const content=await fs.readFile(filePath,'utf-8');
  res.render('script', { name, content, output:null, varsText:'', isError:false });
});

// POST /script/:name/save
// Persist changes from the editor to disk and redirect back to the editor.
// The body field "sql" contains the script text to save.
router.post('/script/:name/save', async (req,res)=>{
  const name=req.params.name; const filePath=path.join(scriptsDir, name);
  await fs.writeFile(filePath, req.body.sql||'', 'utf-8');
  res.redirect('/script/'+encodeURIComponent(name));
});

// POST /script/:name/run
// Execute the script via sqlcmd, optionally after saving edited text,
// and render the output.
// Variable lines from the right-hand panel are parsed and passed to sqlcmd.
router.post('/script/:name/run', async (req,res)=>{
  const name=req.params.name; const filePath=path.join(scriptsDir, name);
  const vars = toPairs(req.body.vars||''); if (req.body.sql) await fs.writeFile(filePath, req.body.sql,'utf-8');
  try{
       // Run the script with variables; runSqlFile handles constructing :setvar header and invoking sqlcmd.
       const output = await runSqlFile(filePath, vars);
       const content=await fs.readFile(filePath,'utf-8');
       res.render('script', { name, content, output, varsText:req.body.vars||'', isError:false });
  }catch(e){
       // On failure, keep the editor state and show the error in the output pane.
       const content=await fs.readFile(filePath,'utf-8');
       res.status(500).render('script', { name, content, output:'ERROR:\n'+e.message, varsText:req.body.vars||'', isError:true });
  }
});

export default router;

