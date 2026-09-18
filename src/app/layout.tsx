import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@mdxeditor/editor/style.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"

import { AuthStateProvider } from "@/components/auth-state-provider"
import { LocaleProvider } from "@/components/shared/locale-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.quillfox.cc'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "QuillFox - Your Encrypted Workspace",
    template: "%s | QuillFox",
  },
  description: "A comprehensive encrypted productivity workspace combining rich-text notetaking and structured to-do lists with end-to-end encryption.",
  keywords: ["QuillFox", "productivity", "notes", "todo", "encryption", "workspace", "end-to-end encrypted notes"],
  authors: [{ name: "QuillFox Team" }],
  applicationName: "QuillFox",
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    title: "QuillFox - Your Encrypted Workspace",
    description: "End-to-end encrypted rich-text notes and structured todos.",
    type: "website",
    url: APP_URL,
    siteName: "QuillFox",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuillFox - Your Encrypted Workspace",
    description: "End-to-end encrypted rich-text notes and structured todos.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
  width: "device-width",
  initialScale: 1,
};

import { headers } from 'next/headers'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') || '';

  return (
    <html lang="en" suppressHydrationWarning nonce={nonce}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthStateProvider>
            <LocaleProvider />
            <div id="main-content" tabIndex={-1}>
              {children}
            </div>
          </AuthStateProvider>
          <Toaster position="bottom-right" theme="system" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}