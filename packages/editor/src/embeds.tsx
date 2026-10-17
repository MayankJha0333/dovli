import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createReactBlockSpec } from "@blocknote/react";
import { classify, isLikelyUrl, normalizeUrl, unfurl, toEmbedProps, type EmbedKind } from "@dovli/core";
import { useIsDark } from "./useIsDark";

const FlowchartEditor = lazy(() => import("./FlowchartEditor"));

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
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // The editor treats Enter as "new block", so catch it on the input itself first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submitRef.current();
      }
    };
    input.addEventListener("keydown", onKey);
    // The editor moves its cursor after inserting a block, so focus a moment later.
    const t = autoFocus ? window.setTimeout(() => input.focus(), 60) : undefined;
    return () => {
      input.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [autoFocus]);

  return (
    <form
      className="embed-input"
      contentEditable={false}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="embed-input__label">Link preview</span>
      <div className="embed-input__row">
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          placeholder="Paste a link to a video, image or page"
          onInput={() => setError("")}
          aria-label="Link to embed"
        />
        <button type="submit" className="btn btn--primary">
          Embed
        </button>
      </div>
      {error && <p className="embed-input__error">{error}</p>}
    </form>
  );
}

function SiteLine({ p }: { p: EmbedProps }) {
  const [iconOk, setIconOk] = useState(true);
  return (
    <span className="embed__site">
      {p.favicon && iconOk && <img src={p.favicon} alt="" width={14} height={14} onError={() => setIconOk(false)} />}
      {p.siteName}
    </span>
  );
}

function LinkCard({ p }: { p: EmbedProps }) {
  const [imgOk, setImgOk] = useState(!!p.image);
  return (
    <a className={`embed embed-link${imgOk ? "" : " embed-link--compact"}`} href={p.url} target="_blank" rel="noopener noreferrer">
      {imgOk && (
        <span className="embed__media">
          <img src={p.image} alt="" loading="lazy" onError={() => setImgOk(false)} />
        </span>
      )}
      <span className="embed__body">
        <SiteLine p={p} />
        <span className="embed__title">{p.title || p.url}</span>
        {p.description && <span className="embed__desc">{p.description}</span>}
      </span>
    </a>
  );
}

function VideoCard({ p }: { p: EmbedProps }) {
  const [playing, setPlaying] = useState(false);
  const [imgOk, setImgOk] = useState(!!p.image);
  return (
    <div className="embed embed-video">
      <div className="embed__media embed__media--video">
        {playing ? (
          <iframe
            src={p.embedUrl}
            title={p.title || "Video"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button type="button" className="embed__poster" onClick={() => setPlaying(true)} aria-label={`Play ${p.title || "video"}`}>
            {imgOk && <img src={p.image} alt="" loading="lazy" onError={() => setImgOk(false)} />}
            <span className="embed__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <a className="embed__body" href={p.url} target="_blank" rel="noopener noreferrer">
        <SiteLine p={p} />
        <span className="embed__title">{p.title || p.url}</span>
        {p.description && <span className="embed__desc">{p.description}</span>}
      </a>
    </div>
  );
}

function ImageEmbed({ p }: { p: EmbedProps }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <LinkCard p={{ ...p, image: "" }} />;
  return (
    <figure className="embed embed-image">
      <img src={p.url} alt={p.title} loading="lazy" onError={() => setOk(false)} />
      <figcaption>
        <a href={p.url} target="_blank" rel="noopener noreferrer">
          {p.siteName}
        </a>
      </figcaption>
    </figure>
  );
}

function VideoFile({ p }: { p: EmbedProps }) {
  return (
    <figure className="embed embed-image">
      <video src={p.url} controls preload="metadata" playsInline />
      <figcaption>
        <a href={p.url} target="_blank" rel="noopener noreferrer">
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
    return (
      <EmbedInput
        autoFocus
        onSubmit={(url) => editor.updateBlock(block.id, { props: toEmbedProps(classify(url), "loading") })}
      />
    );
  }

  if (p.status === "loading") {
    return (
      <div className="embed embed-link embed-link--compact embed--loading" contentEditable={false} aria-busy="true">
        <span className="embed__body">
          <span className="embed__site">{p.siteName}</span>
          <span className="embed__title">Getting a preview</span>
          <span className="embed__shimmer" />
        </span>
      </div>
    );
  }

  const kind = p.kind as EmbedKind;
  const body =
    kind === "image" ? (
      <ImageEmbed p={p} />
    ) : kind === "video" ? (
      <VideoFile p={p} />
    ) : kind === "youtube" || kind === "vimeo" || kind === "loom" ? (
      <VideoCard p={p} />
    ) : (
      <LinkCard p={p} />
    );

  return (
    <div className="embed-wrap" contentEditable={false}>
      {body}
      {editor.isEditable && (
        <div className="embed-tools">
          <button
            type="button"
            className="embed-tools__btn"
            onClick={() =>
              editor.replaceBlocks([block.id], [
                { type: "paragraph", content: [{ type: "link", href: p.url, content: p.title || p.url }] },
              ])
            }
          >
            Show as link
          </button>
        </div>
      )}
    </div>
  );
}

export const embedBlock = createReactBlockSpec(
  { type: "embed", propSchema: embedProps, content: "none" },
  {
    render: ({ block, editor }) => <EmbedView block={block} editor={editor} />,
    toExternalHTML: ({ block }) => <a href={block.props.link}>{block.props.title || block.props.link}</a>,
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

  useEffect(() => {
    let alive = true;
    import("./excalidrawKit")
      .then(async (kit) => {
        if (!scene) {
          editor.updateBlock(block.id, { props: { scene: kit.starterScene() } });
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
    <div className="flow" contentEditable={false}>
      <div
        className="flow__preview"
        role="button"
        tabIndex={0}
        aria-label="Edit flowchart"
        onDoubleClick={open}
        onKeyDown={(e) => e.key === "Enter" && open()}
      >
        {svg === null ? (
          <span className="flow__empty">Drawing flowchart</span>
        ) : svg ? (
          <div className="flow__svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span className="flow__empty">Empty flowchart. Click Edit to draw.</span>
        )}
      </div>
      <div className="flow__bar">
        <span className="flow__label">Flowchart</span>
        {editor.isEditable && (
          <button type="button" className="btn" onClick={open}>
            Edit
          </button>
        )}
      </div>
      {editing &&
        createPortal(
          <Suspense fallback={<div className="flow-modal flow-modal--loading">Opening editor</div>}>
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
