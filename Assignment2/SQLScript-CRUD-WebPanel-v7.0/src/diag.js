// Diagnostics routes
// Purpose: lightweight endpoints to verify the web app is alive and that SQL connectivity works.
// - Uses runSqlText to execute ad-hoc statements through sqlcmd.

import express from 'express';
import { runSqlText } from './sqlrunner.js';

const router = express.Router();

// Liveness probe: returns plain "OK".
// Useful for quick checks and container orchestrators.
router.get('/health', (req, res) => res.type('text').send('OK'));

// SQL probe: executes a minimal batch to confirm that queries reach SQL Server
// and that we can read basic server and database metadata.
// Returns raw sqlcmd text so you can see any warnings or errors verbatim.
router.get('/diag/sql', async (req, res) => {
  try {
    const out = await runSqlText(`SET NOCOUNT ON;
SELECT @@VERSION AS [Version];
SELECT @@SERVERNAME AS ServerName, @@SERVICENAME AS ServiceName, DB_NAME() AS CurrentDb;`);
    res.type('text').send(out);
  } catch (e) {
    // Surface the failure message directly; callers expect plain text.
    res.status(500).type('text').send(String(e));
  }
});

// Transport probe: shows how the current session is connected to SQL Server
// (e.g., TCP, NP, or Shared Memory), the local address/port, and the auth scheme.
// This is valuable when debugging timeouts, encryption, or routing issues.
router.get('/diag/transport', async (req, res) => {
  try {
    const out = await runSqlText(`SET NOCOUNT ON;
SELECT net_transport, local_net_address, local_tcp_port, auth_scheme
FROM sys.dm_exec_connections WHERE session_id = @@SPID;`);
    res.type('text').send(out);
  } catch (e) {
    res.status(500).type('text').send(String(e));
  }
});

export default router;
