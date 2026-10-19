"use client";

// The landing page's bigger sections: the feature story, templates, AI apps (MCP), and what's
// coming next (the browser extension and the Android app). Landing.tsx puts them in order.

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { templates } from "@dovli/core";
import { DovliMark, Icon, buttonStyles, cn, type IconName } from "@dovli/ui";
import { BlocksPicture, BoardPicture, FindPicture, LooksPicture, NestedPicture } from "./Pictures";
import { SIGNUP_PATH } from "@/lib/authGate";
import { trackEvent } from "@/lib/analytics";
import { useInView } from "./motion";
import { tone, type Tone } from "./tones";

export const container = "mx-auto w-full max-w-[1160px] px-4 sm:px-8";
/** One type scale for the whole page: hero 88, section 56, closing 64, step 30. */
export const h2Class = "m-0 text-balance font-serif text-[34px] font-semibold leading-[1.06] tracking-[-0.025em] sm:text-[44px] lg:text-[56px]";
export const h3Class = "m-0 text-balance font-serif text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]";
export const leadClass = "m-0 text-lg leading-relaxed text-ink-2";

export function Ticks({ items, className, t }: { items: string[]; className?: string; t?: Tone }) {
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-2.5 p-0", className)}>
      {items.map((d) => (
        <li key={d} className="flex items-start gap-2.5 text-md">
          <Icon name="check" size={16} aria-hidden="true" className={cn("mt-[3px] flex-none", !t && "text-accent")} style={t ? { color: tone(t).ink } : undefined} />
          {d}
        </li>
      ))}
    </ul>
  );
}

