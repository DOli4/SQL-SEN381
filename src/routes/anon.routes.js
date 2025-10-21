// routes/anon.routes.js
import { Router } from 'express';
import { getPool } from '../db/mssql.js';

const r = Router();

// Guards
function requireLogin(req, res, next){
  if(!req.user) return res.status(401).json({ error: 'Login required' });
  next();
}
function requireAdmin(req, res, next){
  const role = (req.user?.role || req.user?.RoleName || '').toLowerCase();
  if(role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// --------- Page ----------
r.get('/anon', (req, res) => {
  res.render('anon-forum', { user: req.user });
});

// Utility to create display name
const asDisplay = (reqUser, isAnon) =>
  isAnon ? 'Anonymous' : (reqUser?.name || reqUser?.First_Name && reqUser?.Last_Name
    ? `${reqUser.First_Name} ${reqUser.Last_Name}`
    : (reqUser?.email || 'User'));

// --------- API: list threads (with trending) ----------
r.get('/api/anon/threads', async (req, res) => {
  // sort: 'new' | 'top' | 'trending'
  const sort = (req.query.sort || 'trending').toLowerCase();
  // A simple hot score: Upvotes on posts + time decay
  const pool = await getPool();

  let orderBy = 'T.Created_At DESC';
  if (sort === 'top') {
    orderBy = 'TotalUpvotes DESC, T.Created_At DESC';
  } else if (sort === 'trending') {
    // naive "hot": upvotes / hours^0.8
    orderBy = '(CASE WHEN DATEDIFF(HOUR, T.Created_At, SYSUTCDATETIME())=0 THEN 1 ELSE CAST(SUM(P.Upvotes) as float)/POWER(NULLIF(DATEDIFF(HOUR, T.Created_At, SYSUTCDATETIME()),0),0.8) END) DESC';
  }

  const q = `
    SELECT TOP 50
      T.Thread_ID, T.Title, T.DisplayName, T.IsAnonymous, T.IsLocked, T.Created_At,
      ISNULL(SUM(P.Upvotes),0) AS TotalUpvotes,
      COUNT(P.Post_ID) AS ReplyCount
    FROM dbo.AnonThreads T
    LEFT JOIN dbo.AnonPosts P ON P.Thread_ID = T.Thread_ID AND P.IsDeleted = 0
    WHERE T.IsDeleted = 0
    GROUP BY T.Thread_ID, T.Title, T.DisplayName, T.IsAnonymous, T.IsLocked, T.Created_At
    ORDER BY ${orderBy}
  `;
  const { recordset } = await pool.request().query(q);
  res.json(recordset);
});

// --------- API: create thread ----------
r.post('/api/anon/threads', requireLogin, async (req, res) => {
  const { title, body, anonymous } = req.body;
  if(!title || title.length < 4) return res.status(400).json({ error: 'Title too short' });

  const pool = await getPool();
  const display = asDisplay(req.user, !!anonymous);

  const ins = await pool.request()
    .input('title', title)
    .input('body', body || null)
    .input('uid', req.user?.sub || req.user?.id || null)
    .input('anon', !!anonymous)
    .input('display', display)
    .query(`
      INSERT INTO dbo.AnonThreads (Title, Body, Created_By, IsAnonymous, DisplayName)
      VALUES (@title, @body, @uid, @anon, @display);
      SELECT SCOPE_IDENTITY() AS id;
    `);
  res.json({ ok:true, id: ins.recordset[0].id });
});

// --------- API: get thread + posts ----------
r.get('/api/anon/threads/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const th = await pool.request().input('id', id).query(`
    SELECT Thread_ID, Title, Body, DisplayName, IsAnonymous, IsLocked, Created_At
    FROM dbo.AnonThreads WHERE Thread_ID=@id AND IsDeleted=0
  `);
  if(!th.recordset[0]) return res.status(404).json({ error:'Not found' });

  const posts = await pool.request().input('id', id).query(`
    SELECT Post_ID, Body, DisplayName, IsAnonymous, Upvotes, Created_At
    FROM dbo.AnonPosts WHERE Thread_ID=@id AND IsDeleted=0 ORDER BY Created_At ASC
  `);
  res.json({ thread: th.recordset[0], posts: posts.recordset });
});

// --------- API: add reply ----------
r.post('/api/anon/threads/:id/posts', requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  const { body, anonymous } = req.body;
  if(!body || body.trim().length < 2) return res.status(400).json({ error:'Body required' });

  const pool = await getPool();
  // prevent posting to locked thread
  const locked = await pool.request().input('id', id).query('SELECT IsLocked FROM dbo.AnonThreads WHERE Thread_ID=@id AND IsDeleted=0');
  if(!locked.recordset[0]) return res.status(404).json({ error:'Thread not found' });
  if(locked.recordset[0].IsLocked) return res.status(403).json({ error:'Thread locked' });

  const display = asDisplay(req.user, !!anonymous);
  await pool.request()
    .input('id', id)
    .input('body', body)
    .input('uid', req.user?.sub || req.user?.id || null)
    .input('anon', !!anonymous)
    .input('display', display)
    .query(`
      INSERT INTO dbo.AnonPosts (Thread_ID, Body, Created_By, IsAnonymous, DisplayName)
      VALUES (@id, @body, @uid, @anon, @display);
      UPDATE dbo.AnonThreads SET Updated_At = SYSUTCDATETIME() WHERE Thread_ID=@id;
    `);
  res.json({ ok:true });
});

// --------- API: upvote (toggle) ----------
r.post('/api/anon/posts/:pid/upvote', requireLogin, async (req, res) => {
  const pid = Number(req.params.pid);
  const uid = req.user?.sub || req.user?.id;
  const pool = await getPool();

  try {
    await pool.request()
      .input('pid', pid).input('uid', uid)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.AnonVotes WHERE Post_ID=@pid AND Voter_ID=@uid)
        BEGIN
          INSERT INTO dbo.AnonVotes (Post_ID, Voter_ID) VALUES (@pid, @uid);
          UPDATE dbo.AnonPosts SET Upvotes = Upvotes + 1 WHERE Post_ID=@pid;
          SELECT 'added' AS action;
        END
        ELSE
        BEGIN
          DELETE FROM dbo.AnonVotes WHERE Post_ID=@pid AND Voter_ID=@uid;
          UPDATE dbo.AnonPosts SET Upvotes = CASE WHEN Upvotes>0 THEN Upvotes-1 ELSE 0 END WHERE Post_ID=@pid;
          SELECT 'removed' AS action;
        END
      `);
    res.json({ ok:true });
  } catch(e){
    res.status(500).json({ error:'Vote failed' });
  }
});

