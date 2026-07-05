import { Column, DesignMode, SystemColumnDef } from './types';

type ColumnLike = Pick<Column, 'dataType' | 'logicalDataType' | 'physicalDataType'>;
type MutableColumnLike = ColumnLike | SystemColumnDef;

function legacyType(col: ColumnLike): string {
  return col.dataType || col.physicalDataType || col.logicalDataType || '';
}

export function logicalDataType(col: ColumnLike): string {
  return col.logicalDataType || legacyType(col);
}

export function physicalDataType(col: ColumnLike): string {
  return col.physicalDataType || legacyType(col);
}

export function displayDataType(col: ColumnLike, mode: DesignMode): string {
  return mode === 'logical' ? logicalDataType(col) : physicalDataType(col);
}

export function setLogicalDataType(col: MutableColumnLike, value: string): void {
  col.logicalDataType = value;
  if (!col.physicalDataType && !col.dataType) col.dataType = value;
}

export function setPhysicalDataType(col: MutableColumnLike, value: string): void {
  col.physicalDataType = value;
  col.dataType = value;
  if (!col.logicalDataType) col.logicalDataType = value;
}

export function normalizeDataTypes<T extends MutableColumnLike>(col: T): T {
  const physical = physicalDataType(col);
  const logical = logicalDataType(col);
  col.physicalDataType = physical;
  col.logicalDataType = logical;
  col.dataType = physical;
  return col;
}

export function copyDataTypes(from: ColumnLike, to: MutableColumnLike): void {
  to.logicalDataType = logicalDataType(from);
  to.physicalDataType = physicalDataType(from);
  to.dataType = physicalDataType(from);
}
