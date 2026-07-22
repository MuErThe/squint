import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eyeball It — train visual accuracy",
  description:
    "Bisect lines, centre shapes, judge angles and find the golden ratio by eye — scored on pixel error with design-spec redlines showing exactly how close you were. Free, in the browser.",
  alternates: { canonical: "./" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
