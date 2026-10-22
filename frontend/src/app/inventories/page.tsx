import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth/auth-guard';
import { InventoryList } from '@/components/inventory/inventory-list';

export const metadata: Metadata = { title: 'Inventories | GreenTrace' };

export default function InventoriesPage() {
  return (
    <AuthGuard title="Sign in to see your inventories">
      <div className="container mx-auto px-4 py-8">
        <InventoryList />
      </div>
    </AuthGuard>
  );
}
