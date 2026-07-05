import { state } from './state';

const STORAGE_KEY = 'erd_tool_theme';
const LIGHT_IDENTIFYING_RELATION_STROKE = '#1d4ed8';
const LIGHT_NON_IDENTIFYING_RELATION_STROKE = '#64748b';
const DARK_IDENTIFYING_RELATION_STROKE = '#f87171';
const DARK_NON_IDENTIFYING_RELATION_STROKE = '#94a3b8';
const DARK_RELATION_STROKE_HOVER = '#fb7185';
const LIGHT_RELATION_HIGHLIGHT_HALO = '#f59e0b';
const DARK_RELATION_HIGHLIGHT_HALO = '#fbbf24';

let dark = false;

function detectInitialDarkMode(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved === 'dark';
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function apply(): void {
  document.body.classList.toggle('dark-mode', dark);
}

function init(): void {
  dark = detectInitialDarkMode();
  apply();
  state.emit('change');
}

function isDark(): boolean {
  return dark;
}

function setDark(next: boolean): void {
  if (dark === next) return;
  dark = next;
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  apply();
  state.emit('change');
}

function toggle(): void {
  setDark(!dark);
}

function relationStroke(identifying: boolean): string {
  if (dark) return identifying ? DARK_IDENTIFYING_RELATION_STROKE : DARK_NON_IDENTIFYING_RELATION_STROKE;
  return identifying ? LIGHT_IDENTIFYING_RELATION_STROKE : LIGHT_NON_IDENTIFYING_RELATION_STROKE;
}

function relationStrokeHover(fallback: string): string {
  return dark ? DARK_RELATION_STROKE_HOVER : fallback;
}

function relationHighlightHalo(): string {
  return dark ? DARK_RELATION_HIGHLIGHT_HALO : LIGHT_RELATION_HIGHLIGHT_HALO;
}

export const appTheme = { init, isDark, setDark, toggle, relationStroke, relationStrokeHover, relationHighlightHalo };
