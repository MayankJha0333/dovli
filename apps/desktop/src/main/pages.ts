import mark from "../../resources/mark.png?inline";

// The page the browser shows when it hands the sign-in back to the app (see googleSignIn.ts).
// Self-contained: it's served from 127.0.0.1 and can't load anything from the app.

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function donePage(kind: "ok" | "error", message = "") {
  const ok = kind === "ok";
  const title = ok ? "You're signed in" : "Sign-in didn't finish";
  const text = ok ? "Dovli is open on your computer. You can close this tab." : `${escape(message)} Go back to the Dovli app to try again.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Dovli</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f5ff; --card: #fff; --ink: #1d1a2e; --ink2: #5d5878; --line: #e7e2f6; --accent: ${ok ? "#5443E0" : "#c2410c"}; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14121d; --card: #1d1a29; --ink: #f1eefb; --ink2: #a7a1c2; --line: #2d2940; --accent: ${ok ? "#B3A6FF" : "#fb923c"}; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(1200px 500px at 50% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent), var(--bg); color: var(--ink); font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  main { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 36px 32px 32px; text-align: center; box-shadow: 0 24px 60px -24px rgb(40 30 90 / .25); }
  img { width: 56px; height: 56px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  h1 { margin: 14px 0 6px; font-size: 26px; line-height: 1.2; letter-spacing: -0.02em; }
  p { margin: 0; color: var(--ink2); }
</style>
</head>
<body>
<main>
  <img src="${mark}" alt="Dovli">
  <div class="badge">${ok ? "&#10003; Dovli for desktop" : "Dovli for desktop"}</div>
  <h1>${title}</h1>
  <p>${text}</p>
</main>
</body>
</html>`;
}
