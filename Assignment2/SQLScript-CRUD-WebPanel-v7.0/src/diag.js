import express from 'express';
import { runSqlText } from './sqlrunner.js';
const router = express.Router();
router.get('/health', (req,res)=>res.type('text').send('OK'));
router.get('/diag/sql', async (req,res)=>{
  try{
    const out = await runSqlText(`SET NOCOUNT ON;
SELECT @@VERSION AS [Version];
SELECT @@SERVERNAME AS ServerName, @@SERVICENAME AS ServiceName, DB_NAME() AS CurrentDb;`);
    res.type('text').send(out);
  }catch(e){ res.status(500).type('text').send(String(e)); }
});
router.get('/diag/transport', async (req,res)=>{
  try{
    const out = await runSqlText(`SET NOCOUNT ON;
SELECT net_transport, local_net_address, local_tcp_port, auth_scheme
FROM sys.dm_exec_connections WHERE session_id = @@SPID;`);
    res.type('text').send(out);
  }catch(e){ res.status(500).type('text').send(String(e)); }
});
export default router;
