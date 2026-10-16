import { useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import type { PropertyImage as Img, PropertyType } from '@/types';
import './PropertyImage.css';

interface Props {
  type: PropertyType;
  hue: number;
  /** Caption shown on the tile ("Lobby", "Double Room"). */
  label?: string;
  /** Shifts the hue so tiles in one gallery differ. */
  index?: number;
  image?: Img;
  className?: string;
  /** The rendered width of the photo (`sizes`), so the browser picks the smallest candidate that stays sharp. */
  sizes?: string;
  /** The photo is likely the first thing seen (hero, first card): load it now instead of lazily. */
  priority?: boolean;
}

/** A property photo, or a coloured placeholder tile while real photos don't exist. Fixed aspect ratios come from the
 *  caller's CSS so nothing shifts when an image loads. */
export function PropertyImage({ type, hue, label, index = 0, image, className, sizes = '100vw', priority }: Props) {
  // A photo that fails to load falls back to the coloured tile instead of a broken-image icon.
  const [broken, setBroken] = useState<string | null>(null);
  if (image && broken !== image.url) {
    return (
      <img
        className={['ph', className].filter(Boolean).join(' ')}
        src={image.url}
        srcSet={image.srcset}
        sizes={image.srcset ? sizes : undefined}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onError={() => setBroken(image.url)}
      />
    );
  }
  return (
    <div
      className={['ph', className].filter(Boolean).join(' ')}
      style={{ '--h': (hue + index * 22) % 360 } as CSSProperties}
    >
      <Icon name={type === 'hall' ? 'bldg' : 'bed'} width={undefined} height={undefined} />
      {label ? <em>{label}</em> : null}
    </div>
  );
}
