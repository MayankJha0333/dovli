import { useEffect, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { Button, Icon } from "@dovli/ui";
import { useBridge } from "../bridge";

/** A PDF shown right in the page, with its name and a link to open it full size. */

function PdfView({ block, editor }: { block: any; editor: any }) {
  const bridge = useBridge();
  const { url, name } = block.props as { url: string; name: string };
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (!url) return setSrc(null);
    Promise.resolve(bridge.resolveFileUrl ? bridge.resolveFileUrl(url) : url).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [url, bridge]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("Choose a PDF file.");
    if (!bridge.uploadFile) return setError("Files can't be added here.");
    setBusy(true);
    setError("");
    try {
      const stored = await bridge.uploadFile(file);
      editor.updateBlock(block.id, { props: { url: stored, name: file.name } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that file.");
    } finally {
      setBusy(false);
    }
  };

  if (!url) {
    if (!editor.isEditable) return null;
    return (
      <div data-print="hide" className="my-1.5 flex w-full max-w-[540px] flex-col items-start gap-2.5 rounded-lg bg-well p-4 font-sans shadow-sm" contentEditable={false}>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <Icon name="pdf" size={15} />
          PDF
        </span>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="primary" icon="upload" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Adding" : "Choose a PDF"}
        </Button>
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <figure className="my-1.5 w-full overflow-hidden rounded-lg bg-panel font-sans shadow-sm" contentEditable={false}>
      <figcaption className="flex items-center gap-2 border-b border-line px-3.5 py-2">
        <Icon name="pdf" size={15} className="text-danger" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name || "Document.pdf"}</span>
        {src && (
          <a href={src} target="_blank" rel="noopener noreferrer" download={name || undefined} className="text-sm font-semibold text-accent no-underline hover:underline">
            Open
          </a>
        )}
      </figcaption>
      {src ? (
        <iframe src={src} title={name || "PDF"} className="block h-[560px] w-full border-0 bg-well" />
      ) : (
        <div className="grid h-40 place-items-center text-sm text-ink-3">Loading PDF</div>
      )}
    </figure>
  );
}

export const pdfBlock = createReactBlockSpec(
  { type: "pdf", propSchema: { url: { default: "" }, name: { default: "" } }, content: "none" },
  {
    render: ({ block, editor }) => <PdfView block={block} editor={editor} />,
    toExternalHTML: ({ block }) => (
      <p>
        <a href={block.props.url}>{block.props.name || "PDF"}</a>
      </p>
    ),
  },
);
