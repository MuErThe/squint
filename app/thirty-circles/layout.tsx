import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thirty Circles — the divergent thinking exercise",
  description:
    "The classic IDEO creativity warm-up: turn thirty circles into thirty different things in three minutes. Draw with your webcam-tracked hand or a mouse, then reflect on fluency, flexibility and originality.",
  alternates: { canonical: "./" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
