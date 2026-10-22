"use client";

// Dovli for Android: the Google Play badge, phones holding real screens from the app (cut from the
// Play listing's screenshots and promo video in apps/mobile/store-listing), and the Android
// section. Landing.tsx also puts the badge in the hero, the menu, the closing card and the footer.

import { useSyncExternalStore, type CSSProperties } from "react";
import { Icon, cn, type IconName } from "@dovli/ui";
import { trackEvent } from "@/lib/analytics";
import { Status, container, h2Class, leadClass } from "./Sections";
import { APK_PATH, PLAY_LAUNCH_AT, PLAY_STORE_URL } from "./playStore";
import { tone, type Tone } from "./tones";

export { PLAY_STORE_URL };

// One clock for every countdown on the page. 0 on the server and while hydrating, so the first
// render matches the server's HTML whatever the time is.
let clock = 0;
let ticker: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  listeners.add(listener);
  if (!ticker) {
    clock = Date.now();
    ticker = setInterval(() => {
      clock = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
}

/** Milliseconds until the Google Play launch (0 once it's out), or null until the page has a clock. */
export function usePlayCountdown(): { launched: boolean; left: number | null } {
  const now = useSyncExternalStore(subscribeClock, () => clock, () => 0);
  if (!now) return { launched: false, left: null };
  const left = Math.max(0, PLAY_LAUNCH_AT - now);
  return { launched: left === 0, left };
}

function split(ms: number) {
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60 };
}

const two = (n: number) => String(n).padStart(2, "0");
const launchDay = new Date(PLAY_LAUNCH_AT).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

type Screen = { src: string; width: number; height: number; alt: string };

const screens = {
  home: { src: "/landing/android-home.webp", width: 720, height: 1108, alt: "Dovli's home screen on Android: search, buttons for a new page or a to-do list, and your to-dos" },
  recipe: { src: "/landing/android-recipe.webp", width: 720, height: 1108, alt: "A recipe for masala chai in the Café page style, with a table of ingredients" },
  dark: { src: "/landing/android-dark.webp", width: 720, height: 1108, alt: "Settings in a dark theme, with the app's four themes to pick from" },
  kyoto: { src: "/landing/android-kyoto-full.webp", width: 432, height: 960, alt: "Dovli on an Android phone: a trip plan called Weekend in Kyoto, in the Cherry Blossom page style" },
} satisfies Record<string, Screen>;

/**
 * Google's "Get it on Google Play" badge, used the way Google asks: their artwork, unchanged, linking
 * to the listing. Before the launch the listing isn't public, so in its place: the APK, with the
 * time left until Google Play. The same size as the badge, so it fits wherever the badge goes.
 */
export function GooglePlayBadge({ place, className }: { place: string; className?: string }) {
  const { launched, left } = usePlayCountdown();
  if (!launched) {
    const t = left === null ? null : split(left);
    return (
      <a
        href={APK_PATH}
        onClick={() => trackEvent("APK click", { place })}
        className={cn(
          "lp-badge inline-flex h-12 flex-none items-center gap-2.5 rounded-[8px] bg-[#15171D] pl-3 pr-4 text-left text-white ring-1 ring-white/15",
          className,
        )}
      >
        <Icon name="download" size={20} className="flex-none" aria-hidden="true" />
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-[11px] leading-tight text-white/75 tabular-nums">
            {t ? `Google Play in ${t.days}d ${two(t.hours)}:${two(t.minutes)}:${two(t.seconds)}` : `On Google Play ${launchDay}`}
          </span>
          <span className="whitespace-nowrap text-[15px] font-semibold leading-tight">Download the APK</span>
        </span>
      </a>
    );
  }
  return (
    <a href={PLAY_STORE_URL} onClick={() => trackEvent("Play Store click", { place })} className={cn("lp-badge inline-flex h-12 flex-none rounded-[8px]", className)}>
      <img src="/landing/google-play-badge.png" alt="Get it on Google Play" width={564} height={168} className="h-full w-auto" />
    </a>
  );
}

/**
 * A phone holding a real screen from the app. A `rising` phone shows only the top of its screen and
 * runs out of the bottom of the panel it sits in. Lazy everywhere: a phone hidden at some widths
 * is then never downloaded there.
 */
function Phone({ screen, rising, className, style }: { screen: Screen; rising?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("lp-device", className)} style={style} data-rising={rising ? "" : undefined}>
      <div className="lp-device-body">
        <img src={screen.src} alt={screen.alt} width={screen.width} height={screen.height} loading="lazy" decoding="async" draggable={false} className="lp-device-screen" />
      </div>
    </div>
  );
}

