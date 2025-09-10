import path from 'node:path';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'public')));

console.log('ENV → SQL_SERVER=%s | SQL_DB=%s | SQL_AUTH=%s | SCRIPTS_DIR=%s',
  process.env.SQL_SERVER, process.env.SQL_DB, process.env.SQL_AUTH, process.env.SCRIPTS_DIR);

app.get('/', (req, res) => res.redirect('/crud'));

import crudRoutes from './crud.js';
import editorRoutes from './editor.js';
import diagRoutes from './diag.js';
app.use('/', crudRoutes);
app.use('/', editorRoutes);
app.use('/', diagRoutes);

// error handler
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).send('<pre>'+ (err && err.stack || String(err)) +'</pre>');
});

process.on('unhandledRejection', (r,p)=>console.error('unhandledRejection', r));
process.on('uncaughtException', e=>console.error('uncaughtException', e));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SQL Script Web Panel running on http://localhost:${port}`));
