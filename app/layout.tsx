import type { Metadata } from "next";
import { Silkscreen, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

// preload disabled — the boot placeholder doesn't render any text, so the
// link-preload tags fire a "preloaded but not used within a few seconds"
// warning. Fonts still load lazily on first use.
const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  preload: false,
});

// Proportional display serif for Kern Combat — expressive shapes with real
// kerning pairs (AV, To, LT) make the spacing exercise legible. Self-hosted at
// build time, so no CSP change.
const fraunces = Fraunces({
  variable: "--font-kern",
  subsets: ["latin"],
  weight: ["600"],
  preload: false,
});

const SITE_URL = "https://squint.mdzabeeh.com/";
const TITLE = "Squint — train the eye you trust";
const DESCRIPTION =
  "Five-minute games that train a designer's instincts: eyeballing proportion, kerning, colour matching, the Thirty Circles divergent-thinking sprint, and gesture-controlled Tetris.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Squint",
  authors: [{ name: "Zabeeh" }],
  keywords: [
    "squint",
    "design games",
    "designer training",
    "kerning game",
    "colour matching",
    "divergent thinking",
    "thirty circles",
    "hand tetris",
    "gesture game",
    "mediapipe",
  ],
  referrer: "strict-origin-when-cross-origin",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Squint",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "og-image.png",
        width: 1974,
        height: 1097,
        alt: "Squint — five-minute games that train a designer's eye",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["og-image.png"],
  },
  icons: {
    icon: [{ url: "icon.svg", type: "image/svg+xml" }],
  },
};

// Content-Security-Policy ships as a real response header via vercel.json
// (which also lets us enforce frame-ancestors — impossible from a meta tag).
// Keeping it out of the markup also means `next dev` isn't subject to it,
// so development hot-reload (which needs eval) works normally.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${silkscreen.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body
        className="h-full flex flex-col overflow-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
