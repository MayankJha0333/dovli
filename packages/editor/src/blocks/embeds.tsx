import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createReactBlockSpec } from "@blocknote/react";
import { classify, isLikelyUrl, normalizeUrl, unfurl, toEmbedProps, type EmbedKind } from "@dovli/core";
import { Button, Icon, cn } from "@dovli/ui";
import { useIsDark } from "../useIsDark";
import { stopEditorKeys } from "./shared";

const FlowchartEditor = lazy(() => import("../FlowchartEditor"));

/* ------------------------------------------------------------------ */
/* Link preview                                                        */
/* ------------------------------------------------------------------ */

const embedProps = {
  link: { default: "" },
  kind: { default: "link" },
  title: { default: "" },
  description: { default: "" },
  image: { default: "" },
  siteName: { default: "" },
  favicon: { default: "" },
  embedUrl: { default: "" },
  status: { default: "ready" },
} as const;

type EmbedProps = { [K in keyof typeof embedProps]: string } & { url: string };

const card = "flex flex-col overflow-hidden rounded-lg bg-panel text-ink no-underline shadow-sm transition-shadow hover:shadow-card";

function EmbedInput({ onSubmit, autoFocus }: { onSubmit: (url: string) => void; autoFocus: boolean }) {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    const value = inputRef.current?.value ?? "";
    if (!isLikelyUrl(value)) {
      setError("That isn't a web address. Paste a full link, like youtube.com/watch?v=…");
      return;
    }
    onSubmit(normalizeUrl(value));
  };
  useEffect(() => {
    // The editor moves its cursor after inserting a block, so focus a moment later.
    const t = autoFocus ? window.setTimeout(() => inputRef.current?.focus(), 60) : undefined;
    return () => window.clearTimeout(t);
  }, [autoFocus]);

  return (
    <form
      className="my-1.5 flex w-full max-w-[540px] flex-col gap-2.5 rounded-lg bg-well p-3.5 font-sans shadow-sm"
      contentEditable={false}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="text-sm font-semibold text-ink-2">Link preview</span>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          placeholder="Paste a link to a video, image or page"
          onInput={() => setError("")}
          onKeyDown={(e) => {
            stopEditorKeys(e);
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="Link to embed"
          className="h-9 min-w-0 flex-1 rounded-sm border-0 bg-panel px-3 text-base text-ink shadow-sm outline-none focus:shadow-[0_0_0_2px_var(--d-accent)]"
        />
        <Button type="submit" variant="primary">
          Embed
        </Button>
      </div>
      {error && <p className="m-0 text-xs text-danger">{error}</p>}
    </form>
  );
}

function SiteLine({ p }: { p: EmbedProps }) {
  const [iconOk, setIconOk] = useState(true);
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
      {p.favicon && iconOk && <img src={p.favicon} alt="" width={14} height={14} className="rounded-xs" onError={() => setIconOk(false)} />}
      {p.siteName}
    </span>
  );
}

