import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Colour Forge — train colour perception",
  description:
    "Mix HSL colours to match a target, from memory or by complement — scored with the perceptual CIEDE2000 formula and a per-channel breakdown of which way your eye lies.",
  alternates: { canonical: "./" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
