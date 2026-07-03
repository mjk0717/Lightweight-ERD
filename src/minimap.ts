import { state } from './state';
import { viewport } from './viewport';
import { entityRenderer } from './entityRenderer';
import { theme } from './theme';
import { Box } from './types';

// Bottom-right minimap: the bounding box of every table is scaled to fit the
// minimap's fixed max size (so all tables are always visible in it), with the
// current camera's visible area drawn as a rectangle on top. Click/drag on
// the minimap recenters the camera there.

const MAX_W = 220;
const MAX_H = 160;
const PAD = 8;

let containerEl: HTMLElement;
let canvasEl: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// Last-computed world->minimap mapping, kept so pointer events can invert it.
let mapping: { minX: number; minY: number; scale: number; offX: number; offY: number } | null = null;

function contentBounds(): Box | null {
  const entities = state.data.entities;
  if (!entities.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  entities.forEach((e) => {
    const b = entityRenderer.getEntityBox(e.id);
    if (!b) return;
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  });
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
}

function draw(): void {
  if (!state.data.minimapVisible) { containerEl.style.display = 'none'; return; }
  const bounds = contentBounds();
  if (!bounds) { containerEl.style.display = 'none'; return; }
  containerEl.style.display = '';

  const innerW = MAX_W - PAD * 2, innerH = MAX_H - PAD * 2;
  const scale = Math.min(innerW / bounds.w, innerH / bounds.h);
  const drawnW = bounds.w * scale, drawnH = bounds.h * scale;
  const offX = PAD + (innerW - drawnW) / 2;
  const offY = PAD + (innerH - drawnH) / 2;
  mapping = { minX: bounds.x, minY: bounds.y, scale, offX, offY };

  const dpr = window.devicePixelRatio || 1;
  if (canvasEl.width !== MAX_W * dpr || canvasEl.height !== MAX_H * dpr) {
    canvasEl.width = MAX_W * dpr; canvasEl.height = MAX_H * dpr;
    canvasEl.style.width = MAX_W + 'px'; canvasEl.style.height = MAX_H + 'px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, MAX_W, MAX_H);

  // Tables
  state.data.entities.forEach((e) => {
    const b = entityRenderer.getEntityBox(e.id);
    if (!b) return;
    const x = offX + (b.x - bounds.x) * scale;
    const y = offY + (b.y - bounds.y) * scale;
    const w = Math.max(b.w * scale, 2), h = Math.max(b.h * scale, 2);
    ctx.fillStyle = e.headerColor || theme.colors.headerBg;
    ctx.fillRect(x, y, w, h);
  });

  // Camera rectangle (clamped to the canvas so it's always visible)
  const vr = viewport.visibleWorldRect();
  let rx = offX + (vr.x - bounds.x) * scale;
  let ry = offY + (vr.y - bounds.y) * scale;
  let rw = vr.w * scale, rh = vr.h * scale;
  const rx2 = Math.min(MAX_W, rx + rw), ry2 = Math.min(MAX_H, ry + rh);
  rx = Math.max(0, rx); ry = Math.max(0, ry);
  rw = Math.max(0, rx2 - rx); rh = Math.max(0, ry2 - ry);
  ctx.strokeStyle = theme.colors.relationStrokeHover || '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(rw - 1, 0), Math.max(rh - 1, 0));
  ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
  ctx.fillRect(rx, ry, rw, rh);
}

function recenterFromEvent(e: MouseEvent): void {
  if (!mapping) return;
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = mapping.minX + (mx - mapping.offX) / mapping.scale;
  const wy = mapping.minY + (my - mapping.offY) / mapping.scale;
  viewport.centerOnWorld(wx, wy);
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  recenterFromEvent(e);
  const move = (ev: MouseEvent) => recenterFromEvent(ev);
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function init(): void {
  containerEl = document.getElementById('minimap')!;
  canvasEl = containerEl.querySelector('canvas') as HTMLCanvasElement;
  ctx = canvasEl.getContext('2d')!;
  canvasEl.addEventListener('mousedown', onMouseDown);
  state.on('change', draw);
  state.on('move', draw);
  viewport.onViewChange(draw);
  draw();
}

export const minimap = { init };
