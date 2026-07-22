import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kern Combat — a kerning game for typographers",
  description:
    "Drag letters until the spacing feels even, then grade your eye against the typeface's own kerning metrics. Learn the optical rules of letter spacing — open pairs, rounds and straights.",
  alternates: { canonical: "./" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
