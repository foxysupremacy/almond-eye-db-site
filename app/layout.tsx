import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almond Eye's Database",
  description:
    "Game helper and visualizer ᕙ(  •̀ ᗜ •́  )ᕗ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
