import { route } from '@/server/http';
import { verifyCertificate } from '@/server/services/certificates';

export const dynamic = 'force-dynamic';

// Public: anyone holding a certificate id can verify it.
export const GET = route<{ params: { certificateId: string } }>(async (_req, { params }) => verifyCertificate(params.certificateId));
