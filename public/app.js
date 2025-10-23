import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getPool } from './db/mssql.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));

app.get('/health', async (_req, res) => {
  try {
    const pool = await getPool();
    const r = await (await pool.request().query('SELECT 1 AS ok')).recordset[0];
    res.json({ ok: true, db: r.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`API listening on ${process.env.PORT || 3000}`)
);
