/*
 * Lightbox: adapted from duccanhole/lightbox-js (MIT, see LICENSE), upstream commit 85637d4 (2026-03-09).
 * https://github.com/duccanhole/lightbox-js
 *
 * Local changes: images only (video, audio, iframe, custom HTML, rotate and download removed); a native <dialog> in
 * place of a plain div (focus trap, Esc, top layer, focus returns to the opener); labelled buttons; no inline style
 * attributes (our CSP is `style-src 'self'`); an <img> with alt text instead of a background image; previous / next
 * buttons, arrow keys and a counter; photos that cross-fade (no sliding, so nothing travels across the screen; a swipe changes photo on release); thumbnails
 * as buttons; the page's scroll lock is restored, not reset; pinch and double-tap zoom with pan limits.
 */
import { afterTransition } from '@/lib/motion/presence';
import './lightbox.css';

export interface LightboxItem {
  src: string;
  alt: string;
  /** Smaller image for the thumbnail strip; falls back to `src`. */
  thumb?: string;
}

const MAX_ZOOM = 4;
const SNAP_ZOOM = 1.02; // a pinch that ends below this settles back to 1
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
const SWIPE_PX = 50;

interface Pinch {
  dist: number;
  zoom: number;
  mx: number;
  my: number;
  x: number;
  y: number;
  /** The photo's centre at rest (no pan), in viewport pixels. */
  cx: number;
  cy: number;
}

const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.500 4.500M8.500 11h5M11 8.500v5',
  reset: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.500 4.500M8.500 11h5',
} as const;

function icon(name: keyof typeof ICONS): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function button(cls: string, label: string, ic: keyof typeof ICONS): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.setAttribute('aria-label', label);
  b.append(icon(ic));
  return b;
}

export class Lightbox {
  private dialog: HTMLDialogElement;
  private stage = document.createElement('div');
  private track = document.createElement('div');
  private slides: HTMLImageElement[] = [];
  private count = document.createElement('span');
  private strip = document.createElement('div');
  private foot = document.createElement('div');
  private prevBtn = button('lb-btn lb-prev', 'Previous photo', 'prev');
  private nextBtn = button('lb-btn lb-next', 'Next photo', 'next');
  private zoomBtn = button('lb-btn lb-zoom', 'Zoom in', 'zoom');
  private resetBtn = button('lb-btn lb-zoom', 'Reset zoom', 'reset');
  private closeBtn = button('lb-btn', 'Close', 'close');

