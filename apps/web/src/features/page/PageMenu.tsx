import type { ReactElement } from "react";
import type { Page } from "@dovli/core";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger, modKey, toast } from "@dovli/ui";
import { store } from "@/lib/store";
import { exportPagePdf } from "@/lib/pdf";
import { exportPageDocx, exportPageHtml, exportPageImage, exportPageMarkdown } from "@/lib/transfer";
import { ui } from "@/lib/ui";
import { summarizePage } from "@/features/ai/AIPanel";
import { copyLink, duplicate, moveWithPicker, newPage, trashWithUndo } from "@/features/pages/actions";

const failed = (e: unknown) => toast(e instanceof Error ? e.message : "Couldn't export the page. Please try again.", { tone: "danger" });

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
        <MenuSub>
          <MenuSubTrigger icon="download">Export</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem onSelect={() => void exportPagePdf(page).catch(failed)}>PDF</MenuItem>
            <MenuItem onSelect={() => void exportPageImage(page).catch(failed)}>Image (.png)</MenuItem>
            {isDoc && (
              <>
                <MenuItem onSelect={() => void exportPageDocx(page).catch(failed)}>Word (.docx)</MenuItem>
                <MenuItem onSelect={() => void exportPageMarkdown(page).catch(failed)}>Markdown (.md)</MenuItem>
                <MenuItem onSelect={() => void exportPageHtml(page).catch(failed)}>Web page (.html)</MenuItem>
              </>
            )}
          </MenuSubContent>
        </MenuSub>
        <MenuSeparator />
        <MenuItem icon="trash" danger onSelect={() => trashWithUndo(page)}>
          Move to trash
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
