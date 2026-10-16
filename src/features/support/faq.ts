import { config } from '@/lib/config';

export interface FaqGroup {
  title: string;
  items: [question: string, answer: string][];
}

/** The help centre's questions, grouped (docs/05 SupportPage). Answers are plain text; anything that needs a person
 *  goes to customer service on WhatsApp. */
export const FAQ: FaqGroup[] = [
  {
    title: 'Booking',
    items: [
      [
        'Do I need an account to book?',
        'No, you can book as a guest. Guests only get an email with their booking details and nothing is saved on the device, so keep that email. An account keeps every booking, your saved payment methods and your favourites in one place, on any device, and lets you add stays to your calendar, get directions and contact the hotel.',
      ],
      [
        'Where is my confirmation email?',
        'It goes to the email you entered at checkout, usually within a minute. Check your spam folder. If it still has not arrived, message customer service on WhatsApp with your booking reference.',
      ],
      [
        'Can I change my dates or rooms?',
        'Message customer service on WhatsApp with your booking reference and the changes you want. If the hotel has availability we will change it for you.',
      ],
      ...(config.features.halls
        ? ([
            [
              'Can I book a wedding hall?',
              'Yes. Open “Wedding halls” in the menu, then choose your date and number of guests.',
            ],
          ] as [string, string][])
        : []),
    ],
  },
  {
    title: 'Payments',
    items: [
      [
        'When will I be charged?',
        'When you tap Pay, the full amount is charged to your chosen wallet or card. For mobile wallets you approve the payment request on your phone first.',
      ],
      [
        'Which payment methods work?',
        'EVC Plus, ZAAD and SAHAL through WaafiPay, eDahab, Premier Wallet, and Visa/Mastercard. With an account you can save them for one-tap checkout.',
      ],
      [
        'I did not get a payment request on my phone',
        'Check that the wallet number is correct and that you have signal, then tap “Resend request” on the waiting screen. You can also pay with another method.',
      ],
      [
        'Is my payment secure?',
        'Card details go straight to our payment provider and never touch our servers. Wallet payments are approved in your own wallet app.',
      ],
    ],
  },
  {
    title: 'Cancellations',
    items: [
      [
        'How do I cancel?',
        'Message customer service on WhatsApp with your booking reference and we will cancel it for you.',
      ],
      [
        'Will I get a refund?',
        'Free cancellation refunds the full amount until the date shown on your booking. After that the first night is charged. Refunds go back to the wallet or card you paid with.',
      ],
    ],
  },
];
