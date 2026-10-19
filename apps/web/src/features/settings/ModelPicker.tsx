// Pick the AI model in Settings → AI. A searchable list: OpenRouter and Groq list every model they
// offer right now (loaded when the list opens), the others show Dovli's short list. With your own
// key you can also type any model id the provider accepts.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon, PopoverContent, PopoverRoot, PopoverTrigger, Spinner, cn, inputStyles } from "@dovli/ui";
import { PROVIDERS, listModels, type ProviderId } from "@/lib/ai";

type Model = { id: string; label: string; hint: string; free?: boolean };

/** Lists already loaded this session, so reopening is instant. Groq's depends on the key used. */
const cache = new Map<string, { models: Model[]; live: boolean }>();
const VALID_ID = /^~?[\w.:/@+-]{2,120}$/;
const SHOWN = 150;

export function ModelPicker({
  provider,
  value,
  onChange,
  disabled,
  id,
  apiKey = "",
}: {
  provider: ProviderId;
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  id?: string;
  /** A Groq key being pasted: lists the models that key can use. */
  apiKey?: string;
}) {
  const info = PROVIDERS[provider];
  const [open, setOpen] = useState(false);
  const cacheKey = `${provider}:${provider === "groqcloud" ? apiKey.slice(-6) : ""}`;
  const [list, setList] = useState<{ models: Model[]; live: boolean } | null>(cache.get(cacheKey) ?? null);
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load the full list the first time it opens (and the label of the current model with it).
  useEffect(() => {
    setList(cache.get(cacheKey) ?? null);
  }, [cacheKey]);
  useEffect(() => {
    if (!open || cache.has(cacheKey)) return;
    let alive = true;
    void listModels(provider, apiKey).then((got) => {
      cache.set(cacheKey, got);
      if (alive) setList(got);
    });
    return () => {
      alive = false;
    };
  }, [open, cacheKey, provider, apiKey]);

  const models: Model[] = list?.models ?? info.models;
  const current = models.find((m) => m.id === value) ?? info.models.find((m) => m.id === value);
  const anyFree = models.some((m) => m.free);
  const canType = provider !== "groq";

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const found = models.filter((m) => (!onlyFree || m.free) && (!q || m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)));
    // The model in use comes first, so it's always in view.
    const i = found.findIndex((m) => m.id === value);
    return i > 0 ? [found[i], ...found.slice(0, i), ...found.slice(i + 1)] : found;
  }, [models, q, onlyFree, value]);
  const shown = matches.slice(0, SHOWN);
  const custom = canType && q && VALID_ID.test(query.trim()) && !models.some((m) => m.id.toLowerCase() === q) ? query.trim() : null;
  const rows: { id: string; model?: Model }[] = [...shown.map((m) => ({ id: m.id, model: m })), ...(custom ? [{ id: custom }] : [])];

  useEffect(() => setActive(0), [q, onlyFree]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (m: string) => {
    setOpen(false);
    setQuery("");
    if (m !== value) onChange(m);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row.id);
    }
  };

  return (
    <PopoverRoot open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(inputStyles, "flex h-auto min-h-9 items-center gap-2 py-1.5 text-left disabled:cursor-not-allowed")}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-ink">{current?.label ?? value}</span>
            {current?.hint && <span className="truncate text-xs text-ink-3">{current.hint}</span>}
          </span>
          <Icon name="chevronDown" size={14} className="flex-none text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-[max(var(--radix-popover-trigger-width),320px)] max-w-[calc(100vw-32px)] flex-col gap-2 p-2"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder={canType ? "Search, or type any model id" : "Search models"}
              aria-label="Search models"
              aria-controls="model-list"
              className={cn(inputStyles, "pl-8")}
            />
          </div>
          {anyFree && (
            <button
              type="button"
              aria-pressed={onlyFree}
              onClick={() => setOnlyFree((f) => !f)}
              className={cn("h-9 flex-none rounded-md px-3 text-sm font-medium", onlyFree ? "bg-accent text-accent-ink" : "bg-well text-ink-2 hover:text-ink")}
            >
              Free
            </button>
          )}
        </div>

        {!list && info.liveModels ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-ink-3">
            <Spinner />
            Loading {info.name}'s models…
          </div>
        ) : (
          <ul id="model-list" ref={listRef} role="listbox" aria-label={`${info.name} models`} className="m-0 max-h-[300px] list-none overflow-y-auto p-0">
            {rows.map((row, i) => (
              <li
                key={row.id}
                data-index={i}
                role="option"
                aria-selected={row.id === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(row.id)}
                className={cn("flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2", i === active && "bg-hover")}
              >
                <Icon name="check" size={14} className={cn("mt-0.5 flex-none text-accent", row.id !== value && "invisible")} />
                {row.model ? (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{row.model.label}</span>
                      {row.model.free && <span className="flex-none rounded-full bg-accent-soft px-1.5 text-2xs font-semibold text-accent">Free</span>}
                    </span>
                    {row.model.label !== row.id && <span className="truncate font-mono text-2xs text-ink-4">{row.id}</span>}
                    {row.model.hint && <span className="truncate text-xs text-ink-3">{row.model.hint}</span>}
                  </span>
                ) : (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">Use “{row.id}”</span>
                    <span className="text-xs text-ink-3">A model id {info.name} accepts. It's checked when you save.</span>
                  </span>
                )}
              </li>
            ))}
            {!rows.length && <li className="px-2.5 py-3 text-sm text-ink-3">No models match “{query}”.</li>}
          </ul>
        )}

        {list && (
          <p className="m-0 border-t border-line px-2 pt-2 text-xs text-ink-3">
            {matches.length > SHOWN
              ? `Showing ${SHOWN} of ${matches.length.toLocaleString()} models. Type to narrow down.`
              : list.live
                ? `${models.length.toLocaleString()} models from ${info.name}, live.`
                : provider === "groqcloud"
                  ? "Paste your key to see every model it can use."
                  : `${models.length} models.`}
          </p>
        )}
      </PopoverContent>
    </PopoverRoot>
  );
}
