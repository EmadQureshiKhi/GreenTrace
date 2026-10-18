import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export const CONTACT_EMAIL = 'shoph2e@gmail.com';

/** Shared frame for the privacy policy and terms: a readable column with a title block and sections. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-4 text-muted-foreground">{intro}</div>
      <Card className="mt-8">
        <CardContent className="space-y-8 p-6 sm:p-8">{children}</CardContent>
      </Card>
      <p className="mt-6 text-sm text-muted-foreground">
        See also the <Link className="text-primary hover:underline" href="/privacy">privacy policy</Link> and the{' '}
        <Link className="text-primary hover:underline" href="/terms">terms of use</Link>. Questions:{' '}
        <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
