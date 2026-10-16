import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Lightbox } from './lightbox';

const photos = [1, 2, 3].map((n) => ({ src: `/p${n}.jpg`, alt: `Photo ${n} alt` }));
const dialog = () => document.querySelector('dialog.lb') as HTMLDialogElement;
const img = () =>
  dialog().querySelectorAll('.lb-img')[
    Number(dialog().querySelector('.lb-count')?.textContent?.split(' ')[0] ?? 1) - 1
  ] as HTMLImageElement;
const key = (k: string) => dialog().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

let opener: HTMLButtonElement;
let box: Lightbox;

beforeEach(() => {
  // jsdom has no modal <dialog>.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  document.body.style.overflow = 'scroll';
  opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  box = new Lightbox();
});

afterEach(() => {
  document.body.replaceChildren();
  document.body.style.overflow = '';
});

describe('Lightbox', () => {
  it('opens on the chosen photo with its alt text, a counter', () => {
    box.open(photos, 1, opener);
    expect(dialog().open).toBe(true);
    expect(img().getAttribute('src')).toBe('/p2.jpg');
    expect(img().alt).toBe('Photo 2 alt');
    expect(dialog().querySelector('.lb-count')?.textContent).toBe('2 / 3');
  });

  it('fades between photos with the arrow keys and stops at the ends', () => {
    const shown = () => [...dialog().querySelectorAll('.lb-slide')].map((s) => s.classList.contains('on'));
    box.open(photos, 0, opener);
    expect(shown()).toEqual([true, false, false]);
    key('ArrowRight');
    expect(shown()).toEqual([false, true, false]);
    key('ArrowRight');
    key('ArrowRight');
    expect(shown()).toEqual([false, false, true]);
    expect((dialog().querySelector('.lb-next') as HTMLButtonElement).disabled).toBe(true);
    key('ArrowLeft');
    expect(img().getAttribute('src')).toBe('/p2.jpg');
  });

  it('loads the photo on screen and its neighbours only', () => {
    box.open(photos, 0, opener);
    const srcs = [...dialog().querySelectorAll('.lb-img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['/p1.jpg', '/p2.jpg', null]);
  });

  it('jumps to a photo from its thumbnail', () => {
    box.open(photos, 0, opener);
    (dialog().querySelectorAll('.lb-thumb')[2] as HTMLButtonElement).click();
    expect(img().getAttribute('src')).toBe('/p3.jpg');
    expect(dialog().querySelector('.lb-thumb[aria-current="true"]')?.getAttribute('aria-label')).toBe('Photo 3');
  });

  it('closes on Esc and returns focus to the opener', () => {
    box.open(photos, 0, opener);
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('closes when the backdrop is pressed', () => {
    box.open(photos, 0, opener);
    dialog().click();
    expect(dialog().open).toBe(false);
  });

  it('shows no navigation for a single photo', () => {
    box.open([photos[0]!], 0, opener);
    expect((dialog().querySelector('.lb-prev') as HTMLElement).hidden).toBe(true);
    expect((dialog().querySelector('.lb-next') as HTMLElement).hidden).toBe(true);
    expect((dialog().querySelector('.lb-foot') as HTMLElement).hidden).toBe(true);
    key('ArrowRight');
    expect(img().getAttribute('src')).toBe('/p1.jpg');
  });

  it('zooms in steps, up to a limit, and resets', () => {
    box.open(photos, 0, opener);
    const zoomIn = dialog().querySelector('[aria-label="Zoom in"]') as HTMLButtonElement;
    const reset = dialog().querySelector('[aria-label="Reset zoom"]') as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    for (let i = 0; i < 6; i++) zoomIn.click();
    expect(img().style.transform).toContain('scale(4)');
    expect(zoomIn.disabled).toBe(true);
    reset.click();
    expect(img().style.transform).toContain('scale(1)');
  });

  describe('touch gestures', () => {
    // jsdom has no layout: give the photo and the stage a size so pan limits and zoom anchors have something to use.
    const size = (el: Element, w: number, h: number, props: [string, string]) => {
      Object.defineProperty(el, props[0], { configurable: true, value: w });
      Object.defineProperty(el, props[1], { configurable: true, value: h });
    };
    const pointer = (type: string, id: number, x: number, y: number, to: Element = img()) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperty(e, 'pointerId', { value: id });
      Object.defineProperty(e, 'pointerType', { value: 'touch' });
      to.dispatchEvent(e);
    };
    const scale = () => Number(/scale\(([\d.]+)\)/.exec(img().style.transform)?.[1]);
    const shift = () => /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(img().style.transform)!.slice(1).map(Number);

    beforeEach(() => {
      box.open(photos, 0, opener);
      size(img(), 400, 300, ['offsetWidth', 'offsetHeight']);
      size(dialog().querySelector('.lb-stage')!, 400, 600, ['clientWidth', 'clientHeight']);
    });

    it('zooms as two fingers spread, up to a limit', () => {
      pointer('pointerdown', 1, 190, 300);
      pointer('pointerdown', 2, 210, 300);
      pointer('pointermove', 2, 250, 300); // 20px apart -> 60px apart
      expect(scale()).toBeCloseTo(3);
      pointer('pointermove', 2, 600, 300);
      expect(scale()).toBe(4);
      expect(dialog().querySelector('.lb-stage')?.classList.contains('zoomed')).toBe(true);
    });

    it('settles back to the whole photo when a pinch ends almost closed', () => {
      pointer('pointerdown', 1, 150, 300);
      pointer('pointerdown', 2, 250, 300);
      pointer('pointermove', 2, 350, 300);
      pointer('pointermove', 2, 251, 300); // back to 1.01x
      pointer('pointerup', 2, 251, 300);
      pointer('pointerup', 1, 150, 300);
      expect(scale()).toBe(1);
      expect(shift()).toEqual([0, 0]);
    });

    it('changes photo on a swipe, but not when a second finger takes over', () => {
      pointer('pointerdown', 1, 200, 300);
      pointer('pointermove', 1, 120, 300);
      pointer('pointerup', 1, 120, 300);
      expect(dialog().querySelector('.lb-count')?.textContent).toBe('2 / 3');
      pointer('pointerdown', 3, 200, 300);
      pointer('pointermove', 3, 120, 300);
      pointer('pointerdown', 4, 300, 300);
      pointer('pointerup', 4, 300, 300);
      pointer('pointerup', 3, 120, 300);
      expect(dialog().querySelector('.lb-count')?.textContent).toBe('2 / 3');
    });

    it('carries on as a pan with the finger left after a pinch, and keeps the photo on screen', () => {
      pointer('pointerdown', 1, 150, 300);
      pointer('pointerdown', 2, 250, 300);
      pointer('pointermove', 2, 350, 300); // 100px -> 200px apart: 2x
      pointer('pointerup', 2, 350, 300);
      const [x0] = shift();
      pointer('pointermove', 1, 160, 300);
      expect(shift()[0]).toBeCloseTo(x0! + 10);
      pointer('pointermove', 1, 5000, 300);
      expect(shift()[0]).toBe(200); // (400 * 2 - 400) / 2
    });

    it('zooms in on a double tap and out on the next', () => {
      for (const t of [1, 2]) {
        pointer('pointerdown', t, 200, 300);
        pointer('pointerup', t, 200, 300);
      }
      expect(scale()).toBe(2.5);
      for (const t of [3, 4]) {
        pointer('pointerdown', t, 200, 300);
        pointer('pointerup', t, 200, 300);
      }
      expect(scale()).toBe(1);
    });

    it('starts the next photo at the whole photo', () => {
      pointer('pointerdown', 1, 150, 300);
      pointer('pointerdown', 2, 250, 300);
      pointer('pointermove', 2, 350, 300);
      key('ArrowRight');
      expect(scale()).toBe(1);
      expect(dialog().querySelector('.lb-stage')?.classList.contains('zoomed')).toBe(false);
    });
  });
});
