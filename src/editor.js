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
// Using path.resolve with process.cwd() avoids surprises when the app is launched from a different directory.
const scriptsDir = path.resolve(process.cwd(), process.env.SCRIPTS_DIR || 'scripts');

// Parse a multi-line "key=value" text into an object suitable for :setvar injection.
// - Ignores blank lines
// - Ignores lines starting with '#' or '//' (comments)
// - Keeps everything after the first '=' as the value (so values can contain '=')
// This function is intentionally tolerant to make the right-hand "Variables" box easy to use.
function toPairs(text=''){
  const vars={};
  for (const line of text.split(/\r?\n/)) {
    const s=line.trim(); if(!s || s.startsWith('#') || s.startsWith('//')) continue; // skip empties and comments
    const m = s.match(/^([^=]+)=(.*)$/); if(m){ vars[m[1].trim()] = m[2].trim(); }     // left of '=' is the key; the rest is the value
  }
  return vars;
}

// GET /panel
// Render the main panel with a list of available .sql files.
// Ensures the scripts directory exists, then lists files ending in .sql (case-insensitive).
// The template shows each file with a button that links to the editor view.
router.get('/panel', async (req,res)=>{
  await fs.mkdir(scriptsDir, {recursive:true});                                   // create scripts dir on first use
  const dirents = await fs.readdir(scriptsDir, { withFileTypes:true });           // read directory entries
  const files = dirents
    .filter(d=>d.isFile() && d.name.toLowerCase().endsWith('.sql'))               // only .sql files
    .map(d=>d.name);                                                              // keep bare names for display
  res.render('panel', { files });
});

// GET /script/:name
// Open a specific script for viewing/editing.
// Reads the file contents and renders the editor view with empty output/vars.
// Assumes :name is a file from /panel; path.join confines reads to scriptsDir.
router.get('/script/:name', async (req,res)=>{
  const name=req.params.name;                                                     // raw filename from the route
  const filePath=path.join(scriptsDir, name);                                     // normalize to full path under scriptsDir
  const content=await fs.readFile(filePath,'utf-8');                              // read script text
  res.render('script', { name, content, output:null, varsText:'', isError:false });
});

// POST /script/:name/save
// Persist changes from the editor to disk and redirect back to the editor.
// The body field "sql" contains the script text to save.
// Writes are atomic from Node’s perspective; no extra locking is required for single-user admin usage.
router.post('/script/:name/save', async (req,res)=>{
  const name=req.params.name;
  const filePath=path.join(scriptsDir, name);
  await fs.writeFile(filePath, req.body.sql||'', 'utf-8');                        // save editor content (empty string if undefined)
  res.redirect('/script/'+encodeURIComponent(name));                              // PRG pattern to avoid resubmits
});

// POST /script/:name/run
// Execute the script via sqlcmd, optionally after saving edited text,
// and render the output.
// Variable lines from the right-hand panel are parsed and passed to sqlcmd.
// Errors from sqlcmd are caught and rendered verbatim to assist troubleshooting.
router.post('/script/:name/run', async (req,res)=>{
  const name=req.params.name;
  const filePath=path.join(scriptsDir, name);
  const vars = toPairs(req.body.vars||'');                                        // parse key=value lines for :setvar
  if (req.body.sql) await fs.writeFile(filePath, req.body.sql,'utf-8');           // optional save-before-run if SQL text was edited
  try{
       // Run the script with variables; runSqlFile handles constructing :setvar header and invoking sqlcmd.
       const output = await runSqlFile(filePath, vars);                           // returns raw sqlcmd stdout
       const content=await fs.readFile(filePath,'utf-8');                         // reload file to reflect any external changes
       res.render('script', { name, content, output, varsText:req.body.vars||'', isError:false });
  }catch(e){
       // On failure, keep the editor state and show the error in the output pane.
       // e.message already contains the stderr or exit code summary from sqlrunner.
       const content=await fs.readFile(filePath,'utf-8');
       res.status(500).render('script', { name, content, output:'ERROR:\n'+e.message, varsText:req.body.vars||'', isError:true });
  }
});

export default router;
