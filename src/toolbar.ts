import { state } from './state';
import { nextId } from './util';
import { modalEntity } from './modalEntity';
import { appTheme } from './appTheme';
import { Entity } from './types';

const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"/></svg>';
const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

function addTableAt(x: number, y: number): void {
  const entity: Entity = {
    id: nextId('ent'), name: 'NEW_TABLE', comment: '', x, y, headerColor: null,
    columns: [{
      id: nextId('col'), name: 'ID', dataType: 'NUMBER(10)', logicalDataType: 'INTEGER', physicalDataType: 'NUMBER(10)',
      comment: '', pk: true, fk: false, nullable: false, isSystem: false, systemColId: null
    }]
  };
  state.applySystemColumnsToEntity(entity);
  modalEntity.openNew(entity);
}

// The Logical/Physical toggle switch lives in the toolbar (kept as a
// quick-access control alongside the menu bar's View menu). Label order is
// Logical (left) - toggle - Physical (right): unchecked = Logical, checked =
// Physical, and it re-syncs whenever the mode changes elsewhere (e.g. the
// View menu).
function initModeSwitch(): void {
  const toggle = document.getElementById('mode-toggle') as HTMLInputElement | null;
  if (!toggle) return;
  const sync = () => { toggle.checked = state.data.designMode === 'physical'; };
  sync();
  toggle.addEventListener('change', () => state.setDesignMode(toggle.checked ? 'physical' : 'logical'));
  state.on('change', sync);
}

function initThemeToggle(): void {
  const btn = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (!btn) return;
  const themeButton = btn;

  function apply(): void {
    const dark = appTheme.isDark();
    themeButton.innerHTML = dark ? SUN_ICON : MOON_ICON;
    themeButton.title = dark ? 'Light mode' : 'Dark mode';
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  apply();
  themeButton.addEventListener('click', () => appTheme.toggle());
  state.on('change', apply);
}

function init(): void {
  appTheme.init();
  initThemeToggle();
  initModeSwitch();
}

export const toolbar = { init, addTableAt };