export function Soon({ children = "Coming soon", className, t }: { children?: ReactNode; className?: string; t?: Tone }) {
  return (
    <span
      className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-semibold", t ? "bg-panel/75" : "bg-accent-soft text-accent", className)}
      style={t ? { color: tone(t).ink } : undefined}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

/* ---------- Core features: a story that follows your scroll ---------- */

const steps: { id: string; title: string; text: string; details: string[]; picture: ReactNode; t: Tone; icon: IconName }[] = [
  {
    id: "blocks",
    t: "blue",
    icon: "pencil",
    title: "Type / for anything",
    text: "Headings, to-dos, tables, callouts, toggles, files and PDFs. Drag any block to move it, or turn it into another kind.",
    details: ["Markdown shortcuts as you type", "Find and replace, with regex when you need it"],
    picture: <BlocksPicture />,
  },
  {
    id: "nested",
    t: "lilac",
    icon: "page",
    title: "Pages inside pages",
    text: "A page can hold other pages, as deep as you like. A trip, a project or a whole course stays together, and the sidebar shows how it fits.",
    details: ["Link pages to each other and see what links back", "Star the pages you open every day"],
    picture: <NestedPicture />,
  },
  {
    id: "boards",
    t: "mint",
    icon: "board",
    title: "Sketch next to your notes",
    text: "Open a whiteboard when words aren't enough. Boxes, arrows, sticky notes and flowcharts, right beside the page they belong to.",
    details: ["Whiteboards live in your pages, not in another app", "Flowcharts you can edit, not pictures of them"],
    picture: <BoardPicture />,
  },
  {
    id: "looks",
    t: "butter",
    icon: "palette",
    title: "Give each page its own look",
    text: "Plain and clean, a book-like serif, or Starlight for late-night writing. Add a cover, pick a text size, and export to Word or PDF.",
    details: ["Light and dark app themes", "Every page style prints the way it looks"],
    picture: <LooksPicture />,
  },
  {
    id: "find",
    t: "pink",
    icon: "search",
    title: "Find anything in a second",
    text: "Press ⌘K to jump to any page, search the words inside every page, or filter by #tags. Your notes stay easy to reach as they grow.",
    details: ["Search inside every page, not only titles", "Tags you add as you write"],
    picture: <FindPicture />,
  },
];

export function Story() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  // The step nearest the middle of the screen is the one whose picture shows. Measured on every
  // scroll (once per frame), so fast scrolling and jumping to a section never leave them mismatched.
  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section id="features" aria-labelledby="features-title" className={cn(container, "scroll-mt-24")}>
      <div className="max-w-[760px]">
        <h2 id="features-title" className={h2Class}>
          Notes, docs and drawings, together
        </h2>
        <p className={cn(leadClass, "mt-5 max-w-[560px]")}>One home for all of it, so a thought can grow into a plan without moving apps.</p>
      </div>

      <div className="mt-12 grid gap-10 md:mt-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div>
          {steps.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-active={i === active}
              className="lp-step flex flex-col justify-center py-8 md:min-h-[56vh] md:py-0"
            >
              {/* The step you're on shows its colour; the others wait in grey. The text stays full strength. */}
              <span className="lp-step-icon mb-5 grid size-11 place-items-center rounded-lg" style={{ "--on-bg": tone(s.t).bg, "--on-ink": tone(s.t).ink } as CSSProperties} aria-hidden="true">
                <Icon name={s.icon} size={20} />
              </span>
              <h3 className={cn(h3Class, "text-ink")}>{s.title}</h3>
              <p className={cn(leadClass, "mt-4 max-w-[460px]")}>{s.text}</p>
              <Ticks items={s.details} t={s.t} className="mt-5 text-ink-2" />
              <div className="mt-8 rounded-[28px] p-4 sm:p-5 md:hidden" style={{ background: tone(s.t).bg }}>
                {s.picture}
              </div>
            </div>
          ))}
        </div>
        <div className="relative hidden md:block">
          {/* The panel takes on the colour of the step you're reading. */}
          <div
            className="lp-story-panel sticky top-24 grid h-[calc(100dvh-8rem)] max-h-[680px] items-center rounded-[36px] p-8 [grid-template-areas:'pic'] lg:p-12"
            style={{ background: tone(steps[active]!.t).bg }}
          >
            {steps.map((s, i) => (
              <div key={s.id} data-active={i === active} aria-hidden={i !== active} className="lp-story-pic [grid-area:pic]">
                {s.picture}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Templates ---------- */

const groupTone: Record<string, Tone> = { Work: "blue", Personal: "butter", Thinking: "pink" };

function TemplateCard({ t }: { t: (typeof templates)[number] }) {
  const c = tone(groupTone[t.group] ?? "lilac");
  return (
    <div className="flex w-[264px] flex-none flex-col gap-4 rounded-xl bg-panel p-5 shadow-card transition-transform duration-300 hover:-translate-y-1 sm:w-[288px]">
      <div className="flex items-center justify-between">
        <span className="grid size-14 place-items-center rounded-lg font-serif text-[34px] leading-none" style={{ background: c.bg, color: c.ink }} aria-hidden="true">
          {t.mark}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: c.ink }}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {t.group}
        </span>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-md font-semibold text-ink">
          {t.name}
          {t.kind === "board" && <Icon name="board" size={14} className="text-ink-3" aria-label="Whiteboard" />}
        </div>
        <p className="m-0 mt-1 text-base leading-relaxed text-ink-2">{t.description}</p>
      </div>
    </div>
  );
}

function Marquee({ items, reverse, duration, label }: { items: (typeof templates)[number][]; reverse?: boolean; duration: number; label: string }) {
  // Four copies so the row never runs out on wide screens; the copies are hidden from screen
  // readers, and only shown at all when the row moves (with less motion, the row just scrolls).
  // The row can take keyboard focus, which pauses it and lets the arrow keys scroll it.
  return (
    <div className="lp-marquee rounded-lg py-3" tabIndex={0} role="region" aria-label={label}>
      <div className="lp-marquee-track" data-reverse={reverse ? "" : undefined} style={{ "--dur": `${duration}s` } as CSSProperties}>
        {[0, 1, 2, 3].map((copy) => (
          <div key={copy} className={cn("flex gap-4", copy > 0 && "lp-copy")} aria-hidden={copy > 0 ? true : undefined}>
            {items.map((t) => (
              <TemplateCard key={t.id} t={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Templates({ start }: { start: { href: string; label: string } }) {
  const [paused, setPaused] = useState(false);
  const first = templates.slice(0, Math.ceil(templates.length / 2));
  const second = templates.slice(Math.ceil(templates.length / 2));
  return (
    <section id="templates" aria-labelledby="templates-title" className="scroll-mt-24" data-paused={paused ? "" : undefined}>
      <div className={cn(container, "flex flex-col gap-6 md:flex-row md:items-end md:justify-between")}>
        <div className="max-w-[640px]">
          <h2 id="templates-title" className={h2Class}>
            Start from a template
          </h2>
          <p className={cn(leadClass, "mt-5")}>Meeting notes, project briefs, weekly reviews, brainstorm boards and more. Pick one and make it yours.</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className={cn(buttonStyles({ variant: "ghost", size: "md" }), "lp-motion-only rounded-full")}
          >
            {paused ? (
              <Icon name="play" size={14} aria-hidden="true" />
            ) : (
              <span className="flex h-3 gap-[3px]" aria-hidden="true">
                <span className="w-[3px] rounded-[1px] bg-current" />
                <span className="w-[3px] rounded-[1px] bg-current" />
              </span>
            )}
            {paused ? "Play" : "Pause"}
          </button>
          <Link
            href={start.href}
            onClick={() => trackEvent(start.href === SIGNUP_PATH ? "Sign-up click" : "Open app click", { place: "templates" })}
            className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "rounded-full px-5")}
          >
            {start.label}
          </Link>
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-1">
        <Marquee items={first} duration={70} label="Templates, first row" />
        <Marquee items={second} duration={60} reverse label="Templates, second row" />
      </div>
    </section>
  );
}

/* ---------- AI apps through MCP ---------- */

const aiApps: { name: string; icon: IconName; x: number; y: number }[] = [
  { name: "Claude Desktop", icon: "monitor", x: 24, y: 12 },
  { name: "Claude Code", icon: "keyboard", x: 76, y: 12 },
  { name: "Codex", icon: "code", x: 22, y: 88 },
  { name: "Any MCP app", icon: "plug", x: 78, y: 88 },
];

const aiCan: { icon: IconName; text: string }[] = [
  { icon: "search", text: "Search and read your pages" },
  { icon: "pencil", text: "Write new pages and add to old ones" },
  { icon: "checkbox", text: "Tick off to-dos across every page" },
  { icon: "move", text: "Move, star and tidy pages" },
];

export function Mcp() {
  const { ref } = useInView<HTMLDivElement>(0.3);
  return (
    <section id="mcp" aria-labelledby="mcp-title" className="scroll-mt-20 px-2 sm:px-4">
      <div className="lp-starlight overflow-hidden rounded-[28px] sm:rounded-[44px]">
        <div className={cn(container, "grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16")}>
          <div>
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15">
              <Icon name="plug" size={13} aria-hidden="true" />
              Works with MCP
            </span>
            <h2 id="mcp-title" className={cn(h2Class, "mt-6 text-white")}>
              Your AI apps, working in your pages
            </h2>
            <p className="m-0 mt-5 max-w-[520px] text-lg leading-relaxed text-white/80">
              Dovli speaks MCP (Model Context Protocol, the open standard AI apps use to connect to other tools). Connect the AI app you already use, and ask it to work with your pages in plain words.
            </p>
            <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2">
              {aiCan.map((c) => (
                <li key={c.text} className="flex items-center gap-3 text-md text-white/90">
                  <span className="grid size-9 flex-none place-items-center rounded-md bg-white/10 ring-1 ring-white/10" aria-hidden="true">
                    <Icon name={c.icon} size={16} />
                  </span>
                  {c.text}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-8 max-w-[480px] text-base text-white/75">Nothing connects until you add it in Settings, and you can remove a connection any time.</p>
          </div>

          <div ref={ref} className="flex flex-col gap-5">
            {/* Hub: Dovli in the middle, AI apps around it, with data flowing along the lines. */}
            <div className="relative mx-auto aspect-[11/9] w-full max-w-[520px]" role="img" aria-label="Dovli in the middle, connected to Claude Desktop, Claude Code, Codex and any other MCP app.">
              <svg viewBox="0 0 110 90" className="absolute inset-0 size-full" fill="none" aria-hidden="true" preserveAspectRatio="none">
                {aiApps.map((a) => (
                  <path
                    key={a.name}
                    d={`M55 45 C ${55 + (a.x * 1.1 - 55) * 0.2} ${45 + (a.y * 0.9 - 45) * 0.9}, ${a.x * 1.1 + (55 - a.x * 1.1) * 0.6} ${a.y * 0.9}, ${a.x * 1.1} ${a.y * 0.9}`}
                    className="lp-flow"
                    stroke="rgba(255,255,255,0.45)"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: 1.5 }}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-[104px] -translate-x-1/2 -translate-y-1/2 place-items-center sm:size-[124px]">
                <span className="lp-pulse absolute inset-0 rounded-full bg-[#a592ff]/40" />
                <span className="absolute inset-[10px] rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-sm" />
                <DovliMark size={52} className="relative" />
              </div>
              {aiApps.map((a, i) => (
                <div
                  key={a.name}
                  aria-hidden="true"
                  className="lp-seq absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-md sm:px-3 sm:py-2 sm:text-sm"
                  style={{ left: `${a.x}%`, top: `${a.y}%`, "--d": `${0.15 + i * 0.12}s` } as CSSProperties}
                >
                  <Icon name={a.icon} size={14} />
                  {a.name}
                </div>
              ))}
            </div>

            {/* A short chat, played in when you reach it. */}
            <div className="flex flex-col gap-3 rounded-[18px] bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-md sm:p-5">
              <p className="lp-seq m-0 ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-white/15 px-4 py-2.5 text-base text-white" style={{ "--d": "0.7s" } as CSSProperties}>
                Turn today&apos;s meeting notes into to-dos on Launch plan.
              </p>
              <p className="lp-seq m-0 flex items-center gap-2 text-sm text-white/75" style={{ "--d": "1.3s" } as CSSProperties}>
                <DovliMark size={14} />
                Searched your pages, read Meeting notes, added 3 to-dos
              </p>
              <p className="lp-seq m-0 max-w-[90%] text-base leading-relaxed text-white/90" style={{ "--d": "1.9s" } as CSSProperties}>
                Done. Launch plan now has three new to-dos: send the press kit, book the demo room, and invite the first 200 people.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Coming next: the browser extension and the Android app ---------- */

function BrowserDemo({ replay, inViewRef }: { replay: () => void; inViewRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <>
      <div
        ref={inViewRef}
        className="relative overflow-hidden rounded-[18px] bg-panel shadow-pop"
        role="img"
        aria-label="A web article in the browser. A sentence is highlighted, the Dovli clipper opens with the quote and Reading notes chosen, and a message says it was saved to Reading notes."
      >
        <div aria-hidden="true" className="flex h-11 items-center gap-3 border-b border-line bg-well px-4">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-line-strong" />
            ))}
          </span>
          <span className="mx-auto flex h-7 min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-md bg-panel px-3 text-xs text-ink-3 shadow-sm">
            <Icon name="lock" size={11} />
            <span className="truncate">fieldnotes.blog/why-the-tide-turns</span>
          </span>
          <span className="grid size-7 place-items-center rounded-md bg-panel shadow-sm">
            <DovliMark size={15} />
          </span>
        </div>
        <div aria-hidden="true" className="px-5 pb-24 pt-7 sm:px-8 sm:pb-24">
          <div className="text-xs text-ink-3">Field notes, 8 min read</div>
          <div className="mt-2 max-w-[260px] font-serif text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-[26px]">Why the tide turns twice a day</div>
          <p className="m-0 mt-4 font-serif text-[15px] leading-[1.75] text-ink-2">
            The moon pulls the sea towards it, but that&apos;s only half the story.{" "}
            <span className="lp-hl text-ink">The Earth is pulled too, so the water on the far side gets left behind</span>, and that second bulge is why there are two high tides.
          </p>
        </div>
        <div aria-hidden="true" className="lp-clipper absolute right-3 top-14 w-[208px] rounded-xl p-3 surface-raised">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <DovliMark size={16} />
            Clip to Dovli
          </div>
          <p className="m-0 mt-3 border-l-2 border-accent pl-3 font-serif text-[13px] italic leading-snug text-ink-2">The Earth is pulled too, so the water on the far side gets left behind</p>
          <div className="mt-3 flex h-9 items-center gap-2 rounded-md bg-well px-2.5 text-sm text-ink shadow-sm">
            <Icon name="page" size={14} className="text-accent" />
            Reading notes
            <Icon name="chevronDown" size={13} className="ml-auto text-ink-3" />
          </div>
          <div className={cn(buttonStyles({ variant: "primary", size: "md", block: true }), "lp-clip-btn mt-3")}>Save clip</div>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-5 flex justify-center px-4">
          <div className="lp-saved flex items-center gap-2.5 rounded-full bg-ink py-2 pl-3 pr-4 text-sm font-medium text-bg shadow-pop">
            <span className="grid size-5 place-items-center rounded-full bg-[var(--lp-mint-ink)] text-white">
              <Icon name="check" size={12} />
            </span>
            Saved to Reading notes
          </div>
        </div>
      </div>
      <button type="button" onClick={replay} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "lp-motion-only mx-auto mt-3 rounded-full")}>
        <Icon name="restore" size={15} />
        Play the demo again
      </button>
    </>
  );
}

/** An Android phone: even bezels, a punch-hole camera, time on the left and status icons on the right. */
function Phone() {
  const recent = [
    { title: "Launch plan", meta: "Edited 5 min ago", lines: [88, 64] },
    { title: "Kyoto trip", meta: "Edited yesterday", lines: [72, 80] },
    { title: "Reading notes", meta: "Edited Monday", lines: [90, 56] },
  ];
  return (
    <div className="relative mx-auto w-[260px]">
      <div className="rounded-[38px] bg-[#17181d] p-[7px] shadow-pop ring-1 ring-line-strong">
        <div className="relative h-[520px] overflow-hidden rounded-[32px] bg-bg">
          <div className="relative flex h-9 items-center justify-between px-6 text-[11px] font-semibold text-ink">
            <span>9:30</span>
            <span className="absolute left-1/2 top-2.5 size-3 -translate-x-1/2 rounded-full bg-[#0b0c10]" />
            <span className="flex items-center gap-1">
              <span className="flex h-2.5 items-end gap-[2px]">
                {[40, 65, 100].map((h) => (
                  <span key={h} className="w-[3px] rounded-[1px] bg-ink" style={{ height: `${h}%` }} />
                ))}
              </span>
              <span className="h-2.5 w-[18px] rounded-[2px] border border-ink p-[1px]">
                <span className="block h-full w-3/4 rounded-[1px] bg-ink" />
              </span>
            </span>
          </div>
          <div className="px-4 pt-4">
            <div className="text-xs text-ink-3">Monday, 19 October</div>
            <div className="mt-1 text-[24px] font-bold tracking-tight text-ink">Good morning</div>
            <div className="mt-3 flex h-10 items-center gap-2 rounded-full bg-panel px-4 text-sm text-ink-3 shadow-sm">
              <Icon name="search" size={14} />
              Search pages
            </div>
            <div className="mb-2 mt-5 text-xs font-semibold text-ink-3">Recent</div>
            <div className="flex flex-col gap-2.5">
              {recent.map((r) => (
                <div key={r.title} className="rounded-[18px] bg-panel p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Icon name="page" size={14} className="text-accent" />
                    {r.title}
                  </div>
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {r.lines.map((w, i) => (
                      <span key={i} className="block h-1.5 rounded-full bg-line-strong/70" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <div className="mt-2.5 text-2xs text-ink-3">{r.meta}</div>
                </div>
              ))}
            </div>
          </div>
          <span className="absolute bottom-7 right-4 grid size-14 place-items-center rounded-[18px] bg-primary text-primary-ink shadow-pop">
            <Icon name="plus" size={22} />
          </span>
          <span className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-ink/70" />
        </div>
      </div>
      <div className="lp-float absolute -left-10 top-[250px] hidden items-center gap-2.5 rounded-[18px] px-3.5 py-3 text-sm surface-raised sm:flex">
        <span className="grid size-8 place-items-center rounded-lg" style={{ background: tone("mint").bg, color: tone("mint").ink }}>
          <Icon name="cloudCheck" size={16} />
        </span>
        <span>
          <span className="block font-semibold text-ink">Synced with the web</span>
          <span className="block text-xs text-ink-3">Kept for offline</span>
        </span>
      </div>
    </div>
  );
}

function ComingCard({ t, kicker, title, text, details, children }: { t: Tone; kicker: string; title: string; text: string; details: string[]; children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[28px] sm:rounded-[36px]" style={{ background: tone(t).bg }}>
      <div className="px-6 pt-8 sm:px-10 sm:pt-10">
        <Soon t={t}>{kicker}</Soon>
        <h3 className={cn(h3Class, "mt-5 text-ink")}>{title}</h3>
        <p className="m-0 mt-3 max-w-[460px] text-md leading-relaxed text-ink-2">{text}</p>
        <Ticks t={t} items={details} className="mt-5 text-ink-2" />
      </div>
      <div className="mt-auto px-4 pt-10 sm:px-10">{children}</div>
    </div>
  );
}

export function Coming() {
  const { ref, replay } = useInView<HTMLDivElement>(0.45);
  return (
    <section id="coming" aria-labelledby="coming-title" className={cn(container, "scroll-mt-24")}>
      <div className="max-w-[640px]">
        <h2 id="coming-title" className={h2Class}>
          Coming next
        </h2>
        <p className={cn(leadClass, "mt-5")}>Two more ways into the same pages. Both are on the way; everything you write on the web today will be there when they land.</p>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-2 lg:gap-6">
        <ComingCard
          t="sky"
          kicker="Browser extension, coming soon"
          title="Clip the web into Dovli"
          text="Highlight a passage while you read, pick a page, and it's saved, with a link back to where you found it."
          details={["Save a quote, a link, an image or the whole article", "Choose which page each clip goes to"]}
        >
          <div className="pb-6 sm:pb-8">
            <BrowserDemo replay={replay} inViewRef={ref} />
          </div>
        </ComingCard>
        <ComingCard
          t="mint"
          kicker="Android app, coming soon"
          title="Dovli for Android"
          text="Your pages in your pocket. Jot something down on the train, and find it waiting on the web when you sit down."
          details={["The same editor as on the web", "Keeps working without signal, then syncs"]}
        >
          <div className="flex flex-col items-center">
            <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-panel/75 px-3.5 py-1.5 text-sm font-semibold" style={{ color: tone("mint").ink }}>
              <Icon name="play" size={14} aria-hidden="true" />
              Coming to Google Play
            </span>
            {/* The phone rises out of the bottom edge of the card. */}
            <div className="lp-phone -mb-24" role="img" aria-label="The Dovli Android app's home screen, with recent pages and a button to add a new one.">
              <div aria-hidden="true">
                <Phone />
              </div>
            </div>
          </div>
        </ComingCard>
      </div>
    </section>
  );
}
