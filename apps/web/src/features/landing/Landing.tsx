"use client";

// The landing page at "/". It uses the app's own tokens, logo, buttons and glass pills, plus the
// folded sheet from the mark, so the landing page, the sign-in page and the app read as one
// product. The sections live in Sections.tsx, the product pictures in Pictures.tsx, the colours in
// tones.ts, and the motion in landing.css (all of it off when motion is reduced).

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_THEME, type ThemePreference } from "@dovli/theme";
import { DovliLogo, DovliMark, Icon, Segmented, buttonStyles, cn, type IconName } from "@dovli/ui";
import { APP_PATH, LOGIN_PATH, SIGNUP_PATH } from "@/lib/authGate";
import { trackEvent } from "@/lib/analytics";
import { settings } from "@/lib/settings";
import { prefersLessMotion } from "./motion";
import { HeroPicture } from "./Pictures";
import { Coming, Mcp, Story, Templates, container, h2Class, leadClass } from "./Sections";
import { Sheet } from "./Sheet";
import { tone, type Tone } from "./tones";

type Start = { href: string; label: string };

/** Counts clicks on the main button, by where it sits on the page (see lib/analytics.ts). */
const startClick = (start: Start, place: string) => () =>
  trackEvent(start.href === SIGNUP_PATH ? "Sign-up click" : "Open app click", { place });


/**
 * `accounts`: sign-in is set up. Without it, Dovli runs on this device only, so the buttons open the app.
 * `signedIn`: this visitor already has a session, so the buttons go straight into the app.
 */
export function Landing({ accounts = true, signedIn = false }: { accounts?: boolean; signedIn?: boolean }) {
  // One name for the main action everywhere on the page.
  const start: Start = accounts && !signedIn ? { href: SIGNUP_PATH, label: "Create free account" } : { href: APP_PATH, label: "Open Dovli" };
  const showSignIn = accounts && !signedIn;

  // Page links from before the app moved to /app ("/#p-abc") still open the page.
  useEffect(() => {
    if (window.location.hash.startsWith("#p-")) window.location.replace(APP_PATH + window.location.hash);
  }, []);

  return (
    <div className="lp-root relative isolate min-h-dvh overflow-x-clip bg-bg text-ink">
      <Glow />
      <Header showSignIn={showSignIn} start={start} />
      <main id="main">
        <Hero free={showSignIn} start={start} />
        <Ecosystem />
        <div className="flex flex-col gap-28 py-28 sm:gap-36 sm:py-36">
          <Story />
          <Templates start={start} />
          <Mcp />
          <Coming />
          <Promises />
        </div>
        <Closing free={showSignIn} start={start} />
      </main>
      <Footer showSignIn={showSignIn} start={start} />
    </div>
  );
}

/* ---------- Header: a floating glass pill, like the app's own top bar ---------- */

// Everything in Dovli, for the Product menu (and the phone menu). Each part keeps its page colour.
const productItems: { href: string; icon: IconName; t: Tone; title: string; text: string; soon?: "extension" | "android" }[] = [
  { href: "#features", icon: "pencil", t: "blue", title: "Pages and blocks", text: "Type / for to-dos, tables, callouts and more" },
  { href: "#features", icon: "board", t: "mint", title: "Whiteboards", text: "Sketch and flowchart beside your notes" },
  { href: "#templates", icon: "templates", t: "butter", title: "Templates", text: "Meeting notes, briefs, reviews and boards" },
  { href: "#mcp", icon: "plug", t: "lilac", title: "AI apps", text: "Claude, Codex and more, through MCP" },
  { href: "#coming", icon: "paperclip", t: "sky", title: "Browser extension", text: "Clip what you read on the web", soon: "extension" },
  { href: "#coming", icon: "device", t: "pink", title: "Android app", text: "Your pages on your phone, offline too", soon: "android" },
];

// The links in the bar, and which sections light each one up.
const navLinks: { href: string; label: string; sections: string[]; menu?: boolean }[] = [
  { href: "#features", label: "Product", sections: ["features", "coming"], menu: true },
  { href: "#templates", label: "Templates", sections: ["templates"] },
  { href: "#mcp", label: "AI apps", sections: ["mcp"] },
];
const watched = ["features", "templates", "mcp", "coming"];

