import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth/auth-guard';
import { UploadHub } from '@/components/upload/upload-hub';

export const metadata: Metadata = { title: 'Upload data | GreenTrace' };

export default function UploadPage() {
  return (
    <AuthGuard title="Sign in to measure emissions">
      <div className="container mx-auto px-4 py-8">
        <UploadHub />
      </div>
    </AuthGuard>
  );
}
