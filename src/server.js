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




app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}  ct=${req.headers['content-type'] || ''}`);
  next();
});

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
    console.error('DB-TEST error:', e);
    const msg =
      e?.message ||
      e?.originalError?.message ||
      e?.sqlMessage ||
      e?.code ||
      JSON.stringify(e);
    res.status(500).json({ error: msg });
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

app.get('/courses/:id', requireLogin, (req, res) => {
  const course = {
    id: req.params.id,
    title: 'SEN381 · Intro to Software Engineering',
  };

  // Table of contents (same as you have now)
  const toc = [
    { groupId: 'w1', groupTitle: 'Intro to Software Engineering', items: [
      { id: 'w1-1', title: 'Introduction to Software Engineering' },
      { id: 'w1-2', title: 'In-class Quiz · What is Software?' },
      { id: 'w1-3', title: 'Programming in Software Engineering' },
      { id: 'w1-4', title: 'Homework · Predict the output' },
      { id: 'w1-5', title: 'Threading' },
      { id: 'w1-6', title: 'Socket Programming' },
      { id: 'w1-7', title: 'Version Control Systems' },
    ]},
    { groupId: 'w2', groupTitle: 'Software Architecture', items: [
      { id: 'w2-1', title: 'Layers & Modules' },
      { id: 'w2-2', title: 'MVC & MVVM' },
    ]},
    { groupId: 'w3', groupTitle: 'UI & UX Design', items: [
      { id: 'w3-1', title: '1.Principles of UX' },
    ]},
  ];

  // Simple content store keyed by item id (make as detailed as you want)
    const pages = {
  // Week 1
  'w1-1': {
    h1: 'Introduction to Software Engineering',
    body: `
      <h3>Defining Software Engineering</h3>
      <p>Software engineering is the disciplined application of engineering principles to the design, development, and maintenance of software.</p>

      <h3>Other Definitions</h3>
      <ul>
        <li><b>IEEE 610.12-1990:</b> A structured definition of the software process.</li>
        <li><b>Fritz Bauer:</b> Establishment and standard engineering principles for reliable systems.</li>
        <li><b>Boehm:</b> Practical application of scientific knowledge to software production.</li>
      </ul>

      <h3>Tools and Technologies Used</h3>
      <ul>
        <li>IDEs – Visual Studio, Eclipse, IntelliJ</li>
        <li>VCS – Git & GitHub</li>
        <li>Project Management – JIRA, Trello</li>
      </ul>
    `
  },

  'w1-2': {
    h1: 'In-class Quiz · What is Software?',
    body: `
      <h3>Quiz Overview</h3>
      <p>Quick questions exploring the distinction between software, programs, and systems.</p>
      <ul>
        <li>Q1: Define “software” in your own words.</li>
        <li>Q2: List two characteristics of quality software.</li>
        <li>Q3: Explain why software is both a product and a process.</li>
      </ul>
    `
  },

  'w1-3': {
    h1: 'Programming in Software Engineering',
    body: `
      <h3>Programming Basics</h3>
      <p>Programming transforms requirements into executable logic using algorithms and data structures.</p>

      <h3>Languages</h3>
      <ul>
        <li>Low-level – C, C++ (closer to hardware)</li>
        <li>High-level – Python, Java, C# (abstracted)</li>
        <li>Web – HTML, CSS, JavaScript</li>
      </ul>

      <h3>Best Practices</h3>
      <ul>
        <li>Follow naming conventions.</li>
        <li>Write readable and modular code.</li>
        <li>Use version control to track changes.</li>
      </ul>
    `
  },

  'w1-4': {
    h1: 'Homework · Predict the Output',
    body: `
      <h3>Task Description</h3>
      <p>Analyze the given code snippet and predict its output before executing it.</p>
      <pre><code>for (let i = 1; i &lt;= 3; i++) {
  console.log(i * i);
}</code></pre>
      <p><b>Expected Output:</b> 1, 4, 9 – because each iteration prints the square of <i>i</i>.</p>
    `
  },

  'w1-5': {
    h1: 'Threading',
    body: `
      <h3>What is Threading?</h3>
      <p>Threading enables parallel execution of code paths for better performance and responsiveness.</p>
      <h3>Examples</h3>
      <ul>
        <li>In Java: <code>Thread t = new Thread(() -&gt; { ... });</code></li>
        <li>In Python: <code>threading.Thread(target=myFunc)</code></li>
      </ul>
      <h3>Use Cases</h3>
      <ul>
        <li>Background data fetching</li>
        <li>Game loops and physics updates</li>
        <li>Real-time UI refresh</li>
      </ul>
    `
  },

  'w1-6': {
    h1: 'Socket Programming',
    body: `
      <h3>Definition</h3>
      <p>Socket programming enables communication between two systems over a network.</p>

      <h3>Common Protocols</h3>
      <ul>
        <li><b>TCP (Transmission Control Protocol):</b> Reliable stream-based communication.</li>
        <li><b>UDP (User Datagram Protocol):</b> Faster but unreliable packet communication.</li>
      </ul>

      <h3>Example (Python)</h3>
      <pre><code>import socket
