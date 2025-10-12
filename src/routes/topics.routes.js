import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPool, sql } from '../db/mssql.js';

const router = Router();

// GET single topic
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id)
    .query(`SELECT Topic_ID, Title, Module_ID, User_ID, [Description]
            FROM dbo.Topic WHERE Topic_ID=@id`);
  if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.recordset[0]);
});

// GET attachments for a topic
router.get('/:id/content', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id)
    .query(`SELECT Content_ID, OriginalName, MimeType
            FROM dbo.Content WHERE Topic_ID=@id
            ORDER BY Content_ID DESC`);
  res.json(r.recordset);
});

export default router;