  private items: LightboxItem[] = [];
  private index = 0;
  private opener: HTMLElement | null = null;
  private zoom = 1;
  private x = 0;
  private y = 0;
  private pan: { px: number; py: number; ox: number; oy: number } | null = null;
  private swipe: { from: number; dx: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: Pinch | null = null;
  private lastTap: { t: number; x: number; y: number } | null = null;
  private touch = false;
  private downOnImg = false;
  private dragged = false;
  private closing = false;
  private cancelExit: (() => void) | null = null;

  constructor() {
    const d = (this.dialog = document.createElement('dialog'));
    d.className = 'lb';
    d.tabIndex = -1;
    d.setAttribute('autofocus', '');
    d.setAttribute('aria-label', 'Photos');

    const bar = document.createElement('div');
    bar.className = 'lb-bar';
    this.count.className = 'lb-count';
    this.count.setAttribute('aria-live', 'polite');
    bar.append(this.zoomBtn, this.resetBtn, this.closeBtn);

    this.stage.className = 'lb-stage';
    this.track.className = 'lb-track';
    this.stage.append(this.track);

    this.strip.className = 'lb-strip';
    // The counter sits centred above the thumbnails.
    this.foot.className = 'lb-foot';
    this.foot.append(this.count, this.strip);
    d.append(bar, this.stage, this.prevBtn, this.nextBtn, this.foot);
    document.body.append(d);

    this.closeBtn.onclick = () => this.close();
    this.prevBtn.onclick = () => this.go(-1);
    this.nextBtn.onclick = () => this.go(1);
    this.zoomBtn.onclick = () => this.setZoom(this.zoom + 1);
    this.resetBtn.onclick = () => this.setZoom(1);

    d.addEventListener('cancel', (e) => {
      e.preventDefault(); // one close path, so focus is always restored
      this.close();
    });
    // The page behind is held still without touching its scrollbar (hiding it would make the page jump): the dialog
    // covers the viewport, swallows wheel scrolling and does not chain scrolling on to the page (see .lb in the CSS).
    d.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.go(-1);
      else if (e.key === 'ArrowRight') this.go(1);
    });
    // A press on the backdrop or the empty part of a slide closes it (not the end of a drag).
    d.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (this.dragged || this.downOnImg) return; // pointer capture retargets a press on the photo to the stage
      if (t === d || t === this.stage || t.classList.contains('lb-slide')) this.close();
    });
    // A mouse double click zooms; touch has its own double tap (see `tap`).
    this.stage.addEventListener('dblclick', (e) => {
      if (this.touch || !this.downOnImg) return;
      this.zoomAt(this.zoom > 1 ? 1 : 2, e.clientX, e.clientY);
    });
    this.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1));
      },
      { passive: false },
    );
    this.stage.addEventListener('pointerdown', (e) => this.down(e));
    this.stage.addEventListener('pointermove', (e) => this.move(e));
    this.stage.addEventListener('pointerup', (e) => this.release(e, true));
    this.stage.addEventListener('pointercancel', (e) => this.release(e, false));
  }

  get isOpen() {
    return this.dialog.open;
  }

  private get active() {
    return this.slides[this.index]!;
  }

  open(items: LightboxItem[], index = 0, opener: HTMLElement | null = null) {
    if (!items.length) return;
    this.items = items;
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    const many = items.length > 1;
    this.foot.hidden = this.prevBtn.hidden = this.nextBtn.hidden = !many;
    this.strip.replaceChildren(
      ...(many
        ? items.map((it, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lb-thumb';
            b.setAttribute('aria-label', `Photo ${i + 1}`);
            const t = document.createElement('img');
            t.src = it.thumb ?? it.src;
            t.alt = '';
            t.loading = 'lazy';
            b.append(t);
            b.onclick = () => this.show(i);
            return b;
          })
        : []),
    );
    this.slides = items.map((it) => {
      const img = document.createElement('img');
      img.className = 'lb-img';
      img.alt = it.alt;
      img.draggable = false;
      return img;
    });
    this.track.replaceChildren(
      ...this.slides.map((img) => {
        const slide = document.createElement('div');
        slide.className = 'lb-slide';
        slide.append(img);
        return slide;
      }),
    );
    this.show(Math.min(Math.max(index, 0), items.length - 1), false);
    if (this.closing) {
      // reopened while it was closing: keep the dialog up and stop the exit
      this.cancelExit?.();
      this.cancelExit = null;
      this.closing = false;
      this.dialog.classList.remove('closing');
    }
    if (!this.dialog.open) {
      this.dialog.showModal();
      // Focus the dialog itself, not a button: a focused Close button can show a ring nobody asked for.
      this.dialog.focus({ preventScroll: true });
    }
  }

  /** Plays the exit (the entrance backwards), then closes the dialog and gives the page back. */
  close() {
    if (!this.dialog.open || this.closing) return;
    this.closing = true;
    this.dialog.classList.add('closing');
    const cancel = afterTransition(this.dialog, () => this.finishClose());
    if (this.closing) this.cancelExit = cancel;
  }

  private finishClose() {
    this.cancelExit = null;
    this.closing = false;
    this.dialog.classList.remove('closing');
    this.dialog.close();
    this.track.replaceChildren();
    this.slides = [];
    this.resetGesture();
    const o = this.opener;
    this.opener = null;
    if (o && document.contains(o)) o.focus({ preventScroll: true });
  }

  /** Fades to photo `i` (opacity only; `animate` is off for the first paint). */
  private show(i: number, animate = true) {
    const n = this.items.length;
    const next = Math.min(Math.max(i, 0), n - 1);
    if (this.slides[this.index] && next !== this.index) this.active.style.transform = '';
    this.index = next;
    this.track.classList.toggle('instant', !animate);
    if (!animate) void this.track.offsetWidth; // commit the jump before transitions come back
    this.count.textContent = `${next + 1} / ${n}`;
    this.prevBtn.disabled = next === 0;
    this.nextBtn.disabled = next === n - 1;
    this.slides.forEach((img, k) => {
      // Load the photo on screen and its neighbours, so the next slide is ready before it arrives.
      if (Math.abs(k - next) <= 1 && !img.getAttribute('src')) img.src = this.items[k]!.src;
      img.parentElement!.setAttribute('aria-hidden', String(k !== next));
      img.parentElement!.classList.toggle('on', k === next);
    });
    this.strip.querySelectorAll('.lb-thumb').forEach((b, k) => {
      if (k === next) {
        b.setAttribute('aria-current', 'true');
        b.scrollIntoView?.({ block: 'nearest', inline: 'center' });
      } else b.removeAttribute('aria-current');
    });
    this.setZoom(1);
    this.resetGesture();
  }

  /** Forgets any finger still down, so a stale pointer can't leak into the next photo or the next open. */
  private resetGesture() {
    this.pointers.clear();
    this.pinch = this.pan = this.swipe = this.lastTap = null;
  }

  private go(step: number) {
    if (this.items.length > 1) this.show(this.index + step);
  }

  /** Zooms about the middle of the photo (buttons, wheel); the pan is kept, within limits. */
  private setZoom(z: number) {
    this.apply(z, this.x, this.y);
  }

  /** Sets zoom and pan together: zoom is clamped, the pan is kept inside the photo's edges, then it is painted. */
  private apply(z: number, x: number, y: number) {
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, z));
    const img = this.slides[this.index];
    // A photo that fits the stage has nothing to pan to; offsetWidth ignores transforms, so this is the rest size.
    const lx = img ? Math.max(0, (img.offsetWidth * this.zoom - this.stage.clientWidth) / 2) : 0;
    const ly = img ? Math.max(0, (img.offsetHeight * this.zoom - this.stage.clientHeight) / 2) : 0;
    this.x = this.zoom === 1 ? 0 : Math.min(lx, Math.max(-lx, x));
    this.y = this.zoom === 1 ? 0 : Math.min(ly, Math.max(-ly, y));
    this.stage.classList.toggle('zoomed', this.zoom > 1);
    this.zoomBtn.disabled = this.zoom >= MAX_ZOOM;
    this.resetBtn.disabled = this.zoom === 1;
    if (img) this.paint();
  }

  /** The photo's centre with no pan applied (scaling is about the centre, so only the pan moves it). */
  private restCentre() {
    const r = this.active.getBoundingClientRect();
    return { cx: r.left + r.width / 2 - this.x, cy: r.top + r.height / 2 - this.y };
  }

  /** Zooms to `z` keeping the photo point under (px, py) where it is (double tap, double click). */
  private zoomAt(z: number, px: number, py: number) {
    const { cx, cy } = this.restCentre();
    const k = Math.min(MAX_ZOOM, Math.max(1, z)) / this.zoom;
    this.apply(this.zoom * k, px - cx - (px - cx - this.x) * k, py - cy - (py - cy - this.y) * k);
  }

  private paint() {
    this.active.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
  }

  private down(e: PointerEvent) {
    if (this.pointers.size >= 2) return; // a third finger does nothing
    if (!this.pointers.size) {
      this.dragged = false;
      this.touch = e.pointerType === 'touch';
      this.downOnImg = (e.target as HTMLElement).classList?.contains('lb-img') ?? false;
    }
    this.stage.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.startPinch();
    else if (this.zoom > 1) this.pan = { px: e.clientX, py: e.clientY, ox: this.x, oy: this.y };
    else if (this.items.length > 1) this.swipe = { from: e.clientX, dx: 0 };
  }

  /** The two fingers' distance and midpoint. */
  private fingers() {
    const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  /** The second finger landed: a swipe or pan in progress gives way to a pinch. */
  private startPinch() {
    this.swipe = this.pan = null;
    this.dragged = true; // lifting the fingers must not count as a backdrop press
    this.lastTap = null;
    this.pinch = { ...this.fingers(), zoom: this.zoom, x: this.x, y: this.y, ...this.restCentre() };
  }

  private move(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pinch) {
      // The photo point that was under the fingers' midpoint stays under it as they spread, close and travel.
      const s = this.pinch;
      const now = this.fingers();
      const z = Math.min(MAX_ZOOM, Math.max(1, (s.zoom * now.dist) / s.dist));
      const k = z / s.zoom;
      this.apply(z, now.mx - s.cx - (s.mx - s.cx - s.x) * k, now.my - s.cy - (s.my - s.cy - s.y) * k);
    } else if (this.pan) {
      const nx = this.pan.ox + e.clientX - this.pan.px;
      const ny = this.pan.oy + e.clientY - this.pan.py;
      if (Math.abs(nx - this.pan.ox) + Math.abs(ny - this.pan.oy) > 4) this.dragged = true;
      this.apply(this.zoom, nx, ny);
    } else if (this.swipe) {
      // Nothing follows the finger: a swipe only picks the next or previous photo when it lifts.
      this.swipe.dx = e.clientX - this.swipe.from;
      if (Math.abs(this.swipe.dx) > 4) this.dragged = true;
    }
  }

  private release(e: PointerEvent, commit: boolean) {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pinch) {
      this.pinch = null;
      if (this.zoom < SNAP_ZOOM) this.apply(1, 0, 0);
      // The finger left on the glass carries on as a pan, from where the photo is now.
      const rest = [...this.pointers.values()][0];
      if (rest && this.zoom > 1) this.pan = { px: rest.x, py: rest.y, ox: this.x, oy: this.y };
    } else {
      const swipe = this.swipe;
      const tapped = commit && !this.dragged && this.touch && this.downOnImg;
      this.pan = null;
      this.swipe = null;
      if (swipe && commit && Math.abs(swipe.dx) > SWIPE_PX) this.go(swipe.dx < 0 ? 1 : -1);
      if (tapped) this.tap(e);
    }
    // The click that ends a drag must not count as a backdrop press.
    if (this.dragged && !this.pointers.size) setTimeout(() => (this.dragged = false), 0);
  }

  /** Two quick taps on the photo zoom in on that spot, or back out. */
  private tap(e: PointerEvent) {
    const last = this.lastTap;
    if (
      last &&
      e.timeStamp - last.t < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX
    ) {
      this.lastTap = null;
      this.zoomAt(this.zoom > 1 ? 1 : DOUBLE_TAP_ZOOM, e.clientX, e.clientY);
    } else this.lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  }
}
