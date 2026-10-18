import type { ReactElement } from "react";
import type { Page } from "@dovli/core";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger, modKey } from "@dovli/ui";
import { store } from "@/lib/store";
import { exportPageDocx, exportPageHtml, exportPageImage, exportPageMarkdown, exportPagePdf } from "@/lib/transfer";
import { ui } from "@/lib/ui";
import { summarizePage } from "@/features/ai/AIPanel";
import { copyLink, duplicate, moveWithPicker, newPage, trashWithUndo } from "@/features/pages/actions";

/** Everything you can do with a page, in one menu. Used in the sidebar and in the page's top bar. */
export function PageMenu({ page, trigger, onFind }: { page: Page; trigger: ReactElement; onFind?: () => void }) {
  const isDoc = page.kind === "doc";
  const mod = modKey();
  return (
    <MenuRoot>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent className="w-60">
        <MenuItem icon={page.favorite ? "starFilled" : "star"} onSelect={() => store.toggleFavorite(page.id)}>
          {page.favorite ? "Remove from favourites" : "Add to favourites"}
        </MenuItem>
        <MenuItem icon="share" onSelect={() => ui.set({ share: page.id })}>
          Share
        </MenuItem>
        <MenuItem icon="link" onSelect={() => copyLink(page)}>
          Copy link
        </MenuItem>
        <MenuSeparator />
        {isDoc && onFind && (
          <MenuItem icon="search" shortcut={`${mod}F`} onSelect={onFind}>
            Find and replace
          </MenuItem>
        )}
        {isDoc && (
          <MenuItem icon="sparkles" onSelect={() => summarizePage(page)}>
            Summarise with AI
          </MenuItem>
        )}
        {isDoc && (
          <MenuItem icon="palette" onSelect={() => ui.set({ styleFor: page.id })}>
            Page style
          </MenuItem>
        )}
        <MenuItem icon="pagePlus" onSelect={() => newPage("doc", page.id)}>
          Add a page inside
        </MenuItem>
        <MenuItem icon="duplicate" onSelect={() => duplicate(page)}>
          Duplicate
        </MenuItem>
        <MenuItem icon="move" onSelect={() => void moveWithPicker(page)}>
          Move to…
        </MenuItem>
        {isDoc && (
          <MenuSub>
            <MenuSubTrigger icon="download">Export</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem onSelect={() => void exportPageDocx(page)}>Word (.docx)</MenuItem>
              <MenuItem onSelect={() => void exportPageMarkdown(page)}>Markdown (.md)</MenuItem>
              <MenuItem
                onSelect={() => {
                  if (store.get().route.name !== "page" || (store.get().route as any).id !== page.id) store.navigate({ name: "page", id: page.id });
                  setTimeout(() => void exportPageImage(page).catch(() => {}), 500);
                }}
              >
                Image (.png)
              </MenuItem>
              <MenuItem onSelect={() => void exportPageHtml(page)}>Web page (.html)</MenuItem>
              <MenuItem
                onSelect={() => {
                  if (store.get().route.name !== "page" || (store.get().route as any).id !== page.id) store.navigate({ name: "page", id: page.id });
                  setTimeout(exportPagePdf, 400);
                }}
              >
                PDF (print)
              </MenuItem>
            </MenuSubContent>
          </MenuSub>
        )}
        <MenuSeparator />
        <MenuItem icon="trash" danger onSelect={() => trashWithUndo(page)}>
          Move to trash
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
