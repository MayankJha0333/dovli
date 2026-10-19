// The floating "Assistant" button at the bottom right of the page area, like Craft's.
// It opens the assistant panel beside the page (also ⌘J). Summaries and reviews are still in the
// page menu and the Info panel.

import { Icon, modKey } from "@dovli/ui";
import { assistant } from "@/lib/assistant";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";

export function AssistantButton() {
  const page = useStore((s) => (s.route.name === "page" ? s.pages[s.route.id] : undefined));
  const hidden = useUI((s) => !!s.ai || !!s.presenting || s.assistant);
  if (!page || page.kind !== "doc" || page.deletedAt || hidden) return null;

  return (
    <div data-print="hide" className="pointer-events-none absolute bottom-4 right-4 z-30 max-[860px]:bottom-[calc(16px+env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => assistant.toggle(true)}
        title={`Assistant (${modKey()}J)`}
        className="pointer-events-auto flex h-10 items-center gap-2 rounded-full px-4 text-base font-semibold text-ink shadow-pop surface-raised transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-[640px]:size-11 max-[640px]:justify-center max-[640px]:px-0"
      >
        <Icon name="sparkles" size={16} className="text-accent" />
        <span className="max-[640px]:sr-only">Assistant</span>
      </button>
    </div>
  );
}
