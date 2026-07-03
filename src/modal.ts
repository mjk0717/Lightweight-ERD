import { escapeHtml } from './util';
import { ModalAction, ModalHandle, ModalOptions } from './types';

interface CurrentModal {
  overlay: HTMLElement;
  box: HTMLElement;
  body: HTMLElement;
  onClose?: () => void;
}

let current: CurrentModal | null = null;

function close(): void {
  if (!current) return;
  if (current.onClose) current.onClose();
  current.overlay.remove();
  document.removeEventListener('keydown', onKeydown);
  current = null;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}

// Drags the modal box by its header. The box starts centered via flexbox on
// .modal-overlay; the first drag pins it to its current on-screen spot with
// `position: fixed` so it can then move freely.
function makeDraggable(header: HTMLElement, box: HTMLElement): void {
  header.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.modal-close')) return;
    e.preventDefault();
    const rect = box.getBoundingClientRect();
    box.style.position = 'fixed';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.margin = '0';
    const startX = e.clientX, startY = e.clientY;
    const originLeft = rect.left, originTop = rect.top;

    function onMove(ev: MouseEvent): void {
      box.style.left = (originLeft + ev.clientX - startX) + 'px';
      box.style.top = (originTop + ev.clientY - startY) + 'px';
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function open(opts: ModalOptions): ModalHandle {
  if (current) close();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';
  if (opts.width) box.style.width = opts.width;
  // Wizard modals (Import/Export) get full-width footer buttons - detected by
  // the step indicator in their body so callers need no extra flag.
  if (opts.body && opts.body.querySelector('.wizard-steps')) box.classList.add('modal-wizard');

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = '<span class="modal-title">' + escapeHtml(opts.title || '') + '</span>' +
    '<button type="button" class="modal-close" aria-label="Close">✕</button>';

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (opts.body) body.appendChild(opts.body);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  buildFooterButtons(footer, opts.actions || []);

  box.appendChild(header);
  box.appendChild(body);
  if ((opts.actions || []).length) box.appendChild(footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  (header.querySelector('.modal-close') as HTMLElement).addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKeydown);
  makeDraggable(header, box);

  current = { overlay, box, body, onClose: opts.onClose };
  return { close, root: overlay, body };
}

function buildFooterButtons(footer: HTMLElement, actions: ModalAction[]): void {
  footer.innerHTML = '';
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn' + (action.variant ? ' btn-' + action.variant : '');
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick && action.onClick());
    footer.appendChild(btn);
  });
}

// Ensures the box's footer matches the given actions: creates the footer bar
// when a step first needs buttons, removes it entirely when a step has none
// (so a footerless step - e.g. the wizard Plan, whose choices are the
// buttons - shows no empty bar), otherwise just rebuilds the buttons.
function syncFooter(box: HTMLElement, actions: ModalAction[]): void {
  let footer = box.querySelector('.modal-footer') as HTMLElement | null;
  if (!actions.length) { if (footer) footer.remove(); return; }
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'modal-footer';
    box.appendChild(footer);
  }
  buildFooterButtons(footer, actions);
}

// Swaps the current modal's title/body/footer in place for a wizard step
// change. The content is replaced instantly (no horizontal slide), but the
// body's height animates from the old step's to the new step's so the modal
// grows/shrinks smoothly. Falls back to a full open() when there's no modal
// to transition from (the wizard's first step). The `_direction` argument is
// unused now that there's no slide; it's kept so the wizard call sites don't
// all need touching.
function transition(opts: ModalOptions, _direction: 'left' | 'right'): ModalHandle {
  if (!current) return open(opts);

  const box = current.box;
  const bodyEl = current.body;
  const titleEl = box.querySelector('.modal-title') as HTMLElement | null;

  const oldHeight = bodyEl.getBoundingClientRect().height;
  if (opts.width) box.style.width = opts.width;
  if (titleEl) titleEl.textContent = opts.title || '';
  if (opts.body.querySelector('.wizard-steps')) box.classList.add('modal-wizard');

  bodyEl.innerHTML = '';
  bodyEl.appendChild(opts.body);
  syncFooter(box, opts.actions || []);
  const newHeight = bodyEl.getBoundingClientRect().height;

  // Animate the height change (only if it actually differs): pin to the old
  // height, commit it, then transition to the new height and release back to
  // auto once done.
  if (Math.round(oldHeight) !== Math.round(newHeight)) {
    bodyEl.style.height = oldHeight + 'px';
    bodyEl.classList.add('modal-body-resizing');
    void bodyEl.offsetWidth;
    let done = false;
    const finish = (e?: TransitionEvent): void => {
      if (done || (e && e.propertyName !== 'height')) return;
      done = true;
      bodyEl.classList.remove('modal-body-resizing');
      bodyEl.style.height = '';
      bodyEl.removeEventListener('transitionend', finish);
    };
    bodyEl.addEventListener('transitionend', finish);
    setTimeout(finish, 260);
    requestAnimationFrame(() => { bodyEl.style.height = newHeight + 'px'; });
  }

  current.onClose = opts.onClose;
  return { close, root: current.overlay, body: bodyEl };
}

export const modal = { open, close, transition };
