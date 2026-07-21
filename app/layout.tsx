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

const SITE_URL = "https://muerthe.github.io/hand-tetris/";
const TITLE = "Creative Arcade — games that sharpen a designer's mind";
const DESCRIPTION =
  "Five-minute games that warm up a designer's eye, hand and imagination: gesture Tetris, kerning, colour matching, eyeballing proportion, and the Thirty Circles divergent-thinking sprint.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Creative Arcade",
  authors: [{ name: "Zabeeh" }],
  keywords: [
    "creative arcade",
    "design games",
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
    siteName: "Creative Arcade",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "og-image.png",
        width: 1974,
        height: 1097,
        alt: "Creative Arcade — games that sharpen a designer's mind",
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

// Content-Security-Policy. GitHub Pages can't set response headers, so it
// ships as a meta tag (React hoists it into <head> at build time).
// What each allowance is for:
//   script-src  'unsafe-inline' — Next.js static-export bootstrap scripts
//               'wasm-unsafe-eval' + cdn.jsdelivr.net — MediaPipe Hands wasm
//   connect-src cdn.jsdelivr.net — model/wasm asset fetches;
//               *.supabase.co — leaderboard RPC
//   worker-src  blob: — MediaPipe may spawn workers from blob URLs
// frame-ancestors is not enforceable via meta tags, so it's omitted.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://cdn.jsdelivr.net https://*.supabase.co",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        {children}
      </body>
    </html>
  );
}
