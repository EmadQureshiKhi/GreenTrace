# Climate impact assessment and carbon reduction projections

This document explains how GreenTrace contributes to emission reductions, how that contribution can be measured, and a set of transparent, assumption-driven projections.
All projections are scenarios, not forecasts; every assumption is stated so it can be challenged and replaced with real data.

## Impact pathways

| Pathway | Mechanism | How GreenTrace measures it |
| --- | --- | --- |
| Better measurement | Organizations that measure accurately find and act on their largest sources | Inventories created, share of lines backed by documents, audit findings resolved |
| Actual reduction | The AI planner turns an inventory into a costed plan with measures and start years | Planned t CO2e per year, then year-on-year change between certified inventories |
| Integrity of offsets | AI quality ratings steer buyers to higher-quality credits; retirement destroys tokens | Tonnes retired by grade, share of retirements in A-grade or better projects |
| Avoided double counting | Duplicate bills are blocked before certification; retired credits leave supply | Duplicate-bill findings raised, tonnes wiped on chain |
| Transparency | Public, recomputable certificates make greenwashing harder | Certificates verified, verification page visits |

Every one of these metrics can be computed from data GreenTrace already stores, most of it publicly on the Hedera audit topic.

## How reductions are attributed

GreenTrace does not claim the reductions organizations make; it measures them.
For an organization with two consecutive certified inventories, the reduction is the difference between them, normalised to a year.
The reduction planner's projections are kept separate and labelled as plans, never counted as achieved.
Retired credits are reported as offsets, never netted against measured emissions in the inventory itself, in line with GHG Protocol practice.

## Projection method

For a cohort of `N` organizations with an average baseline of `B` t CO2e per year (Scope 1 and 2):

- Identified reduction potential per organization: `B x p`, where `p` is the share of the baseline covered by plan measures.
- Implemented reduction after `y` years: `B x p x i(y)`, where `i(y)` is the cumulative implementation rate.
- Measurement correction: inventories that the audit corrects change reported emissions by `e` (positive or negative); this is an accuracy gain, not a reduction, and is reported separately.

## Illustrative scenarios

Assumptions (replace with pilot data):

- Average SME baseline `B` = 150 t CO2e per year (Scope 1 and 2), a typical order of magnitude for small manufacturers and multi-site service companies.
- Plan coverage `p` = 25%, consistent with efficiency, fleet and renewable electricity measures commonly available to SMEs.
- Implementation `i` = 30% after year one, 60% after year three.

| Scenario | Organizations | Identified potential (t CO2e/yr) | Implemented, year 1 | Implemented, year 3 |
| --- | --- | --- | --- | --- |
| Pilot | 50 | 1,875 | 563 | 1,125 |
| Regional rollout | 1,000 | 37,500 | 11,250 | 22,500 |
| Supply-chain programme | 10,000 | 375,000 | 112,500 | 225,000 |

These figures follow directly from the formulas above (for example, the pilot: 50 x 150 x 0.25 = 1,875).

Offsetting is additive but separate: if the same organizations retire credits for half of their remaining emissions each year, the pilot would retire roughly 50 x (150 - 563 / 50) x 0.5, about 3,470 t in year one, all destroyed on chain and publicly verifiable.

## Measuring it in practice

During a pilot, GreenTrace would report:

1. Number of inventories and certificates, and the share of lines backed by source documents.
2. Audit findings raised and resolved, by type (duplicate bills, unit slips, overlaps).
3. Planned reductions (t CO2e per year) and, once a second inventory is certified, achieved reductions.
4. Tonnes retired, by credit grade.

The platform itself runs on Hedera, an energy-efficient proof-of-stake network; the marginal footprint of anchoring a record is negligible compared with the emissions it helps measure.

## Carbon reduction projections for a single organization

Each user gets their own projection from the reduction planner: a year-by-year trajectory from today to their target year, with every measure's tonnes computed from their certified inventory.
That trajectory is hashed and anchored on Hedera, so progress against it can later be checked against the next certified inventory.