function Body({ p, href }: { p: EmbedProps; href?: string }) {
  const inner = (
    <>
      <SiteLine p={p} />
      <span className="line-clamp-2 text-md font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{p.title || p.url}</span>
      {p.description && <span className="line-clamp-2 text-sm text-ink-2 [overflow-wrap:anywhere]">{p.description}</span>}
    </>
  );
  const cls = "flex min-w-0 flex-col gap-1 px-3.5 pb-3.5 pt-3 text-inherit no-underline";
  return href ? (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

function LinkCard({ p }: { p: EmbedProps }) {
  const [imgOk, setImgOk] = useState(!!p.image);
  return (
    <a className={card} href={p.url} target="_blank" rel="noopener noreferrer">
      {imgOk && (
        <span className="relative block aspect-[1.91/1] overflow-hidden bg-well">
          <img src={p.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={() => setImgOk(false)} />
        </span>
      )}
      <Body p={p} />
    </a>
  );
}

function VideoCard({ p }: { p: EmbedProps }) {
  const [playing, setPlaying] = useState(false);
  const [imgOk, setImgOk] = useState(!!p.image);
  return (
    <div className={card}>
      <div className="relative aspect-video overflow-hidden bg-black">
        {playing ? (
          <iframe
            src={p.embedUrl}
            title={p.title || "Video"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 grid place-items-center border-0 bg-transparent p-0"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${p.title || "video"}`}
          >
            {imgOk && <img src={p.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" onError={() => setImgOk(false)} />}
            <span className="relative grid size-14 place-items-center rounded-full bg-white/90 text-black shadow-pop transition-transform group-hover:scale-105" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" className="ml-0.5">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <Body p={p} href={p.url} />
    </div>
  );
}

function MediaEmbed({ p, video }: { p: EmbedProps; video?: boolean }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <LinkCard p={{ ...p, image: "" }} />;
  return (
    <figure className={cn(card, "m-0")}>
      {video ? (
        <video src={p.url} controls preload="metadata" playsInline className="block max-h-[520px] w-full bg-well object-contain" />
      ) : (
        <img src={p.url} alt={p.title} loading="lazy" className="block max-h-[520px] w-full bg-well object-contain" onError={() => setOk(false)} />
      )}
      <figcaption className="px-3.5 py-2 text-xs">
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-ink-3 no-underline hover:text-accent">
          {p.title || p.siteName}
        </a>
      </figcaption>
    </figure>
  );
}

function EmbedView({ block, editor }: { block: any; editor: any }) {
  const p = { ...block.props, url: block.props.link } as EmbedProps;
  const started = useRef(false);

  useEffect(() => {
    if (!p.url || p.status !== "loading" || started.current) return;
    started.current = true;
    unfurl(p.url).then((meta) => {
      if (editor.getBlock(block.id)) editor.updateBlock(block.id, { props: toEmbedProps(meta, "ready") });
    });
  }, [p.url, p.status, block.id, editor]);

  if (!p.url) {
    return editor.isEditable ? (
      <EmbedInput autoFocus onSubmit={(url) => editor.updateBlock(block.id, { props: toEmbedProps(classify(url), "loading") })} />
    ) : null;
  }

  if (p.status === "loading") {
    return (
      <div className={cn(card, "my-1.5 w-full max-w-[540px]")} contentEditable={false} aria-busy="true">
        <span className="flex flex-col gap-1 px-3.5 py-3">
          <span className="text-xs font-medium text-ink-3">{p.siteName}</span>
          <span className="text-md font-medium text-ink-3">Getting a preview</span>
          <span className="mt-1.5 block h-2 w-3/5 rounded-xs bg-[linear-gradient(90deg,var(--d-well),var(--d-hover),var(--d-well))] bg-[length:200%_100%] animate-shimmer" />
        </span>
      </div>
    );
  }

  const kind = p.kind as EmbedKind;
  const body =
    kind === "image" ? (
      <MediaEmbed p={p} />
    ) : kind === "video" ? (
      <MediaEmbed p={p} video />
    ) : kind === "youtube" || kind === "vimeo" || kind === "loom" ? (
      <VideoCard p={p} />
    ) : (
      <LinkCard p={p} />
    );

  return (
    <div className="group/embed relative my-1.5 w-full max-w-[540px]" contentEditable={false}>
      {body}
      {editor.isEditable && (
        <div className="absolute right-2.5 top-2.5 flex gap-1 opacity-0 transition-opacity group-hover/embed:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <Button
            size="sm"
            className="surface-raised"
            onClick={() =>
              editor.replaceBlocks([block.id], [{ type: "paragraph", content: [{ type: "link", href: p.url, content: p.title || p.url }] }])
            }
          >
            Show as link
          </Button>
        </div>
      )}
    </div>
  );
}

export const embedBlock = createReactBlockSpec(
  { type: "embed", propSchema: embedProps, content: "none" },
  {
    render: ({ block, editor }) => <EmbedView block={block} editor={editor} />,
    toExternalHTML: ({ block }) => (
      <p>
        <a href={block.props.link}>{block.props.title || block.props.link}</a>
      </p>
    ),
  },
);

/* ------------------------------------------------------------------ */
/* Flowchart                                                           */
/* ------------------------------------------------------------------ */

function FlowchartView({ block, editor }: { block: any; editor: any }) {
  const scene: string = block.props.scene;
  const dark = useIsDark();
  const [svg, setSvg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  /** Mermaid that couldn't be drawn: shown as text, so nothing is lost. */
  const [broken, setBroken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setBroken(null);
    import("../excalidrawKit")
      .then(async (kit) => {
        if (!scene) {
          if (editor.isEditable) editor.updateBlock(block.id, { props: { scene: kit.starterScene() } });
          return;
        }
        // Mermaid from the assistant (or an AI app through MCP): draw it as shapes once, and keep
        // those, so it can be edited like any flowchart. Not an undo step of its own.
        const code = kit.mermaidOf(scene);
        if (code !== null) {
          let drawn: string;
          try {
            drawn = await kit.sceneFromMermaid(code);
          } catch {
            if (alive) {
              setBroken(code);
              setSvg("");
            }
            return;
          }
          if (!alive) return;
          if (editor.isEditable && editor.getBlock(block.id)) {
            editor.transact((tr: any) => {
              tr.setMeta("addToHistory", false);
              editor.updateBlock(block.id, { props: { scene: drawn } });
            });
            return;
          }
          const out = await kit.renderSvg(drawn, dark);
          if (alive) setSvg(out);
          return;
        }
        const out = await kit.renderSvg(scene, dark);
        if (alive) setSvg(out);
      })
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [scene, dark, block.id, editor]);

  const open = () => editor.isEditable && setEditing(true);

  return (
    <div className="my-1.5 w-full overflow-hidden rounded-lg bg-panel font-sans shadow-sm" contentEditable={false}>
      <div
        className="grid min-h-[150px] place-items-center bg-well bg-[radial-gradient(var(--d-line-strong)_1px,transparent_1px)] bg-[length:16px_16px] px-5 py-6 [outline-offset:-2px]"
        role="button"
        tabIndex={0}
        aria-label="Edit flowchart"
        onDoubleClick={open}
        onKeyDown={(e) => e.key === "Enter" && open()}
      >
        {svg === null ? (
          <span className="text-sm text-ink-3">Drawing flowchart</span>
        ) : svg ? (
          <div className="flex w-full justify-center [&_svg]:h-auto [&_svg]:max-h-[420px] [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : broken ? (
          <div className="flex w-full flex-col gap-2">
            <span className="text-sm text-ink-3">Couldn't draw this diagram. Here is its text; click Edit to draw it by hand.</span>
            <pre className="m-0 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-md bg-panel p-3 font-mono text-xs text-ink-2">{broken}</pre>
          </div>
        ) : (
          <span className="text-sm text-ink-3">Empty flowchart. Click Edit to draw.</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 py-2 pl-3.5 pr-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
          <Icon name="board" size={14} />
          Flowchart
        </span>
        {editor.isEditable && (
          <Button size="sm" onClick={open}>
            Edit
          </Button>
        )}
      </div>
      {editing &&
        createPortal(
          <Suspense fallback={<div className="fixed inset-0 z-[300] grid place-items-center bg-panel text-ink-3">Opening editor</div>}>
            <FlowchartEditor
              scene={scene}
              onDone={(json) => {
                setEditing(false);
                if (json !== scene) editor.updateBlock(block.id, { props: { scene: json } });
              }}
            />
          </Suspense>,
          document.body,
        )}
    </div>
  );
}

export const flowchartBlock = createReactBlockSpec(
  { type: "flowchart", propSchema: { scene: { default: "" } }, content: "none" },
  {
    render: ({ block, editor }) => <FlowchartView block={block} editor={editor} />,
    toExternalHTML: () => <p>[Flowchart]</p>,
  },
);
