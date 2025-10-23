import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';

// --- Direct LocalDB pipe name ---
const server = 'np:\\\\.\\pipe\\LOCALDB#3BCC5D31\\tsql\\query';
const db = process.env.SQL_DB || 'CampusLearn';

/*
  Driver name: pick one you actually have installed.
  Most machines have "ODBC Driver 18 for SQL Server".
  If 18 isn't installed, try 17. (You can switch the string and retry.)
*/
const DRIVER = '{ODBC Driver 17 for SQL Server}';

const connStr =
  `Server=${server};` +
  `Database=${db};` +
  `Trusted_Connection=Yes;` +
  `TrustServerCertificate=Yes;` +
  `Driver=${DRIVER};`;

console.log('[DB cfg]', { server, db, driver: DRIVER });

let pool = null;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

export async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect({ connectionString: connStr });
      console.log('[DB] Connected (Windows auth)');
    } catch (e) {
      console.error('[DB] connect error:', e);
      throw e;
    }
  }
}

// Handle process termination
process.on('exit', () => {
  if (pool) {
    console.log('Closing database pool...');
    pool.close();
  }
});

export { sql };
