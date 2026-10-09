import { EmissionFactorsDatabase } from '../types/ghg';

// Comprehensive fugitive gas emission factors
export const fugitiveGasFactors: Record<string, number> = {
  'Carbon dioxide': 1,
  'Methane': 27,
  'Nitrous oxide': 273,
  'HFC-23': 14600,
  'HFC-32': 771,
  'HFC-41': 135,
  'HFC-125': 3740,
  'HFC-134': 1260,
  'HFC-134a': 1530,
  'HFC-143': 364,
  'HFC-143a': 5810,
  'HFC-152a': 164,
  'HFC-227ea': 3600,
  'HFC-236fa': 8690,
  'HFC-245fa': 962,
  'HFC-43-10mee': 1600,
  'Perfluoromethane (PFC-14)': 7380,
  'Perfluoroethane (PFC-116)': 12400,
  'Perfluoropropane (PFC-218)': 9290,
  'Perfluorocyclobutane (PFC-318)': 10200,
  'Perfluorobutane (PFC-3-1-10)': 10000,
  'Perfluoropentane (PFC-4-1-12)': 9220,
  'Perfluorohexane (PFC-5-1-14)': 8620,
  'Sulphur hexafluoride (SF6)': 24300,
  'HFC-152': 21.5,
  'HFC-161': 4.84,
  'HFC-236cb': 1350,
  'HFC-236ea': 1500,
  'HFC-245ca': 787,
  'HFC-365mfc': 914,
  'R404A': 3922,
  'R407A': 2107,
  'R407C': 1774,
  'R407F': 1825,
  'R408A': 3152,
  'R410A': 2088,
  'R507A': 3985,
  'R508B': 1339,
  'R403A': 3124,
  'CFC-11/R11 = trichlorofluoromethane': 6230,
  'CFC-12/R12 = dichlorodifluoromethane': 12500,
  'CFC-13': 16200,
  'CFC-113': 6520,
  'CFC-114': 9430,
  'CFC-115': 9600,
  'Halon-1211': 1930,
  'Halon-1301': 7200,
  'Halon-2402': 2170,
  'Carbon tetrachloride': 2200,
  'Methyl bromide': 2.43,
  'Methyl chloroform': 161,
  'HCFC-22/R22 = chlorodifluoromethane': 137,
  'HCFC-123': 90.4,
  'HCFC-124': 597,
  'HCFC-141b': 860,
  'HCFC-142b': 2300,
  'HCFC-225ca': 137,
  'HCFC-225cb': 568,
  'HCFC-21': 160,
  'Nitrogen trifluoride': 17400,
  'PFC-9-1-18': 7500,
  'Trifluoromethyl sulphur pentafluoride': 17700,
  'Perfluorocyclopropane': 17340,
  'HFE-125': 14300,
  'HFE-134': 6630,
  'HFE-143a': 616,
  'HCFE-235da2': 539,
  'HFE-245cb2': 747,
  'HFE-245fa2': 878,
  'HFE-254cb2': 359,
  'HFE-347mcc3': 576,
  'HFE-347pcf2': 980,
  'HFE-356pcc3': 277,
  'HFE-449sl (HFE-7100)': 544,
  'HFE-569sf2 (HFE-7200)': 59,
  'HFE-43-10pccc124 (H-Galden1040x)': 3220,
  'HFE-236ca12 (HG-10)': 6060,
  'HFE-338pcc13 (HG-01)': 3320,
  'PFPMIE': 10300,
  'Dimethylether': 1,
  'Methylene chloride': 11.2,
  'Methyl chloride': 5.54,
  'R290 = propane': 3,
  'R600A = isobutane': 3,
  'R406A': 1943,
  'R409A': 1585,
  'R502': 4657
};

