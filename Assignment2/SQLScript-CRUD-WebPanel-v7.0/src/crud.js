// CRUD router: builds a simple dynamic UI for viewing/inserting/updating/deleting rows
// across a fixed whitelist of tables. It relies on sqlrunner.js to execute SQL via sqlcmd.

import express from 'express';
import { runJson, runSqlText } from './sqlrunner.js';

const router = express.Router();

// Whitelisted tables the UI will expose, with friendly labels for the dropdown
const TABLES = [
  { fq: 'dbo.Roles',             pretty: 'Roles' },
  { fq: 'dbo.[User]',            pretty: 'Users' },
  { fq: 'dbo.Modules',           pretty: 'Modules' },
  { fq: 'dbo.Topic',             pretty: 'Topics' },
  { fq: 'dbo.Reply',             pretty: 'Replies' },
  { fq: 'dbo.UserModule',        pretty: 'User Modules' },
  { fq: 'dbo.TopicSubscriber',   pretty: 'Topic Subscribers' },
  { fq: 'dbo.TutorSubscriber',   pretty: 'Tutor Subscribers' }
];

// Foreign-key helper map used to populate dropdowns for referenced rows in forms.
// Each entry defines the lookup table, key column, display label, and optional role filter.
const FK = {
  'dbo.[User]': {
    Role_ID: { table: 'dbo.Roles', key:'Role_ID', label:'Name' }
  },
  'dbo.Topic': {
    User_ID:   { table: 'dbo.[User]', key:'User_ID', label:'Username' },
    Module_ID: { table: 'dbo.Modules', key:'Module_ID', label:'Name' }
  },
  'dbo.Reply': {
    Topic_ID:        { table: 'dbo.Topic', key:'Topic_ID', label:'Title' },
    Parent_Reply_ID: { table: 'dbo.Reply', key:'Reply_ID', label:'Reply_ID' },
    User_ID:         { table: 'dbo.[User]', key:'User_ID', label:'Username' }
  },
  'dbo.UserModule': {
    Module_ID: { table: 'dbo.Modules', key:'Module_ID', label:'Name' },
    User_ID:   { table: 'dbo.[User]',  key:'User_ID',   label:'Username' }
  },
  'dbo.TopicSubscriber': {
    Topic_ID: { table: 'dbo.Topic', key:'Topic_ID', label:'Title' },
    User_ID:  { table: 'dbo.[User]', key:'User_ID', label:'Username' }
  },
  'dbo.TutorSubscriber': {
    Tutor_ID:   { table: 'dbo.[User]', key:'User_ID', label:'Username', role: 'TUTOR' },
    Student_ID: { table: 'dbo.[User]', key:'User_ID', label:'Username', role: 'STUDENT' }
  }
};

// Parse a fully-qualified table name (schema.table) into parts.
// Falls back to dbo if a schema is not provided.
function parseTable(fq) {
  let m = fq.match(/^\s*([^.\s]+)\.(.+)\s*$/);
  if (!m) return { schema: 'dbo', table: fq };
  return { schema: m[1], table: m[2] };
}

// Safe formatter for [schema].[Table] with brackets preserved on table when already present.
function fq(schema, table) { return `[${schema}].${table.startsWith('[') ? table : '['+table+']'}`; }

// Retrieve column metadata for the selected table (name, type, nullability, length, identity flag).
// Results are used to build forms and to decide which columns are editable.
async function getColumns(schema, table) {
  const sql = `DECLARE @schema sysname='$(schema)', @table sysname='$(table)';
  SELECT
    c.COLUMN_NAME AS name,
    c.DATA_TYPE   AS dataType,
    c.IS_NULLABLE AS isNullable,
    c.CHARACTER_MAXIMUM_LENGTH AS maxLen,
    COLUMNPROPERTY(OBJECT_ID(@schema + '.' + @table), c.COLUMN_NAME, 'IsIdentity') AS isIdentity
  FROM INFORMATION_SCHEMA.COLUMNS c
  WHERE c.TABLE_SCHEMA=@schema AND c.TABLE_NAME=@table
  ORDER BY c.ORDINAL_POSITION;`;
  return await runJson(sql, { schema, table: table.replace(/^\[|\]$/g,'') });
}

// Retrieve primary key column list (in ordinal order). Supports composite keys.
// Used to construct WHERE clauses for update/delete and to lock PK fields in forms.
async function getPrimaryKeys(schema, table) {
  const sql = `DECLARE @schema sysname='$(schema)', @table sysname='$(table)';
  SELECT kcu.COLUMN_NAME AS name
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON kcu.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
   AND kcu.TABLE_SCHEMA=tc.TABLE_SCHEMA
   AND kcu.TABLE_NAME=tc.TABLE_NAME
  WHERE tc.TABLE_SCHEMA=@schema AND tc.TABLE_NAME=@table AND tc.CONSTRAINT_TYPE='PRIMARY KEY'
  ORDER BY kcu.ORDINAL_POSITION;`;
  return await runJson(sql, { schema, table: table.replace(/^\[|\]$/g,'') });
}

