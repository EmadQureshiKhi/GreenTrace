// GHG Calculator Types
export interface QuestionnaireData {
  orgName: string;
  boundaryApproach: string;
  controlSubtype: string;
  operationalBoundary: string;
  emissionSources: string;
  timestamp: string;
}

export interface EmissionEntry {
  id: string;
  scope: string;
  category: string;
  fuelCategory: string;
  fuelType: string;
  amount: number;
  unit_type: string;
  /** kg CO2e per unit of the factor (the catalog entry's native unit, or the custom fuel's unit). */
  baseFactor: number;
  /** kg CO2e per unit as entered (unit_type). */
  convertedFactor: number;
  /** kg CO2e */
  emissions: number;
  timestamp: string;
  equipmentType?: string;
  /** Catalog entry the emissions were computed from. Null or missing for custom fuels. */
  catalogId?: string | null;
  /** Quantity converted to the factor's unit. */
  nativeQuantity?: number;
  nativeUnit?: string;
  /** True when the factor is a user-defined custom fuel: an estimate that cannot be certified. */
  custom?: boolean;
  /** Set when a saved entry can no longer be computed and must be re-entered. */
  issue?: string | null;
}

export interface CustomFuel {
  factor: number;
  custom: boolean;
  timestamp?: string;
}

/** A user-defined fuel with its own emission factor. Usable for estimates only. */
export interface CustomFuelDefinition {
  id: string;
  scope: 'Scope 1' | 'Scope 2';
  category: string;
  fuelCategory: string;
  name: string;
  /** kg CO2e per `unit` */
  factor: number;
  unit: string;
  timestamp: string;
}

export interface CalculationState {
  scope: string;
  category: string;
  equipmentType: string;
  fuelCategory: string;
  fuelType: string;
  amount: number;
  unit: string;
}

export interface CustomEquipmentData {
  name: string;
  description: string;
  category: string;
}

export interface CustomEquipmentEntry {
  description: string;
  custom: boolean;
  timestamp?: string;
}

/** category -> equipment name -> details */
export type CustomEquipmentTypes = Record<string, Record<string, CustomEquipmentEntry>>;

export interface EmissionFactor {
  factor: number;
  custom: boolean;
  timestamp?: string;
}

// For Scope 1: category -> fuelCategory -> fuelType -> EmissionFactor
export type Scope1Factors = {
  [category: string]: {
    [fuelCategory: string]: {
      [fuelType: string]: EmissionFactor;
    };
  };
};

// For Scope 2: fuelCategory -> fuelType -> EmissionFactor
export type Scope2Factors = {
  [fuelCategory: string]: {
    [fuelType: string]: EmissionFactor;
  };
};

// The main database type, mapping each scope to its structure
export type EmissionFactorsDatabase = {
  'Scope 1': Scope1Factors;
  'Scope 2': Scope2Factors;
};
