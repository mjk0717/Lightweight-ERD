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

// Swaps the current modal's body/footer/title for a wizard-style step change,
// sliding the old content out and the new content in (left = advancing,
// right = going back) instead of the instant rebuild open() does. Falls back
// to a plain open() when there's no modal to transition from (the wizard's
// first step). The body's height is explicitly animated between the two
// steps' natural heights since absolutely-positioned sliding panes can't
// otherwise contribute to it.
function transition(opts: ModalOptions, direction: 'left' | 'right'): ModalHandle {
  if (!current) return open(opts);

  const box = current.box;
  const bodyEl = current.body;
  const footer = box.querySelector('.modal-footer') as HTMLElement | null;
  const titleEl = box.querySelector('.modal-title') as HTMLElement | null;

  const oldHeight = bodyEl.getBoundingClientRect().height;
  if (opts.width) box.style.width = opts.width;
  if (titleEl) titleEl.textContent = opts.title || '';

  const oldPane = document.createElement('div');
  oldPane.className = 'modal-slide-pane';
  while (bodyEl.firstChild) oldPane.appendChild(bodyEl.firstChild);

  // Measure the new content's natural height before it's touched by any of
  // the sliding-pane machinery below (absolute positioning + a frozen
  // bodyEl height would both throw off a plain getBoundingClientRect() read
  // here) - appended as a normal-flow child of the still-unconstrained,
  // already-childless bodyEl, this height is exactly what it'll be once
  // finish() unwraps it for real.
  const newPane = document.createElement('div');
  newPane.appendChild(opts.body);
  bodyEl.appendChild(newPane);
  const newHeight = newPane.getBoundingClientRect().height;
  newPane.remove();

  // Only now switch bodyEl into slide mode: position:relative so the two
  // absolutely-positioned panes below use it as their containing block, and
  // an explicit (frozen) height so removing normal-flow content doesn't
  // collapse it before the height transition below takes over.
  bodyEl.classList.add('modal-body-sliding');
  bodyEl.style.height = oldHeight + 'px';
  newPane.className = 'modal-slide-pane';
  bodyEl.appendChild(newPane);
  bodyEl.appendChild(oldPane);

  const outSign = direction === 'left' ? -1 : 1;
  newPane.style.transform = 'translateX(' + (-outSign * 100) + '%)';
  oldPane.style.transform = 'translateX(0)';
  void newPane.offsetWidth; // commit the starting transform before animating

  requestAnimationFrame(() => {
    bodyEl.style.height = newHeight + 'px';
    oldPane.style.transform = 'translateX(' + (outSign * 100) + '%)';
    newPane.style.transform = 'translateX(0)';
  });

  let finished = false;
  function finish(): void {
    if (finished) return;
    finished = true;
    oldPane.remove();
    bodyEl.classList.remove('modal-body-sliding');
    bodyEl.style.height = '';
    while (newPane.firstChild) bodyEl.appendChild(newPane.firstChild);
    newPane.remove();
  }
  // transitionend on a pane that's simultaneously being reparented/resized
  // this way doesn't reliably fire across browsers, so a timer tied to the
  // actual CSS duration (0.22s, plus a small margin) is the real completion
  // signal - transitionend is kept only as a possible earlier trigger.
  newPane.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') finish(); });
  setTimeout(finish, 260);

  if (footer) buildFooterButtons(footer, opts.actions || []);
  current.onClose = opts.onClose;
  return { close, root: current.overlay, body: bodyEl };
}

export const modal = { open, close, transition };
