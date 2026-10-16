/*
 * Lightbox: adapted from duccanhole/lightbox-js (MIT, see LICENSE), upstream commit 85637d4 (2026-03-09).
 * https://github.com/duccanhole/lightbox-js
 *
 * Local changes: images only (video, audio, iframe, custom HTML, rotate and download removed); a native <dialog> in
 * place of a plain div (focus trap, Esc, top layer, focus returns to the opener); labelled buttons; no inline style
 * attributes (our CSP is `style-src 'self'`); an <img> with alt text instead of a background image; previous / next
 * buttons, arrow keys and a counter; photos on a sliding track (a drag follows the finger, release snaps); thumbnails
 * as buttons; the page's scroll lock is restored, not reset.
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
const SWIPE_PX = 50;

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
      if (this.dragged) return;
      if (t === d || t === this.stage || t.classList.contains('lb-slide')) this.close();
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
    this.stage.addEventListener('pointerup', () => this.release(true));
    this.stage.addEventListener('pointercancel', () => this.release(false));
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
      img.addEventListener('dblclick', () => this.setZoom(this.zoom > 1 ? 1 : 2));
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
    const o = this.opener;
    this.opener = null;
    if (o && document.contains(o)) o.focus({ preventScroll: true });
  }

  /** Slides to photo `i` (the track moves on the compositor; `animate` is off for the first paint). */
  private show(i: number, animate = true) {
    const n = this.items.length;
    const next = Math.min(Math.max(i, 0), n - 1);
    if (this.slides[this.index] && next !== this.index) this.active.style.transform = '';
    this.index = next;
    this.track.classList.toggle('instant', !animate);
    this.place(0);
    if (!animate) void this.track.offsetWidth; // commit the jump before transitions come back
    this.count.textContent = `${next + 1} / ${n}`;
    this.prevBtn.disabled = next === 0;
    this.nextBtn.disabled = next === n - 1;
    this.slides.forEach((img, k) => {
      // Load the photo on screen and its neighbours, so the next slide is ready before it arrives.
      if (Math.abs(k - next) <= 1 && !img.getAttribute('src')) img.src = this.items[k]!.src;
      img.parentElement!.setAttribute('aria-hidden', String(k !== next));
    });
    this.strip.querySelectorAll('.lb-thumb').forEach((b, k) => {
      if (k === next) {
        b.setAttribute('aria-current', 'true');
        b.scrollIntoView?.({ block: 'nearest', inline: 'center' });
      } else b.removeAttribute('aria-current');
    });
    this.setZoom(1);
  }

  /** Positions the track on the current photo, `offset` px further along while a finger drags it. */
  private place(offset: number) {
    this.track.style.transform = `translate3d(calc(${-this.index * 100}% + ${offset}px), 0, 0)`;
  }

  private go(step: number) {
    if (this.items.length > 1) this.show(this.index + step);
  }

  private setZoom(z: number) {
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, z));
    if (this.zoom === 1) this.x = this.y = 0;
    this.stage.classList.toggle('zoomed', this.zoom > 1);
    this.zoomBtn.disabled = this.zoom >= MAX_ZOOM;
    this.resetBtn.disabled = this.zoom === 1;
    if (this.slides[this.index]) this.paint();
  }

  private paint() {
    this.active.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
  }

  private down(e: PointerEvent) {
    this.dragged = false;
    this.stage.setPointerCapture?.(e.pointerId);
    if (this.zoom > 1) this.pan = { px: e.clientX, py: e.clientY, ox: this.x, oy: this.y };
    else if (this.items.length > 1) this.swipe = { from: e.clientX, dx: 0 };
  }

  private move(e: PointerEvent) {
    if (this.pan) {
      this.x = this.pan.ox + e.clientX - this.pan.px;
      this.y = this.pan.oy + e.clientY - this.pan.py;
      if (Math.abs(this.x - this.pan.ox) + Math.abs(this.y - this.pan.oy) > 4) this.dragged = true;
      this.paint();
    } else if (this.swipe) {
      let dx = e.clientX - this.swipe.from;
      // Resist at the ends, where the track has nothing further to show.
      if ((this.index === 0 && dx > 0) || (this.index === this.items.length - 1 && dx < 0)) dx /= 3;
      this.swipe.dx = dx;
      if (Math.abs(dx) > 4) {
        this.dragged = true;
        this.track.classList.add('dragging');
        this.place(dx);
      }
    }
  }

  private release(commit: boolean) {
    const swipe = this.swipe;
    this.pan = null;
    this.swipe = null;
    this.track.classList.remove('dragging');
    if (swipe && this.dragged) {
      if (commit && Math.abs(swipe.dx) > SWIPE_PX) this.go(swipe.dx < 0 ? 1 : -1);
      else this.place(0); // not far enough: slide back
    }
    // The click that ends a drag must not count as a backdrop press.
    if (this.dragged) setTimeout(() => (this.dragged = false), 0);
  }
}
