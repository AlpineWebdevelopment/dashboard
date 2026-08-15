import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import BackgroundProvider from "@/components/BackgroundProvider";
import { backgroundUrl } from "@/lib/supabase";
import { BACKGROUND_COOKIE, THEME_COOKIE, decodeBackgroundPref } from "@/lib/prefs";

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
  const cookieStore = await cookies()

  // The theme comes from a cookie so the server can put the right class on
  // <html> straight away — no blocking script, no flash, no mismatch.
  const theme = cookieStore.get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark'

  // Same deal for the wallpaper. The cookie holds the storage object's name, so
  // resolve it to a public URL here — the markup then carries the image on the
  // very first response. No image chosen is the default.
  const pref = decodeBackgroundPref(cookieStore.get(BACKGROUND_COOKIE)?.value)
  const background = {
    url: pref.name ? backgroundUrl(pref.name) : null,
    dim: pref.dim / 100,
    blur: pref.blur,
  }

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
