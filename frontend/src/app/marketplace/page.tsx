import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Marketplace, MarketplaceSkeleton } from '@/components/marketplace/marketplace';

export const metadata: Metadata = {
  title: 'Marketplace | GreenTrace',
  description: 'Buy AI-rated carbon credits with HBAR. Every purchase is logged on Hedera Consensus Service.',
};

export default function MarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* useSearchParams (purchase prefill links) needs a Suspense boundary in Next 14. */}
      <Suspense fallback={<MarketplaceSkeleton />}>
        <Marketplace />
      </Suspense>
    </div>
  );
}
