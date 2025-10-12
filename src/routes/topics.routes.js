import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPool, sql } from '../db/mssql.js';

const router = Router();

// LIST topics (for /forum page)
router.get('/', requireAuth, async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT TOP 50 Topic_ID, Title, Module_ID, User_ID, [Description]
    FROM dbo.Topic
    ORDER BY Topic_ID DESC
  `);
  res.json(r.recordset);
});

// GET single topic (for /forum/:id header)
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT Topic_ID, Title, Module_ID, User_ID, [Description]
    FROM dbo.Topic WHERE Topic_ID=@id
  `);
  if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.recordset[0]);
});

// CREATE topic  <-- THIS is what your /forum/new page calls
router.post('/', requireAuth, async (req, res) => {
  const { title, moduleId, description } = req.body;
  if (!title || !moduleId) return res.status(400).json({ error: 'title and moduleId are required' });

  const pool = await getPool();
  const q = await pool.request()
    .input('User_ID', sql.Int, req.user.sub)        // set by requireAuth
    .input('Module_ID', sql.Int, Number(moduleId))
    .input('Title', sql.VarChar(500), title.trim())
    .input('Description', sql.VarChar(sql.MAX), (description || '').trim() || null)
    .query(`
      INSERT INTO dbo.Topic (User_ID, Module_ID, Title, [Description])
      OUTPUT INSERTED.Topic_ID
      VALUES (@User_ID, @Module_ID, @Title, @Description)
    `);

  res.status(201).json({ Topic_ID: q.recordset[0].Topic_ID });
});

// helper: is this user allowed to change/delete the topic?
async function ensureOwnerOrAdmin(pool, topicId, user) {
  const r = await pool.request().input('id', sql.Int, topicId)
    .query('SELECT User_ID FROM dbo.Topic WHERE Topic_ID=@id');
  if (!r.recordset.length) return { ok:false, status:404, msg:'Topic not found' };

  const ownerId = r.recordset[0].User_ID;
  const isOwner = ownerId === user.sub;
  const role = (user.RoleName || user.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  return isOwner || isAdmin ? { ok:true } : { ok:false, status:403, msg:'Forbidden' };
}

// PUT /api/topics/:id  (edit)
router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { title, moduleId, description } = req.body;
  if (!title || !moduleId) return res.status(400).json({ error:'title and moduleId are required' });

  const pool = await getPool();
  const authz = await ensureOwnerOrAdmin(pool, id, req.user);
  if (!authz.ok) return res.status(authz.status).json({ error: authz.msg });

  await pool.request()
    .input('id', sql.Int, id)
    .input('Title', sql.VarChar(500), title.trim())
    .input('Module_ID', sql.Int, Number(moduleId))
    .input('Description', sql.VarChar(sql.MAX), (description || '').trim() || null)
    .query(`
      UPDATE dbo.Topic
      SET Title=@Title, Module_ID=@Module_ID, [Description]=@Description
      WHERE Topic_ID=@id
    `);
  res.json({ ok:true });
});

// DELETE /api/topics/:id  (delete + children)
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const authz = await ensureOwnerOrAdmin(pool, id, req.user);
  if (!authz.ok) return res.status(authz.status).json({ error: authz.msg });

  // FK doesn’t cascade; delete children first
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM dbo.Content WHERE Topic_ID=@id`);
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM dbo.Reply   WHERE Topic_ID=@id`);
  const r = await pool.request().input('id', sql.Int, id).query(`DELETE FROM dbo.Topic WHERE Topic_ID=@id`);
  res.json({ ok:true, deleted: r.rowsAffected?.[0] ?? 0 });
});


export default router;