// --------- API: FAQs ----------
r.get('/api/anon/faqs', async (req, res) => {
  const pool = await getPool();
  const { recordset } = await pool.request().query(`SELECT TOP 20 Faq_ID, Question, Answer, Upvotes FROM dbo.AnonFaqs ORDER BY Upvotes DESC, Created_At DESC`);
  res.json(recordset);
});
r.post('/api/anon/faqs', requireAdmin, async (req, res) => {
  const { question, answer } = req.body;
  if(!question || !answer) return res.status(400).json({ error:'Invalid FAQ' });
  const pool = await getPool();
  await pool.request().input('q', question).input('a', answer)
    .query(`INSERT INTO dbo.AnonFaqs (Question, Answer) VALUES (@q, @a)`);
  res.json({ ok:true });
});

// --------- Admin moderation ----------
r.post('/api/anon/threads/:id/lock', requireAdmin, async (req,res)=>{
  const pool = await getPool();
  await pool.request().input('id', Number(req.params.id))
    .query('UPDATE dbo.AnonThreads SET IsLocked = 1 WHERE Thread_ID=@id');
  res.json({ ok:true });
});
r.post('/api/anon/threads/:id/delete', requireAdmin, async (req,res)=>{
  const pool = await getPool();
  await pool.request().input('id', Number(req.params.id))
    .query('UPDATE dbo.AnonThreads SET IsDeleted = 1 WHERE Thread_ID=@id');
  res.json({ ok:true });
});

export default r;
