import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';

const server   = process.env.SQL_SERVER || 'ULI';
const instance = process.env.SQL_INSTANCE ? '\\' + process.env.SQL_INSTANCE : '';
const db       = process.env.SQL_DB || 'CampusLearn';

/*
  Driver name: pick one you actually have installed.
  Most machines have "ODBC Driver 18 for SQL Server".
  If 18 isn't installed, try 17. (You can switch the string and retry.)
*/
const DRIVER = '{ODBC Driver 17 for SQL Server}';

const connStr =
  `Server=${server}${instance};` +
  `Database=${db};` +
  `Trusted_Connection=Yes;` +
  `TrustServerCertificate=Yes;` +
  `Driver=${DRIVER};`;

console.log('[DB cfg]', { server: server+instance, db, auth: 'Windows', driver: DRIVER });

let pool;
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
  return pool;
}
export { sql };
