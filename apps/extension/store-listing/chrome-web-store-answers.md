# Dovli for Chrome: Chrome Web Store answers

Copy each section into the matching tab of the item in the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole) (item ID `eompomcfedlnlnbgbacbennoaehobodh`).
Every answer here is checked against the extension code and the privacy policy at https://dovli.in/privacy
(updated 20 October 2026, with the browser extension section).

The name and the short summary come from `manifest.json` and can only change with a new upload:
- Name: `Dovli – Web Clipper & Notes`
- Summary: `Clip web pages to Dovli, make AI notes from them, and write in a Dovli page beside any website.`

---

## 1. Store listing

**Description**
```
Dovli for Chrome brings your Dovli pages to every website you read.

CLIP WHAT YOU READ
Click the Dovli icon (or press Alt+Shift+D) and choose what to keep:
• AI notes: Dovli reads the page and writes the gist, key points and details. Add a focus to shape the notes around what you want from it.
• Article: just the main text, without menus or ads.
• Full page: everything on the page, sidebars and all.
• Selection: the text you selected.
• Bookmark: a link card with the page's own summary.

While the clipper is open, the part an article or AI notes will take is outlined on the page. Use − and + to make it smaller or bigger. Give the clip a title, choose where it goes (at the top level or inside one of your pages), and add tags and a remark.

HIGHLIGHT AS YOU READ
Turn on the highlighter from the clipper or the right-click menu, then select text to highlight it. Your highlights come through in whatever you clip from the page.

A DOVLI PAGE BESIDE ANY WEBSITE
Open the drawer (Alt+Shift+S) to keep a Dovli page next to the site you're on. Write notes, edit blocks, tick off to-dos, and delete with Undo. Changes you make in Dovli elsewhere show up within a few seconds.

RIGHT-CLICK ANYWHERE
Add selected text, a picture or a link to the drawer's page, highlight a selection, clip the page, or make AI notes, all from the right-click menu.

HOW IT WORKS
You need a free Dovli account (dovli.in). Click Connect once and approve the connection in Dovli. You can switch it off or delete it any time under Settings → AI apps.

AI notes use your monthly Dovli AI allowance, or your own AI key if you've connected one in Dovli.

PRIVATE BY DESIGN
Dovli reads a website only when you click the icon, a right-click item or a shortcut. Nothing is collected in the background, there are no ads, and we don't sell your data or train AI models on your pages.

Privacy policy: https://dovli.in/privacy
Help: support@dovli.in
```

**Category:** Productivity (choose the closest subcategory offered, such as Workflow & Planning or Tools)
**Language:** English

**Graphics** (in this folder)
- Store icon: `../icons/128.png` (128×128)
- Screenshots: the `0*-*.png` files (1280×800), in file order
- Small promo tile: `promo-tile-440x280.png`
- Marquee promo tile (optional): `marquee-1400x560.png`, if present

**Additional fields**
- Homepage URL: `https://dovli.in`
- Support URL: `https://dovli.in` (support email: support@dovli.in)
- Mature content: No

---

## 2. Privacy

**Single purpose**
```
Dovli for Chrome saves what you read on the web into your Dovli notes, as clipped pages, AI notes, selections, highlights, pictures, links and bookmarks, and lets you write in a Dovli page beside the website you're on.
```

**Permission justifications**

| Permission | Paste this |
| --- | --- |
| `activeTab` | Reads the tab you're on only when you click the toolbar icon, a right-click item or a shortcut, to clip it or add your selection. |
| `scripting` | Runs the reader in the tab you clip to get the article or selection, outlines the part to be clipped and runs the highlighter there, and runs the Connect script on Dovli's own page. |
| `sidePanel` | Shows the notes drawer, a Dovli page, beside the website. |
| `contextMenus` | Adds "Add selection / image / link to Dovli", "Highlight with Dovli", "Clip this page", "Make AI notes" and "Open the Dovli drawer" to the right-click menu. |
| `storage` | Remembers the connection to your Dovli account, the page you're writing in, and your last clip choices, on your device. |
| Host permission | `https://dovli.in/*` is the Dovli service: the extension saves clips and reads and edits your pages there, and finishes Connect on Dovli's page. The optional `https://*/*` and `http://*/*` are asked for only if you clip from the drawer after switching tabs, where activeTab doesn't reach. Chrome shows a prompt, and nothing is read until you click a button. |

**Remote code:** No, I am not using remote code. Justification if asked:
```
All JavaScript is in the package. The extension only sends and receives JSON data from the Dovli API; it never loads or runs code from elsewhere.
```

**Data usage: what the extension collects.** Tick these:
- **Personally identifiable information**: the name and email of the connected Dovli account, shown in the extension.
- **Authentication information**: the connection secret it uses to sign in to Dovli.
- **Website content**: the text, pictures and links of pages you clip or add.

Leave the rest unticked: health, financial and payment, personal communications, location, web history and user activity. It never keeps a list of the pages you visit, and it reads nothing until you click.

**Certify all three:**
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://dovli.in/privacy`

---

## 3. Test instructions

The reviewer needs a Dovli account to use anything past Connect. Use the review sign-in that Play
review uses: an email whose 6-digit code is fixed and never sent (`REVIEW_LOGIN_EMAIL` and
`REVIEW_LOGIN_CODE` on the live server). Make sure both are set on the live deployment, then paste:
```
1. Install the extension and click the Dovli icon in the toolbar, then Connect.
2. On the Dovli sign-in page, type this in Email: <review email>
   and click "Email me a sign-in code".
3. In "Sign-in code" enter: <review code>. No email is sent; this code always works for this account.
4. In the "Connect the Dovli extension" window, click Connect. The tab closes and the extension
   is connected.
5. Open any article, click the Dovli icon, and choose Article or AI notes, then Save.
   Press Alt+Shift+S to open the drawer beside the page.
```

---

## 4. Distribution

- Payments: Free
- Visibility: **Unlisted** for a soft launch (only people with the link can install it), or **Public**
- Regions: All regions

---

## Before you submit

- [ ] Deploy the web app so https://dovli.in/privacy shows "The browser extension" section
- [ ] Review sign-in env vars are set on the live server, and the code works on dovli.in
- [ ] Graphics uploaded: icon, at least one screenshot, promo tile
- [ ] After it's live: switch the landing page's "Browser extension: coming soon" links to
      `https://chromewebstore.google.com/detail/eompomcfedlnlnbgbacbennoaehobodh`
