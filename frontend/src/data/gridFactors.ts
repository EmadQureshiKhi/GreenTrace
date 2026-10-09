// Location-based national grid electricity emission factors (Scope 2), each read from the publisher's
// own document. One row per country; the catalog turns each row into an entry with the stable id
// `scope-2-electricity-grid-<code>`. Rows are append-only: certified inventories reference them.
// Countries not listed here fall back to the generic "Grid Average" entry.

export interface GridFactorSource {
  /** Short citation for tables, e.g. "DESNZ 2026". */
  citation: string;
  publisher: string;
  title: string;
  url: string;
}

export interface GridFactor {
  /** ISO 3166-1 alpha-2 code ("EU" for the EU-27 average). Lower-cased, it is the id suffix. */
  code: string;
  name: string;
  /** Other names a person may search for. */
  aliases: string[];
  /** kg per kWh, as published (converted to kg where the publisher uses another unit). */
  factor: number;
  /** Gases the factor covers. CO2-only factors are used as the CO2e factor, as the publisher intends for inventories. */
  gas: 'CO2' | 'CO2e';
  /** What one kWh is measured at, in the publisher's terms. */
  boundary: string;
  /** The year (or fiscal year) the factor describes. */
  dataYear: string;
  /** Anything a reviewer needs to read the factor correctly. */
  note: string | null;
  source: GridFactorSource;
}

