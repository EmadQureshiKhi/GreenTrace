import 'server-only';
import * as z from 'zod/v4';
import { catalog, GENERIC_GRID_ID, getCatalogEntry, gridEntryId } from '@/lib/emissions/catalog';
import { UNIT_NAMES } from '@/lib/emissions/units';

// What the extraction model is asked and how its answer is shaped. Kept free of I/O so tests and the
// e2e model scripts use exactly the production prompt.

export const EXTRACTION_PROMPT_VERSION = 'gt-extract-1.1';

const catalogIds = catalog.map((e) => e.id) as [string, ...string[]];

export const ExtractionSchema = z.object({
  isActivityDocument: z
    .boolean()
    .describe('False if the document is not a bill, invoice, statement or service record with energy, fuel or refrigerant quantities.'),
  documentType: z.enum([
    'electricity_bill',
    'gas_bill',
    'fuel_invoice',
    'fuel_card_statement',
    'heat_steam_or_cooling_bill',
    'refrigerant_service_record',
    'other',
  ]),
  supplier: z.string().nullable(),
  customer: z.string().nullable(),
  accountNumber: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  billingPeriodStart: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  billingPeriodEnd: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  siteAddress: z.string().nullable().describe('Where the energy or fuel is used (site or supply address), not the billing address'),
  siteCountry: z
    .string()
    .nullable()
    .describe('ISO 3166-1 alpha-2 code of the site country (GB for the United Kingdom), or null if the document does not show it'),
  lineItems: z.array(
    z.object({
      description: z.string().describe('What was consumed, in the document\'s own words'),
      catalogId: z.enum(catalogIds).nullable().describe('The matching emission source id, or null if none fits'),
      quantity: z.number().describe('The consumed quantity exactly as printed (not the cost)'),
      unit: z.enum(UNIT_NAMES as [string, ...string[]]),
      periodStart: z.string().nullable(),
      periodEnd: z.string().nullable(),
      evidence: z.string().describe('The exact text on the document the quantity was read from'),
      page: z.number().nullable(),
      confidence: z.number().describe('0 to 1: how sure you are the quantity, unit and source are right'),
      reasoning: z.string().describe('One sentence: why this source and unit'),
    }),
  ),
  warnings: z.array(z.string()).describe('Anything a reviewer should know: estimated reads, credits, partial periods, illegible values'),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACTION_SYSTEM_PROMPT = `You read energy bills, fuel invoices, fuel card statements and refrigerant service records for a greenhouse gas inventory.

Your job is to transcribe consumption, not to calculate emissions. For every distinct consumption line on the document:
- Copy the consumed quantity exactly as printed. Never use a currency amount as a quantity.
- Pick the unit the document uses. If it prints kWh, use kWh; if it prints m3 or cubic metres, use m³; litres stays litres.
- Map the line to exactly one emission source id from the catalog. Choose the most specific match (for example "Diesel (100% mineral diesel)" under Mobile for fleet fuel, under Stationary for a generator or boiler). Use null if nothing fits.
- Grid electricity: use the national grid entry ("Grid - <country>") for the site country. Use "Grid - EU-27 average" for a site in an EU member state that has no entry of its own. Use Grid Average when the site country is not shown or has no entry. Use Coal Power, Natural Gas Power or Renewable Power only when the bill states the supply comes from that generation type.
- Put the verbatim text you read the quantity from in evidence, and the page number.
- Use the line's own service period if it has one, otherwise the bill's billing period.
- Lower your confidence when the value is estimated, handwritten, cut off, or when you had to infer the unit or the source.

Site country:
- It is the country of the site or supply address where the energy is used, not of the supplier, its head office or the billing address.
- Decide it only from what the document shows: a country name, a city, region or postcode that clearly belongs to one country, or a national supply point identifier (an MPAN means Great Britain). Currency, language or the supplier's name alone are not enough.
- Put its ISO code in siteCountry and, for electricity lines, name the evidence in reasoning. If it is not shown, set siteCountry to null.

Rules:
- Meter readings (previous/current) are not consumption; use the consumption or "units used" figure. If only readings exist, use their difference and say so in reasoning.
- Do not add separate lines for subtotals, standing charges, taxes or totals that repeat other lines.
- If a quantity is a credit or correction (negative), include it as printed and mention it in warnings.
- If the document is not an activity record (a contract, a marketing letter, a photo of something else), set isActivityDocument to false and return no line items.
- Never invent values that are not on the document.`;

function siteCountryColumn(id: string, country: { code: string; name: string } | null): string {
  if (country) return ` | site country: ${country.code === 'EU' ? 'EU member state without its own entry' : `${country.code} (${country.name})`}`;
  return id === GENERIC_GRID_ID ? ' | site country: unknown or without a national entry' : '';
}

export function catalogText(): string {
  return catalog
    .map(
      (e) =>
        `${e.id} | ${e.scope} / ${e.category} / ${e.fuelCategory} / ${e.fuelType} | factor per ${e.nativeUnit} | units: ${e.units.join(', ')}${siteCountryColumn(e.id, e.country)}`,
    )
    .join('\n');
}

/** The user turn of an extraction request. Shared with the e2e model scripts so they test the real prompt. */
export function extractionRequestText(fileName: string): string {
  return `Emission source catalog (id | source | factor unit | allowed units | site country, for grid electricity):\n${catalogText()}\n\nRead the attached document "${fileName}".`;
}

/**
 * Deterministic cross-check of the grid factor the model chose against the site country it read, so a
 * reviewer sees a mismatch before accepting the lines.
 */
export function gridFactorWarnings(extraction: Pick<Extraction, 'lineItems'> & { siteCountry?: string | null }): string[] {
  const code = extraction.siteCountry?.trim().toUpperCase() || null;
  const country = code === 'UK' ? 'GB' : code;
  const national = country ? getCatalogEntry(gridEntryId(country)) : undefined;
  const warnings: string[] = [];
  for (const item of extraction.lineItems) {
    const entry = item.catalogId ? getCatalogEntry(item.catalogId) : undefined;
    if (!entry) continue;
    if (entry.id === GENERIC_GRID_ID && national) {
      warnings.push(`"${item.description}" uses the generic grid average, but the site is in ${national.country!.name}. Choose "${national.fuelType}".`);
    } else if (entry.country && !country) {
      warnings.push(`"${item.description}" uses the ${entry.country.name} grid factor, but the bill does not show the site country. Confirm it.`);
    } else if (entry.country && country && entry.country.code !== country && (entry.country.code !== 'EU' || national)) {
      warnings.push(`"${item.description}" uses the ${entry.country.name} grid factor, but the site country is ${country}. Check the emission source.`);
    }
  }
  return warnings;
}
