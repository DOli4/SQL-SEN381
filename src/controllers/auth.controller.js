import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db/mssql.js';
import { signUser } from '../utils/jwt.js';

// Helper: find Role_ID by role name (Student/Tutor/Admin)
async function getRoleId(pool, roleName) {
  const r = await pool.request()
    .input('Name', sql.VarChar(10), roleName)
    .query('SELECT Role_ID FROM dbo.Roles WHERE [Name] = @Name');
  if (!r.recordset.length) throw new Error(`Role not found: ${roleName}`);
  return r.recordset[0].Role_ID;
}

export async function register(req, res) {
  const { email, password, firstName, lastName, username, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password, role are required' });
  }

  const pool = await getPool();

  // unique email check
  const exists = await pool.request()
    .input('Email', sql.VarChar(50), email)
    .query('SELECT TOP 1 User_ID FROM dbo.[User] WHERE Email = @Email');
  if (exists.recordset.length) return res.status(409).json({ error: 'Email already registered' });

  const roleId = await getRoleId(pool, role); // Student/Tutor/Admin
  const hash = await bcrypt.hash(password, 10);

  const insert = await pool.request()
    .input('Role_ID', sql.Int, roleId)
    .input('Username', sql.VarChar(30), username || email)
    .input('First_Name', sql.VarChar(30), firstName || null)
    .input('Last_Name', sql.VarChar(30), lastName || null)
    .input('Phone', sql.VarChar(20), null)
    .input('Email', sql.VarChar(50), email)
    .input('Credentials', sql.VarChar(100), null)
    .input('DOB', sql.Date, null)
    .input('Password', sql.VarChar(255), hash)   // 255 to match table
    .input('Status', sql.VarChar(10), 'Active')
    .query(`
      INSERT INTO dbo.[User]
        (Role_ID, Username, First_Name, Last_Name, Phone, Email, Credentials, DOB, [Password], [Status])
      OUTPUT INSERTED.User_ID, INSERTED.Email, INSERTED.First_Name, INSERTED.Last_Name
      VALUES (@Role_ID, @Username, @First_Name, @Last_Name, @Phone, @Email, @Credentials, @DOB, @Password, @Status)
    `);

  const created = insert.recordset[0];
  const withRole = { ...created, RoleName: role };
  const token = signUser(withRole);

  // Set cookie + return JSON
  return res
    .cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,           // set true in production (HTTPS)
      maxAge: 24 * 60 * 60 * 1000
    })
    .status(201)
    .json({
      token,
      user: {
        User_ID: created.User_ID,
        Email: created.Email,
        First_Name: created.First_Name,
        Last_Name: created.Last_Name,
        Role: role
      }
    });
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const pool = await getPool();

  const q = await pool.request()
    .input('Email', sql.VarChar(50), email)
    .query(`
      SELECT TOP 1 u.User_ID, u.Email, u.First_Name, u.Last_Name, u.[Password],
             r.[Name] AS RoleName
      FROM dbo.[User] u
      JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
      WHERE u.Email = @Email
    `);

  if (!q.recordset.length) return res.status(401).json({ error: 'Invalid credentials' });

  const row = q.recordset[0];
  const ok = await bcrypt.compare(password, row.Password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signUser(row);

  // Set cookie + return JSON
  return res
    .cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,           // set true in production (HTTPS)
      maxAge: 24 * 60 * 60 * 1000
    })
    .json({
      token,
      user: {
        User_ID: row.User_ID,
        Email: row.Email,
        First_Name: row.First_Name,
        Last_Name: row.Last_Name,
        Role: row.RoleName
      }
    });
}
