import express from 'express';
import { runJson, runSqlText } from './sqlrunner.js';

const router = express.Router();

function parseTable(input) {
  let schema = 'dbo', table = input;
  if (input.includes('.')) {
    const [s, t] = input.split('.', 2);
    schema = s || 'dbo'; table = t;
  }
  return { schema, table };
}

async function listTables() {
  const sql = `SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [table]
               FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_TYPE='BASE TABLE'
               ORDER BY TABLE_SCHEMA, TABLE_NAME`;
  return await runJson(sql);
}

async function getColumns(schema, table) {
  const sql = `DECLARE @schema sysname = '$(schema)', @table sysname = '$(table)';
    SELECT
      c.COLUMN_NAME AS name,
      c.DATA_TYPE   AS dataType,
      c.IS_NULLABLE AS isNullable,
      c.CHARACTER_MAXIMUM_LENGTH AS maxLen,
      COLUMNPROPERTY(OBJECT_ID(@schema + '.' + @table), c.COLUMN_NAME, 'IsIdentity') AS isIdentity
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_SCHEMA=@schema AND c.TABLE_NAME=@table
    ORDER BY c.ORDINAL_POSITION;`;
  return await runJson(sql, { schema, table });
}

async function getPrimaryKeys(schema, table) {
  const sql = `DECLARE @schema sysname = '$(schema)', @table sysname = '$(table)';
    SELECT kcu.COLUMN_NAME AS name
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      ON kcu.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
     AND kcu.TABLE_SCHEMA=tc.TABLE_SCHEMA
     AND kcu.TABLE_NAME=tc.TABLE_NAME
    WHERE tc.TABLE_SCHEMA=@schema AND tc.TABLE_NAME=@table AND tc.CONSTRAINT_TYPE='PRIMARY KEY'
    ORDER BY kcu.ORDINAL_POSITION;`;
  return await runJson(sql, { schema, table });
}

router.get('/crud', async (req, res, next) => {
  try { const tables = await listTables(); res.render('crud/index', { tables }); }
  catch(e){ next(e); }
});

router.post('/crud/build', async (req, res, next) => {
  const op = req.body.op;  // view | insert | update | delete
  const tbl = req.body.table;
  try {
    const { schema, table } = parseTable(tbl);
    const columns = await getColumns(schema, table);
    const pk = await getPrimaryKeys(schema, table);
    res.render('crud/form', { op, schema, table, columns, pk });
  } catch(e){ next(e); }
});

function isStringType(t){
  const s = String(t).toLowerCase();
  return s.includes('char') || s.includes('text') || s.includes('date') || s.includes('time') || s.includes('uniqueidentifier') || s.includes('xml');
}

router.post('/crud/run', async (req, res) => {
  const { op, schema, table } = req.body;
  const columns = JSON.parse(req.body.columnsJson || '[]');
  const pk = JSON.parse(req.body.pkJson || '[]');

  try{
    let sql = '';
    const fq = `[${schema}].[${table}]`;

    if (op === 'view') {
      const filterCol = req.body.filterCol;
      const filterVal = req.body.filterVal;
      if (filterCol) {
        const col = columns.find(c => c.name === filterCol);
        const val = (filterVal ?? '').replace(/'/g, "''");
        sql = `SELECT TOP (100) * FROM ${fq} WHERE [${filterCol}] = ${isStringType(col?.dataType) ? `'${val}'` : val} ORDER BY 1 DESC`;
      } else {
        sql = `SELECT TOP (100) * FROM ${fq} ORDER BY 1 DESC`;
      }
    }

    if (op === 'insert') {
      const data = {};
      columns.forEach(c => {
        if (c.isIdentity === 1) return;
        const v = req.body['col_'+c.name];
        if (typeof v !== 'undefined' && v !== '') data[c.name] = v;
      });
      const keys = Object.keys(data);
      if (keys.length === 0) throw new Error('Provide at least one column value.');
      const cols = keys.map(k => `[${k}]`).join(', ');
      const vals = keys.map(k => {
        const col = columns.find(c => c.name === k);
        const raw = String(data[k]).replace(/'/g, "''");
        return isStringType(col?.dataType) ? `'${raw}'` : raw;
      }).join(', ');
      sql = `INSERT ${fq} (${cols}) VALUES (${vals}); SELECT SCOPE_IDENTITY() AS NewID;`;
    }

    if (op === 'update') {
      if (pk.length === 0) throw new Error('No primary key found; please add one to use update.');
      const setPairs = [];
      columns.forEach(c => {
        if (pk.some(p => p.name === c.name) || c.isIdentity === 1) return;
        const v = req.body['col_'+c.name];
        if (typeof v !== 'undefined' && v !== '') {
          const esc = String(v).replace(/'/g, "''");
          setPairs.push(`[${c.name}] = ${isStringType(c.dataType) ? `'${esc}'` : esc}`);
        }
      });
      if (setPairs.length === 0) throw new Error('Provide at least one column to update.');
      const where = pk.map(p => {
        const v = req.body['pk_'+p.name];
        if (v === undefined || v==='') throw new Error('Missing PK value for '+p.name);
        const col = columns.find(c => c.name === p.name);
        const esc = String(v).replace(/'/g, "''");
        return `[${p.name}] = ${isStringType(col?.dataType) ? `'${esc}'` : esc}`;
      }).join(' AND ');
      sql = `UPDATE ${fq} SET ${setPairs.join(', ')} WHERE ${where}; SELECT @@ROWCOUNT AS rowsAffected;`;
    }

    if (op === 'delete') {
      if (pk.length === 0) throw new Error('No primary key found; please add one to use delete.');
      const where = pk.map(p => {
        const v = req.body['pk_'+p.name];
        if (v === undefined || v==='') throw new Error('Missing PK value for '+p.name);
        const col = columns.find(c => c.name === p.name);
        const esc = String(v).replace(/'/g, "''");
        return `[${p.name}] = ${isStringType(col?.dataType) ? `'${esc}'` : esc}`;
      }).join(' AND ');
      sql = `DELETE FROM ${fq} WHERE ${where}; SELECT @@ROWCOUNT AS rowsAffected;`;
    }

    const out = await runSqlText(sql);
    res.render('crud/result', { op, schema, table, sql, output: out, error: null });
  }catch(e){
    res.status(500).render('crud/result', { op, schema, table, sql: '', output: 'ERROR: ' + e.message, error: true });
  }
});

export default router;