// If a column is a known foreign key (per FK map), fetch up to 200 options for a dropdown.
// For Users with role filters (TUTOR/STUDENT), join to Roles to constrain the list.
async function getFkOptions(tableFq, colName) {
  const map = FK[tableFq] && FK[tableFq][colName];
  if (!map) return null;
  const { table, key, label, role } = map;
  if (table.toLowerCase() === 'dbo.[user]' && role) {
    const sql = `SELECT TOP (200) u.${key} AS value, u.${label} AS label
           FROM dbo.[User] u
           JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
           WHERE r.Name = '$(role)'
           ORDER BY u.${label};`;
    return await runJson(sql, { role });
  } else {
    const { schema, table: t } = parseTable(table);
    const sql = `SELECT TOP (200) ${fq(schema, t)}.${key} AS value, ${fq(schema, t)}.${label} AS label
           FROM ${fq(schema, t)} ORDER BY ${label};`;
    return await runJson(sql);
  }
}

// Heuristic for deciding whether a SQL literal should be quoted as a string.
// Includes char/text types, temporal, GUID, and XML.
function isStringType(t){
  const s = String(t||'').toLowerCase();
  return s.includes('char') || s.includes('text') || s.includes('date') || s.includes('time') || s.includes('uniqueidentifier') || s.includes('xml');
}

// Landing page: shows the table dropdown and operation buttons (View/Insert/Update/Delete).
router.get('/crud', (req, res) => {
  res.render('crud/index', { tables: TABLES });
});

// Build form for the selected operation and table. Gathers columns, PKs, and FK dropdown data.
router.post('/crud/build', async (req, res, next) => {
  const op = req.body.op;
  const selected = TABLES.find(t => t.fq === req.body.table);
  if (!selected) return res.status(400).send('Unknown table.');
  const { schema, table } = parseTable(selected.fq);
  try {
    const columns = await getColumns(schema, table);
    const pk = await getPrimaryKeys(schema, table);

    // Preload foreign-key dropdowns per editable column
    const fkOptions = {};
    for (const c of columns) {
      const opts = await getFkOptions(selected.fq, c.name);
      if (opts) fkOptions[c.name] = opts;
    }

    res.render('crud/form', { op, schema, table, tableFq: selected.fq, pretty: selected.pretty, columns, pk, fkOptions });
  } catch(e){ next(e); }
});

// Execute the requested operation:
// - view: SELECT with optional equality filter
// - insert: INSERT with non-identity columns only
// - update: UPDATE by primary key
// - delete: DELETE by primary key
router.post('/crud/run', async (req, res) => {
  const { op, schema, table } = req.body;
  const columns = JSON.parse(req.body.columnsJson || '[]');
  const pk = JSON.parse(req.body.pkJson || '[]');

  try{
    let sql = '';
    const target = fq(schema, table);

    // VIEW: show top 100 rows, optional equality filter on a chosen column
    if (op === 'view') {
      const filterCol = req.body.filterCol;
      const filterVal = req.body.filterVal;
      if (filterCol) {
        const col = columns.find(c => c.name === filterCol);
        const val = (filterVal ?? '').replace(/'/g, "''");
        sql = `SELECT TOP (100) * FROM ${target} WHERE [${filterCol}] = ${isStringType(col?.dataType) ? `'${val}'` : val} ORDER BY 1 DESC`;
      } else {
        sql = `SELECT TOP (100) * FROM ${target} ORDER BY 1 DESC`;
      }
      const rows = await runJson(sql);
      return res.render('crud/result', { op, schema, table, pretty: req.body.pretty, sql, rows, output: null, error: null });
    }

    // INSERT: ignore identity columns; build name/value lists, quote strings, escape single quotes
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
      sql = `INSERT ${target} (${cols}) VALUES (${vals}); SELECT SCOPE_IDENTITY() AS NewID;`;
    }

    // UPDATE: require PK(s); build SET list for non-PK, non-identity columns; strict equality on PK(s)
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
      sql = `UPDATE ${target} SET ${setPairs.join(', ')} WHERE ${where}; SELECT @@ROWCOUNT AS rowsAffected;`;
    }

    // DELETE: require PK(s); strict equality filter by all PK columns
    if (op === 'delete') {
      if (pk.length === 0) throw new Error('No primary key found; please add one to use delete.');
      const where = pk.map(p => {
        const v = req.body['pk_'+p.name];
        if (v === undefined || v==='') throw new Error('Missing PK value for '+p.name);
        const col = columns.find(c => c.name === p.name);
        const esc = String(v).replace(/'/g, "''");
        return `[${p.name}] = ${isStringType(col?.dataType) ? `'${esc}'` : esc}`;
      }).join(' AND ');
      sql = `DELETE FROM ${target} WHERE ${where}; SELECT @@ROWCOUNT AS rowsAffected;`;
    }

    // Execute the composed statement and render the result/diagnostic block
    const out = await runSqlText(sql);
    res.render('crud/result', { op, schema, table, pretty: req.body.pretty, sql, rows: null, output: out, error: null });
  }catch(e){
    // Render a friendly error block with the raised message
    res.status(500).render('crud/result', { op, schema, table, pretty: req.body.pretty, sql: '', rows: null, output: 'ERROR: ' + e.message, error: true });
  }
});

export default router;

