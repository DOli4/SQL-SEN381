import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';

// --- Direct LocalDB pipe name ---
const server = 'np:\\\\.\\pipe\\LOCALDB#3BCC5D31\\tsql\\query';
const db = process.env.SQL_DB || 'CampusLearn';

// ODBC driver (try 18, or switch to 17 if 18 not installed)
const DRIVER = '{ODBC Driver 17 for SQL Server}';

const connStr =
  `Server=${server};` +
  `Database=${db};` +
  `Trusted_Connection=Yes;` +
  `TrustServerCertificate=Yes;` +
  `Driver=${DRIVER};`;

console.log('[DB cfg]', { server, db, driver: DRIVER });

let pool;

export async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect({ connectionString: connStr });
      console.log('✅ Connected to LocalDB (CampusLearn)');
    } catch (err) {
      console.error('❌ Database connection failed:', err);
      throw err;
    }
  }
  return pool;
}

export { sql };
