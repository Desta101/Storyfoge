import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppFooter from "./components/AppFooter";
import DevFreeUsageReset from "./components/DevFreeUsageReset";
import ThemePreferenceSync from "./components/ThemePreferenceSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StoryForge",
  description:
    "Turn your ideas into Comics & Manga with AI. StoryForge helps you generate panel-ready scenes and comic pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemePreferenceSync />
        <DevFreeUsageReset />
        {/* Padding reserves space so page content is not hidden behind the fixed footer */}
        <div className="min-h-full pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>
        <AppFooter />
      </body>
    </html>
  );
}
