import { getPool, sql } from '../db/mssql.js';

export async function list(req, res) {
  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT t.Topic_ID, t.Title, t.[Description], t.Module_ID,
            m.[Name]  AS ModuleName,
            u.User_ID AS CreatedByUserId,
            CONCAT(COALESCE(u.First_Name,''), ' ', COALESCE(u.Last_Name,'')) AS CreatedByName,
            t.Upvotes, t.Downvotes
    FROM dbo.Topic t
    JOIN dbo.[User] u ON u.User_ID = t.User_ID
    JOIN dbo.Modules m ON m.Module_ID = t.Module_ID
    ORDER BY t.Topic_ID DESC
  `);
  res.json(rs.recordset);
}

export async function getOne(req, res) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('Topic_ID', sql.Int, Number(req.params.id))
    .query(`
      SELECT t.Topic_ID, t.Title, t.[Description], t.Module_ID,
              m.[Name]  AS ModuleName,
              u.User_ID AS CreatedByUserId,
              CONCAT(COALESCE(u.First_Name,''), ' ', COALESCE(u.Last_Name,'')) AS CreatedByName,
              t.Upvotes, t.Downvotes
      FROM dbo.Topic t
      JOIN dbo.[User] u ON u.User_ID = t.User_ID
      JOIN dbo.Modules m ON m.Module_ID = t.Module_ID
      WHERE t.Topic_ID = @Topic_ID
    `);
  if (!rs.recordset.length) return res.status(404).json({ error: 'Not found' });
  res.json(rs.recordset[0]);
}

export async function create(req, res) {
  const { title, description, moduleId } = req.body;
  if (!title || !moduleId) return res.status(400).json({ error: 'title and moduleId required' });

  const pool = await getPool();
  const ins = await pool.request()
    .input('User_ID', sql.Int, req.user.sub) // INT from JWT
    .input('Module_ID', sql.Int, Number(moduleId))
    .input('Title', sql.VarChar(500), title)
    .input('Description', sql.VarChar(sql.MAX), description || null)
    .query(`
      INSERT INTO dbo.Topic (User_ID, Module_ID, Title, [Description])
      OUTPUT INSERTED.*
      VALUES (@User_ID, @Module_ID, @Title, @Description)
    `);

  res.status(201).json(ins.recordset[0]);
}
