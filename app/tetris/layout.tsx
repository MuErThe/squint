import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hand Tetris — play Tetris with your hands",
  description:
    "Gesture-controlled Tetris in the browser: steer with your hand, pinch to rotate, dip to drop. Webcam hand tracking runs entirely on-device — video never leaves your browser.",
  alternates: { canonical: "./" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
