# Testing results

This is the "user testing results" deliverable for the IEEE ClimateChain Global Hackathon 2026.
It records the end-to-end test of GreenTrace on Hedera testnet, the automated test suites, and the issues the testing found and fixed.
Every on-chain item below can be checked on HashScan; topic messages are on the GreenTrace audit topic [`0.0.11116480`](https://hashscan.io/testnet/topic/0.0.11116480).

## Live deployment test

The deployed app at [greentrace-app.vercel.app](https://greentrace-app.vercel.app) was tested end to end in a browser on 21 October 2026, with new sample bills for April to June 2026, the live AI provider, the production database and Hedera testnet.

| Step on the live site | Result | On-chain evidence |
| --- | --- | --- |
| AI bill reading, 4 new bills (3 electricity, 1 gas) | Pass: 7 lines read at 99% confidence; the UK site was recognised and every electricity line used the DESNZ factor 0.13096 kg CO2e/kWh | Messages #28 to #31 |
| Inventory created | Pass: 9.21 t CO2e recomputed by the server, factor source shown on every line | - |
| AI audit | Pass: risk 0/100, 10 of 10 checks; the AI confirmed the grid factor matches the UK site | Message #32 |
| Certificate issued | Pass: [GT-2026-Q5LL89](https://greentrace-app.vercel.app/certificates/GT-2026-Q5LL89), NFT serial #2, metadata pinned to IPFS | Message #33 |
| Public verification, signed out | Pass: 5 of 5 checks | - |
| AI offset advisor | Pass: 10 t basket of AA and A credits for 18.6 HBAR within a 20 HBAR budget | - |
| Three purchases paid from the test wallet | Pass: payments verified on the mirror node and credits delivered | Messages #34 to #36 |
| Payment made, then the page left before confirming | Pass: the payment was found on the mirror node and the order completed; the other two orders were recognised and not delivered twice | Message #36 |
| Payment never reported by a browser (scheduled scan) | Pass: Supabase pg_cron's scan completed the order 31 seconds after payment | Message #59 |
| Retirement of 10 t | Pass: certificate fully offset, CO2e supply 99,972 to 99,962 | Message #37 |
| AI reduction plan | Pass: 79.1% reduction by 2030 from a 36.9 t/yr annualized baseline | Message #38 |
| AI GRI draft | Pass: 9 missing facts marked instead of invented | Message #39 |
| AI credit re-rating | Pass: BBB, 60/100 | Message #40 |
| One-time 25 test HBAR grant | Pass: wallet 35.85 to 60.85 HBAR; the button disappears after the claim | - |
| Mobile (390 px) and dark mode | Pass: certificate, landing and marketplace render correctly | - |

The live test found one issue, fixed and redeployed the same day: a certificate whose consensus record was not yet indexed by the mirror node showed as "Verified" with 4 of 5 checks; it now shows as pending and rechecks automatically until all checks pass.

## How the end-to-end test was run

- A test organization ("Acme Precision Parts Ltd") signed up and linked a wallet; payments and retirements were signed from a real testnet account (`0.0.11116492`) through the same MetaMask interface the app uses.
- Sample electricity, gas and fleet-fuel bills (clearly marked as samples) were uploaded as PDFs and as a phone-style PNG scan.
- Every flow was driven through the browser UI against the live Supabase database, the live AI provider and Hedera testnet; nothing was mocked.

## Results by flow

| Flow | Result | On-chain evidence |
| --- | --- | --- |
| Sign up and link wallet (signed message verified by the server) | Pass: Hedera account resolved, balances shown | - |
| AI bill reading, 8 documents | Pass: all quantities, units and periods correct; summary rows on the fuel statement correctly not double counted | Messages #1 to #5, #7 to #9 |
| Duplicate bill (PNG scan of an already-counted PDF) | Pass: flagged "same bill", lines held back | - |
| AI audit, deliberately flawed inventory | Pass: high risk (100), certification blocked; found the planted duplicate plus a missing month and meter reads that did not roll forward (a real error in the sample bills) | - |
| AI audit, corrected inventory | Pass: low risk (20); flagged the generic grid factor as too high for UK sites | Message #10 |
| Certificate issuance | Pass: inventory hashed, metadata pinned to IPFS, NFT minted, record logged | NFT [`0.0.11116483` #1](https://hashscan.io/testnet/token/0.0.11116483/1), message #11 |
| Public verification page | Pass: 5 of 5 checks (inventory hash, consensus record, NFT, IPFS metadata, audit) | - |
| AI credit ratings, 6 listings | Pass: grades A to BBB with grounded rationale; grid solar marked down on additionality | Messages #12 to #17 |
| AI offset advisor | Pass: 28 t basket within a 60 HBAR budget, 100% coverage | - |
| Purchases, 4 orders (28 t, 59.5 HBAR) | Pass: payment verified on the mirror node, CO2e delivered | Messages #18 to #21 |
| Paying the same order twice | Pass: rejected by the contract (`OrderAlreadyPaid`) | - |
| Retirements, 9 t then 19 t | Pass: tokens wiped (supply 100,000 to 99,972), certificate "partially offset" then "offset" | Messages #22, #23 |
| AI reduction plan | Pass: 7 measures, 82.5% reduction by 2030, tonnes computed from the inventory | Message #24 |
| SEMA organization and GRI draft | Pass: 9 disclosures, 20 data gaps marked instead of invented | Message #26 |
| GHG calculator saved as inventory | Pass: 2,000 kg of coal correctly computed as 4,760 kg CO2e (previously overstated 1000x) | - |
| Replay of all past exchange events | Pass: everything recognised as already processed; no double delivery or double retirement | - |
| One-time test HBAR grant for a fresh wallet | Pass: account created with 25 HBAR; second claim refused | - |
| National grid factor selection (two UK electricity bills, production prompt) | Pass: site identified as Great Britain from the meter number, all four lines on the DESNZ factor 0.13096 kg CO2e/kWh, no warnings | - |

## Automated tests

| Suite | Command | Result |
| --- | --- | --- |
| Unit: unit conversion, emission catalog, national grid factors, extraction prompt and grid warnings, audit rules, AI arithmetic, hashing | `npm test` | 41 passed |
| Smart contract: payments, double payment, retirement requests | `npm run test:contracts` | 6 passed |
| Database: schema and row level security against real Postgres (cross-user reads, forged certificates, immutable certified inventories, atomic stock) | `npm run test:db` | All assertions passed |
| Type check and lint | `npm run typecheck`, `npm run lint` | 0 errors |
| Production build | `npm run build` | Succeeds |

## AI model evaluation

Bill reading was run with the production prompt on the three hardest sample bills (a 14-line fuel card statement, a gas bill with both volume and energy, a day/night electricity bill):

| Model | Lines found | Quantities correct | Sources correct | Time |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 17 of 17 | yes | yes | 10 to 30 s |
| gpt-5.4-mini | 17 of 17 | yes | yes | 9 to 41 s |
| gpt-5-mini | 17 of 17 | yes | yes | 30 to 87 s |

Bill reading therefore uses the smaller `gpt-5.4-mini` (configurable), which lowers cost and energy use per document without losing accuracy.
Judgement-heavy features (audit, ratings, advisor, reduction plans, GRI drafting) use `gpt-5.5`.

## Issues found by testing and fixed

- Payments to the treasury reverted because Hedera does not route value to the long-zero address of an aliased account; the contract now forwards to the treasury's EVM alias.
- Server reads were served from the framework's fetch cache, so a certificate showed as not offset after a retirement; server database reads now bypass the cache.
- A different file of an already-certified bill was not caught at upload or at save; both now match bills by fingerprint.
- Re-uploading a bill from an abandoned draft was wrongly reported as a duplicate; only copies that are actually counted are flagged now.
- Gas limits were generous and Hedera bills at least 80% of the limit; limits are now set from measured usage (purchase about 55k gas, retirement about 25k).
- The audit flagged the generic grid factor as too high for UK sites; electricity now uses official national grid factors chosen from the bill's site country.
- Smaller interface issues: chart bars not rendering, inconsistent date formats, a SEMA topic count that double counted topics assessed both ways, and a calculator banner shown for the current session.
