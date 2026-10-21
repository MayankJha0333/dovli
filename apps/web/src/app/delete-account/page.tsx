import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, SUPPORT_EMAIL, Section } from "@/features/legal/LegalPage";
import { UPDATED, longDate } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Delete your account · Dovli",
  description: "How to delete your Dovli account and everything in it, and what is removed.",
  alternates: { canonical: "/delete-account" },
};

// Google Play links here as the app's account-deletion page. Keep the steps in step with the apps,
// and the list in step with app/api/account/delete/route.ts.
export default function DeleteAccountPage() {
  return (
    <LegalPage
      title="Delete your Dovli account"
      updated={longDate(UPDATED.deleteAccount)}
      lead={
        <p className="m-0">
          You can delete your Dovli account, and every page in it, at any time. It happens right away and can&rsquo;t be undone, so export your pages
          first if you&rsquo;d like a copy.
        </p>
      }
    >
      <Section title="In the Dovli app">
        <ul>
          <li>Open Dovli and go to Settings.</li>
          <li>Tap your name at the top to open Account.</li>
          <li>
            Tap <strong>Delete account</strong>, then confirm.
          </li>
        </ul>
      </Section>

      <Section title="On the web">
        <ul>
          <li>
            Sign in at <Link href="/app">dovli.in</Link> and open Settings.
          </li>
          <li>
            Go to <strong>Privacy &amp; data</strong> and choose <strong>Delete my account</strong>, then confirm.
          </li>
        </ul>
      </Section>

      <Section title="Can't sign in?">
        <p>
          Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Dovli%20account`}>{SUPPORT_EMAIL}</a> from the address on your account and ask
          us to delete it. We&rsquo;ll confirm it&rsquo;s your account, delete it, and reply within 30 days.
        </p>
      </Section>

      <Section title="What's deleted">
        <ul>
          <li>Your account and sign-in (email, name, Google profile details)</li>
          <li>All your pages, whiteboards and the pictures on them</li>
          <li>Your devices list</li>
          <li>Your AI settings, AI usage records, and any AI key you connected</li>
          <li>AI apps you connected, and their access</li>
          <li>Your pages&rsquo; public links, and invites you sent that are still waiting</li>
          <li>Any sign-in codes for your email</li>
        </ul>
        <p>
          On the device you delete from, Dovli also clears its copy of your pages. Other phones or browsers you used keep their copy until you sign out
          there or remove the app.
        </p>
      </Section>

      <Section title="What may remain">
        <ul>
          <li>A page you shared may stay listed in another person&rsquo;s &ldquo;Shared with me&rdquo; until they next open it.</li>
          <li>Pages owned by other people may still note that you edited them.</li>
          <li>Our service providers may keep short-lived logs, and website analytics are kept only as totals that aren&rsquo;t tied to you.</li>
        </ul>
        <p>
          Read more in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
