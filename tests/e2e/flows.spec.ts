import { expect, test, type Page } from '@playwright/test';

/** Test values only (local mock backend). Wallet numbers ending 0199 / 0196 trigger the documented decline and
 *  price-change fixtures (docs/06 §9). */
const GUEST = { name: 'Test Guest', phone: '61 555 0142', email: 'guest@example.com' };
const STAY = '/stays/jazeera?type=hotel&city=Mogadishu&guests=2&rooms=1';

async function chooseRoomAndReserve(page: Page) {
  await page.goto(STAY);
  await page.getByRole('button', { name: 'Add one Double Room' }).click();
  await page.getByRole('button', { name: 'Reserve' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
}

async function fillGuest(page: Page, phone = GUEST.phone) {
  await page.getByLabel('Full name').fill(GUEST.name);
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByLabel('Email', { exact: true }).fill(GUEST.email);
}

/** Wallet payments wait on the approval screen (the mock confirms after about 12 s, docs/06 §9). */
const WALLET_APPROVAL = { timeout: 25_000 };

const payButton = (page: Page) => page.getByRole('button', { name: /Pay \$\d+ now/ });

test('guest books end to end; nothing is kept on the device', async ({ page, context }) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: /Mogadishu/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('stays in Mogadishu');
  await page.getByRole('link', { name: 'Jazeera Palace Hotel' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Jazeera Palace Hotel' })).toBeVisible();

  await page.getByRole('button', { name: 'Select a room' }).click();
  await page.getByRole('button', { name: 'Add one Double Room' }).click();
  await expect(page.locator('.sticky')).toContainText('$200 · 2 nights');
  await page.getByRole('button', { name: 'Reserve' }).click();

  await expect(payButton(page)).toHaveText(/Pay \$204 now/);
  await payButton(page).click();
  await expect(page.getByText('Please fix 3 fields')).toBeVisible();
  await fillGuest(page);
  await payButton(page).click();

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible(WALLET_APPROVAL);
  await expect(page.getByText(/emailed your booking details to/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Add to calendar/ })).toHaveCount(0);
  const ref = (await page.locator('.ref').innerText()).trim();

  // Another tab has no copy: guests have no booking lookup.
  const other = await context.newPage();
  await other.goto(`/bookings/${ref}`);
  await expect(other.getByRole('heading', { name: 'Sign in to view this booking' })).toBeVisible();
});

test('the basket keeps a stay across visits, and empties once booked', async ({ page }) => {
  const basket = page.locator('.bskt-btn');
  await page.goto(STAY);
  await page.getByRole('button', { name: 'Add one Double Room' }).click();
  await expect(basket).toHaveAccessibleName('Basket, 1 item');

  // A fresh visit resumes from the header basket.
  await page.goto('/');
  await basket.click();
  const panel = page.getByRole('dialog', { name: 'Your basket' });
  await expect(panel).toContainText('Jazeera Palace Hotel');
  await expect(panel).toContainText('Double Room');
  // The stay is stated once, in the header; rooms carry only their own facts.
  await expect(panel.locator('.bskt-stay')).toContainText('2 nights');
  await expect(panel.locator('.bskt-stay')).toContainText('2 guests · 1 room');
  await expect(panel.locator('.bskt-line')).toContainText('Up to 2 guests');
  await expect(panel.locator('.bskt-line')).toContainText('$100 / night');
  await expect(panel.getByText('Change rooms')).toHaveCount(0);
  await panel.getByRole('link', { name: 'Checkout · $204' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await fillGuest(page);
  await payButton(page).click();
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible(WALLET_APPROVAL);
  await expect(basket).toHaveAccessibleName('Basket, empty');
});

test('rooms from two hotels share one basket and one payment, and become one booking each', async ({ page }) => {
  const basket = page.locator('.bskt-btn');
  await page.goto(STAY);
  await page.getByRole('button', { name: 'Add one Double Room' }).click();
  // Another hotel: no question asked, it joins the basket.
  await page.goto('/stays/lido?type=hotel&city=Mogadishu&guests=2&rooms=1');
  await page.getByRole('button', { name: 'Add one Double Suite' }).click();
  await expect(page.getByRole('dialog', { name: 'Start a new basket?' })).toHaveCount(0);
  await expect(basket).toHaveAccessibleName('Basket, 2 items');

  await basket.click();
  const panel = page.getByRole('dialog', { name: 'Your basket' });
  await expect(panel.locator('.bskt-group')).toHaveCount(2);
  await expect(panel.getByRole('region', { name: 'Jazeera Palace Hotel' })).toBeVisible();
  await expect(panel.getByRole('region', { name: /Lido/ })).toBeVisible();
  await panel.getByRole('link', { name: /^Checkout ·/ }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('region', { name: 'Order summary' })).toContainText('Jazeera Palace Hotel');
  await fillGuest(page);
  await payButton(page).click();
  await expect(page.getByRole('heading', { name: 'Bookings confirmed' })).toBeVisible(WALLET_APPROVAL);
  await expect(page.locator('.ordbk')).toHaveCount(2);
  await expect(basket).toHaveAccessibleName('Basket, empty');
});

test('the account menu opens every account page, and the sections stay one page that keeps its state', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'phones reach the account through the drawer');
  await page.goto('/signin?next=%2F');
  await page.getByRole('button', { name: 'For Developer: Demo Account' }).click();
  await expect(page.getByRole('heading', { name: 'The best booking platform in Somalia' })).toBeVisible();

  // The nav has no account pages; the account menu has them all.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'My bookings' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Favourites' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Account menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Your account' });
  for (const name of ['My bookings', 'Favourites', 'Payment methods', 'Profile'])
    await expect(menu.getByRole('link', { name })).toBeVisible();
  await menu.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/account\/profile/);
  await expect(menu).toBeHidden();

  // One page: switching sections shows the content at once, and a section keeps what was typed into it.
  await page.getByLabel('First name').fill('Aminaaa');
  const tabs = page.getByRole('navigation', { name: 'Your account' });
  for (const [name, url] of [
    ['Payment methods', /payments/],
    ['Favourites', /favourites/],
    ['Profile', /profile/],
  ] as const) {
    await tabs.getByRole('link', { name }).click();
    await expect(page).toHaveURL(url);
    await expect(page.locator('#account-panel .skel:visible')).toHaveCount(0);
  }
  await expect(page.getByLabel('First name')).toHaveValue('Aminaaa');
});

test('guests get a stripped-down account: only sign-up and sign-in, hearts ask them to sign in', async ({
  page,
}, testInfo) => {
  await page.goto('/search?type=hotel&city=Mogadishu&guests=2&rooms=1');
  await page.getByRole('button', { name: 'Add to favourites' }).first().click();
  const prompt = page.getByRole('dialog', { name: 'Sign in to save favourites' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Close' }).click();
  await expect(prompt).toBeHidden();
  await expect(page.getByRole('button', { name: 'Remove from favourites' })).toHaveCount(0);

  // An old link to a members-only section asks them to sign in instead.
  await page.goto('/account/favourites');
  await expect(page.getByRole('heading', { name: 'Sign in to see your favourites' })).toBeVisible();
  await page.goto('/account/bookings');
  await expect(page.getByRole('heading', { name: 'Your bookings live in your account' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Your account' }).getByRole('link')).toHaveText(['Bookings']);

  // Support is a page of its own, open to guests; the old account link lands on it.
  await page.goto('/account/support');
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
  await page.getByText('How do I cancel?').click();
  await expect(page.getByRole('link', { name: /Chat on WhatsApp/ })).toHaveAttribute('href', /wa\.me\/\d+/);

  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Your account' });
    await expect(menu.getByRole('link', { name: 'Create account' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(menu.getByText(/Support|WhatsApp|My bookings|Favourites/)).toHaveCount(0);
  }
});

test('a hotel photo opens a lightbox that pages through the photos and closes on Esc', async ({ page }) => {
  await page.goto(STAY);
  const photo = page.getByRole('button', { name: /^Open photo 2 of/ });
  // The phone swiper and the desktop grid are both in the page; only one is shown.
  await photo.locator('visible=true').click();
  const box = page.getByRole('dialog', { name: 'Photos' });
  await expect(box).toBeVisible();
  await expect(box.getByText(/^2 \/ \d+$/)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(box.getByText(/^3 \/ \d+$/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  await expect(photo.locator('visible=true')).toBeFocused();
});

test('stays that are full for the dates are left out of search', async ({ page }) => {
  await page.goto('/search?type=hotel&city=Mogadishu&guests=2&rooms=1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('3 stays in Mogadishu');
  await expect(page.locator('.hcard', { hasText: 'Ocean View Inn' })).toHaveCount(0);
  await expect(page.getByText(/not available/i)).toHaveCount(0);
});

test('filters narrow the results and stay in the URL', async ({ page, isMobile }) => {
  await page.goto('/search?type=hotel&city=&guests=2&rooms=1');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toContainText('9 stays in all cities');
  if (isMobile || (page.viewportSize()?.width ?? 1440) < 768)
    await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByLabel('Guesthouse').check();
  await expect(title).toContainText('3 stays');
  await expect(page).toHaveURL(/pt=Guesthouse/);
  if ((page.viewportSize()?.width ?? 1440) < 768) {
    await page.getByRole('button', { name: 'Show 3 stays' }).click();
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
  }
});

test('a declined payment keeps the form; a price change asks before charging', async ({ page }) => {
  await chooseRoomAndReserve(page);
  await fillGuest(page, '61 555 0199');
  await payButton(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Your payment was declined.' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue(GUEST.name);

  await page.getByLabel('Mobile number').fill('61 555 0196');
  await payButton(page).click();
  await expect(page.getByText('The price changed.')).toBeVisible();
  await page.getByRole('button', { name: /Continue with \$\d+/ }).click();
  await expect(payButton(page)).toHaveText(/Pay \$224 now/);
  await payButton(page).click();
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible(WALLET_APPROVAL);
});

test('guest confirmation → create account (prefilled) → the new account has no bookings', async ({ page }) => {
  await chooseRoomAndReserve(page);
  await fillGuest(page);
  await payButton(page).click();
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible(WALLET_APPROVAL);
  await page.locator('.join').getByRole('link', { name: 'Create account' }).click();
  await expect(page.getByLabel('First name')).toHaveValue('Test');
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(GUEST.email);
  await page.getByLabel('Password', { exact: true }).fill('purple tractor lamp');
  await page.getByLabel('Confirm password').fill('purple tractor lamp');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);
  await expect(page.getByRole('heading', { name: 'No bookings yet' })).toBeVisible();
});

test('Google sign-up asks for the details providers never share', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByLabel('Google account email').fill('new.person@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Almost done' })).toBeVisible();
  await page.getByLabel('First name').fill('New');
  await page.getByLabel('Last name').fill('Person');
  await page.getByLabel('Mobile number').fill('71 555 0100');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Welcome to AVORA, New. Your account is ready.')).toBeVisible();
});

test('five failed sign-ins lock the email', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('First name').fill('Lock');
  await page.getByLabel('Last name').fill('Test');
  await page.getByRole('textbox', { name: 'Email' }).fill('lock@example.com');
  await page.getByLabel('Mobile number').fill('61 555 0111');
  await page.getByLabel('Password', { exact: true }).fill('purple tractor lamp');
  await page.getByLabel('Confirm password').fill('purple tractor lamp');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);
  await page.goto('/account/profile');
  await page.locator('#account-panel').getByRole('button', { name: 'Sign out' }).click();

  await page.goto('/signin');
  await page.getByRole('textbox', { name: 'Email' }).fill('lock@example.com');
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Password', { exact: true }).fill('wrong password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await expect(page.getByRole('alert')).toContainText('Too many attempts');
  await page.getByLabel('Password', { exact: true }).fill('purple tractor lamp');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Too many attempts');
});

test('a member pays with a saved method; sign-out shows in other tabs and the booking is then locked', async ({
  page,
  context,
}) => {
  await page.goto('/signin?next=%2F');
  await page.getByRole('button', { name: 'For Developer: Demo Account' }).click();
  await expect(page.getByRole('heading', { name: 'The best booking platform in Somalia' })).toBeVisible();

  await chooseRoomAndReserve(page);
  await expect(page.getByLabel('Full name')).toHaveValue('Amina Hassan');
  await expect(page.getByRole('radio', { name: /^EVC Plus \+252/ })).toBeChecked();
  await payButton(page).click();
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible(WALLET_APPROVAL);
  await expect(page.getByRole('button', { name: /Add to calendar/ })).toBeVisible();
  const url = page.url();

  const other = await context.newPage();
  await other.goto('/account/bookings');
  await expect(other.getByRole('heading', { name: 'Upcoming' })).toBeVisible();

  await page.goto('/account/profile');
  await page.locator('#account-panel').getByRole('button', { name: 'Sign out' }).click();
  await expect(other.getByRole('heading', { name: 'Your bookings live in your account' })).toBeVisible();

  await other.goto(url);
  await expect(other.getByRole('heading', { name: 'Sign in to view this booking' })).toBeVisible();
});

test('a wallet payment left waiting keeps the basket and is offered back after a reload', async ({ page }) => {
  await chooseRoomAndReserve(page);
  await fillGuest(page, '61 555 0198');
  await payButton(page).click();
  await expect(page.getByRole('heading', { name: 'Waiting for your payment' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /Basket, 1 item/ })).toBeVisible();
  await expect(page.getByText('Your payment is still waiting for approval.')).toBeVisible();
  await page.getByRole('button', { name: 'Check my payment' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for your payment' })).toBeVisible();
});

test('a reset link sets a new password once, and a spent or invalid link says so', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('First name').fill('Reset');
  await page.getByLabel('Last name').fill('Test');
  await page.getByRole('textbox', { name: 'Email' }).fill('reset@example.com');
  await page.getByLabel('Mobile number').fill('61 555 0122');
  await page.getByLabel('Password', { exact: true }).fill('purple tractor lamp');
  await page.getByLabel('Confirm password').fill('purple tractor lamp');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);

  await page.goto('/account/profile');
  await page.locator('#account-panel').getByRole('button', { name: 'Sign out' }).click();

  // The mock "emails" the link by storing it in its server state.
  await page.goto('/forgot-password');
  await page.getByRole('textbox', { name: 'Email' }).fill('reset@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const token = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mock.db.v2')!).resets)[0]);

  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('New password', { exact: true }).fill('orange kettle drum');
  await page.getByLabel('Confirm new password').fill('orange kettle drum');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('reset@example.com');
  await page.getByLabel('Password', { exact: true }).fill('orange kettle drum');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);

  // Signed in and following a spent link: the page opens (no bounce to the account) and says so on submit.
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('New password', { exact: true }).fill('yellow ladder moon');
  await page.getByLabel('Confirm new password').fill('yellow ladder moon');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'This link can’t be used' })).toBeVisible();
  await page.getByRole('button', { name: 'Send a new link' }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
});

test('a finished stay is reviewed once, and still says so after a reload', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('button', { name: 'For Developer: Demo Account' }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);
  await page.getByRole('button', { name: /^Write a review of/ }).click();
  await page.getByRole('radio', { name: '5 stars, Excellent' }).check({ force: true });
  await page.getByLabel('Your review').fill('A calm, spotless room and a very kind reception team.');
  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect(page.getByText('Thanks for your review')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Review sent')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Write a review of/ })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Review sent')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Write a review of/ })).toHaveCount(0);
});

test('the demo accounts sign in through the email form and through Google/Apple', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('textbox', { name: 'Email' }).fill('demo@avora.example');
  await page.getByLabel('Password', { exact: true }).fill('avora demo pass');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);
  await expect(page.getByText('Past stays')).toBeVisible();
  await page.goto('/account/profile');
  await page.locator('#account-panel').getByRole('button', { name: 'Sign out' }).click();

  await page.goto('/signin');
  await page.getByRole('button', { name: 'For Developer: Google/Apple Demo' }).click();
  await expect(page).toHaveURL(/\/account\/bookings/);
  await page.goto('/account/profile');
  await expect(page.getByLabel('First name')).toHaveValue('Omar');
});
