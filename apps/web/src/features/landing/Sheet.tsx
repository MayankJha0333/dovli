import type { CSSProperties, ReactNode } from "react";
import { cn } from "@dovli/ui";
import "./landing.css";

// A sheet of paper with its top-right corner folded back, the same fold as Dovli's mark. Used for
// the product pictures on the landing page and on the sign-in page, so both read as one brand.
// The corner is cut out of the sheet (so whatever is behind shows through), the back of the page
// shows in the mark's blue-to-pink, and the shadow follows the cut shape.

export function Sheet({
  children,
  className,
  sheetClassName,
  fold = 44,
  label,
}: {
  children: ReactNode;
  /** Classes for the outer box (size, placement). */
  className?: string;
  /** Classes for the paper itself (background, radius, padding). */
  sheetClassName?: string;
  /** Size of the folded corner in px. */
  fold?: number;
  /** When set, the sheet is announced as one picture with this description, and its insides are hidden from screen readers. */
  label?: string;
}) {
  return (
    <div
      className={cn("dovli-sheet relative", className)}
      style={{ "--fold": `${fold}px` } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <div className={cn("dovli-sheet-paper relative h-full overflow-hidden", sheetClassName)} aria-hidden={label ? true : undefined}>
        {children}
      </div>
      <span aria-hidden="true" className="dovli-fold">
        <span className="dovli-fold-flap" />
      </span>
    </div>
  );
}
