"use client";

// Pictures of Dovli for the landing page, drawn with the app's own tokens (so they follow the
// theme) instead of screenshots. Most are announced as a single picture with a short
// description; the hero's to-dos are real buttons you can tick.

import { useEffect, useState } from "react";
import { Icon, cn, type IconName } from "@dovli/ui";
import { prefersLessMotion } from "./motion";
import { Sheet } from "./Sheet";

/* ---------- Hero: the app, with a page open and the "/" menu showing ---------- */

const tree: { title: string; depth: number; active?: boolean; open?: boolean }[] = [
  { title: "Launch plan", depth: 0, active: true, open: true },
  { title: "Press kit", depth: 1 },
  { title: "Beta interviews", depth: 1 },
  { title: "Kyoto trip", depth: 0 },
  { title: "Reading notes", depth: 0 },
  { title: "Product map", depth: 0 },
];

const slashItems: { label: string; icon: IconName; hint: string }[] = [
  { label: "To-do list", icon: "checkbox", hint: "[]" },
  { label: "Heading", icon: "textSize", hint: "#" },
  { label: "Whiteboard", icon: "board", hint: "" },
  { label: "Page inside this page", icon: "pagePlus", hint: "" },
];

const todos = ["Write the welcome email", "Record a one-minute demo", "Invite the first 200 people"];

function CheckBox({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[3px] grid size-[16px] flex-none place-items-center rounded-[5px] transition-[background-color,box-shadow] duration-200",
        done ? "bg-accent text-accent-ink" : "shadow-[inset_0_0_0_1.5px_var(--d-line-strong)] group-hover:shadow-[inset_0_0_0_1.5px_var(--d-accent)]",
      )}
    >
      {done && <Icon name="check" size={11} />}
    </span>
  );
}

