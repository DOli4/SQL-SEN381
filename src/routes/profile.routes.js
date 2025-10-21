// routes/profile.route.js
import { Router } from 'express';
import { getPool } from '../db/mssql.js';

const router = Router();

// Use the exact table + schema you verified in SSMS:
const USER_TABLE = '[dbo].[User]';

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

// Load the full DB user by id OR by email/username (fallback)
async function loadDbUser(req) {
  const pool = await getPool();
  const id = req.user?.sub || req.user?.id || req.user?.User_ID || null;
  const em = req.user?.email || req.user?.Username || null;

  const request = pool.request();
  if (id != null) request.input('id', id);
  if (em != null) request.input('em', em);

  const { recordset } = await request.query(`
    SELECT TOP 1
      User_ID,
      Role_ID,
      Username,
      First_Name,
      Last_Name,
      Phone,
      Email,
      DOB,
      Status,
      Created_On
    FROM ${USER_TABLE}
    WHERE
      (${id != null ? 'User_ID = @id' : '1=0'})
      OR (Email = @em)
      OR (Username = @em)
  `);

  return recordset?.[0] || null;
}

// GET /profile → render with real DB values
router.get('/profile', requireLogin, async (req, res) => {
  try {
    const row = await loadDbUser(req);

    const fullUser = {
      ...req.user,
      id: row?.User_ID ?? req.user?.sub ?? req.user?.id,
      email: row?.Email ?? req.user?.email,
      firstName: row?.First_Name ?? '',
      lastName: row?.Last_Name ?? '',
      phone: row?.Phone ?? '',
      dob: row?.DOB ? new Date(row.DOB).toISOString().slice(0, 10) : '',
      role: req.user?.role || req.user?.RoleName || 'Student',
      // optionally surface these if you want to show them:
      status: row?.Status ?? '',
      createdOn: row?.Created_On || null,
      username: row?.Username ?? ''
    };

    return res.render('profile', { user: fullUser });
  } catch (e) {
    console.error('Profile GET error:', e);
    return res.status(500).send('Failed to load profile');
  }
});

// POST /api/profile → save edits
router.post('/api/profile', requireLogin, async (req, res) => {
  const { firstName, lastName, email, phone, dob /*, address */ } = req.body;

  try {
    const pool = await getPool();
    const id = req.user?.sub || req.user?.id || req.user?.User_ID;

    const request = pool.request()
      .input('firstName', firstName || null)
      .input('lastName',  lastName  || null)
      .input('email',     email     || null)
      .input('phone',     phone     || null)
      .input('dob',       dob       || null); // SQL can parse 'YYYY-MM-DD'

    let whereClause = '';
    if (id) {
      request.input('id', id);
      whereClause = 'User_ID = @id';
    } else {
      request.input('em', req.user?.email || email);
      whereClause = '(Email = @em OR Username = @em)';
    }

    await request.query(`
      UPDATE ${USER_TABLE}
      SET
        First_Name = @firstName,
        Last_Name  = @lastName,
        Email      = @email,
        Phone      = @phone,
        DOB        = @dob
      WHERE ${whereClause}
    `);

    // keep the session copy in sync for immediate UI
    Object.assign(req.user, { firstName, lastName, email, phone, dob });

    return res.json({ ok: true });
  } catch (e) {
    console.error('Profile POST error:', e);
    return res.status(500).json({ error: 'Failed to save profile' });
  }
});

export default router;
