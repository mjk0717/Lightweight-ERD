import { escapeHtml } from './util';
import { ModalHandle, ModalOptions } from './types';

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

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = '<span class="modal-title">' + escapeHtml(opts.title || '') + '</span>' +
    '<button type="button" class="modal-close" aria-label="Close">✕</button>';

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (opts.body) body.appendChild(opts.body);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  (opts.actions || []).forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn' + (action.variant ? ' btn-' + action.variant : '');
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick && action.onClick());
    footer.appendChild(btn);
  });

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

export const modal = { open, close };
