"use client";

// The landing page at "/" for people who aren't signed in. It uses the app's own tokens, logo,
// buttons and glass pills, plus the folded sheet from the mark, so the landing page, the sign-in
// page and the app read as one product. The sections live in Sections.tsx, the product pictures
// in Pictures.tsx, and the motion in landing.css (all of it off when motion is reduced).

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DovliLogo, DovliMark, Icon, buttonStyles, cn, type IconName } from "@dovli/ui";
import { APP_PATH, LOGIN_PATH, SIGNUP_PATH } from "@/lib/authGate";
import { HeroPicture } from "./Pictures";
import { Extension, Mcp, Mobile, Soon, Story, Templates, container, h2Class, leadClass } from "./Sections";
import { Sheet } from "./Sheet";
import { tone, type Tone } from "./tones";

type Start = { href: string; label: string };

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#templates", label: "Templates" },
  { href: "#mcp", label: "AI apps" },
  { href: "#extension", label: "Extension" },
  { href: "#mobile", label: "Android" },
];

/**
 * `accounts`: sign-in is set up. Without it, Dovli runs on this device only, so the buttons open the app.
 * `signedIn`: this visitor already has a session, so the buttons go straight into the app.
 */
export function Landing({ accounts = true, signedIn = false }: { accounts?: boolean; signedIn?: boolean }) {
  const start: Start = accounts && !signedIn ? { href: SIGNUP_PATH, label: "Create free account" } : { href: APP_PATH, label: "Open Dovli" };
  const showSignIn = accounts && !signedIn;

  // Page links from before the app moved to /app ("/#p-abc") still open the page.
  useEffect(() => {
    if (window.location.hash.startsWith("#p-")) window.location.replace(APP_PATH + window.location.hash);
  }, []);

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-bg text-ink">
      <Glow />
      <Header accounts={showSignIn} start={start} />
      <main id="main">
        <Hero accounts={showSignIn} start={start} />
        <Ecosystem />
        <div className="flex flex-col gap-28 py-28 sm:gap-40 sm:py-40">
          <Story />
          <Templates start={start} />
          <Mcp />
          <Extension />
          <Mobile start={start} />
        </div>
        <Promises />
        <Closing accounts={accounts} start={start} />
      </main>
      <Footer accounts={showSignIn} />
    </div>
  );
}

/* ---------- Header: a floating glass pill, like the app's own top bar ---------- */

