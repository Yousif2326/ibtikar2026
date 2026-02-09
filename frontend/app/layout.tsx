import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';

const notoSans = Noto_Sans({ variable: '--font-sans', subsets: ['latin'] });

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Treatment Trial Match | AI-Powered Patient-Trial Matching",
  description: "Streamline clinical trial recruitment with AI. Match patients to trials faster, giving patients access to innovative treatments while accelerating research.",
  keywords: ["clinical trials", "patient matching", "clinical trial recruitment", "AI healthcare", "trial enrollment"],
  openGraph: {
    title: "Treatment Trial Match | AI-Powered Patient-Trial Matching",
    description: "Streamline clinical trial recruitment with AI. Match patients to trials faster, giving patients access to innovative treatments while accelerating research.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${notoSans.variable} ${plusJakarta.variable}`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthKitProvider>{children}</AuthKitProvider>
      </body>
    </html>
  );
}
