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

let pool = null;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

export async function getPool() {
  // If we have a pool, test it first
  if (pool) {
    try {
      await pool.request().query('SELECT 1');
      return pool;
    } catch (err) {
      console.warn('Existing pool failed:', err.message);
      pool = null;
    }
  }

  // No pool or pool is invalid, try to connect
  while (connectionAttempts < MAX_RETRIES) {
    try {
      pool = await sql.connect({
        connectionString: connStr,
        options: {
          enableArithAbort: true,
          trustServerCertificate: true,
          connectTimeout: 30000,
          requestTimeout: 30000
        }
      });
      connectionAttempts = 0;
      console.log('✅ Connected to LocalDB (CampusLearn)');
      return pool;
    } catch (err) {
      console.error(`❌ Database connection attempt ${connectionAttempts + 1} failed:`, err);
      pool = null;
      connectionAttempts++;
      
      if (connectionAttempts >= MAX_RETRIES) {
        throw new Error(`Database connection failed after ${MAX_RETRIES} attempts: ${err.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
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
