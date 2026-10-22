// The comparison pages: Dovli vs Notion, Craft and Evernote (/vs/…), and all four side by side
// (/compare). Server-rendered and plain HTML first, so search engines read every word; the content
// lives in data.ts. They wear the landing page's sky, sheet, colours and buttons so they read as Dovli.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { DovliLogo, DovliMark, Icon, buttonStyles, cn, type IconName } from "@dovli/ui";
import { SUPPORT_EMAIL } from "@/features/legal/LegalPage";
import { GooglePlayBadge } from "@/features/landing/Android";
import { Sheet } from "@/features/landing/Sheet";
import { tone, type Tone } from "@/features/landing/tones";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/authGate";
import { breadcrumbJsonLd, faqJsonLd, ldJson } from "@/lib/seo";
import { CHECKED, overview, overviewFaqs, rivals, type Faq, type Rival } from "./data";
import "@/features/landing/landing.css";

const wrap = "mx-auto w-full max-w-[1120px] px-4 sm:px-8";
const h2 = "m-0 text-balance font-serif text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]";
const lead = "m-0 text-lg leading-relaxed text-ink-2";

// Each app keeps one colour across the pages (Dovli's own is the accent). Not the apps' brand colours.
const rivalTone: Record<Rival["slug"], Tone> = { notion: "sky", craft: "pink", evernote: "butter" };

// What each app's export is called, for the picture of it being dropped into Dovli.
const exportFile: Record<Rival["slug"], string> = { notion: "Notion export.zip", craft: "Craft docs.zip", evernote: "Notebook.enex" };

const rowIcons: Record<string, IconName> = {
  "Price to start": "tag",
  "Made for": "user",
  "Best for": "user",
  Whiteboards: "board",
  Offline: "cloudOff",
  Databases: "table",
  AI: "sparkles",
  "Where it runs": "device",
  "Moving your notes": "importIcon",
  "Web clipper": "paperclip",
  Android: "device",
};

function RowLabel({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[10px] bg-well text-ink-2">
        <Icon name={rowIcons[label] ?? "check"} size={15} />
      </span>
      {label}
    </span>
  );
}

function Swatch({ t }: { t: Tone }) {
  return <span aria-hidden="true" className="size-2.5 flex-none rounded-full" style={{ background: tone(t).ink }} />;
}

/* ---------- The frame: header, sky, footer ---------- */

function Shell({ children, crumbs, jsonLd, current }: { children: ReactNode; crumbs: { name: string; path: string }[]; jsonLd: object[]; current: string }) {
  const data = { "@context": "https://schema.org", "@graph": [breadcrumbJsonLd(crumbs), ...jsonLd] };
  const links = [{ href: "/compare", label: "Compare all" }, ...rivals.map((r) => ({ href: `/vs/${r.slug}`, label: `vs ${r.name}` }))];
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-bg text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />
      <header className="sticky top-0 z-20 px-3 pt-3 sm:pt-4">
        <div className="chrome-pill mx-auto flex h-14 max-w-[1120px] items-center gap-2 pl-4 pr-2">
          <Link href="/" aria-label="Dovli home" className="mr-2 rounded-md">
            <DovliLogo size={28} />
          </Link>
          <nav aria-label="Comparisons" className="hidden items-center gap-0.5 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={l.href === current ? "page" : undefined}
                className="flex h-8 items-center rounded-full px-3 text-base font-semibold text-ink-2 transition-colors hover:text-ink aria-[current=page]:bg-hover aria-[current=page]:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href={LOGIN_PATH} className={cn(buttonStyles({ variant: "ghost", size: "md" }), "hidden rounded-full sm:inline-flex")}>
              Sign in
            </Link>
            <Link href={SIGNUP_PATH} className={cn(buttonStyles({ variant: "primary", size: "md" }), "rounded-full px-4")}>
              Try Dovli free
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <Crumbs crumbs={crumbs} />
        {children}
      </main>

      <footer className="px-2 pb-2 pt-10 sm:px-4 sm:pb-4">
        <div className={cn(wrap, "flex flex-col gap-6 border-t border-line py-8 md:flex-row md:items-start md:justify-between")}>
          <div className="flex flex-col gap-3">
            <Link href="/" aria-label="Dovli home" className="self-start rounded-md">
              <DovliLogo size={26} />
            </Link>
            <p className="m-0 max-w-[420px] text-sm leading-relaxed text-ink-3">
              Notion, Craft and Evernote are trademarks of their owners. Dovli isn&rsquo;t connected to them. Facts checked {CHECKED}; plans and prices change.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-ink">
                {l.label}
              </Link>
            ))}
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">
              {SUPPORT_EMAIL}
            </a>
          </nav>
        </div>
        <p className={cn(wrap, "mb-0 mt-0 pb-2 text-xs text-ink-3")}>© {new Date().getFullYear()} Dovli. Google Play and the Google Play logo are trademarks of Google LLC.</p>
      </footer>
    </div>
  );
}

