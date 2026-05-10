import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import ThemeScript from "@/components/ThemeScript";
import MathJaxLoader from "@/components/MathJaxLoader";
import PresenceProvider from "@/components/PresenceProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Phyzic — Physics Knowledge Exchange",
  description: "A rigorous, community-driven physics Q&A. Ask questions, share knowledge, and collaborate on problems across classical mechanics, quantum theory, electrodynamics, and more.",
  openGraph: {
    title: "Phyzic — Physics Knowledge Exchange",
    description: "Ask, answer, and explore physics problems with LaTeX support and peer review.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        <ThemeScript />
        <MathJaxLoader />
        <AuthProvider>
          <PresenceProvider>{children}</PresenceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
