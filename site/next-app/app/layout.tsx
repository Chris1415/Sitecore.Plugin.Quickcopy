import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HahnSoloFooter } from "@/components/hahn-solo-footer";

// T006 — Expose Geist Sans + Geist Mono on the canonical --font-sans /
// --font-mono CSS variables (per § 4c-4). Blok semantic tokens, the Spotlight
// Compass typography rules, and Tailwind's default fontFamily mapping all
// expect these names. Loading via next/font/google gives us zero-config self-
// hosted fonts and matches the pageshot reference.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuickCopy",
  description: "One-click copy panel for Sitecore Pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        {children}
        <HahnSoloFooter />
      </body>
    </html>
  );
}
