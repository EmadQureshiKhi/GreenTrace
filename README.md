<picture>
  <source media="(prefers-color-scheme: dark)" srcset="frontend/assets/readme/hero-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="frontend/assets/readme/hero-light.png">
  <img src="frontend/assets/readme/hero-light.png" alt="GreenTrace: carbon accounting you can verify, not just trust" width="960">
</picture>

<p align="center">
  <a href="https://greentrace-app.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/live%20demo-greentrace--app.vercel.app-16a34a"></a>
  <a href="https://ieee-climatechain-hack.devpost.com/"><img alt="IEEE ClimateChain Global Hackathon 2026" src="https://img.shields.io/badge/IEEE%20ClimateChain-Hackathon%202026-00629B"></a>
  <img alt="Track 1" src="https://img.shields.io/badge/Track%201-Carbon%20Markets%20%26%20Emissions%20Transparency-16a34a">
  <a href="https://hashscan.io/testnet/topic/0.0.11116480"><img alt="Hedera testnet" src="https://img.shields.io/badge/Hedera-testnet-222222?logo=hedera"></a>
  <img alt="AI" src="https://img.shields.io/badge/AI-OpenAI%20%7C%20Claude-8b5cf6">
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?logo=supabase&logoColor=white">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue">
</p>

GreenTrace turns electricity, gas and fuel bills into an audited greenhouse gas inventory with AI, certifies it on Hedera, and lets organizations buy and retire carbon credits on chain, with a public proof for every step.

