import path from 'node:path';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const app = express();

// Load .env early
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

// ✅ Parsers FIRST (so req.body works for ALL routes)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Static + views
app.use(express.static(path.resolve(process.cwd(), 'public')));
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Optional custom auth helpers you had
import { attachUser, requireAuth } from './middleware/auth.js';
import { getPool } from './db/mssql.js';

// Page routers (you had these)
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
import contentRoutes from './routes/content.routes.js';
import subsRouter from './routes/subscriptions.routes.js';
import geminiRoute from "./routes/geminiRoute.js"; // Gemini API
import { reloadFromDisk } from "./utils/vstore.js";
const docsCount = reloadFromDisk();
console.log(`[vstore] Loaded ${docsCount} chunks into memory.`);
import profileRoutes from './routes/profile.routes.js';
import anonRoutes from './routes/anon.routes.js';




// Attach req.user/res.locals.user from JWT cookie (kept from your file)
app.use((req, res, next) => {
  const t = req.cookies?.token;
  if (!t) { res.locals.user = null; return next(); }
  try {
    const payload = jwt.verify(t, process.env.JWT_SECRET);
    req.user = payload;          // { sub, email, name, role }
    res.locals.user = payload;   // usable in EJS
  } catch {
    res.locals.user = null;
  }
  next();
});

// Health/DB
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

// Pages
app.use('/', crudRoutes);
app.use('/', editorRoutes);
app.use('/', diagRoutes);
app.use('/', profileRoutes);


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
app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/login', (req, res) => res.render('auth-login'));
app.get('/register', (req, res) => res.render('auth-register'));

// Splash after login/register
app.get('/splash/:kind(login|register)', requireLogin, (req, res) => {
  const kind = req.params.kind; // 'login' or 'register'
  res.render('splash', {
    kind,
    user: req.user,            // already set by JWT middleware
    goTo: '/dashboard',
    delayMs: 5000
  });
});

app.get('/dashboard', requireLogin, (req, res) => res.render('dashboard'));
// Chatbot page (renders chatbot.ejs)
app.get('/chatbot', (req, res) => res.render('chatbot', { pageClass: 'theme-dark' }));
app.get('/topics', (req, res) => res.render('topics'));
app.get('/topics/create', requireRole('Student'), (req, res) => res.render('topic-create'));
app.get('/forum', (req, res) => res.render('forum'));
app.get('/forum/new', requireAuth, (req, res) => res.render('topic-new'));
app.get('/forum/:id', requireAuth, (req, res) => res.render('topic-detail', { topicId: Number(req.params.id) }));
app.get('/forum/:id/edit', requireAuth, (req, res) => res.render('topic-edit', { topicId: Number(req.params.id) }));

// ✅ API (mounted once each)
// LIST: /courses
app.get('/courses', requireLogin, (req, res) => {
  // demo data – replace with DB later
  const courses = [
    { id: 'sen381', name: 'Intro to Databases', tutor: 'Tutor Name', banner: '/images/frontPage.jpg' },
    { id: 'wd101',  name: 'Web Dev Fundamentals', tutor: 'Tutor Name', banner: '/images/frontPage.jpg' },
    { id: 'alg101', name: 'Algorithms 101', tutor: 'Tutor Name', banner: '/images/frontPage.jpg' },
  ];
  res.render('courses', { user: req.user, courses });
});

// DETAIL: /courses/:id
app.get('/courses/:id', requireLogin, (req, res) => {
  const course = {
    id: req.params.id,
    title: 'SEN381 · Intro to Software Engineering', // swap with real title from DB
  };

  // Placeholder table of contents (mock). Replace with DB data later.
  const toc = [
    {
      groupId: 'w1',
      groupTitle: 'Week 1 - Intro to Software Engineering',
      items: [
        { id: 'w1-1', title: '01. Introduction to Software Engineering' },
        { id: 'w1-2', title: 'In-class Quiz · What is Software?' },
        { id: 'w1-3', title: '02. Programming in Software Engineering' },
        { id: 'w1-4', title: 'Homework · Predict the output' },
        { id: 'w1-5', title: '03. Threading' },
        { id: 'w1-6', title: '04. Socket Programming' },
        { id: 'w1-7', title: '05. Version Control Systems' },
      ],
    },
    { groupId: 'w2', groupTitle: 'Week 2 - Software Architecture', items: [
      { id: 'w2-1', title: '01. Layers & Modules' },
      { id: 'w2-2', title: '02. MVC & MVVM' },
    ]},
    { groupId: 'w3', groupTitle: 'Week 3 - UI & UX Design', items: [
      { id: 'w3-1', title: '01. Principles of UX' },
    ]},
  ];

  res.render('course-view', { user: req.user, course, toc });
});



// API (each mounted ONCE)
app.use('/api/auth', authRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/tutors', tutorsRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/replies', repliesRoutes);
app.use('/api', contentRoutes);
app.use('/api', subsRouter);
// Gemini chatbot API
app.use('/api/gemini', geminiRoute);
app.use('/api', contentRoutes); // <- gives /api/topics/:id/content and /api/content/:cid/*
app.use('/', anonRoutes);


// multer size error → clear message for test
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds maximum allowed size (5 MB)' });
  }
  next(err);
});

// Last error handler
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
