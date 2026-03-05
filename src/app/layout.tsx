import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "myVoice - 1 Million Video Canvas",
    template: "%s | myVoice",
  },
  description:
    "Submit your YouTube or TikTok video to the world's largest video canvas. Like your favorites to push them to the center. Win prizes!",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://myvoice.app"),
  openGraph: {
    type: "website",
    siteName: "myVoice",
    title: "myVoice - 1 Million Video Canvas",
    description: "The world's largest video canvas. Submit, like, and compete.",
  },
  twitter: {
    card: "summary_large_image",
    title: "myVoice - 1 Million Video Canvas",
    description: "The world's largest video canvas. Submit, like, and compete.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ overflow: "hidden" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
