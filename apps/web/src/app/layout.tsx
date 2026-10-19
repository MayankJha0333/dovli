import type { Metadata, Viewport } from "next";
import { APP_THEMES, DEFAULT_THEME, FONT_STYLESHEET, getTheme, themeStylesheet } from "@dovli/theme";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import { themeBootScript } from "@/lib/themeBoot";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Dovli",
  description: "A calm place to write, plan and sketch.",
  applicationName: "Dovli",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // When the phone keyboard opens, shrink the page instead of covering it, so the editor's
  // menus and toolbar stay above the keyboard.
  interactiveWidget: "resizes-content",
  themeColor: getTheme(DEFAULT_THEME).colors.bg,
};

// Every theme's colours as CSS variables, plus a tiny script that picks the saved theme before the
// first paint, so there is never a flash of the wrong theme.
const themeCss = themeStylesheet();
const boot = themeBootScript(Object.fromEntries(APP_THEMES.map((t) => [t.id, { scheme: t.scheme, bg: t.colors.bg }])));

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} data-scheme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <style id="dovli-themes" dangerouslySetInnerHTML={{ __html: themeCss }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only z-[600] rounded-md bg-primary px-4 py-2 font-semibold text-primary-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        {children}
        <VercelAnalytics />
      </body>
    </html>
  );
}