/** The home screen rising out of a tile, for small pictures elsewhere (decorative there). */
export function MiniPhone({ className }: { className?: string }) {
  return <Phone screen={{ ...screens.home, alt: "" }} rising className={className} />;
}

/** The phone beside the hero picture on wide screens: the same pages, on Android. */
export function HeroPhone({ className }: { className?: string }) {
  return (
    <div className={cn("lp-rise", className)} style={{ "--d": "1.15s" } as CSSProperties}>
      <div className="lp-drift">
        <Phone screen={screens.kyoto} className="w-[224px]" />
      </div>
    </div>
  );
}

// The listing's address (PLAY_STORE_URL) as a QR code: version 4, error correction M, 33 modules a
// side. Checked with a QR reader; make it again if the address ever changes.
const QR_PATH =
  "M0 0h7v1h-7zM8 0h1v1h-1zM10 0h3v1h-3zM18 0h4v1h-4zM23 0h1v1h-1zM26 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h3v1h-3zM12 1h1v1h-1zM14 1h1v1h-1zM16 1h1v1h-1zM18 1h1v1h-1zM22 1h2v1h-2zM26 1h1v1h-1zM32 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM9 2h2v1h-2zM12 2h3v1h-3zM22 2h3v1h-3zM26 2h1v1h-1zM28 2h3v1h-3zM32 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM10 3h1v1h-1zM15 3h1v1h-1zM17 3h1v1h-1zM20 3h1v1h-1zM23 3h2v1h-2zM26 3h1v1h-1zM28 3h3v1h-3zM32 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h2v1h-2zM12 4h2v1h-2zM16 4h1v1h-1zM19 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM26 4h1v1h-1zM28 4h3v1h-3zM32 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM12 5h1v1h-1zM14 5h8v1h-8zM24 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h7v1h-7zM8 7h1v1h-1zM10 7h1v1h-1zM15 7h5v1h-5zM22 7h2v1h-2zM0 8h1v1h-1zM2 8h2v1h-2zM5 8h3v1h-3zM11 8h1v1h-1zM14 8h5v1h-5zM21 8h1v1h-1zM23 8h1v1h-1zM26 8h1v1h-1zM29 8h1v1h-1zM31 8h2v1h-2zM1 9h1v1h-1zM4 9h2v1h-2zM7 9h1v1h-1zM9 9h2v1h-2zM13 9h1v1h-1zM16 9h5v1h-5zM23 9h2v1h-2zM26 9h2v1h-2zM29 9h4v1h-4zM1 10h3v1h-3zM6 10h1v1h-1zM8 10h2v1h-2zM13 10h1v1h-1zM17 10h2v1h-2zM20 10h1v1h-1zM22 10h3v1h-3zM26 10h4v1h-4zM31 10h2v1h-2zM0 11h1v1h-1zM4 11h1v1h-1zM8 11h2v1h-2zM11 11h2v1h-2zM15 11h2v1h-2zM20 11h1v1h-1zM27 11h1v1h-1zM29 11h1v1h-1zM31 11h1v1h-1zM1 12h1v1h-1zM3 12h2v1h-2zM6 12h3v1h-3zM10 12h1v1h-1zM12 12h1v1h-1zM14 12h4v1h-4zM19 12h1v1h-1zM22 12h4v1h-4zM27 12h3v1h-3zM0 13h2v1h-2zM4 13h2v1h-2zM7 13h2v1h-2zM11 13h1v1h-1zM13 13h2v1h-2zM19 13h1v1h-1zM21 13h1v1h-1zM24 13h1v1h-1zM27 13h1v1h-1zM29 13h1v1h-1zM31 13h1v1h-1zM0 14h1v1h-1zM3 14h6v1h-6zM18 14h2v1h-2zM21 14h1v1h-1zM24 14h1v1h-1zM26 14h1v1h-1zM28 14h3v1h-3zM0 15h2v1h-2zM3 15h2v1h-2zM7 15h3v1h-3zM11 15h1v1h-1zM13 15h3v1h-3zM20 15h4v1h-4zM25 15h2v1h-2zM30 15h1v1h-1zM0 16h4v1h-4zM6 16h2v1h-2zM9 16h2v1h-2zM12 16h2v1h-2zM16 16h1v1h-1zM20 16h3v1h-3zM24 16h3v1h-3zM28 16h3v1h-3zM0 17h3v1h-3zM7 17h2v1h-2zM11 17h3v1h-3zM15 17h1v1h-1zM17 17h1v1h-1zM22 17h3v1h-3zM26 17h1v1h-1zM28 17h2v1h-2zM32 17h1v1h-1zM0 18h8v1h-8zM12 18h2v1h-2zM15 18h2v1h-2zM18 18h1v1h-1zM20 18h2v1h-2zM26 18h3v1h-3zM30 18h2v1h-2zM1 19h1v1h-1zM4 19h1v1h-1zM7 19h1v1h-1zM9 19h2v1h-2zM13 19h1v1h-1zM15 19h4v1h-4zM22 19h2v1h-2zM25 19h2v1h-2zM28 19h1v1h-1zM32 19h1v1h-1zM1 20h1v1h-1zM4 20h1v1h-1zM6 20h3v1h-3zM11 20h2v1h-2zM15 20h2v1h-2zM19 20h1v1h-1zM21 20h1v1h-1zM24 20h1v1h-1zM27 20h1v1h-1zM29 20h3v1h-3zM0 21h4v1h-4zM5 21h1v1h-1zM10 21h2v1h-2zM14 21h7v1h-7zM22 21h3v1h-3zM26 21h1v1h-1zM29 21h1v1h-1zM32 21h1v1h-1zM2 22h1v1h-1zM6 22h3v1h-3zM12 22h1v1h-1zM15 22h1v1h-1zM18 22h1v1h-1zM20 22h5v1h-5zM26 22h2v1h-2zM30 22h3v1h-3zM1 23h2v1h-2zM4 23h2v1h-2zM7 23h1v1h-1zM9 23h2v1h-2zM12 23h4v1h-4zM18 23h1v1h-1zM20 23h1v1h-1zM23 23h1v1h-1zM25 23h1v1h-1zM27 23h3v1h-3zM32 23h1v1h-1zM0 24h1v1h-1zM2 24h5v1h-5zM8 24h1v1h-1zM11 24h1v1h-1zM13 24h1v1h-1zM17 24h1v1h-1zM19 24h1v1h-1zM22 24h1v1h-1zM24 24h5v1h-5zM31 24h1v1h-1zM8 25h1v1h-1zM10 25h1v1h-1zM14 25h3v1h-3zM18 25h2v1h-2zM23 25h2v1h-2zM28 25h2v1h-2zM31 25h1v1h-1zM0 26h7v1h-7zM8 26h1v1h-1zM10 26h2v1h-2zM13 26h2v1h-2zM16 26h4v1h-4zM22 26h3v1h-3zM26 26h1v1h-1zM28 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM8 27h4v1h-4zM13 27h6v1h-6zM20 27h2v1h-2zM23 27h2v1h-2zM28 27h4v1h-4zM0 28h1v1h-1zM2 28h3v1h-3zM6 28h1v1h-1zM10 28h2v1h-2zM16 28h13v1h-13zM30 28h1v1h-1zM32 28h1v1h-1zM0 29h1v1h-1zM2 29h3v1h-3zM6 29h1v1h-1zM8 29h3v1h-3zM13 29h2v1h-2zM16 29h1v1h-1zM27 29h1v1h-1zM29 29h1v1h-1zM32 29h1v1h-1zM0 30h1v1h-1zM2 30h3v1h-3zM6 30h1v1h-1zM8 30h2v1h-2zM11 30h8v1h-8zM22 30h2v1h-2zM26 30h2v1h-2zM30 30h1v1h-1zM0 31h1v1h-1zM6 31h1v1h-1zM9 31h1v1h-1zM11 31h1v1h-1zM13 31h2v1h-2zM17 31h2v1h-2zM20 31h1v1h-1zM22 31h1v1h-1zM24 31h2v1h-2zM27 31h2v1h-2zM32 31h1v1h-1zM0 32h7v1h-7zM8 32h1v1h-1zM10 32h1v1h-1zM17 32h3v1h-3zM21 32h1v1h-1zM23 32h1v1h-1zM25 32h1v1h-1zM28 32h1v1h-1zM30 32h1v1h-1z";


