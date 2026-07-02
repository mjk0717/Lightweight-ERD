import { state } from './state';
import { modal } from './modal';
import { escapeHtml } from './util';
import { Column, Entity, Relation } from './types';

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

export interface DdlGenOptions {
  owner?: string;
  tablespace?: string;
  indexTablespace?: string;
}

function qualifiedTableName(name: string, owner?: string): string {
  return (owner ? '"' + owner + '".' : '') + '"' + name + '"';
}

// Generates a CREATE TABLE ... COMMENT ON ... script for one entity -
// intentionally just that range (no ALTER TABLE / FK constraints), matching
// what a reverse-engineered dump's per-table section usually looks like.
function generateDdl(entity: Entity, opts?: DdlGenOptions): string {
  const qualifiedName = qualifiedTableName(entity.name, opts?.owner);
  const colLines = entity.columns.map((c) => '  "' + c.name + '" ' + c.dataType + (c.nullable ? '' : ' NOT NULL'));
  const pkCols = entity.columns.filter((c) => c.pk);
  if (pkCols.length) {
    let pkLine = '  CONSTRAINT "' + entity.name + '_PK" PRIMARY KEY (' + pkCols.map((c) => '"' + c.name + '"').join(', ') + ')';
    if (opts?.indexTablespace) pkLine += ' USING INDEX TABLESPACE ' + opts.indexTablespace;
    colLines.push(pkLine);
  }

  const tableEnd = ')' + (opts?.tablespace ? '\nTABLESPACE ' + opts.tablespace : '') + ';';
  const statements = ['CREATE TABLE ' + qualifiedName + ' (\n' + colLines.join(',\n') + '\n' + tableEnd];

  if (entity.comment) {
    statements.push('COMMENT ON TABLE ' + qualifiedName + ' IS \'' + escapeSqlString(entity.comment) + '\';');
  }
  entity.columns.forEach((c) => {
    if (c.comment) {
      statements.push('COMMENT ON COLUMN ' + qualifiedName + '."' + c.name + '" IS \'' + escapeSqlString(c.comment) + '\';');
    }
  });

  return statements.join('\n\n');
}

// DROP TABLE ... for one entity - kept separate from generateDdl() since drop
// export is opt-in (the bulk export's "Include DROP TABLE" checkbox).
function generateDropTableDdl(entity: Entity, owner?: string): string {
  return 'DROP TABLE ' + qualifiedTableName(entity.name, owner) + ';';
}

// ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES ... for one
// relation - kept separate from generateDdl() since FK export is opt-in
// (the bulk export's "Include FK constraints" checkbox).
function generateFkConstraintDdl(relation: Relation, sourceEntity: Entity, targetEntity: Entity, owner?: string): string {
  const sourceCols = relation.columnPairs.map((p) => sourceEntity.columns.find((c) => c.id === p.sourceColumnId)).filter((c): c is Column => !!c);
  const targetCols = relation.columnPairs.map((p) => targetEntity.columns.find((c) => c.id === p.targetColumnId)).filter((c): c is Column => !!c);
  const constraintName = relation.name || (sourceEntity.name + '_' + targetEntity.name + '_FK');
  return 'ALTER TABLE ' + qualifiedTableName(sourceEntity.name, owner) + ' ADD CONSTRAINT "' + constraintName + '" FOREIGN KEY (' +
    sourceCols.map((c) => '"' + c.name + '"').join(', ') + ') REFERENCES ' + qualifiedTableName(targetEntity.name, owner) + ' (' +
    targetCols.map((c) => '"' + c.name + '"').join(', ') + ');';
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
  body.innerHTML =
    '<label class="col-check-row ddl-export-fk-toggle"><input type="checkbox" class="f-ddl-include-drop"> Include DROP TABLE statements</label>' +
    '<label class="col-check-row ddl-export-fk-toggle"><input type="checkbox" class="f-ddl-include-fk" checked> Include FK constraints (ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...)</label>' +
    '<div class="col-check-row ddl-export-fk-toggle ddl-export-ts-row">' +
      '<span class="ddl-export-ts-pair">' +
        '<label><input type="checkbox" class="f-ddl-include-owner"> Owner</label>' +
        '<input type="text" class="f-ddl-owner-input" placeholder="e.g. SCOTT" disabled>' +
      '</span>' +
      '<span class="ddl-export-ts-pair">' +
        '<label><input type="checkbox" class="f-ddl-include-tablespace"> Tablespace</label>' +
        '<input type="text" class="f-ddl-tablespace-input" placeholder="e.g. USERS" disabled>' +
      '</span>' +
      '<span class="ddl-export-ts-pair">' +
        '<label><input type="checkbox" class="f-ddl-include-idx-tablespace"> Index Tablespace</label>' +
        '<input type="text" class="f-ddl-idx-tablespace-input" placeholder="e.g. INDX" disabled>' +
      '</span>' +
    '</div>' +
    '<div class="ddl-export-grid">' +
      '<div class="ddl-export-list">' +
        '<label class="col-check-row ddl-export-select-all"><input type="checkbox" class="f-ddl-select-all" checked> Select All</label>' +
        entities.map((e) =>
          '<label class="col-check-row"><input type="checkbox" class="f-ddl-check" value="' + e.id + '" checked> ' + escapeHtml(e.name) + '</label>'
        ).join('') +
      '</div>' +
      '<textarea class="f-ddl-output" rows="20" readonly></textarea>' +
    '</div>';

  const checks = Array.from(body.querySelectorAll('.f-ddl-check')) as HTMLInputElement[];
  const selectAllToggle = body.querySelector('.f-ddl-select-all') as HTMLInputElement;
  const dropToggle = body.querySelector('.f-ddl-include-drop') as HTMLInputElement;
  const fkToggle = body.querySelector('.f-ddl-include-fk') as HTMLInputElement;
  const ownerToggle = body.querySelector('.f-ddl-include-owner') as HTMLInputElement;
  const ownerInput = body.querySelector('.f-ddl-owner-input') as HTMLInputElement;
  const tablespaceToggle = body.querySelector('.f-ddl-include-tablespace') as HTMLInputElement;
  const tablespaceInput = body.querySelector('.f-ddl-tablespace-input') as HTMLInputElement;
  const idxTablespaceToggle = body.querySelector('.f-ddl-include-idx-tablespace') as HTMLInputElement;
  const idxTablespaceInput = body.querySelector('.f-ddl-idx-tablespace-input') as HTMLInputElement;
  const textarea = body.querySelector('.f-ddl-output') as HTMLTextAreaElement;

  function currentDdl(): string {
    const checkedIds = new Set(checks.filter((c) => c.checked).map((c) => c.value));
    const checkedEntities = entities.filter((e) => checkedIds.has(e.id));
    const owner = ownerToggle.checked ? ownerInput.value.trim() || undefined : undefined;
    const genOpts: DdlGenOptions = {
      owner,
      tablespace: tablespaceToggle.checked ? tablespaceInput.value.trim() || undefined : undefined,
      indexTablespace: idxTablespaceToggle.checked ? idxTablespaceInput.value.trim() || undefined : undefined
    };
    const parts: string[] = [];
    checkedEntities.forEach((e) => {
      if (dropToggle.checked) parts.push(generateDropTableDdl(e, owner));
      parts.push(generateDdl(e, genOpts));
      if (fkToggle.checked) {
        state.data.relations.forEach((r) => {
          if (r.sourceEntityId !== e.id || !checkedIds.has(r.targetEntityId)) return;
          const tgt = state.getEntity(r.targetEntityId);
          if (tgt) parts.push(generateFkConstraintDdl(r, e, tgt, owner));
        });
      }
    });
    return parts.join('\n\n');
  }
  function updateOutput(): void { textarea.value = currentDdl(); }
  function syncSelectAll(): void {
    const checkedCount = checks.filter((c) => c.checked).length;
    selectAllToggle.checked = checkedCount === checks.length;
    selectAllToggle.indeterminate = checkedCount > 0 && checkedCount < checks.length;
  }
  selectAllToggle.addEventListener('change', () => {
    checks.forEach((c) => { c.checked = selectAllToggle.checked; });
    selectAllToggle.indeterminate = false;
    updateOutput();
  });
  checks.forEach((c) => c.addEventListener('change', () => { syncSelectAll(); updateOutput(); }));
  dropToggle.addEventListener('change', updateOutput);
  fkToggle.addEventListener('change', updateOutput);
  ownerToggle.addEventListener('change', () => {
    ownerInput.disabled = !ownerToggle.checked;
    if (ownerToggle.checked) ownerInput.focus();
    updateOutput();
  });
  ownerInput.addEventListener('input', updateOutput);
  tablespaceToggle.addEventListener('change', () => {
    tablespaceInput.disabled = !tablespaceToggle.checked;
    if (tablespaceToggle.checked) tablespaceInput.focus();
    updateOutput();
  });
  idxTablespaceToggle.addEventListener('change', () => {
    idxTablespaceInput.disabled = !idxTablespaceToggle.checked;
    if (idxTablespaceToggle.checked) idxTablespaceInput.focus();
    updateOutput();
  });
  tablespaceInput.addEventListener('input', updateOutput);
  idxTablespaceInput.addEventListener('input', updateOutput);
  updateOutput();

  modal.open({
    title: 'Export DDL',
    width: '920px',
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
