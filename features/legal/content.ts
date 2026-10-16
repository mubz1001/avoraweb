export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  inShort: string[];
  sections: LegalSection[];
}

/** The Terms and Privacy text (docs/01 §8), as published for avorabookings.com, with the contact email changed to the
 *  one below. Plain text, rendered as text. */
const EMAIL = 'avorabookings@gmail.com';
const UPDATED = '10 October 2026';

export const LEGAL: Record<'terms' | 'privacy', LegalDoc> = {
  terms: {
    title: 'Terms of Service',
    updated: UPDATED,
    inShort: [
      'AVORA is a marketplace that connects you with hotels and wedding halls. When you book through us, you enter a contract with the property you booked — we handle the payment, the confirmation, and the support around it.',
      'Use the platform honestly, treat properties and other customers well, and we will do the same. The rest of this page is the long version.',
    ],
    sections: [
      {
        title: 'Acceptance and who we are',
        paragraphs: [
          'These Terms of Service (the “Terms”) govern your access to and use of the AVORA website at avorabookings.com, along with any related applications, APIs, and services we offer (together, the “Platform”). The Platform is operated by AVORA, with a registered address at Mogadishu, Somalia (“AVORA,” “we,” “us,” “our”).',
          `By creating an account, completing a booking, listing a property, or otherwise using the Platform, you confirm that you have read these Terms and agree to be bound by them. If you do not agree, please do not use the Platform. For questions about these Terms, contact us at ${EMAIL}.`,
          'These Terms apply alongside any additional rules we publish for specific features (for example, vendor onboarding rules, review guidelines, or promotional terms). If there is a conflict between a feature-specific rule and these Terms, the feature-specific rule controls for that feature only.',
        ],
      },
      {
        title: 'Definitions',
        paragraphs: [
          'A Customer is an individual who uses the Platform to search for, book, and review properties. A Vendor is the business or individual that owns or operates a property and lists it for booking through the Platform. A Property is a hotel, wedding hall, or similar venue made available by a Vendor.',
          'A Room is a bookable unit within a Property (a hotel room, a hall, or a similarly priced inventory item). A Booking is the contract a Customer enters into with a Vendor to reserve a Room for specific dates, formed when the Customer completes payment and we send a confirmation email.',
          'Content means anything posted to or made available through the Platform — listings, photos, descriptions, reviews, complaint threads, support messages, profile information, and similar material. You means the person reading these Terms; whether that is a Customer or a Vendor will be clear from context.',
        ],
      },
      {
        title: 'Eligibility',
        paragraphs: [
          'You must be at least 18 years old to create an account or make a Booking. The Platform is not directed at children, and we do not knowingly allow anyone under 18 to register. If we learn that an account belongs to a minor, we will close it.',
          'You must provide accurate, current, and complete information when you register and keep that information up to date. You must not impersonate another person, create an account on someone else’s behalf without authorization, or use the Platform if you are barred from doing so under applicable law or sanctions.',
          'If you are using the Platform on behalf of a business (for example, as a Vendor), you confirm that you are authorized to bind that business to these Terms and that the business meets the eligibility requirements as well.',
        ],
      },
      {
        title: 'Account registration and security',
        paragraphs: [
          'To make a Booking, list a Property, or use most account features, you must register an account using a valid email address. We will send a verification email after registration; some actions (such as filing complaints or receiving refunds) may require a verified email address.',
          `You are responsible for choosing a strong password, keeping it confidential, and for all activity that happens under your account. Notify us immediately at ${EMAIL} if you suspect unauthorized access. We are not responsible for losses arising from your failure to keep your credentials secure.`,
          'We may suspend or terminate an account that violates these Terms, that is used for fraud or abuse, that repeatedly receives substantiated complaints, or that we are required to suspend by law or court order. Where reasonable, we will give you notice and an opportunity to respond before doing so.',
        ],
      },
      {
        title: 'Booking process',
        paragraphs: [
          'A listing on the Platform is an invitation to make an offer, not a binding offer itself. When you submit a Booking through checkout, you are making an offer to the Vendor on the terms shown (dates, Room, price, and any specific terms the Vendor has published). The Vendor accepts that offer when payment is successfully captured and we send you a confirmation email.',
          'All payments are processed online through our payment partners: WaafiPay (EVC Plus, ZAAD, SAHAL) and Sifalo Pay (eDahab, Premier Wallet and Visa/Mastercard cards). We do not accept cash, bank transfers, or any payment made directly between you and the Vendor outside the Platform; any such arrangement is at your own risk and is not covered by these Terms or our support processes. Card details are entered on Sifalo Pay’s secure page and never touch our servers.',
          'Prices shown include any platform fees and applicable taxes we are required to collect, unless we say otherwise at checkout. The Vendor is responsible for providing the booked Room on the booked dates in the condition described in the listing. If the Vendor fails to do so, contact us — see the cancellations and complaints sections below.',
        ],
      },
      {
        title: 'Cancellations and refunds',
        paragraphs: [
          'Each Property publishes its own cancellation window and refund policy on its listing. Those Vendor-specific terms control the refund you are entitled to; please read them before you book. Where a Vendor has not published a specific policy, our default rule applies: full refund if you cancel more than 48 hours before check-in, and no refund within 48 hours of check-in.',
          'Eligible refunds are issued back to the original payment method (mobile wallet or card) once approved. Mobile wallet refunds usually arrive within a few business days; card refunds can take longer depending on your bank, and we cannot influence how quickly your bank or wallet provider posts the credit.',
          'If a Vendor cancels a confirmed Booking, you are entitled to a full refund regardless of the published policy. If a Property is materially different from its listing — for example, the Room is unavailable on arrival or conditions create a safety risk — file a complaint within 7 days and we will mediate between you and the Vendor in good faith.',
        ],
      },
      {
        title: 'Vendor obligations',
        paragraphs: [
          'Vendors must onboard through our approval process before listing. Once approved, a Vendor is responsible for keeping listings accurate (photos, amenities, capacity, pricing, availability), honoring every confirmed Booking, and responding to Customer messages and complaints within a reasonable time — generally within 24 hours.',
          'Vendors must hold any licenses, permits, and insurance required to operate their Property under local law, and must comply with all applicable hospitality, safety, employment, and tax rules. Vendors are independent businesses; nothing in these Terms creates an employment, agency, joint venture, or franchise relationship between a Vendor and AVORA.',
          'Vendors may not solicit Customers to book outside the Platform to avoid fees, collect cash or off-platform payments for confirmed Bookings, list a Property they do not have the right to rent out, or discriminate against Customers in violation of applicable law. Repeated or material violations may lead to removal from the Platform.',
        ],
      },
      {
        title: 'Reviews and complaints',
        paragraphs: [
          'Only Customers with a completed Booking may submit a review for the corresponding Property. Reviews must reflect your own honest experience, must not contain personal data about other people, threats, hate speech, sexual content, or false statements, and must focus on the stay or event rather than personal disputes.',
          'Vendors may file complaints about a Customer’s conduct (for example, property damage or harassment of staff) and Customers may file complaints about a Vendor’s conduct or property condition. Complaint threads are reviewed by our team; we may request supporting evidence and may share that evidence with the other party as needed to investigate.',
          'We may remove or edit reviews and complaint posts that violate these Terms, and we may temporarily suspend an account while a serious complaint is being investigated. We do not remove a review simply because it is negative; a negative but honest review is not a violation of these Terms.',
        ],
      },
      {
        title: 'Acceptable use',
        paragraphs: [
          'You must not use the Platform to commit fraud, launder money, finance criminal activity, or violate sanctions. You must not impersonate another person or business, create fake accounts, manipulate reviews or rankings, or pay someone to do any of those things on your behalf.',
          'You must not scrape, crawl, or programmatically extract Content from the Platform without our prior written permission, attempt to interfere with the Platform’s security or availability (including by submitting malware, attempting to bypass rate limits, or probing for vulnerabilities outside any published bug bounty), or use the Platform to send spam or unsolicited marketing.',
          'You must not infringe anyone’s intellectual property rights, post Content that is illegal where it is being posted from or where it is likely to be read, or use the Platform in any way that could damage, disable, overburden, or impair it. We may report serious violations to law enforcement.',
        ],
      },
      {
        title: 'Intellectual property',
        paragraphs: [
          'The Platform itself — including its software, design, branding, and the editorial content we publish — is owned by AVORA or our licensors and is protected by copyright, trademark, and other intellectual property laws. You may use the Platform only as these Terms allow; no other rights are granted by implication.',
          'You retain ownership of the Content you submit (listings, photos, reviews, messages). By submitting Content, you grant AVORA a worldwide, non-exclusive, royalty-free license to host, store, reproduce, adapt, display, and distribute that Content for the purpose of operating, marketing, and improving the Platform. This license ends when you delete the Content or close your account, except where retention is required by law or for legitimate business records (see our Privacy Policy for retention windows).',
          `You confirm that you have the rights necessary to grant this license — for example, that you own the photos you upload or have permission to use them and that the people pictured have consented to publication where required. If you believe Content on the Platform infringes your rights, contact us at ${EMAIL} with details and we will investigate.`,
        ],
      },
      {
        title: 'Disclaimers and limitations of liability',
        paragraphs: [
          'AVORA is an intermediary platform. The contract for any stay or event is between you and the Vendor; we are not the operator of the Property, do not inspect every Property in person, and do not warrant the quality, safety, or legality of any Property listed. Listings, ratings, and search results are provided on an “as is” and “as available” basis without warranties of any kind beyond those we cannot lawfully exclude.',
          'To the maximum extent permitted by applicable law, AVORA will not be liable for indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, business, or goodwill, even if we have been advised of the possibility of such damages. Our aggregate liability to you arising out of or relating to your use of the Platform in any twelve-month period is limited to the greater of (a) the total platform fees you paid us in that period, or (b) USD 100.',
          'Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable law (for example, liability for death, personal injury caused by negligence, or fraud). Where consumer protection rules apply in your jurisdiction and are more favorable to you, those rules continue to apply alongside these Terms.',
        ],
      },
      {
        title: 'Indemnification',
        paragraphs: [
          'You agree to indemnify and hold harmless AVORA, our affiliates, and our respective officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or related to: your use of the Platform; your violation of these Terms; your violation of any applicable law or third-party right; or, for Vendors, any dispute about a Property or Booking you provided.',
          'We will notify you promptly of any claim covered by this section, give you reasonable cooperation in defending it, and not settle a claim in a way that imposes obligations on you without your consent (which you will not unreasonably withhold). We reserve the right to assume exclusive defense and control of any matter for which you have agreed to indemnify us.',
          'This section survives termination of your account or these Terms.',
        ],
      },
      {
        title: 'Termination and suspension',
        paragraphs: [
          'You may close your account at any time from your profile page. When you close an account, we will cancel any future Bookings that have not yet started in line with the applicable cancellation policy and stop processing your personal data for product purposes. Some records (such as completed Bookings and financial records) are retained for the periods described in our Privacy Policy.',
          'We may suspend or terminate your access — temporarily or permanently — if you materially or repeatedly breach these Terms, if your account is implicated in fraud or abuse, if continuing to provide the Platform to you would expose us or our users to legal or security risk, or if we are required to do so by law. Where the circumstances allow, we will give you notice and an opportunity to respond.',
          'Sections that by their nature should survive termination — including intellectual property, disclaimers, limitations of liability, indemnification, governing law, and contact — will survive any termination of these Terms or your account.',
        ],
      },
      {
        title: 'Governing law and dispute resolution',
        paragraphs: [
          'These Terms are governed by the laws of the Federal Republic of Somalia, without regard to its conflict of laws rules. Where mandatory consumer protection rules of the country in which you live apply, those rules continue to apply alongside this clause.',
          `Before starting any formal proceeding, you and AVORA agree to attempt to resolve the dispute informally by contacting ${EMAIL} and negotiating in good faith for at least 30 days. If the dispute cannot be resolved informally, you and we agree to submit the dispute to binding arbitration administered by a mutually agreed arbitrator seated in Mogadishu, Somalia, conducted in English, with each party bearing its own costs unless the arbitrator orders otherwise.`,
          'Either party may bring a claim in small-claims court if the dispute qualifies, and either party may seek emergency injunctive relief in a court of competent jurisdiction to protect intellectual property or confidential information. You and we waive any right to a jury trial and to participate in a class action.',
        ],
      },
      {
        title: 'Changes to these terms',
        paragraphs: [
          'We may update these Terms from time to time as the Platform evolves or the law requires. The “Last updated” date at the top of this page will always reflect the date of the most recent substantive change.',
          'For material changes — those that meaningfully affect your rights, fees, or obligations — we will give you at least 30 days’ prior notice by email to the address on file and through a notice on the Platform. Non-material changes (typos, clarifications, references) take effect when posted.',
          'If you do not agree with a change, you may close your account before the change takes effect. Continuing to use the Platform after a change takes effect constitutes acceptance of the updated Terms.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: [
          `For questions about these Terms, legal notices, or to request the registered address of the operating entity, email ${EMAIL}. For day-to-day support (booking issues, account help, refunds), use the in-app support form or email ${EMAIL}.`,
          'Postal address: Mogadishu, Somalia.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: UPDATED,
    inShort: [
      'AVORA collects only what we need to run the platform: account info, booking history, payment metadata (our payment partners handle your wallet PIN and card details — we never see them), and support messages.',
      `We don’t sell your data, we don’t run ad networks on the platform, and you can ask us to export or delete your data at any time by emailing ${EMAIL}.`,
    ],
    sections: [
      {
        title: 'Summary — what we collect',
        paragraphs: [
          'When you create an account, we collect your name, email address, phone number (if you provide one), hashed password, and any profile details you choose to add. When you book a room or hall, we collect the booking details (dates, property, room, guest count, special requests), and payment metadata returned by our payment partners WaafiPay and Sifalo Pay — typically a transaction ID, the wallet or card type, the phone number charged, and the amount. We never see or store your wallet PIN or full card number.',
          'If you contact support or file a complaint, we collect the messages you send and any attachments. We also collect basic device and usage information automatically: IP address, browser type, pages viewed, referrer, approximate location (derived from IP for fraud prevention and analytics), and timestamps. For Vendors, we additionally collect business details required for onboarding and payout (legal name, contact details, and the property information you list).',
          'We do not knowingly collect special categories of data (health, religion, biometrics, etc.) and we ask that you not share such information through free-text fields unless it is genuinely necessary (for example, an accessibility request you choose to disclose to a hotel).',
        ],
      },
      {
        title: 'How we use your information',
        paragraphs: [
          'We use the information described above to provide and operate the platform: to authenticate you, to display and manage your bookings, to process payments and refunds through WaafiPay and Sifalo Pay, and to send transactional email through Resend (booking confirmation, refund notice, password reset, complaint updates, and similar service messages).',
          'We use it to prevent fraud and abuse — for example, detecting unusual login patterns, flagging suspicious bookings, and blocking repeat policy violators — and to comply with our legal and accounting obligations. We also use aggregated and de-identified information about how the platform is used to fix bugs and improve the product.',
          'We use the information you provide in reviews and complaints to moderate content and resolve disputes between Customers and Vendors. We do not use your personal information for automated decision-making that produces legal effects on you, and we do not sell your personal information to third parties.',
        ],
      },
      {
        title: 'Legal bases for processing',
        paragraphs: [
          'Where the law of your country requires a specific legal basis for processing (for example, the GDPR), we rely on the following: contract — to deliver the platform and your bookings to you; consent — where you have explicitly opted in (for example, to optional marketing or to non-essential analytics); legitimate interest — for fraud prevention, securing the platform, product analytics, and protecting our business; and legal obligation — for retaining records required by tax, accounting, or anti-money-laundering rules.',
          'You can withdraw consent at any time where consent is the basis. Withdrawing consent does not affect the lawfulness of processing carried out before the withdrawal, and it does not affect processing that relies on a different legal basis (such as a booking you have already made).',
          'Where the GDPR or a similar regime does not directly apply, we still aim to process your data in line with these principles — minimization, transparency, and respect for your choices.',
        ],
      },
      {
        title: 'Sharing with third parties',
        paragraphs: [
          'We share information with the following processors and providers so that they can perform services on our behalf: WaafiPay and Sifalo Pay (payment processing — receive the phone number or card details you use at checkout and return payment metadata to us); Resend (transactional email — receives your email address and the contents of the message we send you); Cloudflare (network security and content delivery — handles traffic to our website, app and API); Google (only if you choose to sign in with Google on the website); and our hosting provider (which runs the servers the platform operates on).',
          'We share information with Vendors only as needed to fulfil your Booking — for example, your name, contact details, dates, and any special requests you have submitted. We share information with Customers about a Vendor only as shown publicly on the listing.',
          'We may disclose information to law enforcement, regulators, courts, or other authorities where required by law, where we believe in good faith it is necessary to protect the safety of any person, or to investigate fraud or security incidents. We will narrow the scope of any disclosure to what is reasonably necessary.',
        ],
      },
      {
        title: 'International data transfers',
        paragraphs: [
          'AVORA operates internationally and our processors (WaafiPay, Sifalo Pay, Resend, Cloudflare, Google, hosting providers) are based in or operate servers in multiple countries, including the United States and the European Union. As a result, your personal data may be transferred to, stored in, and processed in a country other than the one where you provided it.',
          'Where required, we rely on appropriate transfer mechanisms — such as standard contractual clauses or equivalent safeguards — in our agreements with these processors. We choose providers that publicly document their security and privacy practices and review those practices periodically.',
          `If you would like more detail about a specific transfer or processor, contact us at ${EMAIL} and we will provide what we can.`,
        ],
      },
      {
        title: 'Cookies and similar technologies',
        paragraphs: [
          'We use a small number of cookies and similar technologies. Essential cookies keep you signed in, remember your session and CSRF tokens, and store short-lived preferences such as your selected currency or language; these cannot be turned off without breaking the platform.',
          'We do not currently use analytics cookies. If we add them in future, we will ask for your consent first where the law requires it, and you will be able to change your choice at any time.',
          'We do not run third-party advertising networks, we do not use cookies to retarget you on other sites, and we do not allow third-party advertisers to place cookies through the platform.',
        ],
      },
      {
        title: 'Data retention',
        paragraphs: [
          'We keep account information for as long as your account is active. When you close an account, we soft-delete it immediately so that your data is no longer visible on the platform and no longer used for product purposes; the underlying record is purged from active systems after 90 days, subject to the exceptions below.',
          'We retain booking records and audit log entries — including financial metadata, refunds, and admin actions — for at least 7 years from the date of the relevant transaction, in order to comply with tax, accounting, and regulatory requirements. We retain support tickets and complaint threads for up to 2 years from the date the matter is closed, so we can investigate related issues that surface later.',
          'We retain server and security logs (including request logs and error reports) for a short period — typically up to 90 days — for debugging, abuse detection, and incident response. Backups follow our normal backup rotation and may contain residual copies of deleted data for a limited period before they are overwritten.',
        ],
      },
      {
        title: 'Your rights',
        paragraphs: [
          'You have the right to access the personal data we hold about you, to ask for it to be corrected if it is inaccurate, to ask for it to be deleted (subject to the retention rules above), and to export a copy of your data in a portable format. You also have the right to object to or restrict certain processing and, where processing relies on consent, to withdraw that consent at any time.',
          `To exercise any of these rights, email ${EMAIL} from the email address on file. You can also delete your account yourself in the AVORA app under Profile → Delete account. We will respond within 30 days, and may extend that period by a further 60 days for unusually complex requests.`,
          'If you believe we have not handled your personal data properly, you have the right to lodge a complaint with the data protection authority of your country. We would also like the chance to put things right first, so please contact us before doing so.',
        ],
      },
      {
        title: 'Children',
        paragraphs: [
          `The Platform is not intended for anyone under 18, and we do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact ${EMAIL} and we will take appropriate steps to delete it and close any associated account.`,
          'Parents and guardians who use the platform are responsible for the activity of any minor they bring to a booked Property; in particular, any photos or details shared with a Vendor about a minor are shared by the booking adult, not by the minor.',
        ],
      },
      {
        title: 'Security',
        paragraphs: [
          'We use industry-standard measures to protect your data: all traffic is encrypted in transit using TLS; data at rest in our primary database and object storage is encrypted; passwords are stored hashed with a modern algorithm; and administrative access is restricted, logged, and protected by multi-factor authentication. Card data is handled directly by Sifalo Pay under PCI DSS, scope SAQ-A — it never touches our servers.',
          `No system is perfectly secure. We continuously work to identify and address vulnerabilities, and we ask that you help by choosing a strong, unique password, enabling any additional authentication options we offer, and contacting us at ${EMAIL} as soon as you suspect unauthorized activity.`,
          `If you are a security researcher and believe you have found a vulnerability, please email ${EMAIL} with a description and steps to reproduce; we will not take legal action against good-faith research that follows responsible-disclosure norms.`,
        ],
      },
      {
        title: 'Breach notification',
        paragraphs: [
          'If we become aware of a personal data breach that affects your information and is likely to result in a risk to your rights or freedoms, we will notify you without undue delay — generally within 72 hours of confirming the scope — using the email address on file and, where appropriate, an in-app notice.',
          'The notification will describe, to the extent known: what happened, what data was affected, the likely consequences, what we are doing in response, and steps you can take to protect yourself (such as changing your password). We will also notify any regulator we are required to notify under applicable law.',
          'We maintain an internal incident response process and review post-incident reports to reduce the chance of similar issues recurring.',
        ],
      },
      {
        title: 'Updates to this policy',
        paragraphs: [
          'We may update this Privacy Policy from time to time to reflect changes in our practices, the services we offer, or applicable law. The “Last updated” date at the top of this page always reflects the date of the most recent substantive change.',
          'For material changes that affect how we use your data, we will give you reasonable advance notice — at least 30 days where the change is significant — by email and through an in-app notice, so you can review the change before it takes effect.',
          'We encourage you to check this page periodically so you stay informed about how we handle your information.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: [
          `For privacy questions, requests to exercise your rights, or to report a privacy concern, email ${EMAIL}. For general support, email ${EMAIL} or use the in-app support form.`,
          'Postal address: Mogadishu, Somalia.',
        ],
      },
    ],
  },
};
