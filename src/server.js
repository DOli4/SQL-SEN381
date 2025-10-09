// src/server.js
import path from 'node:path';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Load env first
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

// Create the app BEFORE any app.use(...)
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

// Attach req.user/res.locals.user from JWT cookie (must be AFTER cookieParser, BEFORE routes)
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

// App logs (optional)
console.log(
  'ENV → SQL_SERVER=%s | SQL_DB=%s',
  process.env.SQL_SERVER, process.env.SQL_DB
);

// Feature routers you already had
import crudRoutes from './crud.js';
import editorRoutes from './editor.js';
import diagRoutes from './diag.js';
app.use('/', crudRoutes);
app.use('/', editorRoutes);
app.use('/', diagRoutes);

// API routers
import authRoutes from './routes/auth.routes.js';
import topicsRoutes from './routes/topics.routes.js';
import studentsRoutes from './routes/students.routes.js'; // make sure filename matches
import tutorsRoutes from './routes/tutors.routes.js';
import resourcesRoutes from './routes/resources.routes.js';
import messagesRoutes from './routes/messages.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/tutors', tutorsRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/messages', messagesRoutes);

// Page guards/helpers
function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function requireRole(role){
  return (req,res,next)=> {
    if(!req.user) return res.redirect('/login');
    if(req.user.role !== role) return res.status(403).send('Forbidden');
    next();
  };
}

// Pages
app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/login', (req, res) => res.render('auth-login'));
app.get('/register', (req, res) => res.render('auth-register'));
app.get('/dashboard', requireLogin, (req, res) => res.render('dashboard'));
app.get('/topics', (req, res) => res.render('topics'));
app.get('/topics/create', requireRole('Student'), (req, res) => res.render('topic-create'));

// Logout
app.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite:'lax', secure:false });
  res.redirect('/login');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).send('<pre>' + (err && err.stack || String(err)) + '</pre>');
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SQL Script Web Panel running on http://localhost:${port}`));
