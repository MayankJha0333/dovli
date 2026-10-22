# Dovli for Chrome

Clip web pages into Dovli, have AI turn them into notes, and write in a Dovli page beside any website.

**Install:** [Dovli – Web Clipper & Notes](https://chromewebstore.google.com/detail/eompomcfedlnlnbgbacbennoaehobodh) on the Chrome Web Store (item id `eompomcfedlnlnbgbacbennoaehobodh`).

- **Clipper** (click the toolbar icon, `Alt+Shift+D`): clip the tab as **AI notes** (with an optional focus), the **Article**, the **Full page**, your **Selection** or a **Bookmark** (a link card with the page's summary). While it's open, the page outlines the part an article or AI notes will take, with − and + to make it smaller or bigger. Give the clip a title, choose where it goes (**Save in**: the top level, or inside one of your pages; selections and bookmarks are added to the end of that page), add **tags** and a **remark**. Arrow keys move between the kinds, Enter saves.
- **Highlighter**: from the clipper, or right-click → Highlight with Dovli. Select text to highlight it, click a highlight to remove it, Esc or Done to stop. Highlights stay on the page until it reloads, and come through in whatever you clip from it.
- **Drawer** (side panel, `Alt+Shift+S`, or right-click the toolbar icon): a Dovli page next to the website. Write notes, edit blocks, tick to-dos, delete with Undo. Changes made in Dovli elsewhere appear within a few seconds.
- **Right-click** on any website: add selected text, a picture or a link to the drawer's page, highlight the selection, clip the page, or make AI notes.
- **Welcome tab** on install: how to pin the icon to the toolbar (Chrome doesn't let extensions pin themselves), and Connect.

Plain Manifest V3 with no build step: the folder is the extension.

## How it talks to Dovli

**Connect** opens `https://dovli.in/app?connect=extension&nonce=…`. After you approve, Dovli makes (or re-keys) a connection named "Dovli for Chrome", the same kind of connection AI apps use. It then hands the connection's secret to `src/connect.js`, which the background injects into that tab. The nonce proves the hand-over answers this extension's own request.

The connection shows in Dovli → Settings → AI apps, where it can be switched off or deleted.

Everything else goes to `POST /api/extension` (`apps/web/src/app/api/extension/route.ts`) with that secret. Clipping sends the tab as the browser shows it, so pages behind a sign-in or built with JavaScript work too. The server finds the article, writes AI notes if asked, picks a page style, and saves the page.

| File | What it is |
| --- | --- |
| `manifest.json` | Permissions, popup, side panel, shortcuts |
| `base.css`, `icons.svg`, `src/ui.js` | Dovli's tokens (Soft Studio light, Mica dark), shared controls, and Dovli's icon set as one sprite |
| `src/background.js` | Right-click menu, shortcuts, clipping for every surface, Connect, welcome tab |
| `popup.html`, `src/popup.js` | The clipper (the toolbar popup) |
| `src/page.js` | Runs inside the web page while it's being clipped: the outline of the part a clip takes, and the highlighter |
| `sidepanel.html`, `src/sidepanel.js`, `src/render.js` | The drawer, and how it draws a page (DOM text only, never HTML) |
| `welcome.html`, `src/welcome.js` | Shown once on install |
| `src/capture.js` | Runs inside the web page: reads the page (or the outlined part), the selection, or what a bookmark needs |
| `src/api.js` | Talking to Dovli, shared helpers |

## Try it locally

1. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked**, and choose this folder.
2. Pin it: puzzle piece → pin next to Dovli.
3. To use a local Dovli (`pnpm dev:web`), open the drawer → **⋯** → Dovli address → `http://localhost:3000` → Save address. Chrome asks for permission for that address. Then Connect.

Tests: `pnpm --filter @dovli/extension test`. The server side is tested in `apps/web` (`route.test.ts`, `extensionCore.test.ts`).

## Publish to the Chrome Web Store

1. Bump `version` in `manifest.json` (and `package.json`). Every upload needs a higher version.
2. `pnpm --filter @dovli/extension zip` makes `dovli-extension.zip` (tests are left out).
3. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), open Dovli, then **Package** → **Upload new package** with the zip. (The first release used **New item**; a developer account needs a one-time fee.)
4. Fill in the listing (below), add screenshots (1280×800: the popup, the drawer beside an article, the right-click menu), and a 440×280 promo tile.
5. **Privacy**: link `https://dovli.in/privacy`, and make sure it describes what the extension sends (see below). Declare that it handles "Website content" and "Personally identifiable information" (the email shown after Connect), and that data isn't sold or used for anything unrelated.
6. Submit for review. Review usually takes a few days; the broad optional host permission can lengthen it.

### Listing text

**Name:** Dovli – Web Clipper & Notes
**Summary (132 characters max):** Clip articles, whole pages, selections and bookmarks to Dovli, highlight as you read, and make AI notes.
**Category:** Productivity

### Why each permission (paste into the review form)

| Permission | Why |
| --- | --- |
| `activeTab` | Reads the tab you're on only when you click the toolbar icon, a right-click item or a shortcut, to clip it or add your selection. |
| `scripting` | Runs the reader in that tab to get the article or selection, outlines the part to be clipped and runs the highlighter there, and runs the Connect script on Dovli's own page. |
| `sidePanel` | The notes drawer beside the website. |
| `contextMenus` | "Add selection / image / link to Dovli", "Clip this page", "Make AI notes", "Open the Dovli drawer". |
| `storage` | Remembers the connection to your Dovli account and the page you're writing in. |
| Host `https://dovli.in/*` | Talks to your Dovli account, and finishes Connect on Dovli's page. |
| Optional `https://*/*`, `http://*/*` | Asked for only if you clip from the drawer after switching tabs (where `activeTab` doesn't reach). Chrome shows a prompt; nothing is read until you click a button. |

## What it sends, for the privacy policy

- When you clip or make notes: the page's address, its content as shown in your browser (without scripts or styles), and your device's date and language, sent to Dovli to make the page. For AI notes, the article's text goes on to the AI provider Dovli uses (Dovli AI on Groq, or your own key's provider).
- When you add a selection, picture, link or bookmark: that selection or address, the page's title, address and own summary, and any title, tags and remark you wrote.
- Highlights are made in the page itself and are never sent anywhere until you clip the page they're on.
- The drawer reads and edits the page you choose in it. It checks every few seconds, only while it's open, whether that page changed.
- Nothing is read from a website until you click, and nothing is collected in the background.