// dovli.in/apk (APK_PATH) the same way: version 2, error correction M, 25 modules a side. Checked
// with a QR reader.
const APK_QR_PATH =
  "M0 0h7v1h-7zM9 0h2v1h-2zM12 0h1v1h-1zM16 0h1v1h-1zM18 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM11 1h2v1h-2zM15 1h2v1h-2zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h2v1h-2zM12 2h1v1h-1zM14 2h1v1h-1zM16 2h1v1h-1zM18 2h1v1h-1zM20 2h3v1h-3zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h2v1h-2zM11 3h4v1h-4zM18 3h1v1h-1zM20 3h3v1h-3zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h2v1h-2zM11 4h2v1h-2zM14 4h1v1h-1zM18 4h1v1h-1zM20 4h3v1h-3zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h2v1h-2zM11 5h2v1h-2zM15 5h1v1h-1zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h7v1h-7zM8 7h1v1h-1zM12 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM2 8h5v1h-5zM9 8h3v1h-3zM13 8h2v1h-2zM18 8h5v1h-5zM0 9h2v1h-2zM4 9h1v1h-1zM8 9h1v1h-1zM10 9h2v1h-2zM13 9h1v1h-1zM16 9h1v1h-1zM19 9h1v1h-1zM23 9h1v1h-1zM0 10h2v1h-2zM3 10h5v1h-5zM10 10h4v1h-4zM15 10h3v1h-3zM21 10h1v1h-1zM23 10h2v1h-2zM1 11h2v1h-2zM4 11h1v1h-1zM7 11h2v1h-2zM11 11h2v1h-2zM14 11h2v1h-2zM17 11h1v1h-1zM19 11h1v1h-1zM24 11h1v1h-1zM2 12h5v1h-5zM8 12h3v1h-3zM17 12h2v1h-2zM20 12h1v1h-1zM22 12h3v1h-3zM0 13h3v1h-3zM4 13h1v1h-1zM12 13h2v1h-2zM16 13h2v1h-2zM19 13h1v1h-1zM21 13h1v1h-1zM23 13h1v1h-1zM0 14h1v1h-1zM2 14h2v1h-2zM5 14h2v1h-2zM8 14h1v1h-1zM10 14h1v1h-1zM13 14h3v1h-3zM17 14h5v1h-5zM23 14h2v1h-2zM0 15h1v1h-1zM2 15h1v1h-1zM4 15h1v1h-1zM7 15h1v1h-1zM9 15h2v1h-2zM12 15h2v1h-2zM16 15h1v1h-1zM19 15h2v1h-2zM24 15h1v1h-1zM0 16h1v1h-1zM6 16h3v1h-3zM12 16h1v1h-1zM14 16h1v1h-1zM16 16h5v1h-5zM22 16h1v1h-1zM8 17h1v1h-1zM10 17h1v1h-1zM15 17h2v1h-2zM20 17h2v1h-2zM0 18h7v1h-7zM11 18h2v1h-2zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM22 18h3v1h-3zM0 19h1v1h-1zM6 19h1v1h-1zM8 19h1v1h-1zM11 19h1v1h-1zM14 19h3v1h-3zM20 19h2v1h-2zM24 19h1v1h-1zM0 20h1v1h-1zM2 20h3v1h-3zM6 20h1v1h-1zM8 20h2v1h-2zM11 20h1v1h-1zM15 20h6v1h-6zM22 20h3v1h-3zM0 21h1v1h-1zM2 21h3v1h-3zM6 21h1v1h-1zM8 21h2v1h-2zM12 21h3v1h-3zM17 21h2v1h-2zM20 21h5v1h-5zM0 22h1v1h-1zM2 22h3v1h-3zM6 22h1v1h-1zM8 22h2v1h-2zM13 22h4v1h-4zM21 22h2v1h-2zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM9 23h2v1h-2zM12 23h2v1h-2zM15 23h3v1h-3zM19 23h3v1h-3zM24 23h1v1h-1zM0 24h7v1h-7zM8 24h3v1h-3zM12 24h1v1h-1zM14 24h1v1h-1zM18 24h7v1h-7z";

