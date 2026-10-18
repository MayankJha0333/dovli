import { useMemo, type ReactNode } from "react";
import { displayTitle, previewLines, timeAgo, type BoardData, type Page, type Template } from "@dovli/core";
import { coverPreset, getStyle, resolveLook, styleVars, type PageStyle } from "@dovli/theme";
import { cn } from "@dovli/ui";
import { store, useStore } from "@/lib/store";

export type Sketch = { shapes: { id: string; type: string; x: number; y: number; width: number; height: number; fill: boolean }[]; edges: [string, string][] };

export function sketchOf(board: BoardData | undefined): Sketch {
  const items: any[] = board?.elements?.length ? board.elements : (board?.skeleton ?? []);
  const shapes = items
    .filter((e) => !e.isDeleted && ["rectangle", "ellipse", "diamond"].includes(e.type))
    .map((e) => ({ id: e.id, type: e.type, x: e.x, y: e.y, width: e.width, height: e.height, fill: !!e.backgroundColor && e.backgroundColor !== "transparent" }));
  const edges: [string, string][] = items
    .filter((e) => e.type === "arrow" && !e.isDeleted)
    .map((e) => [e.start?.id ?? e.startBinding?.elementId, e.end?.id ?? e.endBinding?.elementId] as [string, string])
    .filter(([a, b]) => a && b);
  return { shapes, edges };
}

/** A tiny drawing of a whiteboard's boxes and arrows. */
export function BoardSketch({ sketch }: { sketch: Sketch }) {
  const { shapes, edges } = sketch;
  if (!shapes.length) return <div className="grid h-full place-items-center text-2xs text-ink-4">Empty board</div>;
  const byId = Object.fromEntries(shapes.map((s) => [s.id, s]));
  const xs = shapes.flatMap((s) => [s.x, s.x + s.width]);
  const ys = shapes.flatMap((s) => [s.y, s.y + s.height]);
  const minX = Math.min(...xs) - 24;
  const minY = Math.min(...ys) - 24;
  const w = Math.max(...xs) - minX + 24;
  const h = Math.max(...ys) - minY + 24;
  const center = (s: any) => [s.x + s.width / 2, s.y + s.height / 2];
  const shape = "fill-[var(--d-panel)] stroke-[var(--d-ink-2)] [stroke-width:1.2] [vector-effect:non-scaling-stroke]";
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="absolute inset-x-2.5 bottom-[18px] top-2.5 h-[calc(100%-28px)] w-[calc(100%-20px)]" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {edges
        .filter(([a, b]) => byId[a] && byId[b])
        .map(([a, b], i) => {
          const [x1, y1] = center(byId[a]);
          const [x2, y2] = center(byId[b]);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-[var(--d-ink-3)] [stroke-width:1] [vector-effect:non-scaling-stroke]" />;
        })}
      {shapes.map((s) => {
        const cls = cn(shape, s.fill && "fill-[var(--d-sketch)]");
        if (s.type === "ellipse") return <ellipse key={s.id} cx={s.x + s.width / 2} cy={s.y + s.height / 2} rx={s.width / 2} ry={s.height / 2} className={cls} />;
        if (s.type === "diamond") {
          const [cx, cy] = center(s);
          return <polygon key={s.id} points={`${cx},${s.y} ${s.x + s.width},${cy} ${cx},${s.y + s.height} ${s.x},${cy}`} className={cls} />;
        }
        return <rect key={s.id} x={s.x} y={s.y} width={s.width} height={s.height} rx={12} className={cls} />;
      })}
    </svg>
  );
}

