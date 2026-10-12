import type { Metadata } from 'next';
import { CertificateDetail } from '@/components/certificates/certificate-detail';

interface Props {
  params: { id: string };
}

function certificateIdFrom(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

export function generateMetadata({ params }: Props): Metadata {
  const id = certificateIdFrom(params.id);
  return {
    title: `Certificate ${id} | GreenTrace`,
    description: `Independently verify GreenTrace emissions certificate ${id} against its Hedera consensus record, NFT and content-addressed metadata.`,
  };
}

// Public: anyone with the link can verify a certificate, signed in or not.
export default function CertificatePage({ params }: Props) {
  return (
    <div className="container mx-auto px-4 py-8">
      <CertificateDetail certificateId={certificateIdFrom(params.id)} />
    </div>
  );
}
