import { ExternalLink, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { ExplorerLink } from '@/components/chain/explorer-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { chainConfig } from '@/lib/chain-config';
import { shortHash } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { CopyButton } from './copy-button';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">{children}</dd>
    </div>
  );
}

function Missing({ children = 'Not recorded' }: { children?: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}

export function OnchainProofs({ certificate }: { certificate: Certificate }) {
  const cid = certificate.metadata_cid;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-primary" /> On-chain proofs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <Row label="Certificate NFT">
            {certificate.nft_token_id && certificate.nft_serial ? (
              <ExplorerLink kind="nft" tokenId={certificate.nft_token_id} serial={certificate.nft_serial} />
            ) : (
              <Missing>Not minted</Missing>
            )}
          </Row>

          <Row label="Mint transaction">
            {certificate.nft_tx_id ? <ExplorerLink kind="transaction" id={certificate.nft_tx_id} /> : <Missing />}
          </Row>

          <Row label="Consensus record">
            {certificate.hcs_sequence && chainConfig.topicId ? (
              <ConsensusProof sequence={certificate.hcs_sequence} label="Issuance logged" />
            ) : certificate.hcs_tx_id ? (
              <ExplorerLink kind="transaction" id={certificate.hcs_tx_id} />
            ) : (
              <Missing />
            )}
          </Row>

          <Row label="Metadata CID">
            {cid ? (
              <>
                <a
                  href={`/api/ipfs/${encodeURIComponent(cid)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={cid}
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >
                  {shortHash(cid, 10, 6)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                {certificate.metadata_pinned ? (
                  <a
                    href={`https://ipfs.io/ipfs/${encodeURIComponent(cid)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    ipfs.io <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">(not pinned to public IPFS)</span>
                )}
              </>
            ) : (
              <Missing />
            )}
          </Row>

          <Row label="Inventory hash (sha256)">
            <code className="font-mono text-xs" title={certificate.data_hash}>
              {shortHash(certificate.data_hash, 10, 8)}
            </code>
            <CopyButton value={certificate.data_hash} label="Copy inventory hash" successMessage="Inventory hash copied" />
          </Row>
        </dl>
      </CardContent>
    </Card>
  );
}
