import { useId } from "react";
import { cn } from "./cn";

// Dovli's mark: a sheet of paper folded into a D. The left half is the page's front (pale, blue
// to pink), the bowl is the page curling back (blue to violet), with a soft shade along the fold.
// One drawing, used everywhere: the sidebar, sign-in, shared pages, the browser tab and the app icon.

/** The paths, in the mark's own 344 × 426 space (viewBox "30 22 344 426"). */
export const MARK = {
  viewBox: "30 22 344 426",
  bowl: "M44 50C50 36 62 30 80 30L180 32C292 36 366 120 366 228C366 336 298 408 222 416L222 186C170 160 92 120 44 50Z",
  shade: "M222 186C246 198 276 222 316 262V430H222Z",
  sheet: "M40 66C40 58 41 53 44 50C92 120 170 160 222 186L222 440C214 424 197 411 172 403L92 378C60 368 40 346 40 316Z",
  edge: "M222 188V438",
  crease: "M46 52C94 120 170 160 220 186",
} as const;

/** The mark as an SVG string (for icons and files made outside React). */
export function markSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.viewBox}">${defs("m")}${body("m")}</svg>`;
}

function defs(p: string) {
  return `<defs>
<linearGradient id="${p}b" x1="90" y1="40" x2="340" y2="400" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7DB4FF"/><stop offset=".45" stop-color="#A592FF"/><stop offset=".8" stop-color="#B57CF6"/><stop offset="1" stop-color="#E39AEC"/></linearGradient>
<linearGradient id="${p}f" x1="222" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5A4BD6" stop-opacity=".5"/><stop offset="1" stop-color="#5A4BD6" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}s" x1="60" y1="60" x2="200" y2="430" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9CC3FF"/><stop offset=".38" stop-color="#D9DCFF"/><stop offset=".72" stop-color="#EBD9FB"/><stop offset="1" stop-color="#F6B9EE"/></linearGradient>
<linearGradient id="${p}e" x1="0" y1="186" x2="0" y2="440" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".6"/></linearGradient>
<clipPath id="${p}c"><path d="${MARK.bowl}"/></clipPath>
</defs>`;
}

function body(p: string) {
  return `<path fill="url(#${p}b)" d="${MARK.bowl}"/><path fill="url(#${p}f)" clip-path="url(#${p}c)" d="${MARK.shade}"/><path fill="url(#${p}s)" d="${MARK.sheet}"/><path fill="none" stroke="url(#${p}e)" stroke-width="3" d="${MARK.edge}"/><path fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round" d="${MARK.crease}"/>`;
}

/** The Dovli mark. `size` is its height in px; it is a little narrower than tall. */
export function DovliMark({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  // Each mark on the page needs its own gradient names.
  const p = `dm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox={MARK.viewBox}
      width={Math.round(size * (344 / 426))}
      height={size}
      className={cn("flex-none", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : "") + defs(p) + body(p) }}
    />
  );
}

/** The mark with the name beside it, and the line "Notes, your way." when asked for. */
export function DovliLogo({ size = 28, tagline = false, className }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center", className)} style={{ gap: Math.round(size * 0.32) }}>
      <DovliMark size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display font-bold leading-none tracking-[-0.025em] text-ink" style={{ fontSize: Math.round(size * (tagline ? 0.78 : 0.68)) }}>
          Dovli
        </span>
        {tagline && (
          <span className="mt-1 truncate leading-none tracking-[0.02em] text-ink-3" style={{ fontSize: Math.max(11, Math.round(size * 0.3)) }}>
            Notes, your way.
          </span>
        )}
      </span>
    </span>
  );
}
