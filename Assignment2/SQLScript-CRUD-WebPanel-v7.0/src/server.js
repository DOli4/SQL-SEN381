// Application entry point.
// Responsibilities:
// - Load environment (.env) values
// - Configure Express with EJS + layouts, static assets, and body parsing
// - Mount feature routers (CRUD UI, script editor, diagnostics)
// - Provide a last-resort error handler and start the HTTP server

import path from 'node:path';                    // Path utilities for cross-platform file resolution
import express from 'express';                   // Web framework
import expressLayouts from 'express-ejs-layouts';// Simple layout support for EJS
import dotenv from 'dotenv';                     // Loads environment variables from .env

// Load .env from project root; `override: true` ensures process.env uses file values.
// This must run before any module reads process.env to avoid default fallbacks.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const app = express();                           // Create the Express application

// View engine setup (EJS) with a shared layout.
// - Views are looked up under ./views
// - All views render inside views/layout.ejs by default
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Parse URL-encoded form posts (from HTML forms) and serve static assets from /public.
// - `extended: true` allows rich objects/arrays in form bodies.
// - Static files include CSS, images, client-side scripts, etc.
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Log the key environment values used by the SQL layer and script panel.
// This is helpful during setup and troubleshooting; avoid logging secrets.
console.log(
  'ENV → SQL_SERVER=%s | SQL_DB=%s | SQL_AUTH=%s | SCRIPTS_DIR=%s',
  process.env.SQL_SERVER,
  process.env.SQL_DB,
  process.env.SQL_AUTH,
  process.env.SCRIPTS_DIR
);

// Home redirects to CRUD dashboard to keep a single entry point for users.
app.get('/', (req, res) => res.redirect('/crud'));

// Route registration: CRUD UI, script editor panel, and diagnostics endpoints.
// These routers encapsulate feature-specific endpoints to keep server.js minimal.
import crudRoutes from './crud.js';
import editorRoutes from './editor.js';
import diagRoutes from './diag.js';
app.use('/', crudRoutes);
app.use('/', editorRoutes);
app.use('/', diagRoutes);

// Central error handler to render a plain-text stack trace for unexpected errors.
// This keeps failures visible during development and simple deployments.
// In production, consider rendering a friendlier page and suppressing stack traces.
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).send('<pre>' + (err && err.stack || String(err)) + '</pre>');
});

// Defensive logging for unhandled promise rejections and uncaught exceptions.
// These ensure hard-to-trace failures are at least recorded in the server logs.
process.on('unhandledRejection', (reason, promise) =>
  console.error('unhandledRejection', reason)
);
process.on('uncaughtException', (err) =>
  console.error('uncaughtException', err)
);

// Start HTTP server on PORT (defaults to 3000).
// Use a dedicated process manager (e.g., PM2) or container runtime in production.
const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`SQL Script Web Panel running on http://localhost:${port}`)
);
