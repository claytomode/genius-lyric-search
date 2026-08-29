import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, Inter_Tight } from "next/font/google";
import "./globals.css";

const serif = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Source_Sans_3({
  variable: "--font-ui",
  subsets: ["latin"],
});

const card = Inter_Tight({
  variable: "--font-card",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lyric Search",
  description: "Search Genius lyrics by line, including verses on songs they only feature on.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${card.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
