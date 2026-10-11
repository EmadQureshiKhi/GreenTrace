import type { Metadata } from 'next';
import GHGCalculator from '@/components/ghg/GHGCalculator';
import { AuthGuard } from '@/components/auth/auth-guard';

export const metadata: Metadata = { title: 'GHG calculator | GreenTrace' };

export default function GHGCalculatorPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <GHGCalculator />
      </div>
    </AuthGuard>
  );
}