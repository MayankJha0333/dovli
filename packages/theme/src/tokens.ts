// Spacing and sizing shared by the web and phone apps. Colours, fonts, radii and shadows
// live in the app themes (appThemes.ts), so they change when the theme changes.

/** A 4-point spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Text sizes in px (the web app uses the same steps in rem). */
export const fontSize = { caption: 12.5, small: 13.5, body: 15, bodyLarge: 17, h3: 18, h2: 22, h1: 34, display: 44 } as const;

/** Smallest size for anything you tap. */
export const touchTarget = 44;

/** Readable width of a page's text column, in px. */
export const textColumn = 720;
