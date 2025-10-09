import sql from 'mssql';

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({
      server: process.env.SQL_SERVER,
      database: process.env.SQL_DB,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
      },
    });
  }
  return poolPromise;
}

export { sql };
