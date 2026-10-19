"use client";

// The right half of the sign-in and sign-up pages: a picture of Dovli at work, drawn with the app's
// own tokens (so it follows the theme), instead of empty space. A page with to-dos and a flowchart,
// the assistant beside it, and a "synced" note. It's one picture to screen readers.

import type { CSSProperties } from "react";
import { Icon, cn, type IconName } from "@dovli/ui";
import { Sheet } from "@/features/landing/Sheet";

const delay = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

const todos: [string, boolean][] = [
  ["Write the welcome email", true],
  ["Record a one-minute demo", true],
  ["Invite the first 200 people", false],
];

function Box({ children, tone }: { children: string; tone: "blue" | "lilac" | "mint" }) {
  return (
    <span
      className={cn(
        "flex h-8 flex-none items-center rounded-md px-2.5 text-[12px] font-semibold",
        tone === "blue" && "bg-[var(--lp-blue)] text-[var(--lp-blue-ink)]",
        tone === "lilac" && "bg-[var(--lp-lilac)] text-[var(--lp-lilac-ink)]",
        tone === "mint" && "bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]",
      )}
    >
      {children}
    </span>
  );
}

function Arrow() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" className="flex-none text-ink-4" aria-hidden="true">
      <path d="M1 5h18m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const features: { icon: IconName; text: string }[] = [
  { icon: "pagePlus", text: "Pages inside pages" },
  { icon: "board", text: "Whiteboards" },
  { icon: "sparkles", text: "AI that edits with you" },
];

export function AuthShowcase({ title, lead }: { title: string; lead: string }) {
  return (
    <aside
      aria-label="About Dovli"
      className="relative isolate hidden flex-col overflow-hidden rounded-[28px] bg-[var(--lp-lilac)] xl:flex"
    >
      {/* The mark's colours as a soft wash, and a faint dot grid like the whiteboard. */}
      <div aria-hidden="true" className="lp-wash absolute -inset-20 -z-10 opacity-70" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{ backgroundImage: "radial-gradient(var(--d-line-strong) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <div className="px-14 pt-12">
        <p className="lp-fade m-0 max-w-[520px] text-balance font-serif text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink 2xl:text-[52px]" style={delay(0.05)}>
          {title}
        </p>
        <p className="lp-fade m-0 mt-4 max-w-[440px] text-[17px] leading-relaxed text-ink-2" style={delay(0.15)}>
          {lead}
        </p>
      </div>

      {/* The picture */}
      <div
        role="img"
        aria-label="A Dovli page called Launch plan with ticked to-dos and a small flowchart, the assistant adding a summary beside it, and a note that the page is synced."
        className="relative mx-14 my-auto h-[430px] flex-none pt-8"
      >
        <div aria-hidden="true" className="absolute inset-0">
          <Sheet fold={44} className="lp-fade absolute left-0 top-0 w-[min(440px,82%)]" sheetClassName="rounded-[20px] bg-panel">
            <div className="p-6">
              <div className="flex items-center gap-1.5 text-xs text-ink-3">
                <Icon name="page" size={12} />
                Launch plan
              </div>
              <p className="m-0 mt-3 text-[22px] font-bold leading-tight tracking-tight text-ink">Launch plan</p>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-[13px] leading-snug text-ink">
                <Icon name="sparkles" size={13} className="mt-0.5 flex-none text-accent" />
                Beta opens on 14 November. Keep week one quiet and fix what people trip over.
              </div>
              <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[14px]">
                {todos.map(([t, done]) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-[15px] flex-none place-items-center rounded-[4px]",
                        done ? "bg-accent text-accent-ink" : "shadow-[inset_0_0_0_1.5px_var(--d-line-strong)]",
                      )}
                    >
                      {done && <Icon name="check" size={10} />}
                    </span>
                    <span className={done ? "text-ink-3 line-through decoration-line-strong" : "text-ink"}>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-well p-3">
                <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold text-ink-3">
                  <Icon name="board" size={11} />
                  Flowchart
                </div>
                <div className="flex items-center gap-1.5">
                  <Box tone="blue">Idea</Box>
                  <Arrow />
                  <Box tone="lilac">Draft</Box>
                  <Arrow />
                  <Box tone="mint">Ship</Box>
                </div>
              </div>
            </div>
          </Sheet>

          {/* The assistant, beside the page */}
          <div
            className="lp-fade absolute right-0 top-[190px] w-[min(280px,50%)] rounded-[18px] bg-panel p-3.5 shadow-[0_24px_48px_-12px_rgba(21,23,29,0.25)] ring-1 ring-line"
            style={delay(0.55)}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Icon name="sparkles" size={13} className="text-accent" />
              Assistant
            </div>
            <div className="ml-auto mt-2.5 w-fit max-w-[90%] rounded-[12px] bg-accent-soft px-3 py-2 text-[12.5px] text-ink">Sum up this page at the top</div>
            <p className="m-0 mt-2.5 text-[12.5px] leading-snug text-ink-2">I'd add a two-line summary above the to-dos.</p>
            <div className="mt-2.5 flex items-center justify-between rounded-[10px] bg-well px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <Icon name="plus" size={12} className="text-ink-3" />
                Add at the top
              </span>
              <span className="flex h-6 items-center gap-1 rounded-md bg-accent px-2 text-[11px] font-semibold text-accent-ink">
                <Icon name="check" size={11} />
                Apply
              </span>
            </div>
          </div>

          {/* Synced */}
          <div
            className="lp-fade absolute bottom-2 left-6 flex items-center gap-2 rounded-full bg-panel py-1.5 pl-2 pr-3 text-[12px] font-medium text-ink shadow-[0_10px_24px_-8px_rgba(21,23,29,0.25)] ring-1 ring-line"
            style={delay(0.8)}
          >
            <span className="grid size-5 place-items-center rounded-full bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]">
              <Icon name="cloudCheck" size={12} />
            </span>
            Saved on all your devices
          </div>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-2 px-14 pb-10 pt-6">
        {features.map((f, i) => (
          <li
            key={f.text}
            className="lp-fade flex h-8 items-center gap-2 rounded-full bg-panel/70 px-3 text-[13px] font-medium text-ink-2 ring-1 ring-line backdrop-blur"
            style={delay(1 + i * 0.08)}
          >
            <Icon name={f.icon} size={13} className="text-accent" />
            {f.text}
          </li>
        ))}
      </ul>

    </aside>
  );
}
