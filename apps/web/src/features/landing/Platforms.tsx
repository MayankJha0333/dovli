"use client";

// "Wherever you work": where Dovli runs today, each with a small picture of it there. Wide screens
// get three tiles sized by how much each one does; phones get a row to swipe through, so the
// section stays short. The browser extension isn't out yet, so it's a small link beside the title.

import type { ReactNode } from "react";
import { COVER_PRESETS } from "@dovli/theme";
import { DovliMark, Icon, cn } from "@dovli/ui";
import { trackEvent } from "@/lib/analytics";
import { MiniPhone } from "./Android";
import { Status, container } from "./Sections";
import { tone, type Tone } from "./tones";

const dawn = COVER_PRESETS.find((c) => c.id === "dawn")!.css;

/** A window that rises out of the bottom of its tile, and lifts a little when the tile is pointed at. */
const windowClass = "absolute inset-0 block overflow-hidden rounded-t-[14px] bg-panel shadow-pop transition-transform duration-500 ease-out group-hover:-translate-y-1.5";

function Tile({ href, t, status, name, text, children, className }: { href: string; t: Tone; status: string; name: string; text: string; children: ReactNode; className?: string }) {
  return (
    <li className={cn("flex-none snap-start", className)}>
      <a
        href={href}
        className="group relative flex h-full min-h-[300px] flex-col overflow-clip rounded-[28px] px-6 pt-6 transition-transform duration-300 ease-out hover:-translate-y-1 sm:min-h-[330px] sm:px-7 sm:pt-7"
        style={{ background: tone(t).bg }}
      >
        <Status t="mint" className="self-start">
          {status}
        </Status>
        <span className="mt-4 block text-lg font-semibold text-ink">{name}</span>
        <span className="mt-1 block max-w-[320px] text-md leading-snug text-ink-2">{text}</span>
        <span aria-hidden="true" className="relative mt-6 block min-h-[150px] flex-1">
          {children}
        </span>
      </a>
    </li>
  );
}

// The sidebar's rows: page names as lines of different widths (in %), and the page that's open.
const sidebarRows: (number | "open")[] = [64, "open", 52, 70];

/** Dovli in a browser tab: the sidebar, and the hero's page with its cover and to-dos. */
function WebPicture() {
  return (
    <span className={windowClass}>
      <span className="flex h-7 items-center gap-2 border-b border-line bg-well px-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full bg-line-strong" />
          ))}
        </span>
        <span className="mx-auto flex h-[18px] w-[46%] items-center justify-center gap-1 rounded-[5px] bg-panel text-[10px] text-ink-3 shadow-sm">
          <Icon name="lock" size={8} />
          dovli.in/app
        </span>
      </span>
      <span className="flex h-full">
        <span className="flex w-[30%] flex-none flex-col gap-1.5 border-r border-line bg-well/60 p-2.5">
          <span className="mb-1 block h-4 rounded-[5px] bg-panel shadow-sm" />
          {sidebarRows.map((row, i) =>
            row === "open" ? (
              <span key={i} className="block h-4 rounded-[5px] bg-active" />
            ) : (
              <span key={i} className="block h-1.5 rounded-full bg-line-strong" style={{ width: `${row}%` }} />
            ),
          )}
        </span>
        <span className="min-w-0 flex-1 p-3">
          <span className="block h-8 rounded-[6px]" style={{ background: dawn }} />
          <span className="relative -mt-3.5 ml-2.5 grid size-7 place-items-center rounded-[7px] font-serif text-[12px] text-accent shadow-[0_0_0_2px_var(--d-panel)] [background:linear-gradient(var(--d-accent-soft),var(--d-accent-soft)),var(--d-panel)]">
            ✦
          </span>
          <span className="mt-1.5 block font-serif text-[15px] font-bold leading-tight text-ink">Launch plan</span>
          <span className="mt-2 flex flex-col gap-1.5">
            {[78, 66, 84].map((w, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 flex-none rounded-[3px]", i < 2 ? "bg-accent" : "shadow-[inset_0_0_0_1px_var(--d-line-strong)]")} />
                <span className="block h-1.5 rounded-full bg-line-strong" style={{ width: `${w}%` }} />
              </span>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}

/** An AI app with Dovli connected, adding to-dos to a page. */
function AiPicture() {
  return (
    <span className={windowClass}>
      <span className="flex h-8 items-center gap-2 border-b border-line bg-well px-3 text-[11px] font-semibold text-ink-2">
        <Icon name="sparkles" size={12} className="text-accent" />
        Your AI app
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold shadow-sm" style={{ color: tone("mint").ink }}>
          <span className="size-1.5 rounded-full bg-current" />
          Dovli connected
        </span>
      </span>
      <span className="flex flex-col gap-2 p-3">
        <span className="ml-auto block max-w-[86%] rounded-[14px] rounded-br-[4px] bg-accent px-3 py-1.5 text-[12px] leading-snug text-accent-ink">
          Add today&apos;s meeting notes to Launch plan
        </span>
        <span className="flex max-w-[92%] items-center gap-2 rounded-[14px] rounded-bl-[4px] bg-well px-3 py-1.5 text-[12px] leading-snug text-ink">
          <DovliMark size={13} />
          Added 3 to-dos to Launch plan
        </span>
      </span>
    </span>
  );
}

export function Platforms() {
  return (
    <section aria-labelledby="eco-title" className={cn(container, "pt-16 sm:pt-24 xl:pt-28")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="eco-title" className="m-0 text-balance font-serif text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[36px]">
            Wherever you work
          </h2>
          <p className="m-0 mt-2 text-md leading-relaxed text-ink-2 sm:text-lg">One account and the same pages on every screen, kept in sync.</p>
        </div>
        <a
          href="#coming"
          onClick={() => trackEvent("Coming soon click", { app: "extension" })}
          className="group inline-flex h-10 flex-none items-center gap-2.5 self-start rounded-full bg-panel pl-1.5 pr-4 text-sm font-semibold text-ink shadow-sm ring-1 ring-line transition-colors hover:bg-hover md:self-auto"
        >
          <span className="grid size-7 place-items-center rounded-full" style={{ background: tone("sky").bg, color: tone("sky").ink }} aria-hidden="true">
            <Icon name="paperclip" size={14} />
          </span>
          Browser extension
          <span className="rounded-full bg-well px-2 py-0.5 text-xs font-semibold text-ink-2">Coming soon</span>
          <Icon name="arrowRight" size={13} className="-ml-1 text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </a>
      </div>

      <ul className="m-0 -mx-4 mt-6 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 py-1 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 md:mx-0 md:mt-8 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:p-0 lg:grid-cols-12 [&::-webkit-scrollbar]:hidden">
        <Tile href="#features" t="blue" status="Available now" name="Web app" text="Every feature, in any modern browser." className="w-[86%] md:col-span-2 md:w-auto lg:col-span-5">
          <WebPicture />
        </Tile>
        <Tile href="#android" t="mint" status="New on Google Play" name="Android app" text="Your pages on your phone, offline too." className="w-[70%] md:w-auto lg:col-span-3">
          <MiniPhone className="absolute left-1/2 top-0 w-[180px] -translate-x-1/2 transition-transform duration-500 ease-out group-hover:-translate-y-1.5" />
        </Tile>
        <Tile href="#mcp" t="lilac" status="Available now" name="AI apps" text="Claude, Codex or any MCP app can work in your pages." className="w-[86%] md:w-auto lg:col-span-4">
          <AiPicture />
        </Tile>
      </ul>
    </section>
  );
}
