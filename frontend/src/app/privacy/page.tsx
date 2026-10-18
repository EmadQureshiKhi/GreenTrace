import type { Metadata } from 'next';
import { CONTACT_EMAIL, LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Privacy policy | GreenTrace' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="22 October 2026"
      intro={
        <p>
          GreenTrace is a prototype built for the IEEE ClimateChain Global Hackathon 2026 and runs on Hedera testnet. This policy explains what data it
          collects, what it does with it, what becomes public by design, and the choices you have.
        </p>
      }
    >
      <LegalSection title="What we collect">
        <ul>
          <li><strong>Account details:</strong> your email address, display name and organization name. If you sign in with Google, we receive your name and email from Google, nothing else.</li>
          <li><strong>Documents you upload:</strong> bills and spreadsheets, stored in a private bucket that only your account can read.</li>
          <li><strong>Emissions data:</strong> the activity lines, inventories, audits, reduction plans, materiality assessments and GRI drafts you create.</li>
          <li><strong>Wallet details:</strong> if you link a wallet, its address and Hedera account id, after you sign a message proving you control it.</li>
          <li><strong>Usage records:</strong> a log of AI requests per account, used only to enforce hourly limits, and standard request logs kept by our hosting provider.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>To read your bills with AI, calculate emissions, audit inventories, issue certificates and run the marketplace you use.</li>
          <li>To prevent abuse, such as limiting AI requests and granting test HBAR once per account.</li>
        </ul>
        <p>We do not sell your data, show advertising, or use your data to train AI models.</p>
      </LegalSection>

      <LegalSection title="What becomes public, by design">
        <p>GreenTrace exists to make climate claims verifiable, so some records are public and permanent once created:</p>
        <ul>
          <li><strong>Certificates:</strong> the certificate page, its organization name, reporting period, emissions totals and the activity lines behind it can be viewed by anyone with the link. The metadata is stored on IPFS and the certificate is an NFT on Hedera.</li>
          <li><strong>Hedera records:</strong> the audit topic stores hashes of AI results, audits and certificates, plus purchase and retirement records with the Hedera account ids involved. Hashes do not reveal the content of your documents.</li>
          <li><strong>Payments and retirements:</strong> transactions you sign from your wallet are public on Hedera, as on any public ledger.</li>
        </ul>
        <p>Records on Hedera and IPFS cannot be deleted. Bill contents are never written to the ledger or to IPFS.</p>
      </LegalSection>

      <LegalSection title="Who processes your data">
        <ul>
          <li><strong>Supabase</strong> (database, authentication and file storage, hosted in Singapore).</li>
          <li><strong>Vercel</strong> (application hosting).</li>
          <li><strong>OpenAI</strong> (reading documents and generating AI reviews, plans, ratings and drafts). Documents are sent only to be read, under OpenAI&apos;s API data terms, which do not use API data for training.</li>
          <li><strong>Pinata</strong> (pinning public certificate metadata to IPFS).</li>
          <li><strong>Hedera</strong> (the public ledger described above).</li>
          <li><strong>Google</strong>, only if you choose to sign in with Google.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          GreenTrace stores your sign-in session and your light or dark theme choice in your browser&apos;s local storage. It uses no advertising or analytics
          cookies.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting your data">
        <p>
          We keep your account data while your account exists. You can delete draft inventories in the app at any time. To delete your account and the
          private data behind it, email <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; we will do so within
          30 days, except for public records on Hedera and IPFS, which cannot be removed.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can ask for a copy of your data, its correction or its deletion by emailing{' '}
          <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. GreenTrace is not intended for children under 16.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If this policy changes, the date at the top of this page will change too.</p>
      </LegalSection>
    </LegalPage>
  );
}
