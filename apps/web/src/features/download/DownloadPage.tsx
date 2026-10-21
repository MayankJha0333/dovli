"use client";

// dovli.in/download: Dovli for Mac and Windows. The big button offers the visitor's own computer
// (worked out in the browser, after the page loads), with the other one beside it; then the two
// downloads side by side with how to install, what the app does that a browser tab doesn't, and
// the other ways to use Dovli. With no release published yet, it all says "coming soon".

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { DovliLogo, Icon, buttonStyles, cn, type IconName } from "@dovli/ui";
import "@/features/landing/landing.css";
import { GooglePlayBadge } from "@/features/landing/Android";
import { Status, container } from "@/features/landing/Sections";
import { tone, type Tone } from "@/features/landing/tones";
import { trackEvent } from "@/lib/analytics";
import { APP_PATH } from "@/lib/authGate";
import { DESKTOP_REPO, detectOs, formatSize, type DesktopFile, type DesktopOs, type DesktopRelease } from "@/lib/desktopRelease";
import { DesktopPicture, WindowsIcon } from "./DesktopPicture";

const delay = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

const systems = {
  mac: {
    name: "Mac",
    icon: <Icon name="apple" size={18} />,
    needs: "macOS 12 Monterey or later",
    detail: "One app for Apple silicon and Intel Macs",
    steps: ["Open the downloaded Dovli disk image", "Drag Dovli into your Applications folder", "Open Dovli and sign in"],
  },
  windows: {
    name: "Windows",
    icon: <WindowsIcon size={16} />,
    needs: "Windows 10 or 11",
    detail: "For 64-bit Intel and AMD PCs, and Windows on Arm",
    steps: ["Open the downloaded Dovli installer", "Pick where to install it, then Install", "Open Dovli from the Start menu and sign in"],
  },
} as const;

type System = keyof typeof systems;

const perks: { icon: IconName; t: Tone; title: string; text: string }[] = [
  { icon: "cloudOff", t: "blue", title: "Works with no internet", text: "Every change is saved on your computer first. Write on a plane, a train, or when the Wi-Fi drops." },
  { icon: "sync", t: "mint", title: "Syncs on its own", text: "Back online, your changes go to your other devices by themselves. Edits made in two places are merged, not lost." },
  { icon: "keyboard", t: "lilac", title: "Feels at home", text: "Its own window, menu bar and shortcuts: ⌘N or Ctrl+N for a new page, ⌘K to search, ⌘, for settings." },
  { icon: "download", t: "butter", title: "Keeps itself up to date", text: "New versions download in the background. Restart when it suits you, and nothing you wrote is lost." },
];

function DownloadButton({ system, file, primary, place }: { system: System; file: DesktopFile | null; primary?: boolean; place: string }) {
  const s = systems[system];
  // Nothing to download yet: a quiet label, so the accent isn't spent on something that does nothing.
  const cls = cn(buttonStyles({ variant: primary && file ? "primary" : "secondary", size: "lg" }), "h-12 gap-2.5 rounded-full px-6 text-base");
  if (!file)
    return (
      <span className={cn(cls, "pointer-events-none text-ink-2")} aria-disabled="true">
        {s.icon}
        {s.name} · coming soon
      </span>
    );
  return (
    <a href={file.url} className={cls} onClick={() => trackEvent("Desktop download click", { os: system, place })}>
      {s.icon}
      Download for {s.name}
    </a>
  );
}

function SystemCard({ system, file, release }: { system: System; file: DesktopFile | null; release: DesktopRelease | null }) {
  const s = systems[system];
  return (
    <article className="flex flex-col rounded-[28px] bg-panel p-6 shadow-sm ring-1 ring-line sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 flex-none place-items-center rounded-[14px] bg-well text-ink">{s.icon}</span>
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-semibold text-ink">Dovli for {s.name}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{s.detail}</p>
        </div>
      </div>
      <dl className="m-0 mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-4 text-sm">
        <dt className="text-ink-3">Needs</dt>
        <dd className="m-0 text-right text-ink">{s.needs}</dd>
        <dt className="text-ink-3">Version</dt>
        <dd className="m-0 text-right text-ink">{release && file ? release.version : "Coming soon"}</dd>
        <dt className="text-ink-3">Download</dt>
        <dd className="m-0 truncate text-right text-ink">{file ? `${formatSize(file.size)} · ${system === "mac" ? ".dmg" : ".exe"}` : "—"}</dd>
      </dl>
      <h3 className="m-0 mt-6 text-sm font-semibold text-ink">Install in three steps</h3>
      <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {s.steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-md text-ink-2">
            <span className="grid size-6 flex-none place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-auto pt-7">
        <DownloadButton system={system} file={file} primary place={`card-${system}`} />
      </div>
    </article>
  );
}

function Other({ icon, t, title, text, children }: { icon: IconName; t: Tone; title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] p-6 sm:flex-row sm:items-center" style={{ background: tone(t).bg }}>
      <span className="grid size-11 flex-none place-items-center rounded-[12px] bg-panel/80" style={{ color: tone(t).ink }}>
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-md font-semibold text-ink">{title}</p>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{text}</p>
      </div>
      {children}
    </div>
  );
}

