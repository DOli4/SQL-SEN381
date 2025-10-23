import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPool, sql } from '../db/mssql.js';

const r = Router();

r.get('/', requireAuth, async (req, res) => {
  const topicId = Number(req.query.topicId);
  const pool = await getPool();
  const out = await pool.request().input('Topic_ID', sql.Int, topicId).query(`
    SELECT Reply_ID, Topic_ID, User_ID, [Description], Upvote, Downvote
    FROM dbo.Reply WHERE Topic_ID=@Topic_ID ORDER BY Reply_ID DESC`);
  res.json(out.recordset);
});

r.post('/', requireAuth, async (req, res) => {
  const { topicId, description } = req.body;
  if (!topicId || !description) return res.status(400).json({ error: 'topicId and description required' });
  const pool = await getPool();
  const q = await pool.request()
    .input('Topic_ID', sql.Int, Number(topicId))
    .input('Parent_Reply_ID', sql.Int, null)
    .input('User_ID', sql.Int, req.user.sub)
    .input('Description', sql.VarChar(sql.MAX), description)
    .query(`INSERT INTO dbo.Reply(Topic_ID, Parent_Reply_ID, User_ID, [Description])
            OUTPUT INSERTED.Reply_ID VALUES (@Topic_ID, @Parent_Reply_ID, @User_ID, @Description)`);
  res.status(201).json({ Reply_ID: q.recordset[0].Reply_ID });
});

export default r;
