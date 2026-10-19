import { NextResponse } from 'next/server';
import { hashscanTopicMessageTarget, parseTopicMessage } from '@/lib/chain-config';
import { getTopicMessage } from '@/server/mirror';

export const dynamic = 'force-dynamic';

// "View on HashScan" for a consensus message: HashScan has no page per topic sequence number, so look
// the message up on the mirror node and send the browser to its submit transaction, where HashScan
// shows the message itself. If the mirror node does not have it yet, fall back to the topic.
export async function GET(_request: Request, { params }: { params: { topicId: string; sequence: string } }) {
  const ref = parseTopicMessage(params.topicId, params.sequence);
  if (!ref) return NextResponse.json({ error: 'Not a topic message reference' }, { status: 404 });
  const message = await getTopicMessage(ref.topicId, ref.sequence).catch(() => null);
  return NextResponse.redirect(hashscanTopicMessageTarget(ref.topicId, message?.consensus_timestamp ?? null), 307);
}
