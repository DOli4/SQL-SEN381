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
import editorRoutes from './editor.js';
import crudRoutes from './crud.js';
app.use('/', editorRoutes);
app.use('/', crudRoutes);

// Express error handler (keeps server alive)
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  try {
    res.status(500).send('<pre style="white-space:pre-wrap;">' + (err && err.stack || String(err)) + '</pre>');
  } catch (e) {
    res.status(500).end('Internal error');
  }
});

// Global safety nets
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SQL Script Web Panel running on http://localhost:${port}`));
