import path from 'node:path';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bodyParser from "body-parser";

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

import { attachUser, requireAuth } from './middleware/auth.js';
import { getPool } from './db/mssql.js';

// page routers you already had
import crudRoutes from './crud.js';
import editorRoutes from './editor.js';
import diagRoutes from './diag.js';

// API routers
import authRoutes from './routes/auth.routes.js';
import topicsRoutes from './routes/topics.routes.js';
import studentsRoutes from './routes/students.routes.js';
import tutorsRoutes from './routes/tutors.routes.js';
import resourcesRoutes from './routes/resources.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import repliesRoutes from './routes/replies.routes.js';
import contentRoutes from './routes/content.routes.js'; // <<< one import
import subsRouter from './routes/subscriptions.routes.js'
app.use('/api', subsRouter)


const app = express();

// View engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Parsers & static
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Attach req.user/res.locals.user from JWT cookie
app.use((req, res, next) => {
  const t = req.cookies?.token;
  if (!t) { res.locals.user = null; return next(); }
  try {
    const payload = jwt.verify(t, process.env.JWT_SECRET);
    req.user = payload;          // { sub, email, name, role }
    res.locals.user = payload;   // usable in EJS: <%= user?.name %>
  } catch {
    res.locals.user = null;
  }
  next();
});

// Gemini route
import geminiRoute from "./routes/geminiRoute.js";
app.use("/", geminiRoute);

// view engine
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// health/db
app.get('/_ping', (req, res) => res.send('OK'));
app.get('/db-test', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT DB_NAME() AS Db, SUSER_SNAME() AS Login, GETDATE() AS Now');
    res.json(r.recordset[0]);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// page routers
app.use('/', crudRoutes);
app.use('/', editorRoutes);
app.use('/', diagRoutes);

// page guards
function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if ((req.user.role || req.user.RoleName) !== role) return res.status(403).send('Forbidden');
    next();
  };
}

// pages
app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/login', (req, res) => res.render('auth-login'));
app.get('/register', (req, res) => res.render('auth-register'));
app.get('/dashboard', requireLogin, (req, res) => res.render('dashboard'));
app.get('/topics', (req, res) => res.render('topics'));
app.get('/topics/create', requireRole('Student'), (req, res) => res.render('topic-create'));

app.get('/forum', (req, res) => res.render('forum'));
app.get('/forum/new', requireAuth, (req, res) => res.render('topic-new'));
app.get('/forum/:id', requireAuth, (req, res) => res.render('topic-detail', { topicId: Number(req.params.id) }));
app.get('/forum/:id/edit', requireAuth, (req, res) => res.render('topic-edit', { topicId: Number(req.params.id) }));

// API (each mounted ONCE)
app.use('/api/auth', authRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/tutors', tutorsRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/replies', repliesRoutes);
app.use('/api', contentRoutes); // <- gives /api/topics/:id/content and /api/content/:cid/*

// multer size error → clear message for test
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds maximum allowed size (5 MB)' });
  }
  next(err);
});

// last error handler
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).send('<pre>' + (err?.stack || String(err)) + '</pre>');
});

// logout
app.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: false });
  res.redirect('/login');
});

// start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SQL Script Web Panel running on http://localhost:${port}`));
