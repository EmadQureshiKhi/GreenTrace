import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { issueCertificate, issueCertificateInput } from '@/server/services/certificates';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { certificate: await issueCertificate(user, issueCertificateInput.parse(await readJson(req))) };
});