// Create fugitive gas factors object for emission factors database
const createFugitiveGasFactors = () => {
  const gasFactors: Record<string, { factor: number; custom: boolean }> = {};

  Object.entries(fugitiveGasFactors).forEach(([gasName, factor]) => {
    gasFactors[gasName] = { factor, custom: false };
  });

  return gasFactors;
};

// 🔧 DATA VERSION for migration tracking
export const EMISSION_FACTORS_VERSION = '1.1.0'; // Updated version

// Emission factors database (converted from Python)
export const initialEmissionFactors: EmissionFactorsDatabase = {
  'Scope 1': {
    'Stationary': {
      'Gaseous Fuels': {
        'Compressed Natural Gas': { factor: 0.44327, custom: false },
        'Liquefied Natural Gas': { factor: 1.15041, custom: false },
        'Liquefied Petroleum Gas': { factor: 1.55537, custom: false },
        'Natural Gas': { factor: 2.02236, custom: false },
        'Natural Gas (100% mineral blend)': { factor: 2.03017, custom: false },
        'Other Petroleum Gas': { factor: 0.95279, custom: false }
      },
      'Liquid Fuels': {
        'Aviation Spirit': { factor: 2.29082, custom: false },
        'Aviation Turbine Fuel': { factor: 2.54310, custom: false },
        'Burning Oil': { factor: 2.54039, custom: false },
        'Diesel (average biofuel blend)': { factor: 2.54603, custom: false },
        'Diesel (100% mineral diesel)': { factor: 2.68787, custom: false },
        'Fuel Oil': { factor: 3.18317, custom: false },
        'Gas Oil': { factor: 2.75776, custom: false },
        'Petrol (Average biofuel blend)': { factor: 2.16802, custom: false },
        'Petrol (100% mineral petrol)': { factor: 2.31467, custom: false },
        'Marine gas Oils': { factor: 2.775, custom: false },
        'Marine Fuel Oil': { factor: 3.312204, custom: false }
      },
      'Solid Fuels': {
        'Coal (Industrial)': { factor: 2380.01000, custom: false },
        'Coal (Electricity Generation)': { factor: 2222.94000, custom: false },
        'Coal (Domestic)': { factor: 2833.26000, custom: false },
        'Coking Coal': { factor: 3222.04000, custom: false },
        'Petroleum Coke': { factor: 3397.79000, custom: false }
      }
    },
    'Mobile': {
      'Gaseous Fuels': {
        'Compressed Natural Gas (CNG)': { factor: 0.448, custom: false },
        'Liquefied Natural Gas (LNG)': { factor: 1.166, custom: false },
        'Liquefied Petroleum Gases (LPG)': { factor: 1.555, custom: false },
        'Natural gas (100% mineral blend)': { factor: 2.050, custom: false }
      },
      'Liquid Fuels': {
        'Aviation spirit (Aviation Gasoline)': { factor: 2.283, custom: false },
        'Aviation turbine fuel (Jet Fuel)': { factor: 2.520, custom: false },
        'Diesel (100% mineral diesel)': { factor: 2.626, custom: false },
        'Fuel oil (Residual Fuel Oil)': { factor: 3.163, custom: false },
        'Petrol (100% mineral petrol) (Motor Gasoline)': { factor: 2.331, custom: false },
        'Bioethanol': { factor: 1.52, custom: false },
        'Biodiesel ME': { factor: 2.39, custom: false }
      }
    },
    'Fugitive': {
      'Gas': createFugitiveGasFactors()
    }
  },
  'Scope 2': {
    'Electricity': {
      'Grid Average': { factor: 0.385, custom: false },
      'Coal Power': { factor: 0.95, custom: false },
      'Natural Gas Power': { factor: 0.45, custom: false },
      'Renewable Power': { factor: 0.05, custom: false }
    },
    'Heat': {
      'District Heating': { factor: 0.28, custom: false },
      'Steam': { factor: 0.20, custom: false }
    },
    'Cooling': {
      'District cooling': { factor: 0.4081, custom: false }
    }
  }
};
