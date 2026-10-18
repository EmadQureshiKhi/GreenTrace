import type { Metadata } from 'next';
import { CONTACT_EMAIL, LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Terms of use | GreenTrace' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="22 October 2026"
      intro={
        <p>
          These terms apply to the GreenTrace website and app. By creating an account or using GreenTrace, you agree to them. If you do not agree, please do
          not use the service.
        </p>
      }
    >
      <LegalSection title="A prototype on a test network">
        <ul>
          <li>GreenTrace is a prototype built for the IEEE ClimateChain Global Hackathon 2026. It is provided for evaluation and demonstration.</li>
          <li>It runs on <strong>Hedera testnet</strong>. Testnet HBAR, CO2e tokens and certificate NFTs have no monetary value and may be reset by the network.</li>
          <li>Marketplace listings are <strong>sample projects</strong> with illustrative details. Buying or retiring them does not offset real emissions and is not a claim you can make publicly.</li>
          <li>Certificates issued here are a demonstration of verifiable reporting, not third-party assurance or a regulatory filing.</li>
        </ul>
      </LegalSection>

      <LegalSection title="AI features">
        <ul>
          <li>AI reads documents and suggests audits, ratings, baskets, reduction plans and report text. It can make mistakes.</li>
          <li>You are responsible for reviewing every value before you create an inventory, issue a certificate or publish anything based on it.</li>
          <li>Credit ratings, offset suggestions and reduction plans are decision support, not financial, investment, legal or environmental advice.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your account and content">
        <ul>
          <li>Keep your sign-in details and your wallet secure. You are responsible for transactions you sign in your wallet.</li>
          <li>Upload only documents you are allowed to share, and do not upload other people&apos;s personal data beyond what appears on ordinary utility bills.</li>
          <li>You keep ownership of your content. You let GreenTrace process it to provide the service, as described in the privacy policy.</li>
          <li>Records written to Hedera or IPFS, such as certificates, hashes and transactions, are public and permanent.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Fair use">
        <ul>
          <li>Do not attempt to break, overload or bypass the security of the service, including the AI rate limits and the one-time test HBAR grant.</li>
          <li>Do not use GreenTrace to misrepresent emissions or to make misleading environmental claims.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="No warranty and limitation of liability">
        <p>
          GreenTrace is provided &quot;as is&quot;, without warranties of any kind, and may be unavailable, changed or discontinued at any time. To the extent the
          law allows, its makers are not liable for any loss arising from its use, including decisions made on the basis of its outputs.
        </p>
      </LegalSection>

      <LegalSection title="Open source">
        <p>The GreenTrace source code is released under the MIT license. These terms cover the hosted service, not the code.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms: <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
