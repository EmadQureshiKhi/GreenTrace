# Implementation, adoption strategy and scalability roadmap

IEEE ClimateChain Global Hackathon 2026, Track 1: Carbon Markets & Emissions Transparency.

## Adoption strategy

### Who adopts first

1. **Sustainability consultants** who prepare inventories and GRI reports for many small clients.
   GreenTrace cuts their transcription time and gives them a verifiable deliverable; each consultant brings many organizations.
2. **Large companies running supplier programmes.**
   They need Scope 1 and 2 data from hundreds of suppliers and cannot audit each one; a verifiable certificate per supplier solves that.
3. **SMEs facing customer or lender requests** for emissions data, who need a credible answer quickly.

### How they adopt

- **Zero install.** Sign up, upload bills, review, certify; a wallet is only needed to buy or retire credits.
- **Familiar outputs.** GHG Protocol scopes, standard emission factors and GRI disclosure structure.
- **Exportable.** Inventories and drafts export to spreadsheets and Markdown; certificates are shareable links anyone can verify.
- **Progressive.** Start with a free inventory and audit; add certification, offsetting and reporting when needed.

### Barriers and how we address them

| Barrier | Response |
| --- | --- |
| Trust in AI numbers | Evidence and confidence on every value, mandatory review, computed numbers from code, every AI result anchored with its model and prompt version |
| Crypto unfamiliarity | Only buying and retiring credits needs a wallet; everything else is a normal web app; Hedera fees are fractions of a cent |
| Data confidentiality | Bills stay in private storage; only hashes go on chain |
| Regulatory fit | Methods follow the GHG Protocol and GRI; the audit trail suits third-party assurance |

### Business model

- Free tier: inventories and audits for a single organization.
- Professional tier for consultants: multiple client organizations, GRI drafting, bulk extraction.
- Programme tier for companies collecting supplier data.
- A small fee on marketplace transactions.

## Implementation plan

| Phase | Scope |
| --- | --- |
| Hackathon prototype (now) | Full flow on Hedera testnet: AI extraction, audit, certification, marketplace, retirement, reduction planning, GRI drafting |
| Pilot (3 months) | 20 to 50 organizations through two or three consultants; measure audit findings, time saved and user feedback |
| Production readiness (6 months) | Mainnet deployment, key management in a KMS or HSM, registry bridging for real credits, third-party security review |
| Scale (12 months) | Supplier programmes, Scope 3 categories, multi-language extraction, API for partner platforms |

## Scalability and sustainability roadmap

### Technical scalability

- **Ledger:** Hedera Consensus Service handles thousands of messages per second at fixed low fees; one message per certificate, audit or trade is far below any limit.
- **App:** stateless Next.js server routes scale horizontally; Postgres with indexes on every user-scoped query.
- **AI:** one structured call per document or feature, per-user rate limits, and duplicate files are never re-read; batch processing can halve extraction cost for bulk uploads.
- **Reconciliation:** a scheduled scan with a database cursor and lease; every step is idempotent, so it can run alongside the browser and an optional listener safely.

### Product roadmap

1. Registry bridging: mint CO2e tokens only against credits retired on recognised registries, and record the registry serial numbers on Hedera.
2. Scope 3: supplier certificates feed directly into customers' Scope 3 inventories, verified on chain.
3. Continuous measurement: utility and fuel-card API connectors and IoT meters, with the same audit and anchoring.
4. Assurance workflow: third-party verifiers co-sign certificates with their own Hedera keys.
5. More frameworks: ISSB/IFRS S2 and ESRS disclosure drafting alongside GRI.

### Organisational sustainability

- Revenue from subscriptions and marketplace fees covers AI and infrastructure costs, which are low per organization.
- Open data model and documented APIs reduce lock-in and invite partners.
- Partnerships with consultants and industry associations keep acquisition costs low.

## User testing

The prototype has been tested end to end on Hedera testnet by the team; the full results, with on-chain evidence for every step, are in [TESTING.md](TESTING.md).
Structured user testing with sustainability practitioners is planned for the pilot phase.
