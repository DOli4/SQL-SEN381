// Diagnostics routes
// Purpose: lightweight endpoints to verify the web app is alive and that SQL connectivity works.
// - Uses runSqlText to execute ad-hoc statements through sqlcmd.
// - Returns plain text so outputs mirror what sqlcmd produced (useful for copy/paste into reports).
// - Zero side effects: only SELECT/metadata queries are executed.

import express from 'express';
import { runSqlText } from './sqlrunner.js';

const router = express.Router();

/**
 * GET /health
 * Liveness probe: returns plain "OK".
 * Typical uses:
 *   - Browser smoke test
 *   - Container orchestrator liveness/readiness checks
 * Response:
 *   200 text/plain "OK"
 */
router.get('/health', (req, res) => res.type('text').send('OK'));

/**
 * GET /diag/sql
 * SQL probe: verifies the app can reach SQL Server and run a trivial batch.
 * Batch content:
 *   - SET NOCOUNT ON
 *   - @@VERSION (engine build)
 *   - @@SERVERNAME / @@SERVICENAME / DB_NAME() (routing context)
 * Notes:
 *   - Output is raw text from sqlcmd so any warnings or errors are visible.
 *   - No parameters are accepted; this endpoint is safe to expose to trusted admins.
 * Responses:
 *   200 text/plain   raw sqlcmd output
 *   500 text/plain   error string (connection/query/timeout)
 */
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

/**
 * GET /diag/transport
 * Transport probe: shows how the current session is connected to SQL Server
 * (e.g., TCP, NP, or Shared Memory), the local address/port, and the auth scheme.
 * Useful for diagnosing:
 *   - Timeouts due to wrong protocol or firewall
 *   - TLS/authentication configuration
 *   - Unexpected routing (e.g., Named Pipes vs TCP)
 * Returns:
 *   net_transport, local_net_address, local_tcp_port, auth_scheme
 * Responses:
 *   200 text/plain   raw sqlcmd output
 *   500 text/plain   error string
 */
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

