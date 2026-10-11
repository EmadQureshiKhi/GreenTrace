'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeEntry,
  exportFactors,
  groupUnit,
  legacyCustomFuels,
  migrateEntry,
  normalizeSelection,
  resolveSource,
  asScope,
} from '@/components/ghg/calculator-model';
import { useDataPersistence } from '@/contexts/DataPersistenceContext';
import { getEquipmentOptionsWithCustom } from '@/data/equipmentTypes';
import type {
  CalculationState,
  CustomEquipmentData,
  CustomEquipmentTypes,
  CustomFuelDefinition,
  EmissionEntry,
  QuestionnaireData,
} from '@/types/ghg';

export type CalculatorStep = 'questionnaire' | 'calculator' | 'results';

const EMPTY_QUESTIONNAIRE: QuestionnaireData = {
  orgName: '',
  boundaryApproach: '',
  controlSubtype: '',
  operationalBoundary: '',
  emissionSources: '',
  timestamp: '',
};

const DEFAULT_CALCULATION: CalculationState = {
  scope: 'Scope 1',
  category: 'Stationary',
  equipmentType: '',
  fuelCategory: 'Gaseous Fuels',
  fuelType: '',
  amount: 0,
  unit: '',
};

const KEYS = {
  questionnaire: 'ghg_questionnaire',
  entries: 'ghg_entries',
  customFuels: 'ghg_custom_fuels',
  legacyFactors: 'ghg_emission_factors',
  customEquipment: 'ghg_custom_equipment',
  step: 'ghg_current_step',
} as const;

function isQuestionnaire(value: unknown): value is QuestionnaireData {
  return typeof value === 'object' && value !== null && typeof (value as QuestionnaireData).orgName === 'string';
}

function isEntryArray(value: unknown): value is EmissionEntry[] {
  return Array.isArray(value) && value.every((e) => typeof e === 'object' && e !== null && typeof (e as EmissionEntry).fuelType === 'string');
}

function isCustomFuelArray(value: unknown): value is CustomFuelDefinition[] {
  return Array.isArray(value) && value.every((f) => typeof f === 'object' && f !== null && typeof (f as CustomFuelDefinition).name === 'string');
}