/** For people reading on a computer: point the phone's camera at it to open the listing (or, before the launch, get the APK). */
function PlayQr({ apk }: { apk: boolean }) {
  return (
    <figure className="m-0 hidden items-center gap-3.5 lg:flex">
      <span className="grid flex-none place-items-center rounded-[16px] bg-white p-2 shadow-sm ring-1 ring-black/5">
        {/* Always dark on white: phone cameras read QR codes that way round, in light and dark themes. */}
        {apk ? (
          <svg viewBox="-2 -2 29 29" className="block size-[84px]" role="img" aria-label="QR code for the Dovli APK" shapeRendering="crispEdges">
            <path d={APK_QR_PATH} fill="#15171D" />
          </svg>
        ) : (
          <svg viewBox="-2 -2 37 37" className="block size-[84px]" role="img" aria-label="QR code for Dovli on Google Play" shapeRendering="crispEdges">
            <path d={QR_PATH} fill="#15171D" />
          </svg>
        )}
      </span>
      <figcaption className="max-w-[132px] text-sm leading-snug text-ink-2">Or scan it with your phone&apos;s camera</figcaption>
    </figure>
  );
}

/** The time left until Dovli opens on Google Play, as four tiles. Dashes until the page has a clock. */
function PlayCountdown({ left }: { left: number | null }) {
  const t = left === null ? null : split(left);
  const parts = [
    { label: "days", value: t && String(t.days) },
    { label: "hours", value: t && two(t.hours) },
    { label: "min", value: t && two(t.minutes) },
    { label: "sec", value: t && two(t.seconds) },
  ];
  return (
    <div className="mt-7 max-w-[400px]">
      <p className="m-0 text-sm font-semibold text-ink-2">Opens on Google Play on {launchDay}</p>
      <div role="timer" aria-label={t ? `${t.days} days and ${t.hours} hours until Google Play` : `Until ${launchDay}`} className="mt-3 grid grid-cols-4 gap-2">
        {parts.map((p) => (
          <div key={p.label} className="rounded-[14px] bg-panel/85 py-2.5 text-center shadow-sm ring-1 ring-line">
            <span aria-hidden="true" className="block font-serif text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
              {p.value ?? "–"}
            </span>
            <span aria-hidden="true" className="mt-1.5 block text-xs text-ink-3">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const perks: { icon: IconName; t: Tone; title: string; text: string }[] = [
  { icon: "sync", t: "lilac", title: "Synced with the web", text: "Same pages, phone and web" },
  { icon: "cloudOff", t: "sky", title: "Works without signal", text: "Opens and saves offline" },
  { icon: "board", t: "mint", title: "Sketch on the go", text: "Whiteboards with a finger" },
  { icon: "palette", t: "butter", title: "Make it yours", text: "Page styles, light or dark" },
];

function Note({ icon, t, title, text, className }: { icon: IconName; t: Tone; title: string; text: string; className: string }) {
  return (
    <div aria-hidden="true" className={cn("lp-float absolute z-[3] hidden items-center gap-2.5 rounded-[18px] py-3 pl-3 pr-4 text-sm surface-raised sm:flex", className)}>
      <span className="grid size-8 flex-none place-items-center rounded-lg" style={{ background: tone(t).bg, color: tone(t).ink }}>
        <Icon name={icon} size={16} />
      </span>
      <span className="whitespace-nowrap">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-3">{text}</span>
      </span>
    </div>
  );
}

/** Three phones fanned out from the bottom edge of the panel, with two notes floating over them. */
function PhoneFan() {
  return (
    <div className="lp-fan relative mt-12 h-[370px] sm:h-[470px] xl:mt-0 xl:h-auto xl:min-h-[600px]">
      <Phone screen={screens.recipe} rising className="lp-fan-phone lp-fan-l" />
      <Phone screen={screens.dark} rising className="lp-fan-phone lp-fan-r" />
      <Phone screen={screens.home} rising className="lp-fan-phone lp-fan-c" />
      <Note icon="cloudCheck" t="mint" title="Synced with the web" text="Just now" className="left-[calc(var(--mid)-var(--c-w)/2-130px)] top-[30%]" />
      <Note icon="cloudOff" t="sky" title="Works offline" text="Saved on this phone" className="left-[calc(var(--mid)+var(--c-w)/2-44px)] top-[54%]" />
    </div>
  );
}

export function Android() {
  const { launched, left } = usePlayCountdown();
  return (
    <section id="android" aria-labelledby="android-title" className="px-2 sm:px-4">
      {/* overflow: clip, not hidden, so the phones' scroll-linked motion still follows the page. */}
      <div className="lp-pocket relative isolate overflow-clip rounded-[28px] sm:rounded-[44px]">
        <div className={cn(container, "grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-6")}>
          {/* Above the phones (medium widths) the words take two columns, so the panel isn't half empty. */}
          <div className="pt-14 sm:pt-20 md:grid md:grid-cols-2 md:items-end md:gap-x-10 xl:block xl:py-20">
            <div>
              <Status t="mint">{launched ? "Now on Google Play" : "Out now as an APK"}</Status>
              <h2 id="android-title" className={cn(h2Class, "mt-5 text-ink")}>
                Your pages, in your pocket
              </h2>
              <p className={cn(leadClass, "mt-4 max-w-[500px]")}>
                {launched
                  ? "Dovli for Android is here. Jot something down on the train, and find it waiting on the web when you sit down. Free, with no ads."
                  : "Dovli for Android is in its last days of testing on Google Play. Don't want to wait? Install the APK now: the same app, free, with no ads."}
              </p>
              {!launched && <PlayCountdown left={left} />}
            </div>
            <div>
              <ul className="m-0 mt-7 grid max-w-[520px] list-none grid-cols-1 gap-x-5 gap-y-4 p-0 min-[440px]:grid-cols-2 md:mt-0 md:grid-cols-1 lg:grid-cols-2 xl:mt-7">
                {perks.map((p) => (
                  <li key={p.title} className="flex items-center gap-3">
                    <span className="grid size-9 flex-none place-items-center rounded-[10px] bg-panel shadow-sm" style={{ color: tone(p.t).ink }} aria-hidden="true">
                      <Icon name={p.icon} size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-md font-semibold leading-tight text-ink">{p.title}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-ink-2">{p.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                <GooglePlayBadge place="android" className="h-14" />
                <PlayQr apk={!launched} />
              </div>
              {!launched && (
                <p className="m-0 mt-4 max-w-[460px] text-sm leading-snug text-ink-3">
                  Your phone will ask you to allow installs from your browser, as it does for any app from outside Google Play. Once Dovli is on Google Play, uninstall the APK before installing it from there; your pages stay in your account.
                </p>
              )}
            </div>
          </div>
          <PhoneFan />
        </div>
      </div>
    </section>
  );
}
