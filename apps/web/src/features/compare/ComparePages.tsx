// The comparison pages: Dovli vs Notion, Craft and Evernote (/vs/…), and all four side by side
// (/compare). Server-rendered and plain HTML first, so search engines read every word; the content
// lives in data.ts. They wear the landing page's sky, sheet and buttons so they read as Dovli.

import Link from "next/link";
import type { ReactNode } from "react";
import { DovliLogo, DovliMark, Icon, buttonStyles, cn } from "@dovli/ui";
import { SUPPORT_EMAIL } from "@/features/legal/LegalPage";
import { PLAY_STORE_URL } from "@/features/landing/playStore";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/authGate";
import { breadcrumbJsonLd, faqJsonLd, ldJson } from "@/lib/seo";
import { CHECKED, overview, overviewFaqs, rivals, type Faq, type Rival } from "./data";
import "@/features/landing/landing.css";

const wrap = "mx-auto w-full max-w-[1000px] px-4 sm:px-8";
const h2 = "m-0 text-balance font-serif text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]";
const lead = "m-0 text-lg leading-relaxed text-ink-2";

/* ---------- The frame: header, sky, footer ---------- */

function Shell({ children, crumbs, jsonLd }: { children: ReactNode; crumbs: { name: string; path: string }[]; jsonLd: object[] }) {
  const data = { "@context": "https://schema.org", "@graph": [breadcrumbJsonLd(crumbs), ...jsonLd] };
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-bg text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />
      <header className="px-3 pt-3 sm:pt-4">
        <div className="chrome-pill mx-auto flex h-14 max-w-[1060px] items-center gap-2 pl-4 pr-2">
          <Link href="/" aria-label="Dovli home" className="mr-2 rounded-md">
            <DovliLogo size={28} />
          </Link>
          <nav aria-label="Compare" className="hidden items-center sm:flex">
            <Link href="/compare" className="flex h-8 items-center rounded-full px-3 text-base font-semibold text-ink-2 hover:text-ink">
              Compare
            </Link>
            {rivals.map((r) => (
              <Link key={r.slug} href={`/vs/${r.slug}`} className="flex h-8 items-center rounded-full px-3 text-base font-semibold text-ink-2 hover:text-ink">
                vs {r.name}
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
        <nav aria-label="Breadcrumb" className={cn(wrap, "pt-8")}>
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-ink-3">
            {crumbs.map((c, i) => (
              <li key={c.path} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="text-ink-2">
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
        {children}
      </main>

      <footer className={cn(wrap, "mt-24 border-t border-line py-8")}>
        <div className="flex flex-col gap-4 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>© {new Date().getFullYear()} Dovli</span>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <Link href="/compare" className="hover:text-ink">
              Compare
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">
              {SUPPORT_EMAIL}
            </a>
          </div>
          <span>
            Notion, Craft and Evernote are trademarks of their owners. Dovli isn&rsquo;t connected to them. Facts checked {CHECKED}; plans and prices change.
          </span>
        </div>
      </footer>
    </div>
  );
}

/** The opening: a big title on the landing page's sky, the short answer, and the main buttons. */
function Opening({ eyebrow, title, sub, children }: { eyebrow: string; title: ReactNode; sub: string; children: ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="px-2 pt-4 sm:px-4">
      <div className="lp-sky relative overflow-hidden rounded-[28px] sm:rounded-[40px]">
        <div aria-hidden="true" className="lp-ruled absolute inset-0" />
        <div className={cn(wrap, "relative py-14 sm:py-20")}>
          <p className="m-0 text-sm font-semibold text-ink-2">{eyebrow}</p>
          <h1 id="page-title" className="m-0 mt-3 text-balance font-serif text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[60px]">
            {title}
          </h1>
          <p className={cn(lead, "mt-5 max-w-[640px] sm:text-xl")}>{sub}</p>
          <div className="mt-8 rounded-[20px] bg-panel/90 p-5 shadow-sm ring-1 ring-line sm:p-6">{children}</div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={SIGNUP_PATH} className={cn(buttonStyles({ variant: "primary", size: "lg" }), "h-12 rounded-full px-6 text-md")}>
              Try Dovli free
            </Link>
            <a href={PLAY_STORE_URL} className="lp-badge inline-flex h-12 flex-none rounded-[8px]">
              <img src="/landing/google-play-badge.png" alt="Get it on Google Play" width={564} height={168} className="h-full w-auto" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Picks({ items }: { items: { who: string; text: string; mine?: boolean }[] }) {
  return (
    <div>
      <h2 className="m-0 text-sm font-semibold text-ink-3">The short answer</h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {items.map((it) => (
          <li key={it.who} className="flex gap-3 text-md leading-relaxed text-ink">
            <span aria-hidden="true" className={cn("mt-1 grid size-[20px] flex-none place-items-center rounded-[6px]", it.mine ? "bg-accent text-accent-ink" : "bg-well text-ink-2")}>
              {it.mine ? <DovliMark size={12} /> : <Icon name="arrowRight" size={12} />}
            </span>
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ticks({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-md leading-relaxed text-ink-2">
          <Icon name="check" size={16} aria-hidden="true" className={cn("mt-[5px] flex-none", muted ? "text-ink-3" : "text-accent")} />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Faqs({ faqs }: { faqs: Faq[] }) {
  return (
    <section aria-labelledby="faq-title" className={cn(wrap, "mt-20")}>
      <h2 id="faq-title" className={h2}>
        Questions people ask
      </h2>
      <div className="mt-6 flex flex-col divide-y divide-line border-y border-line">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <h3 className="m-0 text-lg font-semibold">{f.q}</h3>
              <Icon name="chevronDown" size={16} aria-hidden="true" className="flex-none text-ink-3 transition-transform group-open:rotate-180" />
            </summary>
            <p className="m-0 mt-2 max-w-[720px] text-md leading-relaxed text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function OtherComparisons({ current }: { current?: Rival["slug"] }) {
  return (
    <section aria-labelledby="more-title" className={cn(wrap, "mt-20")}>
      <h2 id="more-title" className={h2}>
        More comparisons
      </h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {current && (
          <CompareCard href="/compare" title="All four side by side" text="Dovli, Notion, Craft and Evernote in one table." />
        )}
        {rivals
          .filter((r) => r.slug !== current)
          .map((r) => (
            <CompareCard key={r.slug} href={`/vs/${r.slug}`} title={`Dovli vs ${r.name}`} text={r.promise} />
          ))}
      </div>
    </section>
  );
}

function CompareCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-1 rounded-[16px] bg-panel p-5 shadow-sm ring-1 ring-line transition-colors hover:bg-hover">
      <span className="flex items-center justify-between text-md font-semibold text-ink">
        {title}
        <Icon name="arrowRight" size={14} aria-hidden="true" className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="text-sm leading-snug text-ink-2">{text}</span>
    </Link>
  );
}

/* ---------- /vs/notion, /vs/craft, /vs/evernote ---------- */

export function VsPage({ rival }: { rival: Rival }) {
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
    <Shell crumbs={crumbs} jsonLd={[faqJsonLd(rival.faqs), howTo]}>
      <Opening
        eyebrow={`Dovli vs ${rival.name}`}
        title={
          <>
            Dovli vs {rival.name}
            <span className="block text-ink-2">{rival.promise}.</span>
          </>
        }
        sub={rival.description}
      >
        <Picks items={[{ who: "Dovli", text: rival.pickDovli, mine: true }, { who: rival.name, text: rival.pickThem }]} />
      </Opening>

      <section aria-labelledby="table-title" className={cn(wrap, "mt-20")}>
        <h2 id="table-title" className={h2}>
          Dovli and {rival.name}, side by side
        </h2>
        <div className="mt-6 overflow-hidden rounded-[18px] ring-1 ring-line">
          <table className="w-full border-collapse text-left text-base">
            <caption className="sr-only">
              Dovli compared with {rival.name}, checked {CHECKED}
            </caption>
            <thead className="bg-well text-sm text-ink-2">
              <tr>
                <th scope="col" className="w-[28%] px-4 py-3 font-semibold">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">
                  Dovli
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {rival.name}
                </th>
              </tr>
            </thead>
            <tbody className="bg-panel">
              {rival.rows.map((r) => (
                <tr key={r.label} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3.5 text-sm font-semibold text-ink">
                    {r.label}
                  </th>
                  <td className="px-4 py-3.5 leading-relaxed text-ink">{r.dovli}</td>
                  <td className="px-4 py-3.5 leading-relaxed text-ink-2">{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-3 text-sm text-ink-3">
          {rival.name} facts checked {CHECKED}. Plans change, so check {rival.name}&rsquo;s own site before you decide.
        </p>
      </section>

      <section aria-label="Strengths" className={cn(wrap, "mt-20 grid gap-10 md:grid-cols-2")}>
        <div>
          <h2 className={h2}>Where Dovli is different</h2>
          <div className="mt-6">
            <Ticks items={rival.dovliWins} />
          </div>
        </div>
        <div>
          <h2 className={h2}>Where {rival.name} is stronger</h2>
          <div className="mt-6">
            <Ticks items={rival.theyWin} muted />
          </div>
        </div>
      </section>

      <section aria-labelledby="move-title" className={cn(wrap, "mt-20")}>
        <h2 id="move-title" className={h2}>
          Move from {rival.name} to Dovli
        </h2>
        <p className={cn(lead, "mt-3 max-w-[640px]")}>It takes a few minutes, and your pages stay in {rival.name} too, so you can try both.</p>
        <ol className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-3">
          {rival.move.map((step, i) => (
            <li key={step} className="flex flex-col gap-3 rounded-[16px] bg-panel p-5 shadow-sm ring-1 ring-line">
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {i + 1}
              </span>
              <span className="text-md leading-relaxed text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <Faqs faqs={rival.faqs} />
      <OtherComparisons current={rival.slug} />
    </Shell>
  );
}

/* ---------- /compare ---------- */

export function OverviewPage() {
  const crumbs = [
    { name: "Dovli", path: "/" },
    { name: "Compare", path: "/compare" },
  ];
  const cols = [
    { key: "dovli", name: "Dovli" },
    { key: "notion", name: "Notion" },
    { key: "craft", name: "Craft" },
    { key: "evernote", name: "Evernote" },
  ] as const;
  return (
    <Shell crumbs={crumbs} jsonLd={[faqJsonLd(overviewFaqs)]}>
      <Opening
        eyebrow="Compare note-taking apps"
        title={
          <>
            Notion vs Craft vs Evernote
            <span className="block text-ink-2">and where Dovli fits.</span>
          </>
        }
        sub="Four note-taking apps, compared in plain words: what each one is best at, what it costs to start, and how to move your notes between them."
      >
        <Picks
          items={[
            { who: "Notion", text: "Notion is best for teams that run projects on databases and wikis." },
            { who: "Craft", text: "Craft is best for beautiful documents on a Mac, iPhone and iPad." },
            { who: "Evernote", text: "Evernote is best for saving and finding everything, with a strong web clipper." },
            { who: "Dovli", text: "Dovli is a free, calm place for your own notes, docs and whiteboards, on the web and Android.", mine: true },
          ]}
        />
      </Opening>

      <section aria-labelledby="table-title" className={cn(wrap, "mt-20")}>
        <h2 id="table-title" className={h2}>
          All four, side by side
        </h2>
        <div className="mt-6 overflow-x-auto rounded-[18px] ring-1 ring-line">
          <table className="w-full min-w-[620px] border-collapse text-left text-base">
            <caption className="sr-only">Dovli, Notion, Craft and Evernote compared, checked {CHECKED}</caption>
            <thead className="bg-well text-sm text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Feature</span>
                </th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className={cn("px-4 py-3 font-semibold", c.key === "dovli" && "text-ink")}>
                    {c.key === "dovli" ? c.name : <Link href={`/vs/${c.key}`} className="hover:text-ink hover:underline">{c.name}</Link>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-panel">
              {overview.map((r) => (
                <tr key={r.label} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3.5 text-sm font-semibold text-ink">
                    {r.label}
                  </th>
                  {cols.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3.5 leading-relaxed", c.key === "dovli" ? "text-ink" : "text-ink-2")}>
                      {r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-3 text-sm text-ink-3">Checked {CHECKED}. Plans change, so check each app&rsquo;s own site before you decide.</p>
      </section>

      <section aria-labelledby="each-title" className={cn(wrap, "mt-20")}>
        <h2 id="each-title" className={h2}>
          Dovli next to each one
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {rivals.map((r) => (
            <CompareCard key={r.slug} href={`/vs/${r.slug}`} title={`Dovli vs ${r.name}`} text={r.pickDovli} />
          ))}
        </div>
      </section>

      <Faqs faqs={overviewFaqs} />
    </Shell>
  );
}