function ProductItem({ item, onPick, large }: { item: (typeof productItems)[number]; onPick: () => void; large?: boolean }) {
  const c = tone(item.t);
  return (
    <a
      href={item.href}
      onClick={() => {
        if (item.soon) trackEvent("Coming soon click", { app: item.soon });
        onPick();
      }}
      className="group flex items-start gap-3 rounded-[12px] p-2.5 transition-colors hover:bg-hover focus-visible:outline-offset-[-2px]">
      <span
        className={cn("grid flex-none place-items-center rounded-[10px] transition-transform duration-300 group-hover:-rotate-6", large ? "size-11" : "size-10")}
        style={{ background: c.bg, color: c.ink }}
        aria-hidden="true"
      >
        <Icon name={item.icon} size={large ? 19 : 18} />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="flex items-center gap-2 text-base font-semibold text-ink">
          {item.title}
          {item.soon && <span className="rounded-full bg-well px-1.5 py-px text-2xs font-semibold text-ink-2">Soon</span>}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-ink-2">{item.text}</span>
      </span>
    </a>
  );
}

function Header({ showSignIn, start }: { showSignIn: boolean; start: Start }) {
  const [menu, setMenu] = useState(false); // the phone menu
  const [product, setProduct] = useState(false); // the Product dropdown on wide screens
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState(""); // the section on screen
  const [hovered, setHovered] = useState<string | null>(null);
  const [mark, setMark] = useState<{ left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const productButton = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<number>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Which section is on screen.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    watched.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    const top = new IntersectionObserver(([e]) => e?.isIntersecting && setCurrent(""), { rootMargin: "0px 0px -60% 0px" });
    const hero = document.getElementById("hero-title");
    if (hero) top.observe(hero);
    return () => {
      io.disconnect();
      top.disconnect();
    };
  }, []);

  const activeHref = navLinks.find((l) => l.sections.includes(current))?.href ?? null;

  // One soft highlight glides to the link you point at, or rests on the section you're reading.
  useEffect(() => {
    const target = hovered ?? (product ? "#features" : activeHref);
    const el = target ? navRef.current?.querySelector<HTMLElement>(`[data-nav="${target}"]`) : null;
    setMark(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [hovered, activeHref, product]);

  // Menus close on Escape (focus goes back to the button that opened them), on a click outside,
  // and when keyboard focus leaves the header.
  useEffect(() => {
    if (!menu && !product) return;
    const close = (refocus: boolean) => {
      if (refocus) (menu ? menuButton : productButton).current?.focus();
      setMenu(false);
      setProduct(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const outside = (e: Event) => !wrapRef.current?.contains(e.target as Node) && close(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", outside);
    window.addEventListener("focusin", outside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("focusin", outside);
    };
  }, [menu, product]);

  // On a mouse, the Product menu opens on hover too, with a short grace period when leaving.
  const hoverProduct = (on: boolean) => {
    window.clearTimeout(hoverTimer.current);
    if (on) setProduct(true);
    else hoverTimer.current = window.setTimeout(() => setProduct(false), 160);
  };

  const raised = scrolled || menu || product;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:pt-4">
      <div
        ref={wrapRef}
        className={cn("relative mx-auto transition-[max-width] duration-500 ease-out", scrolled ? "max-w-[1000px]" : "max-w-[1120px]")}
      >
        <div className={cn("relative flex h-14 items-center gap-1 pl-4 pr-2 transition-[box-shadow,background-color] duration-300", raised ? "chrome-pill" : "rounded-full")}>
          <Link href="/" aria-label="Dovli home" className="mr-4 rounded-md">
            <DovliLogo size={28} />
          </Link>

          <div ref={navRef} className="relative hidden items-center lg:flex" onPointerLeave={() => setHovered(null)}>
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-8 -translate-y-1/2 rounded-full bg-active transition-[left,width,opacity] duration-300 ease-out"
              style={{ left: mark?.left ?? 0, width: mark?.width ?? 0, opacity: mark ? 1 : 0 }}
            />
            <nav aria-label="Main" className="relative flex items-center">
              {navLinks.map((l) =>
                l.menu ? (
                  <div key={l.href} onPointerEnter={(e) => e.pointerType === "mouse" && hoverProduct(true)} onPointerLeave={(e) => e.pointerType === "mouse" && hoverProduct(false)}>
                    <button
                      ref={productButton}
                      type="button"
                      data-nav={l.href}
                      aria-expanded={product}
                      aria-controls="product-menu"
                      onPointerEnter={() => setHovered(l.href)}
                      onClick={() => setProduct((p) => !p)}
                      className={cn(
                        "relative flex h-8 items-center gap-1 rounded-full px-3 text-base font-semibold transition-colors",
                        activeHref === l.href || product ? "text-active-ink" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {l.label}
                      <Icon name="chevronDown" size={13} className={cn("transition-transform duration-300", product && "rotate-180")} aria-hidden="true" />
                    </button>
                    {product && (
                      <div
                        id="product-menu"
                        className="absolute left-0 top-[calc(100%+14px)] grid w-[620px] animate-pop-in grid-cols-2 gap-1 p-2 chrome-panel"
                        // Nearly solid glass, so the page behind never competes with the menu's text.
                        style={{ transformOrigin: "top left", background: "var(--c-pill)" }}
                      >
                        {/* An invisible bridge so the mouse can travel from the button to the menu. */}
                        <span aria-hidden="true" className="absolute inset-x-0 -top-4 h-4" />
                        {productItems.map((it) => (
                          <ProductItem key={it.title} item={it} onPick={() => setProduct(false)} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    data-nav={l.href}
                    aria-current={activeHref === l.href ? "location" : undefined}
                    onPointerEnter={() => setHovered(l.href)}
                    className={cn(
                      "relative flex h-8 items-center rounded-full px-3 text-base font-semibold transition-colors",
                      activeHref === l.href ? "text-active-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {l.label}
                  </a>
                ),
              )}
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {showSignIn && (
              <Link href={LOGIN_PATH} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "hidden rounded-full sm:inline-flex")}>
                Sign in
              </Link>
            )}
            <Link href={start.href} onClick={startClick(start, "header")} className={cn(buttonStyles({ variant: "primary", size: "md" }), "rounded-full px-4")}>
              {start.label}
            </Link>
            <button
              ref={menuButton}
              type="button"
              aria-expanded={menu}
              aria-controls="landing-menu"
              aria-label={menu ? "Close menu" : "Open menu"}
              onClick={() => setMenu((o) => !o)}
              className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-hover hover:text-ink lg:hidden"
            >
              <Icon name={menu ? "close" : "menu"} size={18} />
            </button>
          </div>

          {/* How far down the page you are, in the mark's colours (browsers that can tie it to scrolling). */}
          <span aria-hidden="true" className={cn("lp-progress pointer-events-none absolute inset-x-6 bottom-0 h-[2px] rounded-full transition-opacity duration-300", raised ? "opacity-100" : "opacity-0")} />
        </div>

        {menu && (
          <nav
            id="landing-menu"
            aria-label="Menu"
            className="absolute inset-x-0 top-[calc(100%+8px)] max-h-[calc(100dvh-6rem)] animate-pop-in overflow-y-auto p-2 chrome-panel lg:hidden"
            style={{ background: "var(--c-pill)" }}
          >
            <div className="grid gap-0.5 sm:grid-cols-2">
              {productItems.map((it) => (
                <ProductItem key={it.title} item={it} large onPick={() => setMenu(false)} />
              ))}
            </div>
            <div className="mt-2 flex gap-2 border-t border-line p-2 pt-3">
              {showSignIn && (
                <Link href={LOGIN_PATH} className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "flex-1 rounded-full")}>
                  Sign in
                </Link>
              )}
              <Link href={start.href} onClick={startClick(start, "menu")} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "flex-1 rounded-full")}>
                {start.label}
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */

// The headline, with the three things Dovli is for in their own colours (used again further down).
const heroLines: { text: string; verb?: { t: Tone; icon: IconName } }[][] = [
  [{ text: "A" }, { text: "calm" }, { text: "place" }, { text: "to" }],
  [{ text: "write", verb: { t: "blue", icon: "pencil" } }, { text: "," }, { text: "plan", verb: { t: "mint", icon: "checkbox" } }],
  [{ text: "and" }, { text: "sketch", verb: { t: "pink", icon: "brush" } }, { text: "." }],
];

function Hero({ free, start }: { free: boolean; start: Start }) {
  let i = 0;
  return (
    <section aria-labelledby="hero-title" className="relative px-2 pt-2 sm:px-4 sm:pt-4">
      {/* Sky and ruled paper behind the headline. */}
      <div aria-hidden="true" className="lp-sky absolute inset-x-2 top-2 -z-10 h-[min(980px,112vh)] overflow-hidden rounded-[28px] sm:inset-x-4 sm:top-4 sm:rounded-[44px]">
        <div className="lp-ruled absolute inset-0" />
      </div>
      <div className={cn(container, "flex flex-col items-center pt-28 text-center sm:pt-32")}>
        <h1 id="hero-title" className="m-0 font-serif text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[72px] lg:text-[88px]">
          <span className="sr-only">A calm place to write, plan and sketch.</span>
          {heroLines.map((line, li) => (
            <span key={li} className="lp-line" aria-hidden="true">
              {line.map((w, wi) => {
                const style = { "--i": i++ } as CSSProperties;
                const next = line[wi + 1];
                // A space after each word, except before a comma or full stop and at the end of a line.
                const space = next && next.text !== "," && next.text !== "." ? " " : "";
                if (w.verb) {
                  const c = tone(w.verb.t);
                  return (
                    <span key={w.text} className="lp-word" style={style}>
                      <span className="lp-verb" style={{ background: c.bg, color: c.ink }}>
                        <Icon name={w.verb.icon} size={16} />
                        {w.text}
                      </span>
                      {space}
                    </span>
                  );
                }
                const glue = w.text === "," || w.text === ".";
                return (
                  <span key={w.text} className={cn("lp-word", glue && "-ml-[0.12em]")} style={style}>
                    {w.text}
                    {space}
                  </span>
                );
              })}
            </span>
          ))}
        </h1>
        <p className={cn(leadClass, "lp-fade mt-7 max-w-[560px] text-balance sm:text-xl sm:leading-relaxed")} style={{ "--d": "0.55s" } as CSSProperties}>
          Your notes, docs and whiteboards, together in one place. Free on the web, and your AI apps can help out too.
        </p>
        <div className="lp-fade mt-8 flex flex-wrap items-center justify-center gap-3" style={{ "--d": "0.7s" } as CSSProperties}>
          <Link href={start.href} onClick={startClick(start, "hero")} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 rounded-full px-6 text-md")}>
            {start.label}
          </Link>
          <a href="#templates" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "h-12 rounded-full bg-panel/80 px-6 text-md")}>
            Browse templates
          </a>
        </div>
        {free && (
          <p className="lp-fade m-0 mt-4 text-sm text-ink-2" style={{ "--d": "0.8s" } as CSSProperties}>
            Free to use. Sign in with Google or an email code, no password.
          </p>
        )}
      </div>

      <div className={cn(container, "relative mt-12")}>
        <div className="lp-fade" style={{ "--d": "0.85s" } as CSSProperties}>
          <div className="lp-tilt origin-top">
            <HeroPicture />
          </div>
        </div>
        <p className="m-0 mt-5 text-center text-base text-ink-2">Go on, tick a to-do.</p>
      </div>
    </section>
  );
}

/* ---------- Where you can use Dovli ---------- */

const places: { href: string; icon: IconName; name: string; text: string; t: Tone; soon?: "extension" | "android" }[] = [
  { href: "#features", icon: "monitor", name: "Web app", text: "Every feature, in any modern browser.", t: "blue" },
  { href: "#mcp", icon: "plug", name: "AI apps", text: "Claude, Codex and more, through MCP.", t: "lilac" },
  { href: "#coming", icon: "paperclip", name: "Browser extension", text: "Clip anything you read online.", t: "sky", soon: "extension" },
  { href: "#coming", icon: "device", name: "Android app", text: "Your pages on your phone, offline too.", t: "mint", soon: "android" },
];

function Ecosystem() {
  return (
    <section aria-labelledby="eco-title" className={cn(container, "pt-20 sm:pt-28")}>
      <h2 id="eco-title" className="m-0 text-lg font-semibold text-ink-2">
        Wherever you work
      </h2>
      <ul className="m-0 mt-5 grid list-none gap-px overflow-hidden rounded-xl bg-line p-0 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {places.map((p) => (
          <li key={p.name} className="bg-panel">
            <a href={p.href} onClick={() => p.soon && trackEvent("Coming soon click", { app: p.soon })} className="group flex h-full flex-col gap-4 p-6 transition-colors duration-200 hover:bg-hover focus-visible:outline-offset-[-3px]">
              <span
                className="grid size-11 place-items-center rounded-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
                style={{ background: tone(p.t).bg, color: tone(p.t).ink }}
                aria-hidden="true"
              >
                <Icon name={p.icon} size={20} />
              </span>
              <span>
                <span className="block text-lg font-semibold text-ink">{p.name}</span>
                <span className="mt-1 block text-md text-ink-2">{p.text}</span>
              </span>
              {p.soon ? (
                <span className="mt-auto self-start rounded-full bg-well px-2.5 py-1 text-xs font-semibold text-ink-2">Coming soon</span>
              ) : (
                <span className="mt-auto flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: tone("mint").bg, color: tone("mint").ink }}>
                  <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                  Available now
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Promises ---------- */

function Promises() {
  return (
    <section className="px-2 sm:px-4" aria-labelledby="promises-title">
      <div className="rounded-[28px] bg-panel shadow-sm sm:rounded-[44px]">
        <div className={cn(container, "grid gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16")}>
          <h2 id="promises-title" className={cn(h2Class, "text-ink")}>
            Private, offline, and yours
          </h2>
          <ul className="m-0 grid list-none gap-10 p-0 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12">
            <Pledge icon="cloudOff" t="sky" title="Works offline">
              Pages save on your device first, then sync when you&apos;re back online.
            </Pledge>
            <Pledge icon="lock" t="lilac" title="Private by default">
              Each account sees only its own workspace. Nothing is shared until you share it.
            </Pledge>
            <Pledge icon="share" t="mint" title="Share your way">
              Send a link people can read, or let the people you pick edit with you.
            </Pledge>
            <Pledge icon="download" t="butter" title="Take it with you">
              Export any page as a Word file or a PDF, whenever you like.
            </Pledge>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Pledge({ icon, title, t, children }: { icon: IconName; title: string; t: Tone; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3">
      <span className="grid size-10 place-items-center rounded-md" style={{ background: tone(t).bg, color: tone(t).ink }} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <h3 className="m-0 text-lg font-semibold text-ink">{title}</h3>
      <p className="m-0 max-w-[340px] text-md leading-relaxed text-ink-2">{children}</p>
    </li>
  );
}

/* ---------- Closing ---------- */

function Closing({ free, start }: { free: boolean; start: Start }) {
  return (
    <section aria-labelledby="cta-title" className="px-2 pb-16 sm:px-4 sm:pb-24">
      {/* The hero's sky again, so the page ends where it began. */}
      <div className="lp-sky relative overflow-hidden rounded-[28px] sm:rounded-[44px]">
        <div aria-hidden="true" className="lp-ruled absolute inset-0" />
        <div className={cn(container, "relative py-14 sm:py-24")}>
          <Sheet fold={72} sheetClassName="rounded-[32px] bg-panel">
            <div className="flex flex-col items-start gap-8 px-6 py-12 sm:px-16 sm:py-20">
              <DovliMark size={44} />
              <h2 id="cta-title" className="m-0 max-w-[820px] text-balance font-serif text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[64px]">
                Start with a blank page.
              </h2>
              <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <p className={cn(leadClass, "max-w-[460px]")}>
                  {free ? "Free to use. Sign in with Google or an email code, no password." : "Your pages are waiting where you left them."}
                </p>
                <Link href={start.href} onClick={startClick(start, "closing")} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 flex-none rounded-full px-6 text-md")}>
                  {start.label}
                </Link>
              </div>
            </div>
          </Sheet>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer: a last panel, with the name rising out of its bottom edge ---------- */

const themeChoices = [
  { value: "soft-studio", label: "Light", icon: "sun" },
  { value: "night-desk", label: "Dark", icon: "moon" },
  { value: "system", label: "Auto", icon: "monitor" },
] as const;

/** Light, dark or follow the device: the same setting as in the app, so the choice carries over. */
function ThemeSwitch() {
  const theme = useSyncExternalStore(settings.subscribe, () => settings.get().theme, () => DEFAULT_THEME);
  return (
    <Segmented
      label="Colour theme"
      value={theme}
      onValueChange={(v) => settings.set({ theme: v as ThemePreference })}
      options={themeChoices.map((c) => ({ value: c.value, label: c.label, icon: c.icon }))}
      className="rounded-full [&>*]:rounded-full"
    />
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col">
      <h2 className="m-0 mb-2 text-sm font-semibold text-ink">{title}</h2>
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children, soon, onClick }: { href: string; children: ReactNode; soon?: boolean; onClick?: () => void }) {
  const cls = "group inline-flex items-center gap-2 rounded-sm py-1.5 text-base text-ink-2 transition-colors hover:text-ink";
  const body = (
    <>
      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-px transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">{children}</span>
      {soon && <span className="rounded-full bg-well px-2 py-0.5 text-2xs font-semibold text-ink-2">Soon</span>}
    </>
  );
  return (
    <li>
      {href.startsWith("#") ? (
        <a href={href} onClick={onClick} className={cls}>
          {body}
        </a>
      ) : (
        <Link href={href} onClick={onClick} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}

function Footer({ showSignIn, start }: { showSignIn: boolean; start: Start }) {
  const toTop = () => {
    window.scrollTo({ top: 0, behavior: prefersLessMotion() ? "auto" : "smooth" });
    // Keep keyboard users in step with the scroll: focus lands back at the top of the page.
    document.querySelector<HTMLElement>('header a[aria-label="Dovli home"]')?.focus({ preventScroll: true });
  };
  return (
    <footer className="px-2 pb-2 sm:px-4 sm:pb-4">
      <div className="relative overflow-hidden rounded-[28px] bg-panel shadow-sm sm:rounded-[44px]">
        <div className={cn(container, "pt-14 sm:pt-20")}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col items-start gap-5">
              <Link href="/" aria-label="Dovli home" className="rounded-md">
                <DovliLogo size={34} />
              </Link>
              <p className="m-0 max-w-[340px] text-md leading-relaxed text-ink-2">A calm place to write, plan and sketch. Free on the web, with more apps on the way.</p>
              <Link href={start.href} onClick={startClick(start, "footer")} className={cn(buttonStyles({ variant: "primary", size: "md" }), "mt-1 rounded-full px-4")}>
                {start.label}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              <FooterColumn title="Product">
                <FooterLink href="#features">Features</FooterLink>
                <FooterLink href="#templates">Templates</FooterLink>
                <FooterLink href="#mcp">AI apps and MCP</FooterLink>
              </FooterColumn>
              <FooterColumn title="Get Dovli">
                <FooterLink href={APP_PATH}>Web app</FooterLink>
                <FooterLink href="#coming" soon onClick={() => trackEvent("Coming soon click", { app: "extension" })}>
                  Browser extension
                </FooterLink>
                <FooterLink href="#coming" soon onClick={() => trackEvent("Coming soon click", { app: "android" })}>
                  Android app
                </FooterLink>
              </FooterColumn>
              <FooterColumn title="Account">
                {showSignIn && <FooterLink href={LOGIN_PATH}>Sign in</FooterLink>}
                <FooterLink href={start.href} onClick={startClick(start, "footer-account")}>
                  {start.label}
                </FooterLink>
              </FooterColumn>
            </div>
          </div>

          <div className="mt-14 flex flex-col-reverse gap-5 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-ink-3">© {new Date().getFullYear()} Dovli</span>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeSwitch />
              <button type="button" onClick={toTop} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "rounded-full")}>
                <Icon name="arrowUp" size={15} aria-hidden="true" />
                Back to top
              </button>
            </div>
          </div>
        </div>

        {/* The name in the mark's colours, rising out of the panel's bottom edge. */}
        <div aria-hidden="true" className="lp-giant mt-6 select-none text-center font-display text-[29vw] font-bold leading-[0.74] tracking-[-0.06em] lg:text-[320px]">
          <span
            className="inline-block translate-y-[16%] bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(100deg, #7DB4FF 0%, #A592FF 35%, #B57CF6 62%, #E39AEC 85%, #F6B9EE 100%)" }}
          >
            Dovli
          </span>
        </div>
      </div>
    </footer>
  );
}

/** The soft colour behind glass themes (Frost and friends). Solid themes set these to nothing. */
function Glow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px] overflow-hidden">
      <div className="absolute -left-[200px] -top-[240px] h-[600px] w-[720px] rounded-full bg-[var(--d-glow-1)] opacity-[var(--d-glow-1-o)] blur-[120px]" />
      <div className="absolute -right-[180px] top-[320px] h-[520px] w-[600px] rounded-full bg-[var(--d-glow-2)] opacity-[var(--d-glow-2-o)] blur-[130px]" />
    </div>
  );
}
