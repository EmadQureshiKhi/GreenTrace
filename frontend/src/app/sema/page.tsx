import type { Metadata } from 'next';
import { SemaApp } from '@/components/sema/sema-app';

export const metadata: Metadata = {
  title: 'SEMA | GreenTrace',
  description: 'Stakeholder engagement and materiality assessment, with GRI disclosure drafting and a Hedera audit log.',
};

export default function SemaPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <SemaApp />
    </div>
  );
}