**Live demo:** [greentrace-app.vercel.app](https://greentrace-app.vercel.app), on Hedera testnet. A certificate anyone can verify: [GT-2026-Q5LL89](https://greentrace-app.vercel.app/certificates/GT-2026-Q5LL89).

Built for the **IEEE ClimateChain Global Hackathon 2026**, **Track 1: Carbon Markets & Emissions Transparency**, organized by the [IEEE Blockchain Türkiye Group](https://cmte.ieee.org/turkiye-blockchain/hackatlon/) with the IEEE Blockchain Technical Committee and IEEE chapters in support of UN COP 31.

## 🔗 Links

| What | Link |
| --- | --- |
| Live app (Hedera testnet) | [greentrace-app.vercel.app](https://greentrace-app.vercel.app) |
| Verify a certificate, no account needed | [GT-2026-Q5LL89](https://greentrace-app.vercel.app/certificates/GT-2026-Q5LL89) |
| Carbon credit marketplace | [greentrace-app.vercel.app/marketplace](https://greentrace-app.vercel.app/marketplace) |
| Service health | [greentrace-app.vercel.app/api/health](https://greentrace-app.vercel.app/api/health) |
| Source code | [github.com/EmadQureshiKhi/GreenTrace](https://github.com/EmadQureshiKhi/GreenTrace) |
| Audit trail (HCS topic) | [0.0.11116480 on HashScan](https://hashscan.io/testnet/topic/0.0.11116480) |
| CO2e credit token | [0.0.11116482 on HashScan](https://hashscan.io/testnet/token/0.0.11116482) |
| Certificate NFTs | [0.0.11116483 on HashScan](https://hashscan.io/testnet/token/0.0.11116483) |
| Exchange contract | [0.0.11116506 on HashScan](https://hashscan.io/testnet/contract/0.0.11116506) |
| Hackathon | [IEEE ClimateChain Global Hackathon 2026 on Devpost](https://ieee-climatechain-hack.devpost.com/) |
| Privacy and terms | [Privacy policy](https://greentrace-app.vercel.app/privacy) · [Terms of use](https://greentrace-app.vercel.app/terms) |

## 🌱 What it does

- **AI bill reading**: drop in PDFs or photos of bills; the AI transcribes quantities with the exact evidence text and a confidence score, and emissions are computed from an official emission factor catalog, never by the model.
- **AI pre-certification audit**: nine deterministic checks plus an AI reviewer catch double-counted bills, overlapping periods, unit slips and implausible values; a high-risk inventory cannot be certified.
- **Verifiable certificates**: the inventory is hashed, its metadata pinned to IPFS, a certificate NFT minted and the record written to Hedera Consensus Service; anyone can verify it from a public page.
- **Carbon credit marketplace**: AI quality ratings for every project, an AI offset advisor that builds a basket for your remaining emissions, and purchases paid in HBAR through a smart contract.
- **On-chain retirement**: retiring credits destroys the tokens, so a tonne can never be sold or claimed twice.
- **AI reduction planner**: a costed plan with tonnes computed from your own inventory and a trajectory to your target year.
- **Materiality and GRI reporting**: stakeholder engagement and materiality assessment, with AI-drafted GRI disclosures that mark missing facts instead of inventing them.

<img src="frontend/assets/readme/pipeline.png" alt="From a utility bill to a retired tonne: AI reads bills into an inventory, nine rules and an AI auditor gate certification on Hedera, then credits are rated, bought through a contract and retired by wiping the tokens" width="960">

## 🎯 Track 1 alignment

| Track 1 asks for | GreenTrace |
| --- | --- |
| Real-time emissions tracking | AI reads bills into a Scope 1 and 2 inventory in seconds; every reading is anchored on Hedera |
| Blockchain-based carbon credit verification | Certificates are NFTs whose inventory hash, metadata and consensus record anyone can recheck |
| Smart contracts to prevent double counting | Duplicate bills are blocked before certification, each payment settles one order on chain, and retirement wipes tokens from supply |
| Transparent carbon trading platforms | HBAR purchases through `GreenTraceExchange`, AI-rated projects, and every trade on the public audit topic |

<img src="frontend/assets/readme/double-counting.png" alt="Three places a tonne cannot be counted twice: bill fingerprints before certification, one payment per order in the exchange contract, and token wipes on retirement" width="960">

## 🤖 AI that you can audit

<img src="frontend/assets/readme/ai-guardrails.png" alt="Where the model stops and code takes over: six AI features propose schema-checked JSON, deterministic code computes every number, and each result is hashed and recorded on the Hedera audit topic" width="960">

| Feature | The model does | Code guarantees | Anchored on Hedera |
| --- | --- | --- | --- |
| Bill reading | Transcribes quantity, unit, period and evidence; reads the site country; picks a source from a fixed catalog | Unit conversion, emission factors (official national grid factors for 14 regions), duplicate-bill fingerprinting, factor-to-country check | `AI_EXTRACTION` |
| Pre-certification audit | Reviews plausibility, misclassification and evidence | Nine rules always run; risk score computed from all findings | `AI_AUDIT` |
| Credit quality rating | Scores additionality, permanence, MRV, leakage, co-benefits | Weighted score and grade | `AI_CREDIT_RATING` |
| Offset advisor | Proposes a diversified basket | Stock, need and budget enforced | - |
| Reduction planner | Proposes measures and the share of a source each removes | Tonnes, annualization, trajectory | `AI_REDUCTION_PLAN` |
| GRI drafter | Drafts GRI 2-29, 3-1, 3-2, 3-3, 305-1 and 305-2 | Missing facts marked `[DATA NEEDED]` | `AI_GRI_DRAFT` |

Outputs are schema-validated JSON; every AI result is hashed with its model and prompt version and logged on chain.
Bill reading runs on `gpt-5.4-mini` (as accurate as the larger model in [testing](frontend/docs/TESTING.md#ai-model-evaluation)), the judgement-heavy features on `gpt-5.5`; Claude is supported as a drop-in alternative.
See [Responsible AI](frontend/docs/RESPONSIBLE-AI.md).

<p align="center">
  <img src="frontend/docs/images/bill-reading.png" alt="AI bill reading catching a duplicate bill" width="49%"/>
  <img src="frontend/docs/images/audit.png" alt="AI audit before certification" width="49%"/>
</p>

## 🔗 Hedera integration

### Core infrastructure (testnet)

| Asset | ID | Purpose |
| --- | --- | --- |
| Audit topic (HCS) | [`0.0.11116480`](https://hashscan.io/testnet/topic/0.0.11116480) | Ordered, timestamped record of every certificate, audit, AI result, purchase and retirement |
| CO2e credit token (HTS) | [`0.0.11116482`](https://hashscan.io/testnet/token/0.0.11116482) | 1 token = 1 tonne CO2e; wipe key retires credits from supply |
| Certificate NFTs (HTS) | [`0.0.11116483`](https://hashscan.io/testnet/token/0.0.11116483) | One NFT per certificate, metadata on IPFS |
| GreenTraceExchange (EVM) | [`0.0.11116506`](https://hashscan.io/testnet/contract/0.0.11116506) | HBAR purchases (one payment per order) and retirement requests |
| Treasury | [`0.0.11116474`](https://hashscan.io/testnet/account/0.0.11116474) | Mints, delivers and retires; key held only on the server |

**Example:** certificate [`GT-2026-DG4WM6`](https://hashscan.io/testnet/token/0.0.11116483/1), 27.91 t CO2e, fully offset by 28 retired credits.

### Why Hedera

- **An ordered, tamper-evident log** at a fraction of a cent per record, so every step can be anchored.
- **Native tokens with retirement built in**: wiping a credit removes it from supply, which is exactly what prevents double counting.
- **An EVM** so any MetaMask wallet can pay and sign, and a **mirror node** the server uses to verify every payment and retirement before acting.
- **Energy-efficient proof-of-stake consensus**, appropriate for a climate application.

## 🖼️ Screenshots

<p align="center">
  <img src="frontend/docs/images/hero-certificate.png" alt="A GreenTrace certificate verified against Hedera: five of five checks pass" width="960"/>
</p>

| | |
| --- | --- |
| <img src="frontend/docs/images/landing.png" alt="Landing page"/> | <img src="frontend/docs/images/dashboard.png" alt="Dashboard"/> |
| <img src="frontend/docs/images/marketplace.png" alt="Marketplace with AI ratings"/> | <img src="frontend/docs/images/credit-rating.png" alt="AI credit rating"/> |
| <img src="frontend/docs/images/reduction-plan.png" alt="AI reduction plan"/> | <img src="frontend/docs/images/gri-draft.png" alt="AI GRI draft"/> |

## 🚀 Quick start

### Prerequisites

- Node.js 20+ and `psql`
- A Supabase project
- A Hedera testnet account with HBAR ([faucet](https://portal.hedera.com/faucet))
- An OpenAI or Anthropic API key (optional: without one the rule-based audit still runs)
- A Pinata JWT (optional: without it metadata is content-addressed and served by the app)

### Installation

```bash
cd frontend
npm install
cp .env.example .env.local      # fill in Supabase, HEDERA_OPERATOR_KEY and an AI key
npm run db:migrate              # create the schema with row level security
npm run setup:hedera            # create the topic, tokens and contract; writes their ids to .env.local
npm run seed                    # sample marketplace listings
npm run dev                     # http://localhost:3000
```

### Completing payments when the tab closes

```bash
psql "$SUPABASE_DB_URL" -v app_url=https://your-app.vercel.app -f supabase/schedule-scan.sql
```

Supabase's pg_cron then calls `/api/internal/scan` every minute, which reads new exchange events from the mirror node and completes any purchase or retirement the browser did not report.
For completion within seconds, the optional [`backend-listener/`](backend-listener) service does the same continuously.

### Trying it as a judge

Open [greentrace-app.vercel.app](https://greentrace-app.vercel.app), sign up with email or Google, link MetaMask from the account menu and press **Get 25 test HBAR**: the treasury funds your wallet once, so you can buy and retire credits on testnet without the public faucet.

## 🏗️ Architecture

<img src="frontend/assets/diagrams/system-overview.png" alt="System overview: the browser and MetaMask, the trusted Next.js server with AI services, domain services and the treasury key, Supabase and IPFS for data, and Hedera consensus, tokens, the exchange contract and the mirror node, with Supabase pg_cron triggering a scan that completes payments if the tab closed" width="960">

<details>
<summary><b>Sequence: certifying an inventory</b></summary>
<br/>
<img src="frontend/assets/diagrams/certify-sequence.png" alt="Sequence diagram: bills are read by the AI, stored and anchored; the inventory is recomputed and audited; a high-risk audit blocks certification, otherwise the inventory is hashed, metadata pinned, the NFT minted and the certificate anchored" width="960">
</details>

<details>
<summary><b>Sequence: buying and retiring credits</b></summary>
<br/>
<img src="frontend/assets/diagrams/trade-sequence.png" alt="Sequence diagram: an order is priced and reserved, the wallet pays the exchange contract, the browser, or the scheduled scan if the tab closed, reports the transaction, the server verifies it on the mirror node, claims the order once and delivers tokens; retirement wipes tokens from supply" width="960">
</details>

<details>
<summary><b>Server components, data model and trust boundaries</b></summary>
<br/>
<img src="frontend/assets/diagrams/components.png" alt="Server components: thin API routes call domain services and AI features, which use pure tested functions in src/lib and four infrastructure modules; only hedera.ts signs" width="960">
<img src="frontend/assets/diagrams/data-model.png" alt="Entity relationship diagram of profiles, inventories, documents, audits, certificates, retirements, credits, ratings, orders and reduction plans" width="960">
<img src="frontend/assets/diagrams/trust-boundaries.png" alt="Runtime and trust boundaries: what the user device, the app host, managed services and the Hedera network are each trusted with" width="960">
</details>

Full specification: [docs/ARCHITECTURE.md](frontend/docs/ARCHITECTURE.md).
Diagram sources live in [docs/diagrams](frontend/docs/diagrams) (`node scripts/render-diagrams.mjs`) and [tools/make_readme_art.py](frontend/tools/make_readme_art.py).

## 🌍 Climate impact

- **Accurate measurement**: AI removes manual transcription, the audit catches the errors that inflate or hide emissions, and electricity uses the official national grid factor for the bill's country (13 countries plus the EU-27 average, each from the publisher's own document, listed in [`src/data/gridFactors.ts`](frontend/src/data/gridFactors.ts)).
- **Integrity of offsets**: quality ratings steer buyers to better credits, and retirement destroys tokens so nothing is double counted.
- **Real reductions**: plans quantified from measured data, anchored so progress can be checked against the next certified inventory.

Projections and methodology: [docs/CLIMATE-IMPACT.md](frontend/docs/CLIMATE-IMPACT.md).

## 🏆 IEEE ClimateChain deliverables

| Deliverable | Document |
| --- | --- |
| Problem statement and solution overview | [docs/PROBLEM-AND-SOLUTION.md](frontend/docs/PROBLEM-AND-SOLUTION.md) |
| Architecture diagram and technical specification | [docs/ARCHITECTURE.md](frontend/docs/ARCHITECTURE.md) |
| Security and data integrity assessment | [docs/SECURITY.md](frontend/docs/SECURITY.md) |
| Climate impact assessment and reduction projections | [docs/CLIMATE-IMPACT.md](frontend/docs/CLIMATE-IMPACT.md) |
| Implementation, adoption and scalability roadmap | [docs/ADOPTION-AND-ROADMAP.md](frontend/docs/ADOPTION-AND-ROADMAP.md) |
| User testing results | [docs/TESTING.md](frontend/docs/TESTING.md) |
| Responsible AI statement | [docs/RESPONSIBLE-AI.md](frontend/docs/RESPONSIBLE-AI.md) |

## 🔧 Configuration

All settings live in `frontend/.env.local`; [`frontend/.env.example`](frontend/.env.example) documents each one.
No secret is ever exposed to the browser: `NEXT_PUBLIC_` variables hold public identifiers only.

## 🛠️ Development

```bash
npm test                 # unit tests: units, catalog, audit rules, AI arithmetic, hashing
npm run test:contracts   # GreenTraceExchange
npm run test:db          # schema and row level security against a throwaway Postgres
npm run typecheck && npm run lint
```

| Layer | Technology |
| --- | --- |
| App | Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Recharts |
| Data | Supabase (Postgres with row level security, Auth, Storage) |
| Ledger | Hedera Consensus Service, Token Service, EVM, mirror node; `@hashgraph/sdk`, ethers v6 |
| Contracts | Solidity 0.8.24, Hardhat |
| AI | OpenAI or Anthropic SDK with schema-validated structured outputs |
| Storage | IPFS via Pinata |

<img src="frontend/assets/readme/repository.png" alt="What lives where: the web app, the server-only modules that hold the treasury key and the AI services, and the ledger and data layer with the contract, the schema and the scheduled scan" width="960">

<img src="frontend/assets/readme/tree.png" alt="Annotated file tree of the GreenTrace repository, with the AI services under src/server/ai highlighted" width="960">

## 🔐 Security

Treasury signing happens only on the server; row level security keeps inventories private and makes certificates, ratings and retirements a public registry; payments and retirements are verified on the mirror node before anything moves.
Details: [docs/SECURITY.md](frontend/docs/SECURITY.md).

## 📄 License

MIT. See [LICENSE](LICENSE).
