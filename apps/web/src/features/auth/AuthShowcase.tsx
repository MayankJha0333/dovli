"use client";

// The right half of the sign-in and sign-up pages: the landing page's sky (with its drifting paper),
// and a picture of Dovli at work, drawn with the app's own tokens so it follows the theme. A page
// with to-dos and a flowchart, the same pages on the Android app, and a "synced" note between them.
// It's one picture to screen readers.

import type { CSSProperties } from "react";
import { Icon, cn, type IconName } from "@dovli/ui";
import { MiniPhone } from "@/features/landing/Android";
import { Scene } from "@/features/landing/Scene";
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
  { icon: "cloudOff", text: "Works offline" },
  { icon: "sparkles", text: "AI that edits with you" },
];

export function AuthShowcase({ title, lead }: { title: string; lead: string }) {
  return (
    <aside aria-label="About Dovli" className="lp-sky relative isolate hidden min-h-[640px] flex-col overflow-hidden rounded-[28px] lg:flex">
      <div aria-hidden="true" className="lp-ruled absolute inset-0 -z-10" />
      <Scene kind="paper" count={12} className="-z-10" />

      <div className="px-10 pt-11 xl:px-14 xl:pt-12">
        <p className="lp-fade m-0 max-w-[540px] text-balance font-serif text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink xl:text-[48px] 2xl:text-[54px]" style={delay(0.05)}>
          {title}
        </p>
        <p className="lp-fade m-0 mt-4 max-w-[460px] text-[17px] leading-relaxed text-ink-2" style={delay(0.15)}>
          {lead}
        </p>
        <ul className="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">
          {features.map((f, i) => (
            <li key={f.text} className="lp-fade flex h-8 items-center gap-2 rounded-full bg-panel/80 px-3 text-[13px] font-medium text-ink-2 shadow-sm ring-1 ring-line" style={delay(0.25 + i * 0.06)}>
              <Icon name={f.icon} size={13} className="text-accent" aria-hidden="true" />
              {f.text}
            </li>
          ))}
        </ul>
      </div>

      {/* The picture: the page on the web, and the same pages on the phone, rising out of the bottom edge. */}
      <div
        role="img"
        aria-label="A Dovli page called Launch plan with a summary, ticked to-dos and a small flowchart, and Dovli's Android app beside it, with a note that the pages are saved on all your devices."
        className="relative mt-8 min-h-[400px] flex-1"
      >
        <div aria-hidden="true" className="absolute inset-0">
          <div className="lp-rise absolute left-10 top-4 w-[min(440px,72%)] xl:left-14" style={delay(0.45)}>
          <Sheet fold={44} sheetClassName="rounded-[22px] bg-panel">
            <div className="p-6">
              <div className="flex items-center gap-1.5 text-xs text-ink-3">
                <Icon name="page" size={12} />
                Launch plan
              </div>
              <p className="m-0 mt-3 font-serif text-[24px] font-semibold leading-tight tracking-[-0.01em] text-ink">Launch plan</p>
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
          </div>

          <div className="lp-rise absolute -bottom-2 right-6 w-[150px] xl:right-10 xl:w-[180px] min-[1400px]:right-12 min-[1400px]:w-[220px]" style={delay(1.15)}>
            <MiniPhone />
          </div>

          <div
            className="lp-fade absolute bottom-16 right-[200px] hidden items-center min-[1400px]:flex gap-2 rounded-full bg-panel py-1.5 pl-2 pr-3 text-[12px] font-medium text-ink shadow-pop ring-1 ring-line min-[1400px]:right-[244px]"
            style={delay(1.5)}
          >
            <span className="grid size-5 place-items-center rounded-full bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]">
              <Icon name="cloudCheck" size={12} />
            </span>
            Saved on all your devices
          </div>
        </div>
      </div>
    </aside>
  );
}