function Crumbs({ crumbs }: { crumbs: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className={cn(wrap, "pb-3 pt-5")}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-ink-3">
        {crumbs.map((c, i) => (
          <li key={c.path} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevron" size={12} aria-hidden="true" />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-medium text-ink-2">
                {c.name}
              </span>
            ) : (
              <Link href={c.path} className="hover:text-ink">
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Actions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Link href={SIGNUP_PATH} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 rounded-full px-6 text-md")}>
        Try Dovli free
      </Link>
      <GooglePlayBadge place="compare" />
    </div>
  );
}

/** The opening: the title on the landing page's sky, with the short answer beside it on wide screens. */
function Opening({ chip, title, sub, aside }: { chip: ReactNode; title: ReactNode; sub: string; aside: ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="px-2 sm:px-4">
      <div className="lp-sky relative overflow-hidden rounded-[28px] sm:rounded-[40px]">
        <div aria-hidden="true" className="lp-ruled absolute inset-0" />
        <div className={cn(wrap, "relative grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:gap-14 lg:py-20")}>
          <div>
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-panel/85 px-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-line">{chip}</span>
            <h1 id="page-title" className="m-0 mt-6 text-balance font-serif text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[64px]">
              {title}
            </h1>
            <p className={cn(lead, "mt-6 max-w-[560px] sm:text-xl sm:leading-relaxed")}>{sub}</p>
            <Actions className="mt-8" />
            <p className="m-0 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">
              {["Free to use", "Works offline", "Web and Android"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Icon name="check" size={14} aria-hidden="true" className="text-accent" />
                  {t}
                </span>
              ))}
            </p>
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}

/** The short answer on a sheet of paper: who should pick which, then the main differences at a glance. */
function Verdict({ rival }: { rival: Rival }) {
  const t = rivalTone[rival.slug];
  // The overview's short values fit the sheet; Android is the same for every app, so it's left out.
  const glance = overview.filter((r) => r.label !== "Android");
  return (
    <Sheet fold={48} sheetClassName="rounded-[26px] bg-panel" className="w-full">
      <div className="p-5 sm:p-7">
        <h2 className="m-0 text-sm font-semibold text-ink-3">The short answer</h2>
        <div className="mt-3 grid gap-2.5">
          <div className="rounded-[18px] bg-accent-soft p-4">
            <span className="flex items-center gap-2 text-sm font-bold text-accent">
              <DovliMark size={16} />
              Dovli
            </span>
            <p className="m-0 mt-1.5 text-md leading-relaxed text-ink">{rival.pickDovli}</p>
          </div>
          <div className="rounded-[18px] p-4" style={{ background: tone(t).bg }}>
            <span className="flex items-center gap-2 text-sm font-bold" style={{ color: tone(t).ink }}>
              <Swatch t={t} />
              {rival.name}
            </span>
            <p className="m-0 mt-1.5 text-md leading-relaxed text-ink-2">{rival.pickThem}</p>
          </div>
        </div>
        <h3 className="m-0 mt-6 text-sm font-semibold text-ink-3">At a glance</h3>
        <dl className="m-0 mt-2 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-4 text-sm">
          {glance.map((r) => (
            <div key={r.label} className="col-span-3 grid grid-cols-subgrid border-t border-line py-2.5">
              <dt className="font-semibold text-ink-2">{r.label}</dt>
              <dd className="m-0 font-semibold text-ink">
                <span className="sr-only">Dovli: </span>
                {r.dovli}
              </dd>
              <dd className="m-0 text-ink-2">
                <span className="sr-only">{rival.name}: </span>
                {r[rival.slug]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Sheet>
  );
}

/** The four apps' one-line answers, for /compare. */
function Lineup() {
  const items: { name: string; t?: Tone; text: string; href?: string }[] = [
    ...rivals.map((r) => ({ name: r.name, t: rivalTone[r.slug], text: r.pickThem.replace(/^Pick \w+ if /, ""), href: `/vs/${r.slug}` })),
    { name: "Dovli", text: "you want a free, calm place for your own notes, docs and whiteboards, on the web and Android." },
  ];
  return (
    <Sheet fold={48} sheetClassName="rounded-[26px] bg-panel" className="w-full">
      <div className="p-5 sm:p-7">
        <h2 className="m-0 text-sm font-semibold text-ink-3">The short answer: pick…</h2>
        <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
          {items.map((it) => {
            const mine = !it.t;
            return (
              <li key={it.name} className={cn("rounded-[18px] p-4", mine && "bg-accent-soft")} style={it.t ? { background: tone(it.t).bg } : undefined}>
                <span className={cn("flex items-center gap-2 text-sm font-bold", mine && "text-accent")} style={it.t ? { color: tone(it.t).ink } : undefined}>
                  {it.t ? <Swatch t={it.t} /> : <DovliMark size={16} />}
                  {it.name}
                </span>
                <p className={cn("m-0 mt-1 text-md leading-snug", mine ? "text-ink" : "text-ink-2")}>if {it.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

/* ---------- Pieces shared by both pages ---------- */

function SectionHead({ id, title, note, children }: { id: string; title: ReactNode; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="max-w-[640px]">
        <h2 id={id} className={h2}>
          {title}
        </h2>
        {children}
      </div>
      {note && <p className="m-0 flex-none text-sm text-ink-3">{note}</p>}
    </div>
  );
}

function Faqs({ faqs }: { faqs: Faq[] }) {
  return (
    <section aria-labelledby="faq-title" className={cn(wrap, "mt-16 sm:mt-24 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14")}>
      <div>
        <h2 id="faq-title" className={h2}>
          Questions people ask
        </h2>
        <p className={cn(lead, "mt-4 max-w-[380px]")}>
          Something else?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent hover:underline">
            Write to us
          </a>
          , a person answers.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        {faqs.map((f, i) => (
          <details key={f.q} className="group rounded-[20px] bg-panel shadow-sm ring-1 ring-line open:shadow-card" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-5 py-4 focus-visible:outline-offset-[-2px] sm:px-6 [&::-webkit-details-marker]:hidden">
              <h3 className="m-0 text-md font-semibold text-ink sm:text-lg">{f.q}</h3>
              <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-well text-ink-2 transition-transform duration-200 group-open:rotate-180">
                <Icon name="chevronDown" size={15} />
              </span>
            </summary>
            <p className="m-0 max-w-[680px] px-5 pb-5 text-md leading-relaxed text-ink-2 sm:px-6">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CompareCard({ href, title, text, t }: { href: string; title: string; text: string; t?: Tone }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[150px] flex-col justify-between gap-6 rounded-[24px] p-6 transition-transform duration-300 ease-out hover:-translate-y-1"
      style={{ background: t ? tone(t).bg : "var(--d-accent-soft)" }}
    >
      <span className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: t ? tone(t).ink : "var(--d-accent)" }}>
          {t ? <Swatch t={t} /> : <DovliMark size={15} />}
          {t ? "Compare" : "Overview"}
        </span>
        <span className="text-lg font-semibold text-ink">{title}</span>
        <span className="text-base leading-snug text-ink-2">{text}</span>
      </span>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        Read the comparison
        <Icon name="arrowRight" size={14} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function OtherComparisons({ current }: { current?: Rival["slug"] }) {
  return (
    <section aria-labelledby="more-title" className={cn(wrap, "mt-16 sm:mt-24")}>
      <SectionHead id="more-title" title="More comparisons" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <CompareCard href="/compare" title="All four side by side" text="Dovli, Notion, Craft and Evernote in one table." />
        {rivals
          .filter((r) => r.slug !== current)
          .map((r) => (
            <CompareCard key={r.slug} href={`/vs/${r.slug}`} title={`Dovli vs ${r.name}`} text={`${r.promise}.`} t={rivalTone[r.slug]} />
          ))}
      </div>
    </section>
  );
}

/** One last invitation, on the sky again so the page ends where it began. */
function Closing({ title, text }: { title: string; text: string }) {
  return (
    <section aria-labelledby="closing-title" className="mt-16 sm:mt-24 px-2 sm:px-4">
      <div className="lp-sky relative overflow-hidden rounded-[28px] sm:rounded-[40px]">
        <div aria-hidden="true" className="lp-ruled absolute inset-0" />
        <div className={cn(wrap, "relative flex flex-col items-start gap-6 py-14 sm:py-16 md:flex-row md:items-center md:justify-between")}>
          <div className="max-w-[620px]">
            <DovliMark size={36} />
            <h2 id="closing-title" className={cn(h2, "mt-5")}>
              {title}
            </h2>
            <p className={cn(lead, "mt-3")}>{text}</p>
          </div>
          <Actions className="flex-none" />
        </div>
      </div>
    </section>
  );
}

/* ---------- /vs/notion, /vs/craft, /vs/evernote ---------- */

/** Dovli's real import box (Settings, Import & export), with this app's export being dropped in. */
function ImportPicture({ rival }: { rival: Rival }) {
  return (
    <div role="img" aria-label={`Dovli's Settings, on Import & export, with ${exportFile[rival.slug]} being dropped into the import box.`} className="relative">
      <div aria-hidden="true" className="overflow-hidden rounded-[22px] bg-panel shadow-pop">
        <div className="flex h-11 items-center gap-2 border-b border-line bg-well px-4 text-sm font-semibold text-ink">
          <Icon name="settings" size={15} className="text-ink-3" />
          Settings
        </div>
        <div className="grid grid-cols-[176px_minmax(0,1fr)] max-sm:grid-cols-1">
          <ul className="m-0 flex list-none flex-col gap-0.5 border-r border-line p-2.5 max-sm:hidden">
            {(
              [
                ["palette", "Appearance"],
                ["user", "Account"],
                ["cloud", "Sync & backups"],
                ["importIcon", "Import & export"],
                ["sparkles", "AI"],
              ] as const
            ).map(([icon, label]) => (
              <li key={label} className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]", label === "Import & export" ? "bg-accent-soft font-semibold text-accent" : "text-ink-2")}>
                <Icon name={icon} size={13} />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
          <div className="p-4 sm:p-5">
            <div className="text-md font-semibold text-ink">Import</div>
            <div className="mt-0.5 text-[13px] text-ink-3">Pictures and files come along.</div>
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-accent bg-accent-soft px-4 pb-5 pt-12 text-center">
              <Icon name="importIcon" size={22} className="text-accent" />
              <div className="text-base font-semibold text-ink">Drop files here</div>
              <div className="mt-1 flex gap-2">
                <span className={cn(buttonStyles({ variant: "primary", size: "sm" }), "pointer-events-none")}>
                  <Icon name="upload" size={13} />
                  Choose files
                </span>
                <span className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "pointer-events-none")}>Choose a folder</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* The file on its way in, tilted as if held by the pointer. */}
      <div aria-hidden="true" className="absolute right-[12%] top-[134px] flex rotate-[-5deg] items-center gap-2.5 rounded-[14px] py-2.5 pl-2.5 pr-4 text-sm font-semibold text-ink surface-raised max-sm:right-[8%]">
        <span className="grid size-8 place-items-center rounded-[9px]" style={{ background: tone(rivalTone[rival.slug]).bg, color: tone(rivalTone[rival.slug]).ink }}>
          <Icon name="file" size={15} />
        </span>
        {exportFile[rival.slug]}
      </div>
    </div>
  );
}

export function VsPage({ rival }: { rival: Rival }) {
  const t = rivalTone[rival.slug];
  const crumbs = [
    { name: "Dovli", path: "/" },
    { name: "Compare", path: "/compare" },
    { name: `Dovli vs ${rival.name}`, path: `/vs/${rival.slug}` },
  ];
  const howTo = {
    "@type": "HowTo",
    name: `How to move from ${rival.name} to Dovli`,
    step: rival.move.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
  };
  return (
    <Shell crumbs={crumbs} jsonLd={[faqJsonLd(rival.faqs), howTo]} current={`/vs/${rival.slug}`}>
      <Opening
        chip={
          <>
            <DovliMark size={15} />
            Dovli
            <span className="text-ink-3">vs</span>
            <Swatch t={t} />
            {rival.name}
          </>
        }
        title={
          <>
            Dovli vs {rival.name}
            <span className="mt-3 block text-[0.56em] leading-[1.1] tracking-[-0.025em] text-ink-2">{rival.promise}.</span>
          </>
        }
        sub={rival.description}
        aside={<Verdict rival={rival} />}
      />

      <section aria-labelledby="table-title" className={cn(wrap, "mt-16 sm:mt-24")}>
        <SectionHead id="table-title" title={`Dovli and ${rival.name}, side by side`} note={`${rival.name} facts checked ${CHECKED}`} />
        <div className="mt-8 overflow-hidden rounded-[26px] bg-panel shadow-card max-md:rounded-none max-md:bg-transparent max-md:shadow-none">
          {/* One table for every width: on phones each row becomes a card, with the app named on each value. */}
          <table className="w-full border-collapse text-left text-base max-md:block">
            <caption className="sr-only">
              Dovli compared with {rival.name}, checked {CHECKED}
            </caption>
            <thead className="text-sm max-md:hidden">
              <tr>
                <th scope="col" className="w-[26%] px-6 py-4 font-semibold">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-[37%] bg-accent-soft px-6 py-4 font-bold text-accent">
                  <span className="flex items-center gap-2">
                    <DovliMark size={18} />
                    Dovli
                  </span>
                </th>
                <th scope="col" className="px-6 py-4 font-bold" style={{ color: tone(t).ink }}>
                  <span className="flex items-center gap-2">
                    <Swatch t={t} />
                    {rival.name}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="max-md:flex max-md:flex-col max-md:gap-2.5">
              {rival.rows.map((r) => (
                <tr key={r.label} className="border-t border-line align-top max-md:block max-md:rounded-[20px] max-md:border-0 max-md:bg-panel max-md:p-4 max-md:shadow-sm max-md:ring-1 max-md:ring-line">
                  <th scope="row" className="px-6 py-4 text-md font-semibold text-ink max-md:block max-md:p-0">
                    <RowLabel label={r.label} />
                  </th>
                  <td
                    data-app="Dovli"
                    className="bg-accent-soft px-6 py-4 font-medium leading-relaxed text-ink max-md:mt-3 max-md:block max-md:rounded-[12px] max-md:px-3.5 max-md:py-2.5 max-md:before:block max-md:before:text-xs max-md:before:font-bold max-md:before:text-accent max-md:before:content-[attr(data-app)]"
                  >
                    {r.dovli}
                  </td>
                  <td
                    data-app={rival.name}
                    className="px-6 py-4 leading-relaxed text-ink-2 max-md:mt-1.5 max-md:block max-md:px-3.5 max-md:py-1.5 max-md:before:block max-md:before:text-xs max-md:before:font-bold max-md:before:text-[var(--app-ink)] max-md:before:content-[attr(data-app)]"
                    style={{ "--app-ink": tone(t).ink } as CSSProperties}
                  >
                    {r.them}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-4 text-sm text-ink-3">Plans change, so check {rival.name}&rsquo;s own site before you decide.</p>
      </section>

      <section aria-label="Strengths" className={cn(wrap, "mt-16 sm:mt-24 grid grid-cols-1 gap-4 md:grid-cols-2")}>
        <div className="rounded-[32px] p-7 sm:p-9" style={{ background: tone("lilac").bg }}>
          <span className="grid size-12 place-items-center rounded-[14px] bg-panel shadow-sm">
            <DovliMark size={24} />
          </span>
          <h2 className={cn(h2, "mt-6 sm:text-[34px]")}>Where Dovli is different</h2>
          <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
            {rival.dovliWins.map((w) => (
              <li key={w} className="flex items-start gap-3 text-md leading-relaxed text-ink">
                <span aria-hidden="true" className="mt-[3px] grid size-[20px] flex-none place-items-center rounded-[6px] bg-accent text-accent-ink">
                  <Icon name="check" size={13} />
                </span>
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[32px] bg-panel p-7 shadow-sm ring-1 ring-line sm:p-9">
          <span className="grid size-12 place-items-center rounded-[14px]" style={{ background: tone(t).bg, color: tone(t).ink }}>
            <Icon name="star" size={22} aria-hidden="true" />
          </span>
          <h2 className={cn(h2, "mt-6 sm:text-[34px]")}>Where {rival.name} is stronger</h2>
          <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
            {rival.theyWin.map((w) => (
              <li key={w} className="flex items-start gap-3 text-md leading-relaxed text-ink-2">
                <span aria-hidden="true" className="mt-[3px] grid size-[20px] flex-none place-items-center rounded-[6px]" style={{ background: tone(t).bg, color: tone(t).ink }}>
                  <Icon name="check" size={13} />
                </span>
                {w}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-7 border-t border-line pt-5 text-sm leading-relaxed text-ink-3">We&rsquo;d rather you pick the right app. If these matter most, {rival.name} is the better fit.</p>
        </div>
      </section>

      <section aria-labelledby="move-title" className="mt-16 sm:mt-24 px-2 sm:px-4">
        <div className="overflow-hidden rounded-[28px] sm:rounded-[40px]" style={{ background: tone("mint").bg }}>
          <div className={cn(wrap, "grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14")}>
            <div>
              <h2 id="move-title" className={h2}>
                Move from {rival.name} to Dovli
              </h2>
              <p className={cn(lead, "mt-4 max-w-[520px]")}>It takes a few minutes, and your pages stay in {rival.name} too, so you can try both.</p>
              <ol className="m-0 mt-8 flex list-none flex-col p-0">
                {rival.move.map((step, i) => (
                  <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* The line joining each step to the next. */}
                    {i < rival.move.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[17px] top-10 w-0.5 rounded-full bg-[var(--lp-mint-ink)] opacity-25" />}
                    <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-panel text-sm font-bold shadow-sm" style={{ color: tone("mint").ink }}>
                      {i + 1}
                    </span>
                    <span className="pt-1.5 text-md leading-relaxed text-ink">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <ImportPicture rival={rival} />
          </div>
        </div>
      </section>

      <Faqs faqs={rival.faqs} />
      <OtherComparisons current={rival.slug} />
      <Closing title={`Try Dovli next to ${rival.name}`} text={`It's free, and your ${rival.name} pages come along in one step.`} />
    </Shell>
  );
}

/* ---------- /compare ---------- */

export function OverviewPage() {
  const crumbs = [
    { name: "Dovli", path: "/" },
    { name: "Compare", path: "/compare" },
  ];
  const cols = [{ key: "dovli", name: "Dovli" }, ...rivals.map((r) => ({ key: r.slug, name: r.name }))] as const;
  return (
    <Shell crumbs={crumbs} jsonLd={[faqJsonLd(overviewFaqs)]} current="/compare">
      <Opening
        chip={
          <>
            <Icon name="viewGrid" size={14} aria-hidden="true" className="text-ink-3" />
            Compare note-taking apps
          </>
        }
        title={
          <>
            Notion vs Craft vs Evernote
            <span className="mt-3 block text-[0.56em] leading-[1.1] tracking-[-0.025em] text-ink-2">and where Dovli fits.</span>
          </>
        }
        sub="Four note-taking apps, compared in plain words: what each one is best at, what it costs to start, and how to move your notes between them."
        aside={<Lineup />}
      />

      <section aria-labelledby="table-title" className={cn(wrap, "mt-16 sm:mt-24")}>
        <SectionHead id="table-title" title="All four, side by side" note={`Checked ${CHECKED}`} />
        <div className="mt-8 overflow-hidden rounded-[26px] bg-panel shadow-card max-md:rounded-none max-md:bg-transparent max-md:shadow-none">
          <table className="w-full border-collapse text-left text-base max-md:block">
            <caption className="sr-only">Dovli, Notion, Craft and Evernote compared, checked {CHECKED}</caption>
            <thead className="text-sm max-md:hidden">
              <tr>
                <th scope="col" className="w-[24%] px-6 py-4 font-semibold">
                  <span className="sr-only">Feature</span>
                </th>
                {cols.map((c) =>
                  c.key === "dovli" ? (
                    <th key={c.key} scope="col" className="bg-accent-soft px-6 py-4 font-bold text-accent">
                      <span className="flex items-center gap-2">
                        <DovliMark size={18} />
                        Dovli
                      </span>
                    </th>
                  ) : (
                    <th key={c.key} scope="col" className="px-6 py-4 font-bold">
                      <Link href={`/vs/${c.key}`} className="flex items-center gap-2 hover:underline" style={{ color: tone(rivalTone[c.key]).ink }}>
                        <Swatch t={rivalTone[c.key]} />
                        {c.name}
                      </Link>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="max-md:flex max-md:flex-col max-md:gap-2.5">
              {overview.map((r) => (
                <tr key={r.label} className="border-t border-line align-top max-md:grid max-md:grid-cols-2 max-md:gap-1.5 max-md:rounded-[20px] max-md:border-0 max-md:bg-panel max-md:p-4 max-md:shadow-sm max-md:ring-1 max-md:ring-line">
                  <th scope="row" className="px-6 py-4 text-md font-semibold text-ink max-md:col-span-2 max-md:mb-1.5 max-md:p-0">
                    <RowLabel label={r.label} />
                  </th>
                  {cols.map((c) => {
                    const mine = c.key === "dovli";
                    return (
                      <td
                        key={c.key}
                        data-app={c.name}
                        className={cn(
                          "px-6 py-4 leading-relaxed max-md:rounded-[12px] max-md:px-3 max-md:py-2 max-md:text-sm max-md:before:block max-md:before:text-xs max-md:before:font-bold max-md:before:text-[var(--app-ink)] max-md:before:content-[attr(data-app)]",
                          mine ? "bg-accent-soft font-medium text-ink" : "text-ink-2 max-md:bg-well",
                        )}
                        style={{ "--app-ink": mine ? "var(--d-accent)" : tone(rivalTone[c.key as Rival["slug"]]).ink } as CSSProperties}
                      >
                        {r[c.key]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-4 text-sm text-ink-3">Plans change, so check each app&rsquo;s own site before you decide.</p>
      </section>

      <section aria-labelledby="each-title" className={cn(wrap, "mt-16 sm:mt-24")}>
        <SectionHead id="each-title" title="Dovli next to each one">
          <p className={cn(lead, "mt-4")}>Each comparison has the full table, where the other app is stronger, and how to move your notes over.</p>
        </SectionHead>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {rivals.map((r) => (
            <CompareCard key={r.slug} href={`/vs/${r.slug}`} title={`Dovli vs ${r.name}`} text={r.pickDovli} t={rivalTone[r.slug]} />
          ))}
        </div>
      </section>

      <Faqs faqs={overviewFaqs} />
      <Closing title="Try Dovli free" text="Bring your notes from Notion, Craft or Evernote in one step, and keep writing on the web and Android." />
    </Shell>
  );
}
