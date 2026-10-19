// The frame for Dovli's legal pages (privacy, deleting your account): the logo, a title with its
// date, and readable text. Public, so the Play Store listing and the apps can link to them.

import Link from "next/link";
import type { ReactNode } from "react";
import { DovliLogo } from "@dovli/ui";

export const SUPPORT_EMAIL = "support@dovli.in";

export function LegalPage({ title, updated, lead, children }: { title: string; updated: string; lead: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" aria-label="Dovli home" className="rounded-md">
          <DovliLogo size={28} />
        </Link>
        <nav aria-label="Legal" className="flex gap-4 text-sm">
          <Link href="/privacy" className="text-ink-2 hover:text-ink">
            Privacy
          </Link>
          <Link href="/delete-account" className="text-ink-2 hover:text-ink">
            Delete account
          </Link>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <p className="m-0 text-sm font-medium text-ink-3">Last updated {updated}</p>
        <h1 className="m-0 mt-3 font-display text-4xl font-bold tracking-tight text-ink">{title}</h1>
        <div className="mt-5 text-lg leading-relaxed text-ink-2">{lead}</div>
        <div className="legal mt-12 flex flex-col gap-12">{children}</div>
        <footer className="mt-16 border-t border-line pt-6 text-sm text-ink-3">
          Questions? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </footer>
      </main>
    </div>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="m-0 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-base leading-relaxed text-ink-2 [&_a]:font-medium [&_a]:text-accent hover:[&_a]:underline [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_p]:m-0">
        {children}
      </div>
    </section>
  );
}
