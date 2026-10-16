/** The two developer demo members (mock API only, `config.features.demo`). Both are real accounts the mock server
 *  creates on first use, so they sign in through the ordinary paths: `email` with the email and password form, `social`
 *  through "Continue with Google / Apple" (a provider-linked account with no password). */
export const DEMO_ACCOUNTS = {
  email: { email: 'demo@avora.example', password: 'avora demo pass' },
  social: { email: 'demo.social@avora.example' },
} as const;
