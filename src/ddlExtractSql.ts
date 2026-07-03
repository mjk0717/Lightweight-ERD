export type DbVendor = 'oracle' | 'mysql' | 'postgres' | 'mssql';

export const DB_VENDORS: { value: DbVendor; label: string }[] = [
  { value: 'oracle', label: 'Oracle' },
  { value: 'mysql', label: 'MySQL / MariaDB' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mssql', label: 'SQL Server' }
];

function schemaOf(schema: string): string {
  return schema.trim() || '<SCHEMA>';
}

// Each generator produces SQL to run against the *source* database's own
// catalog, not DDL itself - the user runs it there and pastes the resulting
// rows back into the box below. Every vendor's catalog exposes different
// DDL-reconstruction capabilities (Oracle's DBMS_METADATA can reproduce full
// CREATE TABLE text including constraints; the others have no equivalent
// single-call export), so each function shapes its own SQL instead of
// forcing one query style across vendors.
const GENERATORS: Record<DbVendor, (schema: string) => string> = {
  oracle(schema) {
    const s = schemaOf(schema);
    // DBMS_METADATA.GET_DDL returns CLOB, so the comment branches are cast to
    // CLOB too - Oracle's UNION ALL requires every branch of the same column
    // to share a datatype, and mixing CLOB with VARCHAR2 is rejected.
    return `-- Run once - UNION ALL keeps CREATE TABLE, table comments, and column
-- comments together in one result set (ORDER BY keeps tables first, since
-- COMMENT ON referencing a not-yet-seen table gets dropped on import)
SELECT 1 AS ord, DBMS_METADATA.GET_DDL('TABLE', table_name) AS ddl
FROM ALL_TABLES
WHERE OWNER = '${s}'
UNION ALL
SELECT 2, TO_CLOB('COMMENT ON TABLE "' || TABLE_NAME || '" IS ''' || REPLACE(COMMENTS, '''', '''''') || ''';')
FROM ALL_TAB_COMMENTS
WHERE OWNER = '${s}' AND COMMENTS IS NOT NULL
UNION ALL
SELECT 3, TO_CLOB('COMMENT ON COLUMN "' || TABLE_NAME || '"."' || COLUMN_NAME || '" IS ''' || REPLACE(COMMENTS, '''', '''''') || ''';')
FROM ALL_COL_COMMENTS
WHERE OWNER = '${s}' AND COMMENTS IS NOT NULL
ORDER BY ord;`;
  },
  mysql(schema) {
    const s = schemaOf(schema);
    return `-- 1) MySQL has no aggregate DDL export - this generates one SHOW CREATE TABLE
--    statement per table; run each and paste its "Create Table" result column
SELECT CONCAT('SHOW CREATE TABLE \`', TABLE_NAME, '\`;') AS run_this
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = '${s}';

-- 2) Table + column comments, combined via UNION ALL - run once
SELECT 1 AS ord, CONCAT('COMMENT ON TABLE "', TABLE_NAME, '" IS ''', REPLACE(TABLE_COMMENT, '''', ''''''), ''';') AS ddl
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = '${s}' AND TABLE_COMMENT <> ''
UNION ALL
SELECT 2, CONCAT('COMMENT ON COLUMN "', TABLE_NAME, '"."', COLUMN_NAME, '" IS ''', REPLACE(COLUMN_COMMENT, '''', ''''''), ''';')
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = '${s}' AND COLUMN_COMMENT <> ''
ORDER BY ord;`;
  },
  postgres(schema) {
    const s = schemaOf(schema);
    return `-- 1) No single built-in DDL export - for accurate CREATE TABLE/constraint text,
--    prefer running from a terminal:  pg_dump --schema-only --no-owner -n ${s} <database>
--    Fallback column dump if pg_dump isn't available:
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = '${s}'
ORDER BY table_name, ordinal_position;

-- 2) Table + column comments, combined via UNION ALL - run once
SELECT 1 AS ord, 'COMMENT ON TABLE "' || c.relname || '" IS ''' || replace(d.description, '''', '''''') || ''';' AS ddl
FROM pg_class c
JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${s}'
UNION ALL
SELECT 2, 'COMMENT ON COLUMN "' || c.relname || '"."' || a.attname || '" IS ''' || replace(d.description, '''', '''''') || ''';'
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid
JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${s}'
ORDER BY ord;`;
  },
  mssql(schema) {
    const s = schemaOf(schema);
    return `-- 1) No single built-in DDL export - SSMS's Database > Tasks > Generate Scripts
--    wizard gives the most accurate result. Fallback column dump:
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = '${s}'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 2) Table + column comments (MS_Description extended property), combined
--    via UNION ALL - run once
SELECT 1 AS ord, 'COMMENT ON TABLE "' + t.name + '" IS ''' + REPLACE(CAST(ep.value AS NVARCHAR(MAX)), '''', '''''') + ''';' AS ddl
FROM sys.tables t
JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
WHERE SCHEMA_NAME(t.schema_id) = '${s}'
UNION ALL
SELECT 2, 'COMMENT ON COLUMN "' + t.name + '"."' + c.name + '" IS ''' + REPLACE(CAST(ep.value AS NVARCHAR(MAX)), '''', '''''') + ''';'
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE SCHEMA_NAME(t.schema_id) = '${s}'
ORDER BY ord;`;
  }
};

export function generateExtractSql(vendor: DbVendor, schema: string): string {
  return (GENERATORS[vendor] || GENERATORS.oracle)(schema);
}
