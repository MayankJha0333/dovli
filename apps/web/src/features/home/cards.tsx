import { useMemo, type ReactNode } from "react";
import { store, useStore } from "@/lib/store";
import { displayTitle, timeAgo, previewLines, type Page, type BoardData, type Template } from "@dovli/core";
import { getStyle, styleVars, type PageStyle } from "@dovli/theme";

export type Sketch = { shapes: { id: string; type: string; x: number; y: number; width: number; height: number; fill: boolean }[]; edges: [string, string][] };

export function sketchOf(board: BoardData | undefined): Sketch {
  const items: any[] = board?.elements?.length ? board.elements : board?.skeleton ?? [];
  const shapes = items
    .filter((e) => !e.isDeleted && ["rectangle", "ellipse", "diamond"].includes(e.type))
    .map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      fill: !!e.backgroundColor && e.backgroundColor !== "transparent",
    }));
  const edges: [string, string][] = items
    .filter((e) => e.type === "arrow" && !e.isDeleted)
    .map((e) => [e.start?.id ?? e.startBinding?.elementId, e.end?.id ?? e.endBinding?.elementId] as [string, string])
    .filter(([a, b]) => a && b);
  return { shapes, edges };
}

export function BoardSketch({ sketch }: { sketch: Sketch }) {
  const { shapes, edges } = sketch;
  if (!shapes.length) return <div className="card__empty">Empty board</div>;
  const byId = Object.fromEntries(shapes.map((s) => [s.id, s]));
  const xs = shapes.flatMap((s) => [s.x, s.x + s.width]);
  const ys = shapes.flatMap((s) => [s.y, s.y + s.height]);
  const minX = Math.min(...xs) - 24;
  const minY = Math.min(...ys) - 24;
  const w = Math.max(...xs) - minX + 24;
  const h = Math.max(...ys) - minY + 24;
  const center = (s: any) => [s.x + s.width / 2, s.y + s.height / 2];
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="sketch" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {edges
        .filter(([a, b]) => byId[a] && byId[b])
        .map(([a, b], i) => {
          const [x1, y1] = center(byId[a]);
          const [x2, y2] = center(byId[b]);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="sketch__line" />;
        })}
      {shapes.map((s) => {
        const cls = s.fill ? "sketch__shape sketch__shape--fill" : "sketch__shape";
        if (s.type === "ellipse")
          return <ellipse key={s.id} cx={s.x + s.width / 2} cy={s.y + s.height / 2} rx={s.width / 2} ry={s.height / 2} className={cls} />;
        if (s.type === "diamond") {
          const [cx, cy] = center(s);
          return <polygon key={s.id} points={`${cx},${s.y} ${s.x + s.width},${cy} ${cx},${s.y + s.height} ${s.x},${cy}`} className={cls} />;
        }
        return <rect key={s.id} x={s.x} y={s.y} width={s.width} height={s.height} rx={12} className={cls} />;
      })}
    </svg>
  );
}

export function DocPreview({ title, blocks }: { title: string; blocks: any[] }) {
  const lines = previewLines(blocks, 9);
  return (
    <div className="mini">
      <div className="mini__title">{title}</div>
      {lines.map((l, i) =>
        l.kind === "rule" ? (
          <hr key={i} />
        ) : l.kind === "table" ? (
          <div key={i} className="mini__table">
            <i /><i /><i /><i /><i /><i />
          </div>
        ) : (
          <div key={i} className={`mini__line mini__line--${l.kind}`}>
            {l.kind === "todo" && <span className="mini__box" />}
            {l.text || " "}
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
}: {
  title: string;
  mark: string;
  meta: string;
  preview: ReactNode;
  onClick: () => void;
  look?: PageStyle | null;
}) {
  return (
    <button type="button" className="card" onClick={onClick}>
      <span className={`card__thumb${look ? " card__thumb--styled" : ""}`} style={look ? styleVars(look) : undefined} aria-hidden="true">
        <span className="card__paper">{preview}</span>
      </span>
      <span className="card__info">
        <span className="card__mark">{mark}</span>
        <span className="card__text">
          <span className="card__title">{title}</span>
          <span className="card__meta">{meta}</span>
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
      preview={
        t.kind === "board" ? (
          <BoardSketch sketch={sketchOf(built.board)} />
        ) : (
          <DocPreview title={built.title.replace(/:\s*$/, "")} blocks={built.blocks ?? []} />
        )
      }
    />
  );
}

export function PageCard({ page }: { page: Page }) {
  const pages = useStore((s) => s.pages);
  const parent = page.parentId ? pages[page.parentId] : null;
  return (
    <DocCard
      title={displayTitle(page)}
      mark={page.mark}
      meta={`${timeAgo(page.updatedAt)}${parent ? `, in ${displayTitle(parent)}` : ""}`}
      onClick={() => store.navigate({ name: "page", id: page.id })}
      look={page.kind === "doc" ? getStyle(page.style) : null}
      preview={
        page.kind === "board" ? (
          <BoardSketch sketch={sketchOf(page.board)} />
        ) : (
          <DocPreview title={displayTitle(page)} blocks={page.blocks ?? []} />
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Templates view                                                      */
/* ------------------------------------------------------------------ */
