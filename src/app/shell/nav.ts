import type { IconName } from '@/components/Icon';
import { config } from '@/lib/config';

export interface NavItem {
  label: string;
  to: string;
  key: string;
  icon: IconName;
  /** Needs an account: shown to signed-in members only. */
  member?: boolean;
  /** Opens another site in a new tab. */
  external?: boolean;
}

const BROWSE: NavItem[] = (
  [
    { label: 'Search', to: '/', key: 'home', icon: 'search' },
    { label: 'Wedding halls', to: '/search?type=hall&city=', key: 'hall', icon: 'bldg' },
  ] satisfies NavItem[]
).filter((n) => config.features.halls || n.key !== 'hall');

/** The account's pages, in the order the account menu and the phone drawer list them. Guests get Support only: the rest
 *  need an account, which the menu invites them to create. */
const ACCOUNT: NavItem[] = [
  { label: 'My bookings', to: '/account/bookings', key: 'bookings', icon: 'cal', member: true },
  { label: 'Favourites', to: '/account/favourites', key: 'favourites', icon: 'heart', member: true },
  { label: 'Payment methods', to: '/account/payments', key: 'payments', icon: 'card', member: true },
  { label: 'Profile', to: '/account/profile', key: 'profile', icon: 'user', member: true },
];

/** Phone drawer only, in a section of its own at the end: the desktop header has its own link at the end of the nav. */
const LIST: NavItem = { label: 'List your property', to: config.listUrl, key: 'list', icon: 'bldg', external: true };

const SUPPORT: NavItem = { label: 'Support', to: '/support', key: 'support', icon: 'help' };

/** The desktop header nav: browsing and support. The account's pages live in the account menu. */
export const HEADER_NAV: NavItem[] = [...BROWSE, SUPPORT];

const visible = (member: boolean) => (n: NavItem) => member || !n.member;

/** The account menu's rows: the account pages the visitor can open. Support is not here: it is in the header nav. */
export const accountItems = (member: boolean): NavItem[] => ACCOUNT.filter(visible(member));

export interface DrawerSection {
  items: NavItem[];
}

/** The phone drawer's sections, set apart by divider lines: browsing, the account (members), support, then listing a
 *  property. Guests have no account section. */
export const drawerSections = (member: boolean): DrawerSection[] =>
  member
    ? [{ items: [...BROWSE] }, { items: accountItems(true) }, { items: [SUPPORT] }, { items: [LIST] }]
    : [{ items: [...BROWSE, SUPPORT] }, { items: [LIST] }];

/** A stable colour for a member's initial, from their first name. */
export const memberHue = (name: string) =>
  [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) % 360;
