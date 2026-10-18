// How a page's icon looks. Kept free of app state so the public share page can use it too.

import type { Page } from "@dovli/core";
import { cn } from "@dovli/ui";

/** The mark a new page gets. A page still showing it counts as having no icon of its own. */
export const defaultMark = (kind: Page["kind"]) => (kind === "board" ? "◇" : "¶");
export const hasOwnIcon = (page: Page) => page.mark !== defaultMark(page.kind);
/** Emoji show on their own; typographic marks (¶ § ✦) sit in a soft tile. */
export const isEmoji = (mark: string) => /\p{Extended_Pictographic}/u.test(mark);

/** The page's icon, drawn the same way everywhere it's shown big. */
export function PageIconGlyph({ mark, size = "lg", onCover = false }: { mark: string; size?: "lg" | "sm"; onCover?: boolean }) {
  if (isEmoji(mark))
    return (
      <span className={cn("grid place-items-center leading-none", size === "lg" ? "size-[78px] text-[64px] max-[640px]:size-16 max-[640px]:text-[52px]" : "size-9 text-[26px]", onCover && "drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]")}>
        {mark}
      </span>
    );
  return (
    <span
      className={cn(
        "grid place-items-center bg-accent-soft font-serif text-accent",
        size === "lg" ? "size-[72px] rounded-xl text-[34px] max-[640px]:size-[60px] max-[640px]:text-[28px]" : "size-9 rounded-sm text-lg",
        // On a cover, a ring in the paper colour lifts the tile off the picture.
        onCover && "shadow-[0_0_0_4px_var(--d-sheet-solid,var(--d-panel))] [background:linear-gradient(var(--d-accent-soft),var(--d-accent-soft)),var(--d-sheet-solid,var(--d-panel))]",
      )}
    >
      {mark}
    </span>
  );
}
