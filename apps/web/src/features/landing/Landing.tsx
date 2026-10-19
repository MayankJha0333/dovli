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
import { settings } from "@/lib/settings";
import { prefersLessMotion } from "./motion";
import { HeroPicture } from "./Pictures";
import { Coming, Mcp, Story, Templates, container, h2Class, leadClass } from "./Sections";
import { Sheet } from "./Sheet";
import { tone, type Tone } from "./tones";

type Start = { href: string; label: string };

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#templates", label: "Templates" },
  { href: "#mcp", label: "AI apps" },
  { href: "#coming", label: "Coming soon" },
];

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

function Header({ showSignIn, start }: { showSignIn: boolean; start: Start }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Light up the link for the section on screen.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    navLinks.forEach((l) => {
      const el = document.getElementById(l.href.slice(1));
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

  // The mobile menu closes on Escape (focus goes back to its button), on a click outside, and
  // when focus leaves it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    const onFocus = (e: FocusEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:pt-4">
      <div ref={menuRef} className="relative mx-auto max-w-[1120px]">
        <div className={cn("flex h-14 items-center gap-1 pl-4 pr-2 transition-shadow duration-300", scrolled || open ? "chrome-pill" : "rounded-full")}>
          <Link href="/" aria-label="Dovli home" className="mr-3 rounded-md">
            <DovliLogo size={28} />
          </Link>
          <nav aria-label="Main" className="hidden items-center lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={current === l.href ? "location" : undefined}
                className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "h-8 rounded-full px-3 text-base aria-[current]:bg-active aria-[current]:text-active-ink")}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {showSignIn && (
              <Link href={LOGIN_PATH} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "hidden rounded-full sm:inline-flex")}>
                Sign in
              </Link>
            )}
            <Link href={start.href} className={cn(buttonStyles({ variant: "primary", size: "md" }), "rounded-full px-4")}>
              {start.label}
            </Link>
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls="landing-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-hover hover:text-ink lg:hidden"
            >
              <Icon name={open ? "close" : "menu"} size={18} />
            </button>
          </div>
        </div>
        {open && (
          <nav id="landing-menu" aria-label="Menu" className="absolute inset-x-0 top-[calc(100%+8px)] flex animate-pop-in flex-col p-2 chrome-panel lg:hidden">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-md font-semibold text-ink hover:bg-hover">
                {l.label}
              </a>
            ))}
            {showSignIn && (
              <Link href={LOGIN_PATH} className="rounded-md px-3 py-3 text-md font-semibold text-ink hover:bg-hover sm:hidden">
                Sign in
              </Link>
            )}
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
          <Link href={start.href} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 rounded-full px-6 text-md")}>
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

const places: { href: string; icon: IconName; name: string; text: string; t: Tone; soon?: boolean }[] = [
  { href: "#features", icon: "monitor", name: "Web app", text: "Every feature, in any modern browser.", t: "blue" },
  { href: "#mcp", icon: "plug", name: "AI apps", text: "Claude, Codex and more, through MCP.", t: "lilac" },
  { href: "#coming", icon: "paperclip", name: "Browser extension", text: "Clip anything you read online.", t: "sky", soon: true },
  { href: "#coming", icon: "device", name: "Android app", text: "Your pages on your phone, offline too.", t: "mint", soon: true },
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
            <a href={p.href} className="group flex h-full flex-col gap-4 p-6 transition-colors duration-200 hover:bg-hover focus-visible:outline-offset-[-3px]">
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
                <Link href={start.href} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 flex-none rounded-full px-6 text-md")}>
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

function FooterLink({ href, children, soon }: { href: string; children: ReactNode; soon?: boolean }) {
  const cls = "group inline-flex items-center gap-2 rounded-sm py-1.5 text-base text-ink-2 transition-colors hover:text-ink";
  const body = (
    <>
      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-px transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">{children}</span>
      {soon && <span className="rounded-full bg-well px-2 py-0.5 text-2xs font-semibold text-ink-2">Soon</span>}
    </>
  );
  return <li>{href.startsWith("#") ? <a href={href} className={cls}>{body}</a> : <Link href={href} className={cls}>{body}</Link>}</li>;
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
              <Link href={start.href} className={cn(buttonStyles({ variant: "primary", size: "md" }), "mt-1 rounded-full px-4")}>
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
                <FooterLink href="#coming" soon>
                  Browser extension
                </FooterLink>
                <FooterLink href="#coming" soon>
                  Android app
                </FooterLink>
              </FooterColumn>
              <FooterColumn title="Account">
                {showSignIn && <FooterLink href={LOGIN_PATH}>Sign in</FooterLink>}
                <FooterLink href={start.href}>{start.label}</FooterLink>
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
