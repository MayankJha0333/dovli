// The landing page's colours. Each idea gets one soft colour, used the same way everywhere:
// writing is blue, planning is mint, sketching is pink, pages are lilac, looks are butter,
// the web clipper is sky. The values live in landing.css (with dark versions), so they follow
// the theme; this file only names them.

export type Tone = "blue" | "lilac" | "mint" | "butter" | "pink" | "sky";

export const tone = (t: Tone) => ({ bg: `var(--lp-${t})`, ink: `var(--lp-${t}-ink)` });
