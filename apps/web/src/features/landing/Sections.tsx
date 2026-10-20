"use client";

// The landing page's bigger sections: the features, templates, AI (the assistant, and your own AI
// apps through MCP), and what's coming next (the browser extension). Landing.tsx puts them in
// order; the Android section lives in Android.tsx.

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { templates } from "@dovli/core";
import { DovliMark, Icon, buttonStyles, cn, type IconName } from "@dovli/ui";
import { BlocksPicture, BoardPicture, FindPicture, LooksPicture, NestedPicture } from "./Pictures";
import { SIGNUP_PATH } from "@/lib/authGate";
import { trackEvent } from "@/lib/analytics";
import { prefersLessMotion, useInView } from "./motion";
import { Sheet } from "./Sheet";
import { tone, type Tone } from "./tones";

export const container = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";
/** One type scale for the whole page: hero 88, section 56, closing 60, step 30. */
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

/** A small status pill: "Coming soon", "Now on Google Play". */
export function Status({ children, className, t }: { children: ReactNode; className?: string; t?: Tone }) {
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

/* ---------- Core features ---------- */

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

const iconTone = (t: Tone) => ({ "--on-bg": tone(t).bg, "--on-ink": tone(t).ink }) as CSSProperties;

/**
 * On phones, every feature in turn with its picture. On wider screens, a short list beside one
 * picture panel, so all five fit on one screen: the features take turns once while the section is
 * in view (paused while pointed at or focused), and picking one stops the tour.
 */
export function Features() {
  const [active, setActive] = useState(0);
  const [touring, setTouring] = useState(true);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pick = (i: number) => {
    setTouring(false);
    setActive(i);
  };
  const advance = () => {
    if (prefersLessMotion()) return;
    const next = (active + 1) % steps.length;
    setActive(next);
    if (next === 0) setTouring(false);
  };
  const current = steps[active]!;

  return (
    <section id="features" aria-labelledby="features-title" className={container}>
      <div className="md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 lg:gap-14">
        <div>
          <h2 id="features-title" className={h2Class}>
            Notes, docs and drawings, together
          </h2>
          <p className={cn(leadClass, "mt-5 max-w-[520px]")}>One home for all of it, so a thought can grow into a plan without moving apps.</p>

          <div className="mt-4 md:hidden">
            {steps.map((s) => (
              <div key={s.id} className="flex flex-col py-8">
                <span className="lp-step-icon mb-5 grid size-11 place-items-center rounded-lg" style={iconTone(s.t)} aria-hidden="true">
                  <Icon name={s.icon} size={20} />
                </span>
                <h3 className={cn(h3Class, "text-ink")}>{s.title}</h3>
                <p className={cn(leadClass, "mt-4")}>{s.text}</p>
                <Ticks items={s.details} t={s.t} className="mt-5 text-ink-2" />
                <div className="mt-8 rounded-[28px] p-4 sm:p-5" style={{ background: tone(s.t).bg }}>
                  {s.picture}
                </div>
              </div>
            ))}
          </div>

          <div
            ref={listRef}
            className="mt-9 hidden flex-col gap-1.5 md:flex"
            data-held={held || !visible ? "" : undefined}
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
          >
            {steps.map((s, i) => {
              const on = i === active;
              return (
                <div key={s.id} data-active={on} className="lp-acc relative rounded-[20px]" style={iconTone(s.t)}>
                  <h3 className="m-0">
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls={`feature-${s.id}`}
                      onClick={() => pick(i)}
                      className="flex w-full items-center gap-4 rounded-[20px] px-4 py-3 text-left text-md font-semibold text-ink focus-visible:outline-offset-[-2px] lg:text-lg"
                    >
                      <span className="lp-step-icon grid size-10 flex-none place-items-center rounded-lg" aria-hidden="true">
                        <Icon name={s.icon} size={18} />
                      </span>
                      {s.title}
                    </button>
                  </h3>
                  <div id={`feature-${s.id}`} className="lp-acc-body" aria-hidden={!on}>
                    <div className="min-h-0 overflow-hidden">
                      <p className="m-0 pb-7 pl-[72px] pr-6 text-md leading-relaxed text-ink-2">{s.text}</p>
                    </div>
                  </div>
                  {on && touring && <span key={active} className="lp-acc-progress" onAnimationEnd={advance} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* The panel takes on the colour of the feature you're on. */}
        <div className="hidden md:block">
          <div className="lp-story-panel flex h-full min-h-[540px] flex-col rounded-[36px] p-8 lg:p-10" style={{ background: tone(current.t).bg }}>
            <div className="grid flex-1 items-center [grid-template-areas:'pic']">
              {steps.map((s, i) => (
                <div key={s.id} data-active={i === active} aria-hidden={i !== active} className="lp-story-pic [grid-area:pic]">
                  {s.picture}
                </div>
              ))}
            </div>
            <div className="mt-6 grid [grid-template-areas:'more']">
              {steps.map((s, i) => (
                <div key={s.id} data-active={i === active} aria-hidden={i !== active} className="lp-story-pic [grid-area:more]">
                  <Ticks items={s.details} t={s.t} className="flex-row flex-wrap gap-x-6 gap-y-2 text-ink" />
                </div>
              ))}
            </div>
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
    <section id="templates" aria-labelledby="templates-title" data-paused={paused ? "" : undefined}>
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
      <div className="mt-8 flex flex-col gap-1">
        <Marquee items={first} duration={70} label="Templates, first row" />
        <Marquee items={second} duration={60} reverse label="Templates, second row" />
      </div>
    </section>
  );
}

/* ---------- AI: the assistant beside your page, and your own AI apps through MCP ---------- */

// The changes the assistant suggests, worded the way the app words them (lib/assistantCore.ts).
const suggestions: { icon: IconName; label: string; preview?: string }[] = [
  { icon: "summary", label: "Add a summary at the top", preview: "Beta opens 14 November. Three to-dos left before then." },
  { icon: "pencil", label: "Fix the wording", preview: "“recieve” → “receive”" },
  { icon: "board", label: "Turn a block into a flowchart" },
];

function AssistantPicture() {
  return (
    <Sheet
      fold={36}
      sheetClassName="rounded-[22px] bg-raised"
      label="The assistant beside a page. Asked to tidy the page and add a summary, it suggests three changes to check before applying: a summary at the top, a spelling fix, and a flowchart."
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent">
          <Icon name="sparkles" size={14} />
        </span>
        <span className="text-sm font-semibold text-ink">Assistant</span>
        <span className="ml-auto mr-6 flex rounded-full bg-well p-0.5 text-xs font-medium">
          <span className="rounded-full bg-panel px-2.5 py-1 text-ink shadow-sm">Suggest</span>
          <span className="px-2.5 py-1 text-ink-3">Edit</span>
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <p className="lp-seq m-0 ml-auto max-w-[85%] rounded-[16px] rounded-br-md bg-accent px-3.5 py-2 text-sm text-accent-ink" style={{ "--d": "0.25s" } as CSSProperties}>
          Tidy this page and add a short summary at the top.
        </p>
        <p className="lp-seq m-0 text-sm text-ink-2" style={{ "--d": "0.8s" } as CSSProperties}>
          Here&apos;s what I&apos;d change. Check each one, then apply.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {suggestions.map((s, i) => (
            <li key={s.label} className="lp-seq flex items-center gap-3 rounded-[14px] bg-well px-3 py-2.5" style={{ "--d": `${1.15 + i * 0.3}s` } as CSSProperties}>
              <span className="grid size-7 flex-none place-items-center rounded-md bg-panel text-accent shadow-sm">
                <Icon name={s.icon} size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{s.label}</span>
                {s.preview && <span className="block truncate text-xs text-ink-3">{s.preview}</span>}
              </span>
              <span className="grid size-6 flex-none place-items-center rounded-full bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]">
                <Icon name="check" size={12} />
              </span>
            </li>
          ))}
        </ul>
        <div className="lp-seq flex items-center gap-3 pt-1" style={{ "--d": "2.2s" } as CSSProperties}>
          <span className={cn(buttonStyles({ variant: "primary", size: "sm" }), "rounded-full px-3.5")}>Apply all</span>
          <span className="text-xs text-ink-3">One undo takes it all back</span>
        </div>
      </div>
    </Sheet>
  );
}

const aiApps: { name: string; icon: IconName; x: number; y: number }[] = [
  { name: "Claude Desktop", icon: "monitor", x: 20, y: 14 },
  { name: "Claude Code", icon: "keyboard", x: 80, y: 14 },
  { name: "Codex", icon: "code", x: 18, y: 86 },
  { name: "Any MCP app", icon: "plug", x: 82, y: 86 },
];

function McpPicture() {
  return (
    <div className="flex flex-col gap-4">
      {/* Hub: Dovli in the middle, AI apps around it, with data flowing along the lines. */}
      <div className="relative aspect-[5/2] w-full" role="img" aria-label="Dovli in the middle, connected to Claude Desktop, Claude Code, Codex and any other MCP app.">
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
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-[88px] -translate-x-1/2 -translate-y-1/2 place-items-center sm:size-[104px]">
          <span className="lp-pulse absolute inset-0 rounded-full bg-[#a592ff]/40" />
          <span className="absolute inset-[9px] rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-sm" />
          <DovliMark size={44} className="relative" />
        </div>
        {aiApps.map((a, i) => (
          <div
            key={a.name}
            aria-hidden="true"
            className="lp-seq absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-md sm:px-3 sm:text-sm"
            style={{ left: `${a.x}%`, top: `${a.y}%`, "--d": `${0.15 + i * 0.12}s` } as CSSProperties}
          >
            <Icon name={a.icon} size={14} />
            {a.name}
          </div>
        ))}
      </div>

      {/* A short chat, played in when you reach it. */}
      <div className="flex flex-col gap-3 rounded-[18px] bg-white/[0.06] p-4 ring-1 ring-white/10 sm:p-5">
        <p className="lp-seq m-0 ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-white/15 px-4 py-2.5 text-base text-white" style={{ "--d": "0.7s" } as CSSProperties}>
          Turn today&apos;s meeting notes into to-dos on Launch plan.
        </p>
        <p className="lp-seq m-0 flex items-center gap-2 text-sm text-white/75" style={{ "--d": "1.3s" } as CSSProperties}>
          <DovliMark size={14} />
          Searched your pages, read Meeting notes, added 3 to-dos
        </p>
        <p className="lp-seq m-0 max-w-[92%] text-base leading-relaxed text-white/90" style={{ "--d": "1.9s" } as CSSProperties}>
          Done. Launch plan now has three new to-dos: send the press kit, book the demo room, and invite the first 200 people.
        </p>
      </div>
    </div>
  );
}

export function Ai() {
  const { ref } = useInView<HTMLDivElement>(0.25);
  return (
    <section id="mcp" aria-labelledby="ai-title" className="px-2 sm:px-4">
      <div className="lp-starlight overflow-hidden rounded-[28px] sm:rounded-[44px]">
        <div ref={ref} className={cn(container, "py-16 sm:py-24")}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div className="max-w-[620px]">
              <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15">
                <Icon name="sparkles" size={13} aria-hidden="true" />
                AI, when you ask for it
              </span>
              <h2 id="ai-title" className={cn(h2Class, "mt-6 text-white")}>
                AI that works in your pages
              </h2>
            </div>
            <p className="m-0 max-w-[460px] text-lg leading-relaxed text-white/80">
              Ask the assistant beside your page, or connect the AI app you already use. In Suggest mode, every change waits for your OK.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-14 lg:mt-14 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col">
              <h3 className="m-0 text-xl font-semibold text-white">An assistant beside every page</h3>
              <p className="m-0 mt-2 max-w-[500px] text-md leading-relaxed text-white/75">
                Summarise a page, check its spelling, clarity and tone, or turn a list into a flowchart. A monthly AI allowance comes with your account, or use your own OpenAI, Anthropic, Groq or OpenRouter key.
              </p>
              <div className="mt-7">
                <AssistantPicture />
              </div>
            </div>
            <div className="flex flex-col">
              <h3 className="m-0 text-xl font-semibold text-white">Your AI apps, through MCP</h3>
              <p className="m-0 mt-2 max-w-[500px] text-md leading-relaxed text-white/75">
                Connect Claude Desktop, Claude Code, Codex or any MCP app, and ask it to search, write, tick off or tidy your pages in plain words. Nothing connects until you add it in Settings.
              </p>
              <div className="mt-7">
                <McpPicture />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Coming next: the browser extension ---------- */

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

export function Coming() {
  const { ref, replay } = useInView<HTMLDivElement>(0.45);
  return (
    <section id="coming" aria-labelledby="coming-title" className={container}>
      <div className="grid grid-cols-1 items-center overflow-hidden rounded-[28px] sm:rounded-[36px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" style={{ background: tone("sky").bg }}>
        <div className="px-6 pt-8 sm:px-10 sm:pt-10 lg:py-14 lg:pl-14 lg:pr-4">
          <Status t="sky">Browser extension, coming soon</Status>
          <h2 id="coming-title" className={cn(h3Class, "mt-5 text-ink")}>
            Clip the web into Dovli
          </h2>
          <p className="m-0 mt-3 max-w-[440px] text-md leading-relaxed text-ink-2">
            Highlight a passage while you read, pick a page, and it&apos;s saved, with a link back to where you found it. Everything you write today will be there when it lands.
          </p>
          <Ticks t="sky" items={["Save a quote, a link, an image or the whole article", "Choose which page each clip goes to"]} className="mt-5 text-ink-2" />
        </div>
        <div className="flex flex-col px-4 pb-5 pt-8 sm:px-10 sm:pb-8 lg:py-12 lg:pl-6 lg:pr-12">
          <BrowserDemo replay={replay} inViewRef={ref} />
        </div>
      </div>
    </section>
  );
}
