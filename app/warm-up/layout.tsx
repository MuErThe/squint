import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Warm-Up — five minutes before the real work",
  description:
    "One quick round of every Squint game — eye, type, colour, imagination — chained into a five-minute daily ritual with streak tracking. Warm up before you open your design tools.",
  alternates: { canonical: "./" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
