import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cribbage",
  description: "A modern, beautiful multiplayer Cribbage game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