s = socket.socket()
s.connect(('localhost', 8080))
print(s.recv(1024))
s.close()</code></pre>
    `
  },

  'w1-7': {
    h1: 'Version Control Systems',
    body: `
      <h3>Purpose</h3>
      <p>Version control systems (VCS) track changes to code and facilitate collaboration.</p>

      <h3>Popular VCS Tools</h3>
      <ul>
        <li>Git (GitHub, GitLab, Bitbucket)</li>
        <li>Subversion (SVN)</li>
      </ul>

      <h3>Common Commands (Git)</h3>
      <pre><code>git init
git add .
git commit -m "Initial commit"
git push origin main</code></pre>
    `
  },

  // Week 2
  'w2-1': {
    h1: 'Layers and Modules',
    body: `
      <h3>Layered Architecture</h3>
      <p>Software is organized into logical layers for maintainability and separation of concerns.</p>
      <ul>
        <li>Presentation Layer (UI)</li>
        <li>Business Logic Layer</li>
        <li>Data Access Layer</li>
      </ul>
    `
  },

  'w2-2': {
    h1: 'MVC and MVVM Architectures',
    body: `
      <h3>MVC (Model-View-Controller)</h3>
      <ul>
        <li><b>Model:</b> Data and business logic.</li>
        <li><b>View:</b> User interface.</li>
        <li><b>Controller:</b> Handles input and updates model + view.</li>
      </ul>

      <h3>MVVM (Model-View-ViewModel)</h3>
      <p>Improves separation of UI and logic for data-binding frameworks like WPF or Vue.js.</p>
    `
  },

  // Week 3
  'w3-1': {
    h1: 'Principles of User Experience Design',
    body: `
      <h3>Core UX Principles</h3>
      <ul>
        <li>Consistency in layout and interaction</li>
        <li>Clarity and feedback on actions</li>
        <li>Accessibility for all users</li>
        <li>Efficiency and error prevention</li>
      </ul>

      <h3>Tools</h3>
      <ul>
        <li>Figma / Adobe XD for prototyping</li>
        <li>Heuristic evaluation for usability testing</li>
      </ul>
    `
  }
};


  // Determine which item to show (default = first in toc)
  const firstId = toc[0].items[0].id;
  const selected = req.query.item || firstId;
  const page = pages[selected] || { h1: 'Content not available', body: '<p>Coming soon.</p>' };

  res.render('course-view', { user: req.user, course, toc, selected, page });
});




// API (each mounted ONCE)
app.use('/api/auth', authRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/tutors', tutorsRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/replies', repliesRoutes);
app.use('/content', contentRoutes);
app.use('/api', subsRouter);
// Gemini chatbot API
app.use('/api/gemini', geminiRoute);
app.use('/', anonRoutes);
// Render the upload form with modules for the dropdown
// DB-free content upload page
app.get('/content-upload', requireLogin, (req, res) => {
  res.render('content-upload', { user: req.user, ok: req.query.ok, modules: [] });
});



// multer size error → clear message for test
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
  return res.status(413).json({ error: 'File exceeds maximum allowed size (10 MB)' });
}

  next(err);
});

// Last error handler
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).send('<pre>' + (err?.stack || String(err)) + '</pre>');
});

// logout
app.get('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: false });
  res.redirect('/login');
});

// start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SQL Script Web Panel running on http://localhost:${port}`));
