import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@mdxeditor/editor/style.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"

import { SentryProvider } from "@/components/sentry-provider"
import { AuthStateProvider } from "@/components/auth-state-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuillFox - Your Encrypted Workspace",
  description: "A comprehensive encrypted productivity workspace combining rich-text notetaking and structured to-do lists with end-to-end encryption.",
  keywords: ["QuillFox", "productivity", "notes", "todo", "encryption", "workspace"],
  authors: [{ name: "QuillFox Team" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "QuillFox - Your Encrypted Workspace",
    description: "End-to-end encrypted rich-text notes and structured todos.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SentryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthStateProvider>
              {children}
            </AuthStateProvider>
            <Toaster position="bottom-right" theme="system" richColors />
          </ThemeProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
