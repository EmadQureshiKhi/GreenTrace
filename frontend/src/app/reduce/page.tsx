import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ReductionPlanner, ReductionPlannerSkeleton } from '@/components/reduce/reduction-planner';

export const metadata: Metadata = {
  title: 'Reduction planner | GreenTrace',
  description: 'AI-assisted decarbonization plans quantified from your own emissions inventory.',
};

export default function ReducePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <AuthGuard title="Sign in to plan reductions">
        <Suspense fallback={<ReductionPlannerSkeleton />}>
          <ReductionPlanner />
        </Suspense>
      </AuthGuard>
    </div>
  );
}
