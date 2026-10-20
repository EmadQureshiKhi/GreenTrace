# Problem statement and solution overview

IEEE ClimateChain Global Hackathon 2026, Track 1: Carbon Markets & Emissions Transparency.

## The problem

Carbon markets only work if a tonne is measured honestly, claimed once and retired for good.
Today all three steps are weak, and the weakness is worst for the organizations that most need help: small and mid-sized companies and the suppliers of large companies.

**Measurement is manual and error-prone.**
Most organizations build their Scope 1 and 2 inventory by copying numbers from electricity, gas and fuel bills into spreadsheets.
Unit slips (kWh against MWh, litres against gallons), bills counted twice and missing months are common, and nobody checks them before the numbers are published.

**Claims are hard to verify.**
A sustainability report or an emissions certificate is usually a PDF.
A buyer, lender or regulator cannot tell whether the numbers behind it were changed after the fact.

**Credits can be counted twice and quality is opaque.**
Investigations into the voluntary carbon market have shown credits that did not represent real reductions, and the same environmental benefit can be claimed by more than one party when registries and claims are not linked.
Buyers rarely have the expertise to judge a project's additionality or permanence.

**Reporting is expensive.**
Frameworks such as the GRI Standards require a materiality assessment and narrative disclosures that smaller organizations cannot afford to commission.

## The solution

GreenTrace is an end-to-end, verifiable carbon accounting platform that combines AI for the labour-intensive steps with Hedera for the record.

1. **Measure with AI.**
   Users drop in bills; the AI reads quantities, units and billing periods with quoted evidence and a confidence score.
   Emissions are computed by code from a fixed emission factor catalog, never by the model.
   Every reading is hashed and anchored on Hedera Consensus Service.
2. **Audit before certifying.**
   Nine deterministic checks and an AI auditor look for double-counted bills, overlapping periods, unit slips and implausible values.
   A high-risk inventory cannot be certified.
3. **Certify on chain.**
   The inventory is hashed, its metadata stored by content address, a certificate NFT minted and the record logged to Hedera.
   Anyone can verify a certificate from a public page that recomputes the hash and checks it against the chain.
4. **Offset with integrity.**
   An AI rater scores each credit project on additionality, permanence, monitoring, leakage and co-benefits.
   An AI advisor builds a diversified basket for the remaining emissions.
   Credits are bought in HBAR through a smart contract and retired by destroying the tokens, so a tonne can never be claimed twice.
5. **Plan and report.**
   An AI planner proposes reduction measures with tonnes computed from the inventory, and an AI drafter writes GRI disclosures from the stakeholder and materiality assessment.

## Target users

- Small and mid-sized organizations that need a credible inventory for customers, lenders or regulation.
- Large companies collecting supplier emissions (Scope 3 for them, Scope 1 and 2 for the supplier).
- Sustainability consultants who prepare inventories and GRI reports for many clients.
- Carbon credit buyers who need quality signals and proof of retirement.
- Auditors, lenders and regulators who need to verify a claim without trusting the issuer.

## Why it scales and why it is easy to adopt

- Nothing to install: a web app, a bill upload and an optional MetaMask wallet.
- The AI removes the most expensive manual step (transcription) while keeping a person in the loop for every value.
- Hedera fees are a fraction of a cent per record, so logging every step costs less than a page of paper.
- The emission factor catalog and the GRI drafting follow established frameworks (GHG Protocol scopes, DEFRA-style fuel factors, official national grid factors from bodies such as DESNZ, US EPA and UBA, GRI Standards), so outputs fit existing reporting.
- The provider-agnostic AI layer and the open data model let consultants and platforms integrate GreenTrace rather than replace their tools.

## What makes it different

- **AI with accountability.** Every AI output is schema-constrained, computed numbers come from code, and each result is hashed and anchored with the model name and prompt version.
- **Verification by anyone.** A certificate is not a PDF; it is a recomputable hash, an NFT and an ordered consensus record.
- **Double counting prevented in three places:** duplicate bills are caught before certification, each inventory backs one certificate, and retired credits leave the token supply.
