import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import BackgroundProvider from "@/components/BackgroundProvider";
import { getBackgroundSettings } from "@/lib/actions";
import { THEME_COOKIE } from "@/lib/prefs";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personal dashboard",
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [background, cookieStore] = await Promise.all([getBackgroundSettings(), cookies()])

  // The theme comes from a cookie so the server can put the right class on
  // <html> straight away — no blocking script, no flash, no mismatch.
  const theme = cookieStore.get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark'

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${theme === 'dark' ? ' dark' : ''}`}>
      <body className="h-full">
        <ThemeProvider initial={theme}>
          <BackgroundProvider initial={background}>{children}</BackgroundProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
