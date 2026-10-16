import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

/** The Google Maps embed is a heavy page of its own (hundreds of KB of script), so it must not compete with the photos,
 *  prices and rooms the guest came for. It starts loading only when the Location section is about to scroll into view,
 *  shows a quiet placeholder meanwhile, and fades in once it has loaded. */
export function LazyMap({ title, src }: { title: string; src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => !('IntersectionObserver' in window));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <div className="map" ref={box} data-loaded={loaded || undefined}>
      <span className="map-ph" aria-hidden="true">
        <Icon name="pin" />
      </span>
      {near ? (
        <iframe
          title={title}
          src={src}
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      ) : null}
    </div>
  );
}
