import type { MetadataRoute } from "next";
import { DEFAULT_THEME, getTheme } from "@dovli/theme";
import { HOME_DESCRIPTION } from "@/lib/seo";

// Dovli as an installable web app: its name, icon and colours when it's added to a home screen,
// and a tie to the Android app on Google Play.
export default function manifest(): MetadataRoute.Manifest {
  const bg = getTheme(DEFAULT_THEME).colors.bg;
  return {
    name: "Dovli",
    short_name: "Dovli",
    description: HOME_DESCRIPTION,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: bg,
    theme_color: bg,
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    related_applications: [{ platform: "play", url: "https://play.google.com/store/apps/details?id=app.dovli", id: "app.dovli" }],
  };
}
