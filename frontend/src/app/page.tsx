'use client';

import { Landing } from '@/components/dashboard/landing';
import { UserDashboard } from '@/components/dashboard/user-dashboard';
import { useAuth } from '@/hooks/use-auth';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  return isAuthenticated ? <UserDashboard /> : <Landing />;
}
