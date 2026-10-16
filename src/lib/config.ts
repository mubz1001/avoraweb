/** Environment-driven settings and product switches (docs/04 §A.7). */
const mock = import.meta.env.VITE_API_MOCK !== 'false';

export const config = {
  apiBase: import.meta.env.VITE_API_BASE ?? '/api/v1',
  mockApi: mock,
  whatsapp: '252610999082',
  whatsappLabel: '+252 61 099 9082',
  /** Where hotels sign up to list on AVORA (header and footer links, new tab). */
  listUrl: 'https://hotels.avorabookings.com/?signup=1',
  /** Display only: the server quote is authoritative. */
  serviceFeeRate: 0.02,
  features: {
    /** Wedding halls are parked: flip to bring back the toggle, nav links and hall results. */
    halls: false,
    /** "For Developer: Demo Account" on the sign-in page. Only exists with the mock backend. */
    demo: mock,
  },
  limits: {
    hotelGuestsMax: 8,
    roomsMax: 5,
    hallGuestsMin: 50,
    hallGuestsMax: 500,
    savedMethodsMax: 10,
    basketStaysMax: 10,
  },
} as const;
