import { describe, expect, it } from 'vitest';
import { GENERIC_GRID_ID } from '@/lib/emissions/catalog';
import { catalogText, EXTRACTION_SYSTEM_PROMPT, gridFactorWarnings, type Extraction } from '../extraction-prompt';

type Item = Extraction['lineItems'][number];
const item = (catalogId: string | null): Item => ({
  description: 'Electricity',
  catalogId,
  quantity: 1000,
  unit: 'kWh',
  periodStart: null,
  periodEnd: null,
  evidence: '1,000 kWh',
  page: 1,
  confidence: 0.9,
  reasoning: '',
});

describe('extraction catalog text', () => {
  it('tells the model which site country each grid entry is for', () => {
    const text = catalogText();
    expect(text).toMatch(/^scope-2-electricity-grid-gb \| Scope 2 \/ Electricity \/ Electricity \/ Grid - United Kingdom \|.*\| site country: GB \(United Kingdom\)$/m);
    expect(text).toMatch(new RegExp(`^${GENERIC_GRID_ID} \\|.*\\| site country: unknown or without a national entry$`, 'm'));
    expect(text).toMatch(/^scope-2-electricity-grid-eu \|.*site country: EU member state without its own entry$/m);
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('national grid entry');
  });
});

describe('gridFactorWarnings', () => {
  it('accepts the national entry for the site country', () => {
    expect(gridFactorWarnings({ siteCountry: 'GB', lineItems: [item('scope-2-electricity-grid-gb')] })).toEqual([]);
    expect(gridFactorWarnings({ siteCountry: 'UK', lineItems: [item('scope-2-electricity-grid-gb')] })).toEqual([]);
  });

  it('accepts the generic grid when the country is unknown or has no entry, and EU-27 for other member states', () => {
    expect(gridFactorWarnings({ siteCountry: null, lineItems: [item(GENERIC_GRID_ID)] })).toEqual([]);
    expect(gridFactorWarnings({ siteCountry: 'PK', lineItems: [item(GENERIC_GRID_ID)] })).toEqual([]);
    expect(gridFactorWarnings({ siteCountry: 'IT', lineItems: [item('scope-2-electricity-grid-eu')] })).toEqual([]);
    // Older stored extractions have no siteCountry at all.
    expect(gridFactorWarnings({ lineItems: [item(GENERIC_GRID_ID)] })).toEqual([]);
  });

  it('flags the generic grid for a country with its own entry', () => {
    expect(gridFactorWarnings({ siteCountry: 'GB', lineItems: [item(GENERIC_GRID_ID)] })).toEqual([
      '"Electricity" uses the generic grid average, but the site is in United Kingdom. Choose "Grid - United Kingdom".',
    ]);
  });

  it('flags another country\'s grid and a national grid without a site country', () => {
    expect(gridFactorWarnings({ siteCountry: 'DE', lineItems: [item('scope-2-electricity-grid-gb')] })).toHaveLength(1);
    expect(gridFactorWarnings({ siteCountry: 'FR', lineItems: [item('scope-2-electricity-grid-eu')] })).toHaveLength(1);
    expect(gridFactorWarnings({ siteCountry: null, lineItems: [item('scope-2-electricity-grid-gb')] })).toHaveLength(1);
  });

  it('ignores non-electricity lines', () => {
    expect(gridFactorWarnings({ siteCountry: 'GB', lineItems: [item(null), item('scope-1-stationary-gaseous-fuels-natural-gas')] })).toEqual([]);
  });
});
