import type { Metadata } from "next";
import { EB_Garamond } from 'next/font/google';
import "./globals.css";

const garamond = EB_Garamond({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Portfolio Dashboard",
  description: "Also Capital Portfolio Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={garamond.className}>
      <body>{children}</body>
    </html>
  );
}