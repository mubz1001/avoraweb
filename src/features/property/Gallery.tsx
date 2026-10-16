import { useState } from 'react';
import { PropertyImage } from '@/components/PropertyImage';
import { useLightbox, warmLightbox } from '@/components/useLightbox';
import { GALLERY_LABELS } from '@/lib/reference';
import type { Property } from '@/types';
import { t } from '@/lib/i18n';

/** Swipeable photos with a counter on phones; a 2×2 grid beside the main photo from 768px (docs/05 Gallery). */
export function Gallery({ property: p }: { property: Property }) {
  const labels = GALLERY_LABELS[p.type];
  const [index, setIndex] = useState(0);
  const openPhotos = useLightbox();
  // Only the first photo of the layout in use is fetched at once; the other layout's copy is hidden by CSS.
  const [wide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  /** A photo opens the lightbox on tap; a placeholder tile (no photo yet) is inert. */
  const tile = (grid: boolean) => (label: string, i: number) => {
    const img = (
      <PropertyImage
        type={p.type}
        hue={p.hue}
        label={label}
        index={i}
        image={p.images[i]}
        sizes={grid ? (i === 0 ? '(min-width: 1100px) 550px, 50vw' : '(min-width: 1100px) 275px, 25vw') : '100vw'}
        priority={i === 0 && grid === wide}
      />
    );
    return p.images[i] ? (
      <button
        key={label}
        type="button"
        className="gal-open"
        aria-label={t('Open photo {i} of {n}', { i: i + 1, n: p.images.length })}
        onPointerDown={warmLightbox}
        onClick={(e) => openPhotos(p.images, i, e.currentTarget)}
      >
        {img}
      </button>
    ) : (
      <div key={label} className="gal-open">
        {img}
      </div>
    );
  };
  return (
    <div className="gallery">
      <div
        className="gal-scroll"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a focusable scroll region lets keyboard users swipe the photos
        tabIndex={0}
        role="region"
        aria-label={t('Photos of {name}', { name: p.name })}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {labels.map(tile(false))}
      </div>
      <span className="gal-count" aria-hidden="true">
        {index + 1} / {labels.length}
      </span>
      <div className="gal-grid">{labels.slice(0, 5).map(tile(true))}</div>
    </div>
  );
}
