# Dovli: Play Console answers

Copy each section into the matching Play Console page. Every answer here is checked against the app
code and the privacy policy at https://dovli.in/privacy (updated 20 October 2026).

---

## 1. Main store listing (Grow users → Store presence → Main store listing)

**App name** (30 max)
```
Dovli: Notes & Whiteboard
```

**Short description** (80 max)
```
Write, plan and sketch. Pages, to-dos and whiteboards that sync with the web.
```

**Full description** (4000 max)
```
Dovli is a calm place to write, plan and sketch.

Write in pages made of blocks: headings, lists, to-dos, tables, callouts, quotes, code, pictures and link previews. Put pages inside pages, link them to each other, and add #tags to find things again.

Sketch on a whiteboard when words aren't enough. Draw shapes, arrows and notes on the same canvas as Dovli on the web.

Start fast with templates for notes, plans, journals, meetings and more, or begin with a blank page or a blank whiteboard.

Make each page yours with page styles, and pick a look for the whole app, light or dark, or let it match your phone.

Your pages work offline and sync between your phone and dovli.in when you're back online.

Share a page with a link, for others to read or to edit with their own Dovli account, turn the link off any time, or share a page as a PDF.

Your pages are yours. Export a full Dovli backup or every page as Markdown. Delete your account and everything in it from inside the app.

No ads. We don't sell your data and we don't train AI models on your pages.

Privacy policy: https://dovli.in/privacy
Help: support@dovli.in
```

**Graphics**
- App icon: `icon-512.png` (512×512, 32-bit PNG)
- Feature graphic: `feature-graphic-1024x500.png` (made from `Playstore/Dovli_ A Calm Creative Space.png`)
- Phone screenshots: the 8 files in `screenshots/` (1080×1920), taken from a demo account.
  Upload them in file order: 01-hero first, since the first three are the ones most people see
- Promo video: upload `promo-video-1080p.mp4` to YouTube (Public or Unlisted, ads off,
  not "made for kids"), then paste its URL in the "Video" field

---

## 2. Store settings (Grow users → Store presence → Store settings)

- App or game: **App**
- Category: **Productivity**
- Tags: Note taking, Productivity, Task management (pick the closest offered)
- Email: **support@dovli.in**
- Website: **https://dovli.in**
- Phone: leave empty (optional)

---

## 3. Privacy policy (Policy → App content)

```
https://dovli.in/privacy
```

---

## 4. App access (Policy → App content → App access)

Choose: **All or some functionality is restricted** (the app needs sign-in).

Sign-in is by a 6-digit code emailed to the user, or Google. A reviewer can't receive a code sent to
your inbox, so give them one of these (you decide which; see "Still to do"):

- **Option A, a Google account made only for review.** Instructions to paste:
  ```
  Tap "Continue with Google" and sign in with:
  Email: <review account email>
  Password: <password>
  No other steps are needed. The account has sample pages already.
  ```
- **Option B, an email account with a fixed code for review.** Needs a small server change first.

---

## 5. Ads (Policy → App content → Ads)

**No, my app does not contain ads.**

---

## 6. Content rating (Policy → App content → Content ratings)

- Email: support@dovli.in
- Category: **All other app types** (Productivity / Utility)
- Violence, sexuality, language, controlled substances, gambling: **No** to all
- Does the app allow users to interact or exchange content with other users? **Yes**
  (pages can be shared with other people and through public links)
- Does the app share the user's current physical location with other users? **No**
- Does the app allow users to purchase digital goods? **No**
- Is this app a web browser or search engine? **No**

Expected rating: Everyone / PEGI 3, with the "Users Interact" note.

---

## 7. Target audience and content (Policy → App content)

- Target age groups: **13–15, 16–17, 18 and over** (the privacy policy says Dovli isn't for under-13s)
- Could the app unintentionally appeal to children? **No**

---

## 8. Data safety (Policy → App content → Data safety)

**Overview**
- Does the app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**
- Delete-account URL: **https://dovli.in/delete-account**

**Data types: tick these, and for each one: Collected = Yes, Shared = No**

| Category → type | Required or optional | Purposes |
|---|---|---|
| Personal info → **Name** | Optional (users can leave it empty; Google sign-in fills it) | App functionality, Account management |
| Personal info → **Email address** | Required | App functionality, Account management, Fraud prevention, security and compliance |
| Personal info → **User IDs** | Required | App functionality, Account management |
| Photos and videos → **Photos** | Optional (pictures added to a whiteboard; Google profile photo) | App functionality |
| App activity → **Other user-generated content** | Required (pages sync while signed in) | App functionality |
| Device or other IDs → **Device or other IDs** | Required (a random ID per device, for the devices list and sync) | App functionality, Account management |

Ephemeral processing: **No** for all of these (they are stored).

**Why "Shared = No"** is correct: Play doesn't count as sharing (a) data sent to service providers that
process it for you (Firebase, Vercel, the email service), or (b) data the user chooses to send to
other people (sharing a page). Both apply here.

**Not collected by the phone app:** location, contacts, messages, audio, files, calendar, health,
financial info, web history, app interactions, crash logs, diagnostics. (The privacy policy says: "The
phone app has no analytics or crash-reporting tools.") AI features are web-only.

---

## 9. Other declarations (Policy → App content)

- Government app: **No**
- Financial features: **None**
- Health: **None**
- News app: **No**
- Advertising ID: **No** (the app doesn't use it)

---

## 10. Testing before production (only if this is a personal developer account)

If the Play developer account is **personal** and was created after 13 November 2023:
1. Testing → Closed testing → create a track and upload the `.aab` there.
2. Add at least **12 testers** (a Google Group or email list) who opt in through the test link.
3. Keep them opted in for **14 days** in a row.
4. Then Dashboard → "Apply for production" and answer the short questions.

An **organisation** account can skip this and release to Production directly.

---

## Still to do (can't be done from the code)

1. **Reviewer login** (section 4): Option B is built. Set `REVIEW_LOGIN_EMAIL` and `REVIEW_LOGIN_CODE`
   on Vercel and deploy, then give Play that email and code.
2. **Google sign-in SHA-1:** add the upload key now:
   `23:32:E6:5D:48:3C:69:32:55:E3:F6:7B:34:04:85:87:EF:E2:E9:B5`. Then, after the first upload, copy Play Console → Test and release →
   App integrity → **App signing key certificate → SHA-1** into Firebase → Project settings →
   Android app `app.dovli` → Add fingerprint.