export const gridFactors: GridFactor[] = [
  {
    code: 'GB',
    name: 'United Kingdom',
    aliases: ['UK', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
    factor: 0.13096,
    gas: 'CO2e',
    boundary: 'generation',
    dataYear: '2025',
    note: '2026 conversion factor set. Transmission and distribution losses (0.01299 kg CO2e/kWh) are a separate Scope 3 factor.',
    source: {
      citation: 'DESNZ 2026',
      publisher: 'Department for Energy Security and Net Zero (DESNZ)',
      title: '2026 Government greenhouse gas conversion factors for company reporting',
      url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
    },
  },
  {
    code: 'US',
    name: 'United States',
    aliases: ['USA', 'United States of America', 'America'],
    factor: 0.34967,
    gas: 'CO2e',
    boundary: 'generation',
    dataYear: '2023',
    note: 'US national average, 770.884 lb CO2e/MWh. eGRID also publishes subregion factors.',
    source: {
      citation: 'EPA eGRID2023',
      publisher: 'US Environmental Protection Agency (EPA)',
      title: 'eGRID2023 (revision 2) summary data',
      url: 'https://www.epa.gov/egrid/summary-data',
    },
  },
  {
    code: 'DE',
    name: 'Germany',
    aliases: ['Deutschland'],
    factor: 0.344,
    gas: 'CO2',
    boundary: 'consumption',
    dataYear: '2025',
    note: 'Provisional value per kWh of electricity consumed.',
    source: {
      citation: 'UBA 2025',
      publisher: 'Umweltbundesamt (UBA)',
      title: 'CO2-Emissionen pro Kilowattstunde Strom 2025',
      url: 'https://www.umweltbundesamt.de/themen/co2-emissionen-pro-kilowattstunde-strom-2025-nur',
    },
  },
  {
    code: 'FR',
    name: 'France',
    aliases: [],
    factor: 0.0196,
    gas: 'CO2e',
    boundary: 'generation',
    dataYear: '2025',
    note: null,
    source: {
      citation: 'RTE 2025',
      publisher: 'RTE (Réseau de transport d\'électricité)',
      title: 'Bilan électrique 2025, principaux résultats',
      url: 'https://assets.rte-france.com/prod/public/2026-02/Bilan-electrique-2025-principaux-resultats.pdf',
    },
  },
  {
    code: 'TR',
    name: 'Türkiye',
    aliases: ['Turkey', 'Turkiye'],
    factor: 0.469,
    gas: 'CO2e',
    boundary: 'consumption (distribution-connected)',
    dataYear: '2023',
    note: 'Factor for consumption points connected to the distribution grid, which covers most offices. The generation factor is 0.434. Published December 2025.',
    source: {
      citation: 'ETKB 2023',
      publisher: 'Ministry of Energy and Natural Resources (ETKB)',
      title: '2023 Türkiye Elektrik Üretimi ve Elektrik Tüketim Noktası Emisyon Faktörleri',
      url: 'https://enerji.gov.tr/Media/Dizin/EVCED/tr/%C3%87evreVe%C4%B0klim/%C4%B0klimDe%C4%9Fi%C5%9Fikli%C4%9Fi/EmisyonFaktorleri/2023_Turkiye_Elektrik_UretimiveElektrik_Tuketim_Noktasi_Emisyon_Faktorleri.pdf',
    },
  },
  {
    code: 'IN',
    name: 'India',
    aliases: ['Bharat'],
    factor: 0.675,
    gas: 'CO2',
    boundary: 'generation',
    dataYear: 'FY2025-26',
    note: null,
    source: {
      citation: 'CEA v22.0',
      publisher: 'Central Electricity Authority (CEA)',
      title: 'CO2 Baseline Database for the Indian Power Sector, User Guide version 22.0',
      url: 'https://cea.nic.in/api/cdm-report-version/view-pdf/en/82',
    },
  },
  {
    code: 'CN',
    name: 'China',
    aliases: ['PRC', "People's Republic of China"],
    factor: 0.5306,
    gas: 'CO2',
    boundary: 'national average',
    dataYear: '2023',
    note: 'National average factor for location-based accounting, published January 2026.',
    source: {
      citation: 'MEE 2023',
      publisher: 'Ministry of Ecology and Environment (MEE)',
      title: 'Announcement on the 2023 electricity CO2 emission factors (2025 No. 47)',
      url: 'https://www.mee.gov.cn/ywdt/zbft/202601/t20260105_1139911.shtml',
    },
  },
  {
    code: 'JP',
    name: 'Japan',
    aliases: ['Nippon'],
    factor: 0.423,
    gas: 'CO2',
    boundary: 'national average',
    dataYear: 'FY2024',
    note: 'National average of the emission factors by electricity supplier, FY2024 actuals.',
    source: {
      citation: 'MOE/METI FY2024',
      publisher: 'Ministry of the Environment and Ministry of Economy, Trade and Industry',
      title: 'Emission factors by electricity supplier, for specified emitters\' greenhouse gas reporting (FY2024 actuals)',
      url: 'https://policies.env.go.jp/earth/ghg-santeikohyo/files/calc/r08_denki_coefficient_rev3.pdf',
    },
  },
  {
    code: 'AU',
    name: 'Australia',
    aliases: [],
    factor: 0.62,
    gas: 'CO2e',
    boundary: 'Scope 2 (purchased electricity)',
    dataYear: '2025',
    note: 'National factor. NGA also publishes state factors.',
    source: {
      citation: 'NGA Factors 2025',
      publisher: 'Department of Climate Change, Energy, the Environment and Water (DCCEEW)',
      title: 'Australian National Greenhouse Accounts Factors 2025',
      url: 'https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-account-factors-2025.pdf',
    },
  },
  {
    code: 'CA',
    name: 'Canada',
    aliases: [],
    factor: 0.11,
    gas: 'CO2e',
    boundary: 'consumption (incl. losses)',
    dataYear: '2024',
    note: 'Preliminary national consumption intensity from the 2026 National Inventory Report. Provinces differ widely.',
    source: {
      citation: 'ECCC NIR 2026',
      publisher: 'Environment and Climate Change Canada (ECCC)',
      title: 'National Inventory Report 2026, Annex 7: Electricity in Canada, summary and intensity tables',
      url: 'https://data-donnees.az.ec.gc.ca/api/file?path=%2Fsubstances%2Fmonitor%2Fcanada-s-official-greenhouse-gas-inventory%2FC-Tables-Electricity-Canada-Provinces-Territories%2FEN_Annex7_Electricity_Intensity.pdf',
    },
  },
  {
    code: 'BR',
    name: 'Brazil',
    aliases: ['Brasil'],
    factor: 0.0461,
    gas: 'CO2',
    boundary: 'national grid (SIN) average',
    dataYear: '2025',
    note: 'Annual average of the National Interconnected System (SIN), for corporate inventories.',
    source: {
      citation: 'MCTI 2025',
      publisher: 'Ministry of Science, Technology and Innovation (MCTI)',
      title: 'Fator médio: inventários corporativos',
      url: 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao',
    },
  },
  {
    code: 'ZA',
    name: 'South Africa',
    aliases: ['RSA'],
    factor: 0.96,
    gas: 'CO2e',
    boundary: 'generation',
    dataYear: 'CY2024',
    note: 'National grid emission factor designated for Scope 2 reporting, gazetted September 2026.',
    source: {
      citation: 'DFFE CY2024',
      publisher: 'Department of Forestry, Fisheries and the Environment (DFFE)',
      title: 'Publication of South Africa\'s 2024 Grid Emission Factors Report (Government Gazette 55353, Notice 7891)',
      url: 'https://www.gov.za/sites/default/files/gcis_document/202609/55353gon7891.pdf',
    },
  },
  {
    code: 'SG',
    name: 'Singapore',
    aliases: [],
    factor: 0.402,
    gas: 'CO2',
    boundary: 'grid average',
    dataYear: '2024',
    note: 'Energy Market Authority grid emission factor, as cited by the NCCS.',
    source: {
      citation: 'NCCS / EMA 2024',
      publisher: 'National Climate Change Secretariat (NCCS), citing the Energy Market Authority',
      title: 'Power (Singapore\'s climate action, citing EMA Singapore Energy Statistics)',
      url: 'https://www.nccs.gov.sg/singapores-climate-action/mitigation-efforts/power/',
    },
  },
  {
    code: 'EU',
    name: 'EU-27 average',
    aliases: ['European Union', 'Europe'],
    factor: 0.18344,
    gas: 'CO2e',
    boundary: 'generation',
    dataYear: '2024',
    note: 'Early estimate. For EU member states without their own entry.',
    source: {
      citation: 'EEA 2024',
      publisher: 'European Environment Agency (EEA)',
      title: 'Greenhouse gas emission intensity of electricity generation in Europe',
      url: 'https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1',
    },
  },
];
