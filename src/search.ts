import { state } from './state';
import { logicalDataType, physicalDataType } from './columnTypes';
import { Entity, Relation } from './types';

type Listener = () => void;

let inputEl: HTMLInputElement | null = null;
let active = false;
let query = '';
const listeners: Listener[] = [];

function normalized(value: unknown): string {
  return String(value == null ? '' : value).toLowerCase();
}

function includesQuery(values: unknown[]): boolean {
  const q = normalized(query.trim());
  if (!q) return false;
  return values.some((value) => normalized(value).indexOf(q) !== -1);
}

function notify(): void {
  listeners.slice().forEach((listener) => listener());
}

function onChange(listener: Listener): void {
  listeners.push(listener);
}

function isActive(): boolean {
  return active;
}

function matchesEntity(entity: Entity): boolean {
  const values: unknown[] = [entity.name, entity.comment];
  entity.columns.forEach((col) => values.push(col.name, col.comment, col.dataType, logicalDataType(col), physicalDataType(col)));
  return includesQuery(values);
}

function matchesRelation(relation: Relation): boolean {
  const source = state.getEntity(relation.sourceEntityId);
  const target = state.getEntity(relation.targetEntityId);
  const sourceCols = relation.columnPairs.map((pair) => source && source.columns.find((col) => col.id === pair.sourceColumnId));
  const targetCols = relation.columnPairs.map((pair) => target && target.columns.find((col) => col.id === pair.targetColumnId));
  const values: unknown[] = [
    relation.name,
    relation.logicalName,
    source && source.name,
    source && source.comment,
    target && target.name,
    target && target.comment
  ];
  sourceCols.forEach((col) => { if (col) values.push(col.name, col.comment, col.dataType, logicalDataType(col), physicalDataType(col)); });
  targetCols.forEach((col) => { if (col) values.push(col.name, col.comment, col.dataType, logicalDataType(col), physicalDataType(col)); });
  return includesQuery(values);
}

function focus(): void {
  if (!inputEl) return;
  inputEl.focus();
  inputEl.select();
}

function init(): void {
  inputEl = document.getElementById('global-search-input') as HTMLInputElement | null;
  if (!inputEl) return;

  inputEl.addEventListener('focus', () => {
    active = true;
    notify();
  });
  inputEl.addEventListener('blur', () => {
    active = false;
    notify();
  });
  inputEl.addEventListener('input', () => {
    query = inputEl ? inputEl.value : '';
    notify();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (inputEl!.value) {
      inputEl!.value = '';
      query = '';
      notify();
    } else {
      inputEl!.blur();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return;
    e.preventDefault();
    focus();
  }, true);
}

export const search = { init, onChange, isActive, matchesEntity, matchesRelation, focus };
