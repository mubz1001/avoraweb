import { accountHandlers } from './account';
import { checkoutHandlers } from './checkout';
import { discoveryHandlers } from './discovery';

export const handlers = [...discoveryHandlers, ...checkoutHandlers, ...accountHandlers];
