import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, SUPPORT_EMAIL, Section } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · Dovli",
  description: "What Dovli keeps about you, why, who else sees it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

// Every statement here should match what the code does. When storage, providers or deletion
// change, update this page in the same change (and the "Last updated" date).
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="20 October 2026"
      lead={
        <p className="m-0">
          Dovli is a place to write, plan and sketch, on the web at dovli.in and in the Dovli app for phones. This policy explains what we keep about
          you, why, who else sees it, and how to delete it. We don&rsquo;t sell your data and we don&rsquo;t show ads.
        </p>
      }
    >
      <Section title="Who runs Dovli">
        <p>
          Dovli is made and run by Mayank Jha, an independent developer (&ldquo;we&rdquo; in this policy). For anything about your privacy or your data,
          email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="What we keep">
        <p>
          <strong>Your account.</strong> Your email address, and your name if you give one. If you sign in with Google, we also get your name, email and
          profile photo from Google. We note how you sign in (Google or email code), when you made your account, and when you last signed in and used
          Dovli.
        </p>
        <p>
          <strong>Your pages.</strong> When you&rsquo;re signed in, your pages, to-dos, tables and whiteboards are saved on our servers so they stay in
          sync across your devices. That includes pictures you add to a whiteboard. Pictures you add inside a document are kept on that device only for
          now. Pages are stored securely but are not end-to-end encrypted.
        </p>
        <p>
          <strong>Your devices.</strong> For each device you use, a random device ID, the kind of device and browser (for example &ldquo;Chrome on
          macOS&rdquo; or &ldquo;Android phone&rdquo;), the app version, and when it was first and last used.
        </p>
        <p>
          <strong>Sign-in codes.</strong> When you ask for a sign-in code, we keep a scrambled (hashed) copy of the code, when it expires, how many tries
          were made, and when codes were sent, so we can check it and stop misuse. To limit how many codes can be requested, we also keep a hashed form
          of your IP address and the times of recent requests.
        </p>
        <p>
          <strong>Sharing.</strong> When you share a page, we keep who it&rsquo;s shared with and what they can do. If you invite an email address that
          doesn&rsquo;t have a Dovli account yet, we keep that address and the page title until they sign up or you remove the invite.
        </p>
        <p>
          <strong>AI features (web).</strong> How much AI you&rsquo;ve used each month, and which AI provider and model you chose. If you connect your
          own AI key, we keep it encrypted and use it only for your requests.
        </p>
        <p>
          <strong>Connected AI apps.</strong> If you connect an AI app to Dovli (through MCP), we keep the connection&rsquo;s name, which pages it may
          use and what it may do, and when it was last used.
        </p>
        <p>
          <strong>Website analytics.</strong> The website uses Vercel Web Analytics and Speed Insights to count visits, see how fast pages load, and
          count a few button clicks (such as &ldquo;Create free account&rdquo;). Page addresses are stripped of page IDs and other details before they
          are sent, and we never send your name, email or page content. The phone app has no analytics or crash-reporting tools.
        </p>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To run your account, sign you in, and keep your pages in sync.</li>
          <li>To send the emails you ask for: sign-in codes, and invites when you share a page.</li>
          <li>To answer AI requests you make, and to keep AI use within fair limits.</li>
          <li>To keep Dovli safe, such as limiting how many sign-in codes can be requested.</li>
          <li>To understand, in total numbers, how the website is used and how fast it is.</li>
        </ul>
        <p>We don&rsquo;t sell your data, we don&rsquo;t use it for advertising, and we don&rsquo;t train AI models on your pages.</p>
      </Section>

      <Section title="Who else sees it">
        <p>We use a few services to run Dovli. They handle your data for us, to provide their service:</p>
        <ul>
          <li>
            <strong>Google Firebase</strong>: accounts and sign-in, and the database where your account and pages are stored. <strong>Google
            Sign-In</strong>, if you choose to sign in with Google.
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website and the server Dovli runs on, and provides the website analytics above.
          </li>
          <li>
            <strong>An email delivery service</strong>: sends sign-in codes and share invites.
          </li>
          <li>
            <strong>AI providers</strong>, only when you use an AI feature on the web: Groq or Anthropic for Dovli&rsquo;s own AI, or the provider whose
            key you connect (Groq, OpenRouter, Anthropic or OpenAI). We send what the request needs, such as your question, the page you have open and
            the titles of pages inside it. We don&rsquo;t send your name, email or account ID. Each provider handles that text under its own terms.
          </li>
          <li>
            <strong>Link previews</strong>: when you paste a link, your device asks microlink.io (or noembed.com for YouTube and Vimeo links) for its
            title and picture, so those services see the link. Videos you embed load from YouTube, Vimeo or Loom.
          </li>
          <li>
            <strong>Fonts</strong>: the website and the editor load fonts from Google Fonts and similar public font services, which see your IP
            address, as with any website.
          </li>
        </ul>
        <p>And people or apps you choose:</p>
        <ul>
          <li>
            <strong>People you share with.</strong> They see the page you share and your name (or, if you haven&rsquo;t set a name, your email). Invite
            emails include your name or email and the page title. Anyone with a page&rsquo;s public link can see that page, until you turn the link off.
          </li>
          <li>
            <strong>AI apps you connect</strong> can see your name and email, and read or change the pages you allow.
          </li>
        </ul>
        <p>We may also share information if the law requires it, or to protect Dovli and its users from fraud or abuse.</p>
      </Section>

      <Section title="Where it’s stored">
        <p>
          Your data is stored by the services above, which may keep and process it in data centres in different countries. We choose services that
          protect it with strong security.
        </p>
      </Section>

      <Section title="How long we keep it">
        <ul>
          <li>Your account and pages: until you delete them, or delete your account.</li>
          <li>
            Pages you delete for good: removed, except a small note (the page&rsquo;s ID, title and type) so your other devices know to remove it too.
            That note goes when your account does.
          </li>
          <li>Sign-in codes: they work for 10 minutes and once only. The records behind them are kept only briefly.</li>
          <li>Website analytics: kept by Vercel in total numbers, not tied to you.</li>
        </ul>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Change your name (in the phone app, under Account), and stop sharing any page, at any time.</li>
          <li>Export your pages: a full backup, or every page as Markdown.</li>
          <li>
            Use the phone app without an account. Your pages then stay on that phone only (pasted links and fonts still reach the services listed
            above).
          </li>
          <li>
            Ask us for a copy of your data, or to correct or delete it, by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the
            address on your account.
          </li>
          <li>
            Delete your account and everything in it, in the app or on the web. <Link href="/delete-account">See how</Link>.
          </li>
        </ul>
      </Section>

      <Section title="Deleting your account">
        <p>
          Deleting your account removes your sign-in, your pages, your devices list, your AI settings and any key you connected, your AI app
          connections, your pages&rsquo; public links, invites you sent that are still waiting, and any sign-in codes for your email. It happens right
          away and can&rsquo;t be undone. <Link href="/delete-account">How to delete your account</Link>.
        </p>
        <p>
          A few traces can remain: a page you shared may stay listed in another person&rsquo;s &ldquo;Shared with me&rdquo; until they next open it,
          pages owned by other people may still note that you edited them, and our service providers may keep their own logs for a short time.
        </p>
      </Section>

      <Section title="Cookies and storage">
        <p>
          The website sets one cookie, to keep you signed in (for up to 14 days). The website and app also keep your pages on your device so they open
          quickly and work offline. Analytics does not use cookies.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Everything travels over encrypted connections (HTTPS). Only Dovli&rsquo;s server can read or write the database, and it checks who you are
          before it opens or changes your pages. Keys you connect for AI are encrypted. No system is perfectly secure, so if we ever learn of a breach that affects your data,
          we&rsquo;ll tell you.
        </p>
      </Section>

      <Section title="Children">
        <p>Dovli isn&rsquo;t meant for children under 13, and we don&rsquo;t knowingly keep data about them. If you think a child has given us data, email us and we&rsquo;ll delete it.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change this policy, we&rsquo;ll update the date at the top. If a change matters for how your data is used, we&rsquo;ll let you know in
          the app or by email before it takes effect.
        </p>
      </Section>
    </LegalPage>
  );
}
