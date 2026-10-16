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

  it('slides the track with the arrow keys and stops at the ends', () => {
    const track = () => dialog().querySelector('.lb-track') as HTMLElement;
    box.open(photos, 0, opener);
    expect(track().style.transform).toContain('calc(0%');
    key('ArrowRight');
    expect(track().style.transform).toContain('-100%');
    key('ArrowRight');
    key('ArrowRight');
    expect(track().style.transform).toContain('-200%');
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
});
