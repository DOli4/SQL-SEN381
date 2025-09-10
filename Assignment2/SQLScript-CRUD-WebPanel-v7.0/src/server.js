// Application entry point.
// Responsibilities:
// - Load environment (.env) values
// - Configure Express with EJS + layouts, static assets, and body parsing
// - Mount feature routers (CRUD UI, script editor, diagnostics)
// - Provide a last-resort error handler and start the HTTP server

import path from 'node:path';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';

// Load .env from project root; `override: true` ensures process.env uses file values.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const app = express();

// View engine setup (EJS) with a shared layout.
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Parse URL-encoded form posts and serve static assets from /public.
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Log the key environment values used by the SQL layer and script panel.
console.log(
  'ENV → SQL_SERVER=%s | SQL_DB=%s | SQL_AUTH=%s | SCRIPTS_DIR=%s',
  process.env.SQL_SERVER,
  process.env.SQL_DB,
  process.env.SQL_AUTH,
  process.env.SCRIPTS_DIR
);

// Home redirects to CRUD dashboard.
app.get('/', (req, res) => res.redirect('/crud'));

// Route registration: CRUD UI, script editor panel, and diagnostics endpoints.
import crudRoutes from './crud.js';
import editorRoutes from './editor.js';
import diagRoutes from './diag.js';
app.use('/', crudRoutes);
app.use('/', editorRoutes);
app.use('/', diagRoutes);

// Central error handler to render a plain-text stack trace for unexpected errors.
// This keeps failures visible during development and simple deployments.
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).send('<pre>' + (err && err.stack || String(err)) + '</pre>');
});

// Defensive logging for unhandled promise rejections and uncaught exceptions.
process.on('unhandledRejection', (reason, promise) =>
  console.error('unhandledRejection', reason)
);
process.on('uncaughtException', (err) =>
  console.error('uncaughtException', err)
);

// Start HTTP server.
const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`SQL Script Web Panel running on http://localhost:${port}`)
);