function isEquipment(value: unknown): value is CustomEquipmentTypes {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** State and actions for the GHG calculator. Saved per user in local storage. */
export const useGHGCalculator = () => {
  const { saveData, loadData, removeData } = useDataPersistence();

  const [currentStep, setCurrentStep] = useState<CalculatorStep>('questionnaire');
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData>(EMPTY_QUESTIONNAIRE);
  const [entries, setEntries] = useState<EmissionEntry[]>([]);
  const [customFuels, setCustomFuels] = useState<CustomFuelDefinition[]>([]);
  const [customEquipmentTypes, setCustomEquipmentTypes] = useState<CustomEquipmentTypes>({});
  const [calculation, setCalculation] = useState<CalculationState>(() => normalizeSelection(DEFAULT_CALCULATION, [], {}));
  const [amountText, setAmountTextState] = useState('');
  const [customFuel, setCustomFuel] = useState({ name: '', factor: 0, unit: '' });
  const [customEquipment, setCustomEquipment] = useState<CustomEquipmentData>({ name: '', description: '', category: 'Stationary' });
  const [errors, setErrors] = useState<string[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [lastCalculation, setLastCalculation] = useState<{ emissionAmount: number; fuelType: string; scope: string } | null>(null);
  const [highlightResults, setHighlightResults] = useState(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------------ persistence

  const loadGHGData = useCallback(() => {
    const savedQuestionnaire = loadData(KEYS.questionnaire);
    const savedEntries = loadData(KEYS.entries);
    const savedFuels = loadData(KEYS.customFuels);
    const savedEquipment = loadData(KEYS.customEquipment);
    const savedStep = loadData(KEYS.step);

    const fuels = isCustomFuelArray(savedFuels) ? savedFuels : legacyCustomFuels(loadData(KEYS.legacyFactors));
    const equipment = isEquipment(savedEquipment) ? savedEquipment : {};
    const q = isQuestionnaire(savedQuestionnaire) ? savedQuestionnaire : EMPTY_QUESTIONNAIRE;

    setCustomFuels(fuels);
    setCustomEquipmentTypes(equipment);
    setQuestionnaire(q);
    setEntries(isEntryArray(savedEntries) ? savedEntries.map((e) => migrateEntry(e, fuels)) : []);
    setCalculation((prev) => normalizeSelection(prev, fuels, equipment));
    setCurrentStep(q.orgName && (savedStep === 'calculator' || savedStep === 'results') ? savedStep : 'questionnaire');
    setIsDataLoaded(true);
  }, [loadData]);

  useEffect(() => {
    loadGHGData();
    // Load once per mount; loadData changes identity on every provider render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    saveData(KEYS.questionnaire, questionnaire);
    saveData(KEYS.entries, entries);
    saveData(KEYS.customFuels, customFuels);
    saveData(KEYS.customEquipment, customEquipmentTypes);
    saveData(KEYS.step, currentStep);
    // saveData changes identity on every provider render; the data dependencies are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire, entries, customFuels, customEquipmentTypes, currentStep, isDataLoaded]);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  // ------------------------------------------------------------------ selection

  const updateCalculation = useCallback(
    (patch: Partial<CalculationState>) => setCalculation((prev) => normalizeSelection({ ...prev, ...patch }, customFuels, customEquipmentTypes)),
    [customFuels, customEquipmentTypes],
  );

  const source = useMemo(() => resolveSource(calculation, customFuels), [calculation, customFuels]);

  /** The quantity as typed; the numeric amount follows it. */
  const setAmountText = (text: string) => {
    setAmountTextState(text);
    const n = Number(text);
    setCalculation((prev) => ({ ...prev, amount: text.trim() !== '' && Number.isFinite(n) ? n : 0 }));
  };

  // ------------------------------------------------------------------ questionnaire

  const submitQuestionnaire = () => {
    const next: string[] = [];
    if (!questionnaire.orgName.trim()) next.push('Organization name is required');
    if (!questionnaire.boundaryApproach) next.push('Organizational boundary is required');
    if (questionnaire.boundaryApproach === 'Control Approach' && !questionnaire.controlSubtype) next.push('Control Approach type is required');
    if (!questionnaire.operationalBoundary) next.push('Operational Boundary is required');
    if (!questionnaire.emissionSources) next.push('Emission sources must be selected');
    setErrors(next);
    if (next.length) return;
    setQuestionnaire((prev) => ({ ...prev, timestamp: new Date().toISOString() }));
    const scope = questionnaire.emissionSources.includes('Scope 2') ? 'Scope 2' : 'Scope 1';
    updateCalculation({ scope });
    setCurrentStep('calculator');
  };

  // ------------------------------------------------------------------ entries

  const calculateEmissions = () => {
    if (!calculation.amount || calculation.amount <= 0) {
      setErrors(['Enter a quantity greater than zero.']);
      return;
    }
    const result = computeEntry(
      {
        id: crypto.randomUUID(),
        scope: calculation.scope,
        category: calculation.category,
        fuelCategory: calculation.fuelCategory,
        fuelType: calculation.fuelType,
        equipmentType: calculation.equipmentType || undefined,
        amount: calculation.amount,
        unit_type: calculation.unit,
        timestamp: new Date().toISOString(),
      },
      customFuels,
    );
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    const entry = result.entry;
    setEntries((prev) => [...prev, entry]);
    setLastCalculation({ emissionAmount: entry.emissions, fuelType: entry.fuelType, scope: entry.scope });
    setShowSuccessNotification(true);
    setHighlightResults(true);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightResults(false), 2000);
    setCalculation((prev) => ({ ...prev, amount: 0 }));
    setAmountTextState('');
    setErrors([]);
  };

  const deleteEntry = (entryId: string) => setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  const deleteAllEntries = () => setEntries([]);

  // ------------------------------------------------------------------ custom fuels

  const addCustomFuel = () => {
    const name = customFuel.name.trim();
    const scope = asScope(calculation.scope);
    const unit = customFuel.unit || groupUnit(scope, calculation.category, calculation.fuelCategory);
    if (!name || !(customFuel.factor > 0)) {
      setErrors(['Enter a fuel name and an emission factor greater than zero.']);
      return;
    }
    const clash = resolveSource({ ...calculation, fuelType: name }, customFuels);
    if (clash) {
      setErrors([`"${name}" already exists in ${calculation.fuelCategory}.`]);
      return;
    }
    const fuel: CustomFuelDefinition = {
      id: crypto.randomUUID(),
      scope,
      category: calculation.category,
      fuelCategory: calculation.fuelCategory,
      name,
      factor: customFuel.factor,
      unit,
      timestamp: new Date().toISOString(),
    };
    const nextFuels = [...customFuels, fuel];
    setCustomFuels(nextFuels);
    setCalculation((prev) => normalizeSelection({ ...prev, fuelType: name, unit }, nextFuels, customEquipmentTypes));
    setCustomFuel({ name: '', factor: 0, unit: '' });
    setErrors([]);
  };

  const deleteCustomFuel = (fuelType: string) => {
    const nextFuels = customFuels.filter(
      (f) => !(f.scope === calculation.scope && f.category === calculation.category && f.fuelCategory === calculation.fuelCategory && f.name === fuelType),
    );
    setCustomFuels(nextFuels);
    setCalculation((prev) => normalizeSelection(prev, nextFuels, customEquipmentTypes));
  };

  // ------------------------------------------------------------------ custom equipment

  const addCustomEquipment = () => {
    const name = customEquipment.name.trim();
    const description = customEquipment.description.trim();
    if (!name || !description) {
      setErrors(['Enter both an equipment name and a description.']);
      return;
    }
    if (getEquipmentOptionsWithCustom(customEquipment.category, customEquipmentTypes).includes(name)) {
      setErrors(['That equipment type already exists in this category.']);
      return;
    }
    const next: CustomEquipmentTypes = {
      ...customEquipmentTypes,
      [customEquipment.category]: {
        ...(customEquipmentTypes[customEquipment.category] ?? {}),
        [name]: { description, custom: true, timestamp: new Date().toISOString() },
      },
    };
    setCustomEquipmentTypes(next);
    if (customEquipment.category === calculation.category) {
      setCalculation((prev) => normalizeSelection({ ...prev, equipmentType: name }, customFuels, next));
    }
    setCustomEquipment({ name: '', description: '', category: customEquipment.category });
    setErrors([]);
  };

  const deleteCustomEquipment = (category: string, equipmentType: string) => {
    const group = { ...(customEquipmentTypes[category] ?? {}) };
    delete group[equipmentType];
    const next = { ...customEquipmentTypes };
    if (Object.keys(group).length) next[category] = group;
    else delete next[category];
    setCustomEquipmentTypes(next);
    setCalculation((prev) => normalizeSelection(prev, customFuels, next));
  };

  // ------------------------------------------------------------------ totals and reset

  const totalEmissions = entries.reduce((sum, entry) => sum + (entry.issue ? 0 : entry.emissions), 0);
  const emissionFactors = useMemo(() => exportFactors(customFuels), [customFuels]);

  const goToResults = () => setCurrentStep('results');

  const resetToQuestionnaire = () => {
    Object.values(KEYS).forEach((key) => removeData(key));
    setQuestionnaire(EMPTY_QUESTIONNAIRE);
    setEntries([]);
    setCustomFuels([]);
    setCustomEquipmentTypes({});
    setCalculation(normalizeSelection(DEFAULT_CALCULATION, [], {}));
    setAmountTextState('');
    setCurrentStep('questionnaire');
    setErrors([]);
  };

  return {
    currentStep,
    setCurrentStep,
    questionnaire,
    setQuestionnaire,
    entries,
    currentCalculation: calculation,
    updateCalculation,
    amountText,
    setAmountText,
    source,
    customFuels,
    customFuel,
    setCustomFuel,
    customEquipment,
    setCustomEquipment,
    customEquipmentTypes,
    errors,
    emissionFactors,
    totalEmissions,
    isDataLoaded,
    showSuccessNotification,
    setShowSuccessNotification,
    lastCalculation,
    highlightResults,
    submitQuestionnaire,
    calculateEmissions,
    deleteEntry,
    deleteAllEntries,
    addCustomFuel,
    deleteCustomFuel,
    addCustomEquipment,
    deleteCustomEquipment,
    goToResults,
    resetToQuestionnaire,
  };
};
