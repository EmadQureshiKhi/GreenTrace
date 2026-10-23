# Responsible AI in GreenTrace

GreenTrace uses AI where it removes real work, and never where a mistake could silently become a public climate claim.
This statement follows the themes of the IEEE ClimateChain learning series on ethics and responsible innovation: transparency, accountability, privacy, bias, environmental impact and trust.

## Where AI is used, and where it is not

![Where the model stops and code takes over](../assets/readme/ai-guardrails.png)

| AI does | AI never does |
| --- | --- |
| Reads quantities, units and periods from bills, with the quoted evidence | Compute emissions, choose an emission factor value, or total an inventory |
| Reviews an inventory for plausibility and adds audit findings | Remove a rule-based finding or set the risk score |
| Proposes reduction measures and the share of a source each could remove | Decide the tonnes; they are computed from the measured inventory |
| Scores credit projects on five quality dimensions with reasons | Compute the overall score or grade |
| Proposes an offset basket | Exceed available stock or the buyer's budget |
| Drafts GRI disclosure text from the user's assessment | Invent facts; missing data is marked `[DATA NEEDED]` |

Every AI output is a JSON object validated against a schema before the application uses it, and every number that reaches a certificate, an order or a retirement is produced by deterministic, unit-tested code.

## Transparency

- Every AI result is labelled as AI in the interface, with the model that produced it.
- Bill readings show the exact text and page each value was read from, and a confidence score.
- Each AI result is hashed together with the model name and prompt version and recorded on the Hedera Consensus Service, so anyone can later prove what the AI said and when.
- The rating weights, audit rules and risk scoring are published in the code and the documentation.

## Accountability and human oversight

- A person reviews and can correct every extracted value before an inventory is created; changed values are marked as edited and remain visible to the auditor.
- Values the model was unsure about and nobody reviewed are themselves an audit finding.
- A high-risk audit blocks certification until a person resolves the findings and the audit is re-run.
- Certificates are issued by the organization, not by the AI; the AI's role is recorded alongside.

## Privacy and data governance

- Bills are stored in a private bucket readable only by their owner; only hashes of documents and AI outputs go on chain.
- Documents are sent to the AI provider only to read them, over the provider's API with its standard data-retention terms; no data is used to train GreenTrace models.
- Identical files are never sent twice; the earlier reading is reused.

## Bias and fairness

- Credit ratings score projects against the same five published dimensions and treat missing information as a risk, rather than rewarding well-written project descriptions.
- Ratings, advice and plans are decision support; buyers see the rationale and can disagree.
- Electricity uses location-based national grid factors for 13 countries plus the EU-27 average, each read from the publisher's own document (DESNZ, US EPA eGRID, UBA, RTE, the Turkish Ministry of Energy, CEA, MEE, MOE/METI, DCCEEW, ECCC, MCTI, DFFE, NCCS/EMA and the EEA), so organizations are not penalized by a single global average.
- The source, year and gas basis are shown next to every factor, and a code check warns when the chosen grid factor does not match the bill's site country.
- Countries without a verified official factor fall back to a generic grid average, which the interface makes visible.

## Environmental footprint of the AI

- One structured call per document or feature, no agent loops.
- The high-volume task (bill reading) runs on a smaller model that matched the larger one's accuracy in testing, which cuts compute per document.
- Hedera's proof-of-stake consensus keeps the cost and energy of anchoring each result negligible.

## Security against misuse

- Uploaded documents cannot instruct the system: model output is schema-constrained, validated, never executed and never rendered as HTML.
- Per-user hourly limits on every AI feature prevent cost abuse.
- See [SECURITY.md](SECURITY.md) for the full assessment.
