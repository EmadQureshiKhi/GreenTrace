import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth/auth-guard';
import { InventoryDetail } from '@/components/inventory/inventory-detail';

export const metadata: Metadata = { title: 'Inventory | GreenTrace' };

export default function InventoryPage({ params }: { params: { id: string } }) {
  return (
    <AuthGuard title="Sign in to view this inventory">
      <div className="container mx-auto px-4 py-8">
        <InventoryDetail id={params.id} />
      </div>
    </AuthGuard>
  );
}