function Header({ accounts, start }: { accounts: boolean; start: Start }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Light up the link for the section on screen.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    const ids = navLinks.map((l) => l.href.slice(1));
    ids.forEach((id) => {
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClick);
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
                aria-current={current === l.href ? "true" : undefined}
                className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "h-8 rounded-full px-3 text-base aria-[current]:bg-active aria-[current]:text-active-ink")}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {accounts && (
              <Link href={LOGIN_PATH} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "hidden rounded-full sm:inline-flex")}>
                Sign in
              </Link>
            )}
            <Link href={start.href} className={cn(buttonStyles({ variant: "primary", size: "md" }), "rounded-full px-4")}>
              {start.href === SIGNUP_PATH ? "Get started" : start.label}
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="landing-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-hover hover:text-ink lg:hidden"
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
            {accounts && (
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

function Hero({ accounts, start }: { accounts: boolean; start: Start }) {
  let i = 0;
  return (
    <section aria-labelledby="hero-title" className="relative px-2 pt-2 sm:px-4 sm:pt-4">
      {/* Sky and ruled paper behind the headline. */}
      <div aria-hidden="true" className="lp-sky absolute inset-x-2 top-2 -z-10 h-[min(1040px,118vh)] overflow-hidden rounded-[28px] sm:inset-x-4 sm:top-4 sm:rounded-[44px]">
        <div className="lp-ruled absolute inset-0" />
      </div>
      <div className={cn(container, "flex flex-col items-center pt-32 text-center sm:pt-44")}>
        <h1 id="hero-title" aria-label="A calm place to write, plan and sketch." className="m-0 font-serif text-[46px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[84px] lg:text-[104px]">
          {heroLines.map((line, li) => (
            <span key={li} className="lp-line" aria-hidden="true">
              {line.map((w, wi) => {
                const style = { "--i": i++ } as CSSProperties;
                const next = line[wi + 1];
                // A space after each word, except before a comma or full stop and at the end of a line.
                const space = next && next.text !== "," && next.text !== "." ? "\u00a0" : "";
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
        <p className={cn(leadClass, "lp-fade mt-8 max-w-[600px] sm:text-xl sm:leading-relaxed")} style={{ "--d": "0.55s" } as CSSProperties}>
          One home for your notes, docs and whiteboards. Write on the web, clip from your browser, let your AI apps lend a hand, and soon take it all with you on Android.
        </p>
        <div className="lp-fade mt-9 flex flex-wrap items-center justify-center gap-3" style={{ "--d": "0.7s" } as CSSProperties}>
          <Link href={start.href} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 rounded-full px-6 text-md")}>
            {start.label}
          </Link>
          {accounts && (
            <Link href={LOGIN_PATH} className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "h-12 rounded-full bg-panel/80 px-6 text-md")}>
              Sign in
            </Link>
          )}
        </div>
      </div>

      <div className={cn(container, "relative mt-16 sm:mt-20")}>
        <div className="lp-fade" style={{ "--d": "0.85s" } as CSSProperties}>
          <div className="lp-tilt origin-top">
            <HeroPicture />
          </div>
        </div>
        <p className="m-0 mt-5 text-center text-sm text-ink-3">Go on, tick a to-do.</p>
      </div>
    </section>
  );
}

/* ---------- The ecosystem: every way into Dovli ---------- */

const places: { href: string; icon: IconName; name: string; text: string; t: Tone; soon?: boolean }[] = [
  { href: "#features", icon: "monitor", name: "Web app", text: "Every feature, in any modern browser.", t: "blue" },
  { href: "#mcp", icon: "plug", name: "AI apps", text: "Claude, Codex and more, through MCP.", t: "lilac" },
  { href: "#extension", icon: "paperclip", name: "Browser extension", text: "Clip anything you read online.", t: "sky", soon: true },
  { href: "#mobile", icon: "device", name: "Android app", text: "On Google Play, with offline pages.", t: "mint", soon: true },
];

function Ecosystem() {
  return (
    <section aria-labelledby="eco-title" className={cn(container, "pt-24 sm:pt-32")}>
      <h2 id="eco-title" className="m-0 max-w-[640px] text-balance font-serif text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]">
        One workspace, wherever you are
      </h2>
      <ul className="m-0 mt-10 grid list-none gap-px overflow-hidden rounded-xl bg-line p-0 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {places.map((p) => (
          <li key={p.name} className="bg-panel">
            <a href={p.href} className="group flex h-full flex-col gap-4 p-6 transition-colors duration-200 hover:bg-hover">
              <span className="flex items-center justify-between">
                <span
                  className="grid size-11 place-items-center rounded-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
                  style={{ background: tone(p.t).bg, color: tone(p.t).ink }}
                  aria-hidden="true"
                >
                  <Icon name={p.icon} size={20} />
                </span>
                {p.soon ? (
                  <span className="rounded-full bg-well px-2.5 py-1 text-xs font-semibold text-ink-3">Coming soon</span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-well px-2.5 py-1 text-xs font-semibold text-ok">
                    <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
                    Available now
                  </span>
                )}
              </span>
              <span>
                <span className="block text-lg font-semibold text-ink">{p.name}</span>
                <span className="mt-1 block text-md text-ink-2">{p.text}</span>
              </span>
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
    <section className="border-y border-line bg-panel/60" aria-labelledby="promises-title">
      <div className={cn(container, "grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16")}>
        <h2 id="promises-title" className={cn(h2Class, "text-ink")}>
          Calm, private, and yours
        </h2>
        <ul className="m-0 grid list-none gap-10 p-0 sm:grid-cols-3 sm:gap-8">
          <Pledge icon="cloudOff" t="sky" title="Works offline">
            Pages save on your device first, then sync when you&apos;re back online.
          </Pledge>
          <Pledge icon="lock" t="lilac" title="Private by default">
            Each account sees only its own workspace. Nothing is shared until you share it.
          </Pledge>
          <Pledge icon="share" t="mint" title="Share your way">
            Send a link people can read, or let the people you pick edit with you.
          </Pledge>
        </ul>
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
      <p className="m-0 text-md leading-relaxed text-ink-2">{children}</p>
    </li>
  );
}

/* ---------- Closing ---------- */

function Closing({ accounts, start }: { accounts: boolean; start: Start }) {
  return (
    <section aria-labelledby="cta-title" className="px-2 py-24 sm:px-4 sm:py-32">
      {/* The hero's sky again, so the page ends where it began. */}
      <div className="lp-sky relative overflow-hidden rounded-[28px] sm:rounded-[44px]">
        <div aria-hidden="true" className="lp-ruled absolute inset-0" />
        <div className={cn(container, "relative py-16 sm:py-24")}>
      <Sheet fold={72} sheetClassName="rounded-[32px] bg-panel">
        <div className="flex flex-col items-start gap-8 px-6 py-14 sm:px-16 sm:py-20">
          <DovliMark size={44} />
          <h2 id="cta-title" className="m-0 max-w-[820px] text-balance font-serif text-[44px] font-semibold leading-[1] tracking-[-0.035em] text-ink sm:text-[76px]">
            Start with a blank page.
          </h2>
          <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className={cn(leadClass, "max-w-[460px]")}>
              {accounts ? "Free to use. Sign in with Google or a code we email you, no password needed." : "Your pages are saved on this device and work offline."}
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

/* ---------- Footer, ending on the name in the mark's colours ---------- */

function Footer({ accounts }: { accounts: boolean }) {
  return (
    <footer className="overflow-hidden border-t border-line">
      <div className={cn(container, "flex flex-col gap-10 pt-14 sm:flex-row sm:justify-between")}>
        <div className="flex max-w-[300px] flex-col gap-3">
          <DovliLogo size={30} tagline />
          <p className="m-0 text-sm text-ink-3">A calm place to write, plan and sketch.</p>
        </div>
        <div className="flex gap-16">
          <nav aria-label="Product" className="flex flex-col gap-2.5 text-sm">
            <span className="font-semibold text-ink">Product</span>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="rounded-sm text-ink-2 hover:text-ink">
                {l.label}
              </a>
            ))}
          </nav>
          {accounts && (
            <nav aria-label="Account" className="flex flex-col gap-2.5 text-sm">
              <span className="font-semibold text-ink">Account</span>
              <Link href={LOGIN_PATH} className="rounded-sm text-ink-2 hover:text-ink">
                Sign in
              </Link>
              <Link href={SIGNUP_PATH} className="rounded-sm text-ink-2 hover:text-ink">
                Create account
              </Link>
            </nav>
          )}
        </div>
      </div>
      <div className={cn(container, "mt-12 flex items-center justify-between gap-4 text-xs text-ink-3")}>
        <span>© {new Date().getFullYear()} Dovli</span>
        <Soon className="h-6 px-2.5 text-xs">Android app coming soon</Soon>
      </div>
      <div aria-hidden="true" className="lp-giant mt-6 select-none text-center font-display text-[30vw] font-bold leading-[0.78] tracking-[-0.06em] lg:text-[340px]">
        <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(100deg, #7DB4FF 0%, #A592FF 35%, #B57CF6 62%, #E39AEC 85%, #F6B9EE 100%)" }}>
          Dovli
        </span>
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
