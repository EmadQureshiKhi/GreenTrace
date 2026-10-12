import 'server-only';
import { CID } from 'multiformats/cid';
import * as json from 'multiformats/codecs/json';
import { sha256 } from 'multiformats/hashes/sha2';
import { canonicalJson } from '@/lib/hashing';
import { serverEnv } from './env';
import { must, supabaseAdmin } from './supabase-admin';

export interface StoredObject {
  cid: string;
  uri: string;
  pinned: boolean;
}

/** Content identifier (CIDv1, json codec, sha2-256) of the canonical encoding of `content`. */
export async function cidFor(content: unknown): Promise<string> {
  const bytes = json.encode(JSON.parse(canonicalJson(content)));
  return CID.create(1, json.code, await sha256.digest(bytes)).toString();
}

/**
 * Stores JSON metadata by content address.
 * With PINATA_JWT set, it is pinned to IPFS through Pinata and the returned CID is Pinata's.
 * Without it, the CID is computed locally and the content is served by this app at /api/ipfs/<cid>.
 * Either way a copy is kept in `ipfs_objects` so verification never depends on a public gateway.
 */
export async function storeJson(name: string, content: Record<string, unknown>): Promise<StoredObject> {
  const jwt = serverEnv.pinataJwt();
  let cid: string;
  let pinned = false;

  if (jwt) {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: { name },
        pinataOptions: { cidVersion: 1 },
      }),
    });
    if (!res.ok) throw new Error(`IPFS pinning failed (${res.status}): ${await res.text()}`);
    cid = ((await res.json()) as { IpfsHash: string }).IpfsHash;
    pinned = true;
  } else {
    cid = await cidFor(content);
  }

  must(
    await supabaseAdmin().from('ipfs_objects').upsert({ cid, content, pinned }, { onConflict: 'cid' }),
    'Store metadata',
  );
  return { cid, uri: `ipfs://${cid}`, pinned };
}

export async function loadJson(cid: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabaseAdmin().from('ipfs_objects').select('content').eq('cid', cid).maybeSingle();
  return (data?.content as Record<string, unknown>) ?? null;
}
