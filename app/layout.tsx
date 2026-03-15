// app/layout.tsx
// Root layout shared across all pages.
// Loads fonts, sets metadata, applies grain overlay.

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'WeStayFlyBot — Deal Alerts for the Restless',
    template: '%s | WeStayFlyBot',
  },
  description:
    'Get emailed when flights and hotels drop 35% or more below typical pricing. Set your airports and dream destinations once — we do the rest.',
  openGraph: {
    title: 'WeStayFlyBot',
    description: 'Deal alerts for the restless. 35%+ off flights and hotels, delivered to your inbox.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&family=Caveat:wght@600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
