import 'dotenv/config';
import sql from 'mssql';

const cfg = {
  server: process.env.SQL_SERVER || 'localhost',
  database: process.env.SQL_DB || 'CampusLearn',
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
  encrypt: false,
  trustServerCertificate: true,
  instanceName: process.env.SQL_INSTANCE // present → SQLEXPRESS
}

};

let pool;
export async function getPool() {
  if (!pool || !pool.connected) {
    pool = await new sql.ConnectionPool(cfg).connect();
    console.log('[DB] Connected as', process.env.SQL_USER || '(Windows auth)');
  }
  return pool;
}
export { sql };