/** The hero picture. The to-dos really tick, and the "/" menu follows the pointer. */
export function HeroPicture() {
  const [done, setDone] = useState([true, true, false]);
  const [hi, setHi] = useState(0);
  const [hover, setHover] = useState(false);

  // The menu's highlight walks down the list, like someone choosing a block. It stops while pointed at.
  useEffect(() => {
    if (hover || prefersLessMotion()) return;
    const id = setInterval(() => setHi((i) => (i + 1) % slashItems.length), 1600);
    return () => clearInterval(id);
  }, [hover]);

  return (
    <Sheet fold={56} sheetClassName="rounded-[22px] bg-panel">
      <div className="flex h-[520px] text-left sm:h-[580px]">
        {/* Sidebar */}
        <div aria-hidden="true" className="hidden w-[232px] flex-none flex-col gap-0.5 border-r border-line bg-well/60 p-3 md:flex">
          <div className="mb-2 flex h-8 items-center gap-2 rounded-md bg-panel px-2.5 text-sm text-ink-4 shadow-sm">
            <Icon name="search" size={14} />
            Search
            <span className="ml-auto text-2xs text-ink-4">⌘K</span>
          </div>
          {(
            [
              ["home", "Home"],
              ["viewCards", "All pages"],
              ["templates", "Templates"],
            ] as const
          ).map(([icon, title]) => (
            <div key={title} className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-sm text-ink-2">
              <Icon name={icon} size={15} className="text-ink-3" />
              {title}
            </div>
          ))}
          <div className="mb-1 mt-4 px-2.5 text-xs font-semibold text-ink-3">Pages</div>
          {tree.map((t) => (
            <div
              key={t.title}
              className={cn("flex h-8 items-center gap-2 rounded-sm pr-2.5 text-sm", t.active ? "bg-active font-semibold text-active-ink" : "text-ink-2")}
              style={{ paddingLeft: 10 + t.depth * 18 }}
            >
              <Icon name={t.open ? "chevronDown" : t.depth ? "page" : "chevron"} size={13} className={cn(!t.active && "text-ink-4")} />
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>

        {/* The page */}
        <div className="relative min-w-0 flex-1 px-6 pt-6 sm:px-12 sm:pt-10 lg:px-16">
          <div aria-hidden="true" className="flex items-center gap-1.5 text-xs text-ink-3">
            <Icon name="page" size={13} />
            Launch plan
          </div>
          <p className="m-0 mt-5 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">Launch plan</p>
          <p className="m-0 mt-3 max-w-[520px] text-[15px] leading-relaxed text-ink-2">
            Public beta opens on 14 November. Keep the first week quiet, talk to people, and fix what they trip over.
          </p>
          <ul className="m-0 mt-4 flex list-none flex-col gap-1 p-0 text-[15px] text-ink">
            {todos.map((t, i) => (
              <li key={t}>
                <button
                  type="button"
                  aria-pressed={done[i]}
                  onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
                  className="group -mx-1.5 flex items-start gap-2.5 rounded-sm px-1.5 py-0.5 text-left hover:bg-hover"
                >
                  <CheckBox done={!!done[i]} />
                  <span className={cn("transition-colors duration-200", done[i] && "text-ink-3 line-through decoration-line-strong")}>{t}</span>
                </button>
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="mt-5 flex max-w-[320px] items-center gap-3 rounded-lg bg-well px-3.5 py-3 shadow-sm">
            <span className="grid size-8 flex-none place-items-center rounded-md bg-accent-soft text-accent">
              <Icon name="page" size={15} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">Press kit</span>
              <span className="block text-xs text-ink-3">4 pages inside</span>
            </span>
          </div>
          <div aria-hidden="true" className="relative mt-5 flex h-6 items-center text-[15px] text-ink">
            /<span className="lp-caret ml-px inline-block h-[18px] w-[1.5px] bg-accent" />
            <div
              className="lp-fade absolute left-0 top-8 z-10 w-[248px] rounded-lg p-1.5 surface-raised"
              style={{ "--d": "1.2s" } as React.CSSProperties}
              onPointerEnter={() => setHover(true)}
              onPointerLeave={() => setHover(false)}
            >
              <div className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-ink-3">Add a block</div>
              {slashItems.map((it, i) => (
                <div
                  key={it.label}
                  onPointerEnter={() => setHi(i)}
                  className={cn("lp-slash-row flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-sm", i === hi ? "bg-active text-active-ink" : "text-ink")}
                >
                  <Icon name={it.icon} size={15} className={i === hi ? "" : "text-ink-3"} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="text-2xs text-ink-4">{it.hint}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Blocks ---------- */

const specRows = [
  ["Sign in with Google", "Mayank", "Done"],
  ["Email sign-in codes", "Priya", "Done"],
  ["Share a page", "Mayank", "In review"],
];

export function BlocksPicture() {
  return (
    <Sheet fold={40} sheetClassName="rounded-[20px] bg-panel" label="A page called Product spec with a callout, a table of features with owners and status, and a folded toggle.">
      <div className="p-6 sm:p-8">
        <h3 className="m-0 text-2xl font-bold tracking-tight text-ink">Product spec</h3>
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink">
          <Icon name="callout" size={15} className="mt-0.5 flex-none text-accent" />
          Ship the smallest version people would miss if it went away.
        </div>
        <div className="mt-4 overflow-hidden rounded-lg shadow-sm">
          <div className="grid grid-cols-[1.6fr_1fr_1fr] bg-well text-xs font-semibold text-ink-3">
            {["Feature", "Owner", "Status"].map((h) => (
              <span key={h} className="px-3 py-2">
                {h}
              </span>
            ))}
          </div>
          {specRows.map((r) => (
            <div key={r[0]} className="grid grid-cols-[1.6fr_1fr_1fr] items-center border-t border-line text-sm text-ink">
              <span className="truncate px-3 py-2.5">{r[0]}</span>
              <span className="truncate px-3 py-2.5 text-ink-2">{r[1]}</span>
              <span className="px-3 py-2">
                <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2 text-xs font-medium", r[2] === "Done" ? "bg-well text-ok" : "bg-accent-soft text-accent")}>
                  {r[2]}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name="chevron" size={13} className="text-ink-3" />
          Open questions
          <span className="font-normal text-ink-4">3 inside</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Find anything ---------- */

const findResults = [
  { title: "Kyoto trip", before: "Ten days in ", match: "Kyoto", after: " in October" },
  { title: "Where to eat", before: "Ramen near ", match: "Kyoto", after: " station, opens at 11" },
  { title: "Reading notes", before: "", match: "Kyoto", after: ": the city of a thousand shrines" },
];

export function FindPicture() {
  return (
    <Sheet fold={40} sheetClassName="rounded-[20px] bg-well" label="The search box with kyoto typed in, showing three pages with the matching word highlighted.">
      <div className="relative h-[360px] p-5 sm:p-8">
        <div className="flex flex-col gap-3 opacity-60">
          {[70, 92, 60, 84, 76, 50, 66].map((w, i) => (
            <span key={i} className="block h-2 rounded-full bg-line-strong" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="absolute inset-x-4 top-8 rounded-xl p-2 surface-raised sm:inset-x-10">
          <div className="flex h-11 items-center gap-2.5 border-b border-line px-3 text-md text-ink">
            <Icon name="search" size={16} className="text-ink-3" />
            <span>
              kyoto
              <span className="lp-caret ml-px inline-block h-[18px] w-[1.5px] translate-y-[3px] bg-accent" />
            </span>
          </div>
          <div className="flex flex-col py-1.5">
            {findResults.map((r, i) => (
              <div key={r.title} className={cn("flex items-start gap-3 rounded-md px-3 py-2", i === 0 && "bg-active")}>
                <Icon name="page" size={15} className={cn("mt-0.5 flex-none", i === 0 ? "text-active-ink" : "text-ink-3")} />
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold", i === 0 ? "text-active-ink" : "text-ink")}>{r.title}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {r.before}
                    <mark className="rounded-[3px] bg-accent-soft px-0.5 text-ink">{r.match}</mark>
                    {r.after}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-line px-3 pb-1 pt-2.5 text-xs text-ink-3">
            <span className="rounded-full bg-well px-2 py-0.5 text-ink-2">#travel</span>
            <span className="rounded-full bg-well px-2 py-0.5 text-ink-2">#2026</span>
            <span className="ml-auto">Enter to open</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Pages inside pages ---------- */

const tripPages = [
  { title: "Day 1, Higashiyama", lines: [92, 70, 84] },
  { title: "Where to eat", lines: [80, 88, 54] },
  { title: "Packing list", lines: [64, 76, 70] },
  { title: "Bookings", lines: [86, 58, 74] },
];

export function NestedPicture() {
  return (
    <Sheet fold={40} sheetClassName="rounded-[20px] bg-panel" label="A page called Kyoto trip holding four smaller pages: Day 1, Where to eat, Packing list and Bookings.">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-1.5 text-xs text-ink-3">
          Trips
          <Icon name="chevron" size={11} className="text-ink-4" />
          Kyoto trip
        </div>
        <h3 className="m-0 mt-3 text-2xl font-bold tracking-tight text-ink">Kyoto trip</h3>
        <p className="m-0 mt-1.5 text-sm text-ink-2">Ten days in October. Everything for the trip lives in here.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {tripPages.map((p) => (
            <div key={p.title} className="rounded-lg bg-well p-3.5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="page" size={14} className="flex-none text-accent" />
                <span className="truncate">{p.title}</span>
              </div>
              <div className="mt-3 flex flex-col gap-1.5" aria-hidden="true">
                {p.lines.map((w, i) => (
                  <span key={i} className="block h-[5px] rounded-full bg-line-strong/70" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Whiteboard ---------- */

export function BoardPicture() {
  // Slightly wobbly lines, so it reads as a sketch rather than a chart.
  const stroke = "var(--d-ink-2)";
  return (
    <Sheet fold={40} sheetClassName="rounded-[20px] bg-panel" label="A whiteboard sketch: three boxes, Idea, First draft and Share, joined by arrows, with a sticky note beside them.">
      <div
        className="relative h-[300px] sm:h-[340px]"
        style={{ backgroundImage: "radial-gradient(var(--d-line-strong) 1px, transparent 1.4px)", backgroundSize: "18px 18px" }}
      >
        <svg viewBox="0 0 520 340" className="absolute inset-0 size-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke={stroke} strokeWidth="2">
            <path d="M44 62c40-2 82-1 118 1 2 18 1 36-1 52-38 2-78 1-116-1-2-17-2-34-1-52Z" fill="var(--d-panel)" />
            <path d="M206 150c44-3 88-2 128 1 2 19 1 37-1 53-42 2-86 2-126-1-2-18-2-36-1-53Z" fill="var(--d-accent-soft)" />
            <path d="M350 254c38-2 74-1 110 1 2 17 1 33-1 49-36 2-72 2-108-1-2-16-2-33-1-49Z" fill="var(--d-panel)" />
            <path d="M120 120c10 30 40 50 82 56" />
            <path d="M190 168l13 8-12 10" />
            <path d="M300 206c14 26 30 44 52 56" />
            <path d="M338 252l15 11-15 6" />
          </g>
          <g fill="var(--d-ink)" fontSize="15" fontWeight="600" fontFamily="var(--d-font-sans)" textAnchor="middle">
            <text x="103" y="93">Idea</text>
            <text x="270" y="182">First draft</text>
            <text x="405" y="284">Share</text>
          </g>
        </svg>
        <div className="absolute right-[7%] top-[13%] w-[132px] rotate-[3deg] rounded-[3px] bg-[#FFF2A8] p-3 text-[13px] leading-snug text-[#3A3418] shadow-card">
          Ask Priya about the cover photo
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Page looks ---------- */

function LookCard({ name, className, title, body, titleClass, style }: { name: string; className: string; title: string; body: string; titleClass?: string; style?: React.CSSProperties }) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className={cn("flex aspect-[3/4] flex-col gap-2 rounded-lg p-4 shadow-card", className)} style={style}>
        <span className={cn("text-[15px] font-bold leading-tight", titleClass)}>{title}</span>
        <span className="text-[11px] leading-relaxed opacity-80">{body}</span>
      </div>
      <figcaption className="text-center text-xs text-ink-3">{name}</figcaption>
    </figure>
  );
}

export function LooksPicture() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-5" role="img" aria-label="The same note in three page styles: Plain, Serif, and Starlight, a dark page with a scatter of stars.">
      <LookCard name="Plain" className="bg-panel text-ink" title="Sunday notes" body="Slow morning. Finished the chapter on tides and started the garden plan." />
      <LookCard
        name="Serif"
        className="bg-[#FBF8F1] text-[#2A2620]"
        titleClass="font-serif text-[17px] font-semibold"
        title="Sunday notes"
        body="Slow morning. Finished the chapter on tides and started the garden plan."
      />
      <LookCard
        name="Starlight"
        className="text-[#E9E7FF]"
        style={{
          background:
            "radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 70% 18%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 84% 62%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 38% 78%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 58% 46%, #cfc8ff 50%, transparent 51%), linear-gradient(160deg, #1B1A3A, #2C2160 60%, #3B2470)",
        }}
        title="Sunday notes"
        body="Slow morning. Finished the chapter on tides and started the garden plan."
      />
    </div>
  );
}

