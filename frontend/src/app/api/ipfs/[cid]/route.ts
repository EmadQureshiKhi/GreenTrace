import { NextResponse } from 'next/server';
import { notFound, route } from '@/server/http';
import { loadJson } from '@/server/ipfs';

export const dynamic = 'force-dynamic';

// Serves content-addressed certificate metadata. Content never changes for a CID, so it is cacheable forever.
export const GET = route<{ params: { cid: string } }>(async (_req, { params }) => {
  const content = await loadJson(params.cid);
  if (!content) throw notFound('Unknown CID.');
  return NextResponse.json(content, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
});
