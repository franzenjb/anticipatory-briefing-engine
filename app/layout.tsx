import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anticipatory Briefing Engine",
  description: "5-day forecast briefings per county. Forecast + historical precedent + assets + vulnerable populations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
