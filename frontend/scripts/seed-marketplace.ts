/**
 * Seeds the marketplace with sample listings for the testnet demo. The projects are illustrative,
 * not real registry projects; each listing says so. Re-running updates listings by slug and leaves
 * stock that has already been sold untouched. Usage: npm run seed
 */
import { createClient } from '@supabase/supabase-js';
import { readEnv } from './env-file';

const env = readEnv();

const SAMPLE_NOTE = 'Sample listing on the GreenTrace testnet marketplace; project details are illustrative.';

const listings = [
  {
    slug: 'rift-valley-cookstoves',
    title: 'Rift Valley Efficient Cookstoves',
    description: `Distributes and services efficient biomass cookstoves to rural households, cutting fuelwood use and indoor smoke. ${SAMPLE_NOTE}`,
    project_type: 'Cookstoves',
    location: 'Kenya',
    vintage: '2025',
    methodology: 'Gold Standard TPDDTEC with metered stove usage',
    registry: 'Gold Standard (sample)',
    price_hbar: 1.2,
    total_supply: 4000,
    image_url: 'https://images.pexels.com/photos/6646917/pexels-photo-6646917.jpeg',
    project_details: {
      startYear: 2021,
      creditingPeriodYears: 7,
      households: 18500,
      monitoring: 'Stove use sensors on a 5% sample; annual kitchen performance tests',
      verification: 'Independent auditor, annual',
      fuelSavingsBaseline: 'Fraction of non-renewable biomass set at 0.30 from a 2019 regional study',
      additionalityEvidence: 'Stoves sold below cost; carbon finance covers the subsidy',
      leakage: 'Displaced fuelwood use by non-participants not separately monitored',
      coBenefits: ['Reduced indoor air pollution', 'Time saved collecting fuel', 'Local jobs in stove servicing'],
      sdgs: [3, 5, 7, 13],
    },
  },
  {
    slug: 'sumatra-peatland',
    title: 'Sumatra Peat Swamp Forest Conservation',
    description: `Protects tropical peat swamp forest from conversion to plantations, avoiding emissions from clearing and peat drainage. ${SAMPLE_NOTE}`,
    project_type: 'Forest Conservation',
    location: 'Indonesia',
    vintage: '2024',
    methodology: 'VM0007 REDD+ Methodology Framework',
    registry: 'Verra VCS (sample)',
    price_hbar: 1.8,
    total_supply: 6000,
    image_url: 'https://images.pexels.com/photos/975771/pexels-photo-975771.jpeg',
    project_details: {
      startYear: 2016,
      creditingPeriodYears: 30,
      hectares: 64000,
      bufferPoolPercent: 18,
      monitoring: 'Annual satellite land-cover analysis plus ground patrols',
      verification: 'Third-party VVB every two years',
      baseline: 'Historical deforestation rate of a reference region, updated every 6 years',
      risks: ['Peat fire in drought years', 'Concession boundary disputes'],
      leakage: 'Activity-shifting leakage belt monitored; 10% deduction applied',
      coBenefits: ['Orangutan and tiger habitat', 'Community fire brigades', 'Agroforestry livelihoods'],
      sdgs: [1, 13, 15],
    },
  },
  {
    slug: 'gujarat-solar',
    title: 'Gujarat Grid-Connected Solar Park',
    description: `A 150 MW solar photovoltaic plant supplying the western Indian grid, displacing coal-heavy grid electricity. ${SAMPLE_NOTE}`,
    project_type: 'Renewable Energy',
    location: 'India',
    vintage: '2023',
    methodology: 'ACM0002 Grid-connected electricity generation from renewable sources',
    registry: 'Verra VCS (sample)',
    price_hbar: 0.8,
    total_supply: 8000,
    image_url: 'https://images.pexels.com/photos/433308/pexels-photo-433308.jpeg',
    project_details: {
      startYear: 2019,
      creditingPeriodYears: 10,
      capacityMW: 150,
      monitoring: 'Revenue-grade meters, continuous',
      verification: 'Third-party VVB, annual',
      gridEmissionFactor: '0.79 t CO2/MWh combined margin',
      additionalityEvidence: 'Investment analysis at registration; the plant also has a long-term power purchase agreement at market tariffs',
      leakage: 'None expected',
      coBenefits: ['Construction jobs', 'Reduced local air pollution from coal'],
      sdgs: [7, 13],
    },
  },
  {
    slug: 'midwest-landfill-gas',
    title: 'Midwest Landfill Gas Capture',
    description: `Captures methane from a closed municipal landfill and flares or uses it to generate electricity. ${SAMPLE_NOTE}`,
    project_type: 'Waste Management',
    location: 'United States',
    vintage: '2025',
    methodology: 'Landfill gas destruction (ACM0001 equivalent)',
    registry: 'Climate Action Reserve (sample)',
    price_hbar: 1.5,
    total_supply: 5000,
    image_url: 'https://images.pexels.com/photos/2768961/pexels-photo-2768961.jpeg',
    project_details: {
      startYear: 2022,
      creditingPeriodYears: 10,
      monitoring: 'Continuous flow and methane concentration metering; flare temperature logs',
      verification: 'Accredited verifier, annual site visit',
      regulatoryContext: 'Landfill is below the size threshold that legally requires gas collection',
      leakage: 'None expected',
      coBenefits: ['Odour reduction', 'Local renewable electricity'],
      sdgs: [7, 11, 13],
    },
  },
  {
    slug: 'nordic-biochar',
    title: 'Nordic Forestry Residue Biochar',
    description: `Converts sawmill and forestry residues into biochar applied to farmland, storing carbon in a stable form for centuries. ${SAMPLE_NOTE}`,
    project_type: 'Carbon Removal',
    location: 'Finland',
    vintage: '2025',
    methodology: 'Biochar carbon removal (Puro-style standard)',
    registry: 'Puro.earth (sample)',
    price_hbar: 4,
    total_supply: 1200,
    image_url: 'https://images.pexels.com/photos/1067333/pexels-photo-1067333.jpeg',
    project_details: {
      startYear: 2023,
      monitoring: 'Per-batch lab analysis of carbon content and H/Corg ratio; feedstock chain of custody',
      verification: 'Third-party audit of each production batch',
      permanence: 'H/Corg below 0.4; more than 100-year durability fraction applied',
      feedstock: 'Residues only, no purpose-grown biomass',
      leakage: 'Life-cycle emissions of pyrolysis and transport deducted',
      coBenefits: ['Soil water retention', 'Use of residues otherwise burned'],
      sdgs: [2, 12, 13],
    },
  },
  {
    slug: 'sundarbans-mangroves',
    title: 'Sundarbans Mangrove Restoration',
    description: `Replants degraded mangrove mudflats with community nurseries, sequestering carbon and protecting coasts from storm surge. ${SAMPLE_NOTE}`,
    project_type: 'Blue Carbon',
    location: 'Bangladesh',
    vintage: '2024',
    methodology: 'VM0033 Tidal Wetland and Seagrass Restoration',
    registry: 'Verra VCS (sample)',
    price_hbar: 2.6,
    total_supply: 2500,
    image_url: 'https://images.pexels.com/photos/2131614/pexels-photo-2131614.jpeg',
    project_details: {
      startYear: 2020,
      creditingPeriodYears: 40,
      hectaresRestored: 3200,
      bufferPoolPercent: 15,
      monitoring: 'Survival plots and drone surveys twice a year; soil carbon cores every 5 years',
      verification: 'Third-party VVB every two years',
      risks: ['Cyclone damage', 'Sea level rise', 'Illegal cutting'],
      coBenefits: ['Storm surge protection', 'Fisheries nursery habitat', 'Women-led nurseries'],
      sdgs: [5, 13, 14, 15],
    },
  },
];

async function main() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  for (const listing of listings) {
    const { data: existing } = await db.from('carbon_credits').select('id, available, total_supply').eq('slug', listing.slug).maybeSingle();
    if (existing) {
      const sold = existing.total_supply - existing.available;
      const { error } = await db
        .from('carbon_credits')
        .update({ ...listing, available: Math.max(0, listing.total_supply - sold) })
        .eq('id', existing.id);
      if (error) throw error;
      console.log(`updated ${listing.slug}`);
    } else {
      const { error } = await db.from('carbon_credits').insert({ ...listing, available: listing.total_supply });
      if (error) throw error;
      console.log(`created ${listing.slug}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
