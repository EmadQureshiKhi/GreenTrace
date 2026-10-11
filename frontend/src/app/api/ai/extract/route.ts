import { extractDocument } from '@/server/ai/extract';
import { requireUser } from '@/server/auth';
import { badRequest, route } from '@/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw badRequest('Attach a file in the "file" field.');
  return extractDocument(user, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
});
