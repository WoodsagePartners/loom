import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Loom — Struinova",
  description: "Keep a line of inquiry alive and advancing when the facilitator is not in the room.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600&family=Caveat:wght@500;600&family=JetBrains+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
