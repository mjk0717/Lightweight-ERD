import { state } from './state';
import { modal } from './modal';
import { escapeHtml } from './util';
import { Entity } from './types';

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

// Generates a CREATE TABLE ... COMMENT ON ... script for one entity -
// intentionally just that range (no ALTER TABLE / FK constraints), matching
// what a reverse-engineered dump's per-table section usually looks like.
function generateDdl(entity: Entity): string {
  const colLines = entity.columns.map((c) => '  "' + c.name + '" ' + c.dataType + (c.nullable ? '' : ' NOT NULL'));
  const pkCols = entity.columns.filter((c) => c.pk);
  if (pkCols.length) {
    colLines.push('  CONSTRAINT "' + entity.name + '_PK" PRIMARY KEY (' + pkCols.map((c) => '"' + c.name + '"').join(', ') + ')');
  }

  const statements = ['CREATE TABLE "' + entity.name + '" (\n' + colLines.join(',\n') + '\n);'];

  if (entity.comment) {
    statements.push('COMMENT ON TABLE "' + entity.name + '" IS \'' + escapeSqlString(entity.comment) + '\';');
  }
  entity.columns.forEach((c) => {
    if (c.comment) {
      statements.push('COMMENT ON COLUMN "' + entity.name + '"."' + c.name + '" IS \'' + escapeSqlString(c.comment) + '\';');
    }
  });

  return statements.join('\n\n');
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard unavailable - user can still select the text manually */ }
  document.body.removeChild(ta);
}

// Toolbar-level export: a checklist of every table (all checked by default)
// next to a live-updating textarea with the combined DDL for whichever
// tables are currently checked.
function openBulk(): void {
  const entities = state.data.entities;
  if (!entities.length) { window.alert('There are no tables to export.'); return; }

  const body = document.createElement('div');
  body.className = 'ddl-export-grid';
  body.innerHTML =
    '<div class="ddl-export-list">' +
      entities.map((e) =>
        '<label class="col-check-row"><input type="checkbox" class="f-ddl-check" value="' + e.id + '" checked> ' + escapeHtml(e.name) + '</label>'
      ).join('') +
    '</div>' +
    '<textarea class="f-ddl-output" rows="20" readonly></textarea>';

  const checks = Array.from(body.querySelectorAll('.f-ddl-check')) as HTMLInputElement[];
  const textarea = body.querySelector('.f-ddl-output') as HTMLTextAreaElement;

  function currentDdl(): string {
    const checkedIds = new Set(checks.filter((c) => c.checked).map((c) => c.value));
    return entities.filter((e) => checkedIds.has(e.id)).map((e) => generateDdl(e)).join('\n\n');
  }
  function updateOutput(): void { textarea.value = currentDdl(); }
  checks.forEach((c) => c.addEventListener('change', updateOutput));
  updateOutput();

  modal.open({
    title: 'Export DDL',
    width: '820px',
    body,
    actions: [
      { label: 'Close', onClick: () => modal.close() },
      { label: 'Copy to clipboard', variant: 'primary', onClick: () => copyToClipboard(textarea.value) }
    ]
  });
}

function open(entityId: string): void {
  const entity = state.getEntity(entityId);
  if (!entity) return;
  const ddl = generateDdl(entity);

  const body = document.createElement('div');
  body.innerHTML =
    '<p class="hint">' + escapeHtml(entity.name) + ' as CREATE TABLE / COMMENT statements.</p>' +
    '<textarea class="f-ddl-output" rows="18" readonly></textarea>';
  (body.querySelector('.f-ddl-output') as HTMLTextAreaElement).value = ddl;

  modal.open({
    title: 'DDL - ' + entity.name,
    width: '700px',
    body,
    actions: [
      { label: 'Close', onClick: () => modal.close() },
      { label: 'Copy to clipboard', variant: 'primary', onClick: () => copyToClipboard(ddl) }
    ]
  });
}

export const ddlExport = { open, openBulk, generateDdl };
