import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth/auth-guard';
import { CertificateList } from '@/components/certificates/certificate-list';

export const metadata: Metadata = {
  title: 'Certificates | GreenTrace',
};

export default function CertificatesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <AuthGuard title="Sign in to see your certificates">
        <CertificateList />
      </AuthGuard>
    </div>
  );
}
