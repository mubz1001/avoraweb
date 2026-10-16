import type { SVGProps } from 'react';

/** The icon set: 24×24 stroke paths (docs/03 §Icons). Add a path here to add an icon. */
const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  chev: 'M6 9l6 6 6-6',
  heart:
    'M12 20.5s-7.5-4.6-9.2-9.4C1.700 7.600 3.900 4.500 7.100 4.500c2 0 3.600 1.100 4.900 3 1.300-1.900 2.900-3 4.900-3 3.200 0 5.400 3.100 4.300 6.600-1.700 4.800-9.200 9.400-9.200 9.400z',
  bed: 'M3 18V7M3 14h18v4M21 14v-2.500a3 3 0 0 0-3-3h-7V14M7 11.500h.01',
  bldg: 'M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.500-6 8-6s8 2 8 6',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  size: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6zM8.500 12l2.500 2.500 4.500-5',
  plus: 'M12 5v14M5 12h14',
  monitor: 'M3 5h18v11H3zM9 20h6M12 16v4',
  sun: 'M12 16.500a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9zM12 2.500v2M12 19.500v2M4.600 4.600l1.400 1.400M18 18l1.400 1.400M2.500 12h2M19.500 12h2M4.600 19.400L6 18M18 6l1.400-1.400',
  moon: 'M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.500 4.500',
  basket: 'M3 10h18M8.500 10L12 4.500l3.500 5.500M5 10l1.500 9a1 1 0 0 0 1 .8h9a1 1 0 0 0 1-.8L19 10M10 14v3M14 14v3',
  card: 'M3 6.5h18v11H3zM3 10.5h18M7 14.5h3',
  mobile: 'M7.5 3h9v18h-9zM11 17.5h2',
  review: 'M4 5h16v11H9l-4 4V5zM12 7.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z',
  medal: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.9L7 21l5-3 5 3-1.5-7.1',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  eyeoff:
    'M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.6 7.6C4 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.4-1.2M9.9 10a2.5 2.5 0 0 0 3.5 3.5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  mail: 'M3 5.5h18v13H3zM3 6.5l9 6.5 9-6.5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Solid fill (hearts, stars) instead of outline. */
  filled?: boolean;
  size?: number;
}

export function Icon({ name, filled, size = 24, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