export function DownloadPage({ release }: { release: DesktopRelease | null }) {
  // Which computer this is, known only in the browser: until then, the Mac comes first.
  const [os, setOs] = useState<DesktopOs>("other");
  useEffect(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
    setOs(detectOs(navigator.userAgent, platform));
  }, []);
  const first: System = os === "windows" ? "windows" : "mac";
  const second: System = first === "mac" ? "windows" : "mac";
  const fileFor = (s: System) => (s === "mac" ? release?.mac : release?.windows) ?? null;
  const date = release?.publishedAt ? new Date(release.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-bg text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] overflow-hidden">
        <div className="lp-wash absolute -left-24 -right-24 -top-40 h-[520px] opacity-60" />
      </div>

      <header className={cn(container, "flex h-20 items-center justify-between")}>
        <Link href="/" aria-label="Dovli home" className="rounded-md">
          <DovliLogo size={30} />
        </Link>
        <Link href={APP_PATH} className={cn(buttonStyles({ variant: "secondary", size: "md" }), "rounded-full px-4")}>
          Open Dovli on the web
        </Link>
      </header>

      <main id="main">
        {/* Hero */}
        <section className={cn(container, "grid items-center gap-12 pb-16 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:pb-24")}>
          <div>
            <span className="lp-fade" style={delay(0)}>
              <Status>{release ? `Version ${release.version}${date ? ` · ${date}` : ""}` : "Coming soon"}</Status>
            </span>
            <h1 className="lp-fade m-0 mt-5 text-balance font-serif text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-[56px]" style={delay(0.05)}>
              Dovli for Mac and Windows
            </h1>
            <p className="lp-fade m-0 mt-4 max-w-[520px] text-lg leading-relaxed text-ink-2" style={delay(0.1)}>
              Your pages in their own window. It works with no internet and syncs with your phone and the web the moment you&apos;re back online.
            </p>
            <div className="lp-fade mt-8 flex flex-wrap items-center gap-3" style={delay(0.15)}>
              <DownloadButton system={first} file={fileFor(first)} primary place="hero" />
              <DownloadButton system={second} file={fileFor(second)} place="hero-other" />
            </div>
            <p className="lp-fade m-0 mt-4 text-sm text-ink-3" style={delay(0.2)}>
              {release ? (
                <>
                  Free, with the same account as the web and Android apps.{" "}
                  <a href={release.notesUrl} className="font-medium text-ink-2 underline-offset-2 hover:underline">
                    What&apos;s new in {release.version}
                  </a>
                </>
              ) : (
                <>
                  The desktop app is on its way. Meanwhile,{" "}
                  <Link href={APP_PATH} className="font-medium text-ink-2 underline-offset-2 hover:underline">
                    use Dovli on the web
                  </Link>
                  : it&apos;s the same account, and your pages will be waiting in the app.
                </>
              )}
            </p>
          </div>

          <div className="lp-fade relative" style={delay(0.2)}>
            <DesktopPicture os={first === "windows" ? "windows" : "mac"} />
            <DesktopPicture os={first === "windows" ? "mac" : "windows"} sync="offline" compact className="absolute -bottom-8 -left-4 hidden w-[46%] sm:block lg:-left-10" />
          </div>
        </section>

        {/* Both downloads */}
        <section aria-label="Downloads" className={cn(container, "grid gap-4 pb-20 md:grid-cols-2 lg:pb-24")}>
          <SystemCard system="mac" file={release?.mac ?? null} release={release} />
          <SystemCard system="windows" file={release?.windows ?? null} release={release} />
        </section>

        {/* What the desktop app adds */}
        <section aria-labelledby="perks-title" className={cn(container, "pb-20 lg:pb-24")}>
          <h2 id="perks-title" className="m-0 text-balance font-serif text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[36px]">
            Made for your computer
          </h2>
          <ul className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map((p) => (
              <li key={p.title} className="rounded-[24px] p-6" style={{ background: tone(p.t).bg }}>
                <span className="grid size-10 place-items-center rounded-[12px] bg-panel/80" style={{ color: tone(p.t).ink }} aria-hidden="true">
                  <Icon name={p.icon} size={18} />
                </span>
                <h3 className="m-0 mt-5 text-md font-semibold text-ink">{p.title}</h3>
                <p className="m-0 mt-1.5 text-sm leading-relaxed text-ink-2">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Other ways */}
        <section aria-labelledby="other-title" className={cn(container, "pb-20")}>
          <h2 id="other-title" className="m-0 text-xl font-semibold text-ink">
            Other ways to use Dovli
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Other icon="monitor" t="sky" title="On the web" text="Every feature in any modern browser, nothing to install.">
              <Link href={APP_PATH} className={cn(buttonStyles({ variant: "secondary", size: "md" }), "flex-none rounded-full px-4")}>
                Open Dovli
              </Link>
            </Other>
            <Other icon="device" t="pink" title="On Android" text="Your pages on your phone, offline too.">
              <GooglePlayBadge place="download-page" className="h-10" />
            </Other>
          </div>
        </section>
      </main>

      <footer className={cn(container, "flex flex-col gap-3 border-t border-line py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between")}>
        <span>© {new Date().getFullYear()} Dovli</span>
        <span className="flex flex-wrap gap-x-5 gap-y-2">
          <a href={`https://github.com/${DESKTOP_REPO}/releases`} className="hover:text-ink">
            All versions
          </a>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <span>Google Play and the Google Play logo are trademarks of Google LLC.</span>
        </span>
      </footer>
    </div>
  );
}