/** A miniature of a document: title, headings, list dots and to-do boxes. */
export function DocPreview({ title, blocks }: { title: string; blocks: any[] }) {
  const lines = previewLines(blocks, 9);
  return (
    <div className="flex flex-col gap-1 px-[13px] py-3.5">
      <div className="mb-1 truncate font-[family-name:var(--title-font,var(--d-font-display))] text-[12.5px] font-semibold leading-tight tracking-tight text-ink">{title}</div>
      {lines.map((l, i) =>
        l.kind === "rule" ? (
          <hr key={i} className="my-0.5 w-full border-0 border-t border-line" />
        ) : l.kind === "table" ? (
          <div key={i} className="grid grid-cols-[1fr_2fr] overflow-hidden rounded-[3px] border border-line">
            {Array.from({ length: 6 }).map((_, j) => (
              <i key={j} className="h-[7px] border-b border-r border-line [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0" />
            ))}
          </div>
        ) : (
          <div
            key={i}
            className={cn(
              "flex items-center gap-1 truncate text-[7.5px] leading-[1.35] text-ink-2",
              (l.kind === "h1" || l.kind === "h2") && "mt-[3px] text-[8.5px] font-semibold text-ink",
              l.kind === "h3" && "mt-0.5 text-[8px] font-semibold text-ink",
              l.kind === "li" && "before:size-[2.5px] before:flex-none before:rounded-full before:bg-[var(--d-ink-3)] before:content-['']",
            )}
          >
            {l.kind === "todo" && <span className="size-1.5 flex-none rounded-[2px] border border-ink-3" />}
            {l.text || " "}
          </div>
        ),
      )}
    </div>
  );
}

export function DocCard({
  title,
  mark,
  meta,
  preview,
  onClick,
  look,
  cover,
}: {
  title: string;
  mark: string;
  meta: string;
  preview: ReactNode;
  onClick: () => void;
  look?: PageStyle | null;
  cover?: string | null;
}) {
  const preset = coverPreset(cover);
  return (
    <button type="button" className="group flex min-w-0 flex-col gap-2.5 text-left text-ink" onClick={onClick}>
      <span
        aria-hidden="true"
        style={look ? (styleVars(look) as any) : undefined}
        className={cn(
          "relative block aspect-[4/3.1] max-w-full overflow-hidden rounded-lg transition-[box-shadow,background-color] duration-200",
          look
            ? "page-styled [background:var(--s-backdrop)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
            : "bg-well shadow-[inset_0_0_0_1px_var(--d-line)] group-hover:bg-accent-soft group-focus-visible:bg-accent-soft",
        )}
      >
        {preset && <span className="absolute inset-x-0 top-0 h-[22%]" style={{ background: preset.css }} />}
        <span className="absolute inset-x-[14%] -bottom-[8%] top-[14%] overflow-hidden rounded-t-[7px] shadow-[0_0_0_1px_rgba(20,20,30,0.05),0_4px_14px_rgba(20,20,30,0.08)] transition-transform duration-300 ease-out [background:var(--d-panel)] group-hover:-translate-y-[5px] group-focus-visible:-translate-y-[5px]">
          {preview}
        </span>
      </span>
      <span className="flex min-w-0 items-start gap-2 px-0.5">
        <span className="w-4 flex-none text-center font-serif text-md leading-snug text-accent">{mark}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold leading-snug">{title}</span>
          <span className="line-clamp-2 text-xs leading-snug text-ink-3">{meta}</span>
        </span>
      </span>
    </button>
  );
}

export function TemplateCard({ t, onUse }: { t: Template; onUse: (t: Template) => void }) {
  const built = useMemo(() => t.build(), [t]);
  return (
    <DocCard
      title={t.name}
      mark={t.mark}
      meta={t.description}
      onClick={() => onUse(t)}
      look={getStyle((built as any).style)}
      preview={t.kind === "board" ? <BoardSketch sketch={sketchOf(built.board)} /> : <DocPreview title={built.title.replace(/:\s*$/, "")} blocks={built.blocks ?? []} />}
    />
  );
}

export function PageCard({ page }: { page: Page }) {
  const parent = useStore((s) => (page.parentId ? s.pages[page.parentId] : null));
  return (
    <DocCard
      title={displayTitle(page)}
      mark={page.mark}
      meta={`${timeAgo(Math.max(page.updatedAt, page.lastOpenedAt ?? 0))}${parent ? `, in ${displayTitle(parent)}` : ""}`}
      onClick={() => store.navigate({ name: "page", id: page.id })}
      look={page.kind === "doc" ? resolveLook(page.style, page.look).style : null}
      cover={page.cover}
      preview={page.kind === "board" ? <BoardSketch sketch={sketchOf(page.board)} /> : <DocPreview title={displayTitle(page)} blocks={page.blocks ?? []} />}
    />
  );
}

export const cardGrid = "grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-x-[18px] gap-y-[22px] max-[640px]:grid-cols-2 max-[640px]:gap-x-3 max-[640px]:gap-y-[18px]";
