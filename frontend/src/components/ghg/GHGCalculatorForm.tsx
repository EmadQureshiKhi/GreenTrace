'use client';

import { AlertCircle, AlertTriangle, Calculator, ChevronDown, Plus, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { FactorSourceLink } from '@/components/inventory/factor-source';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getEquipmentDescriptionWithCustom, getEquipmentOptionsWithCustom, isCustomEquipment } from '@/data/equipmentTypes';
import { convertToNative, UNIT_NAMES } from '@/lib/emissions/units';
import { formatKg } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CalculationState, CustomEquipmentData, CustomEquipmentTypes, CustomFuelDefinition } from '@/types/ghg';
import {
  asScope,
  categoriesFor,
  computeEntry,
  fuelCategoriesFor,
  fuelOptionsFor,
  groupUnit,
  SCOPES,
  type FactorSource,
} from './calculator-model';
import { selectClass } from './field-styles';
import SearchableDropdown from './SearchableDropdown';

interface GHGCalculatorFormProps {
  calculation: CalculationState;
  updateCalculation: (patch: Partial<CalculationState>) => void;
  amountText: string;
  setAmountText: (text: string) => void;
  source: FactorSource | null;
  customFuels: CustomFuelDefinition[];
  customFuel: { name: string; factor: number; unit: string };
  setCustomFuel: Dispatch<SetStateAction<{ name: string; factor: number; unit: string }>>;
  customEquipment: CustomEquipmentData;
  setCustomEquipment: Dispatch<SetStateAction<CustomEquipmentData>>;
  customEquipmentTypes: CustomEquipmentTypes;
  errors: string[];
  onCalculate: () => void;
  onAddCustomFuel: () => void;
  onDeleteCustomFuel: (fuelType: string) => void;
  onAddCustomEquipment: () => void;
  onDeleteCustomEquipment: (category: string, equipmentType: string) => void;
  questionnaireScope?: string;
}

const formatFactor = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });

const GHGCalculatorForm = ({
  calculation,
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
  onCalculate,
  onAddCustomFuel,
  onDeleteCustomFuel,
  onAddCustomEquipment,
  onDeleteCustomEquipment,
  questionnaireScope,
}: GHGCalculatorFormProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const scope = asScope(calculation.scope);
  const categories = categoriesFor(scope);
  const fuelCategories = fuelCategoriesFor(scope, calculation.category);
  const fuels = fuelOptionsFor(scope, calculation.category, calculation.fuelCategory, customFuels);
  const equipmentOptions = scope === 'Scope 1' ? getEquipmentOptionsWithCustom(calculation.category, customEquipmentTypes) : [];
  const searchable = fuels.length > 15;
  const isCustomSelected = source?.kind === 'custom';

  const preview =
    source && calculation.amount > 0 && calculation.unit
      ? computeEntry(
          {
            id: 'preview',
            scope: calculation.scope,
            category: calculation.category,
            fuelCategory: calculation.fuelCategory,
            fuelType: calculation.fuelType,
            amount: calculation.amount,
            unit_type: calculation.unit,
            timestamp: '',
          },
          customFuels,
        )
      : null;

  let conversion: string | null = null;
  if (source && calculation.unit && calculation.unit !== source.factorUnit) {
    try {
      const options = source.kind === 'catalog' ? source.entry.conversion : {};
      const perUnit = convertToNative(1, calculation.unit, source.factorUnit, options);
      conversion = `1 ${calculation.unit} = ${perUnit.toLocaleString(undefined, { maximumSignificantDigits: 6 })} ${source.factorUnit}`;
    } catch {
      conversion = null;
    }
  }

  const fuelLabel = (name: string, custom: boolean) => (custom ? `${name} (custom)` : name);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Add an activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {errors.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errors[0]}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="calc-scope">Scope</Label>
            <select id="calc-scope" value={scope} onChange={(e) => updateCalculation({ scope: e.target.value })} className={selectClass}>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {questionnaireScope?.startsWith(s) ? ' (from questionnaire)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="calc-category">Category</Label>
            <select
              id="calc-category"
              value={calculation.category}
              onChange={(e) => updateCalculation(scope === 'Scope 2' ? { category: e.target.value, fuelCategory: e.target.value } : { category: e.target.value })}
              className={selectClass}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {scope === 'Scope 1' && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="calc-equipment">
                Equipment or source type <span className="font-normal text-muted-foreground">(for your records)</span>
              </Label>
              <select
                id="calc-equipment"
                value={calculation.equipmentType}
                onChange={(e) => updateCalculation({ equipmentType: e.target.value })}
                className={selectClass}
              >
                {equipmentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {calculation.equipmentType && (
                <p className="text-xs text-muted-foreground">
                  {getEquipmentDescriptionWithCustom(calculation.category, calculation.equipmentType, customEquipmentTypes)}
                </p>
              )}
            </div>
          )}

          {scope === 'Scope 1' && (
            <div className="space-y-2">
              <Label htmlFor="calc-fuel-category">Fuel category</Label>
              <select
                id="calc-fuel-category"
                value={calculation.fuelCategory}
                onChange={(e) => updateCalculation({ fuelCategory: e.target.value })}
                className={selectClass}
              >
                {fuelCategories.map((fc) => (
                  <option key={fc} value={fc}>
                    {fc}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={cn('space-y-2', scope === 'Scope 2' && 'sm:col-span-2')}>
            <Label htmlFor="calc-fuel">
              {calculation.category === 'Fugitive' ? 'Gas' : scope === 'Scope 2' ? 'Supply' : 'Fuel'}
              {searchable && <span className="font-normal text-muted-foreground"> ({fuels.length} options)</span>}
            </Label>
            {searchable ? (
              <SearchableDropdown
                options={fuels.map((f) => f.name)}
                labels={Object.fromEntries(fuels.map((f) => [f.name, fuelLabel(f.name, f.custom)]))}
                value={calculation.fuelType}
                onChange={(value) => updateCalculation({ fuelType: value })}
                placeholder="Search..."
              />
            ) : (
              <select id="calc-fuel" value={calculation.fuelType} onChange={(e) => updateCalculation({ fuelType: e.target.value })} className={selectClass}>
                {fuels.map((f) => (
                  <option key={f.name} value={f.name}>
                    {fuelLabel(f.name, f.custom)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t pt-5">
          <h3 className="font-medium">Activity data</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calc-amount">Quantity</Label>
              <Input
                id="calc-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-unit">Unit</Label>
              <select
                id="calc-unit"
                value={calculation.unit}
                onChange={(e) => updateCalculation({ unit: e.target.value })}
                className={selectClass}
                disabled={!source}
              >
                {(source?.units ?? []).map((u) => (
                  <option key={u} value={u}>
                    {u}
                    {u === source?.factorUnit ? ' (factor unit)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
            {source ? (
              <>
                <p>
                  <span className="font-medium">Emission factor:</span> {formatFactor(source.factor)} kg CO2e per {source.factorUnit}
                  {source.kind === 'catalog' &&
                    (source.entry.source ? (
                      <>
                        {' '}
                        <span className="text-muted-foreground">(</span>
                        <FactorSourceLink source={source.entry.source} className="text-sm" />
                        <span className="text-muted-foreground">, {source.entry.source.dataYear} data)</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground"> (catalog)</span>
                    ))}
                </p>
                {conversion && <p className="text-xs text-muted-foreground">{conversion}</p>}
                {preview && (
                  <p className={cn('font-medium', preview.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {preview.ok ? `= ${formatKg(preview.entry.emissions)} CO2e` : preview.error}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Choose a fuel to see its emission factor.</p>
            )}
          </div>

          {isCustomSelected && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <span className="font-medium">Custom factor, estimate only.</span> Entries with custom fuels are left out when you save an inventory, because the server
                can only verify factors from the GreenTrace catalog and certificates attest to verified numbers.
              </p>
            </div>
          )}
        </div>

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button onClick={onCalculate} size="lg" className="w-full" disabled={!source}>
            <Calculator className="mr-2 h-5 w-5" />
            Calculate and add
          </Button>
        </motion.div>

        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-medium"
            aria-expanded={showCustom}
          >
            Custom fuels and equipment
            <ChevronDown className={cn('h-4 w-4 transition-transform', showCustom && 'rotate-180')} />
          </button>

          {showCustom && (
            <div className="mt-4 space-y-4">
              {scope === 'Scope 1' && (
                <div className="space-y-3 rounded-lg border p-4">
                  <h4 className="text-sm font-medium">Add custom equipment type</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="eq-category" className="text-xs">
                        Category
                      </Label>
                      <select
                        id="eq-category"
                        value={customEquipment.category}
                        onChange={(e) => setCustomEquipment((prev) => ({ ...prev, category: e.target.value }))}
                        className={selectClass}
                      >
                        {categoriesFor('Scope 1').map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="eq-name" className="text-xs">
                        Name
                      </Label>
                      <Input
                        id="eq-name"
                        value={customEquipment.name}
                        onChange={(e) => setCustomEquipment((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Backup boiler"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="eq-description" className="text-xs">
                        Description
                      </Label>
                      <Input
                        id="eq-description"
                        value={customEquipment.description}
                        onChange={(e) => setCustomEquipment((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Short description"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={onAddCustomEquipment}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add equipment
                    </Button>
                    {isCustomEquipment(calculation.category, calculation.equipmentType, customEquipmentTypes) && (
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => onDeleteCustomEquipment(calculation.category, calculation.equipmentType)}>
                        <X className="mr-1.5 h-4 w-4" />
                        Delete &quot;{calculation.equipmentType}&quot;
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-amber-200 p-4 dark:border-amber-900">
                <div>
                  <h4 className="text-sm font-medium">Add custom fuel to {calculation.fuelCategory}</h4>
                  <p className="text-xs text-muted-foreground">For estimates only. Custom factors cannot be certified.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fuel-name" className="text-xs">
                      Fuel name
                    </Label>
                    <Input id="fuel-name" value={customFuel.name} onChange={(e) => setCustomFuel((prev) => ({ ...prev, name: e.target.value }))} placeholder="Fuel name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fuel-factor" className="text-xs">
                      kg CO2e per unit
                    </Label>
                    <Input
                      id="fuel-factor"
                      type="number"
                      min="0"
                      step="any"
                      value={customFuel.factor === 0 ? '' : customFuel.factor}
                      onChange={(e) => setCustomFuel((prev) => ({ ...prev, factor: e.target.value === '' ? 0 : Number(e.target.value) || 0 }))}
                      placeholder="Factor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fuel-unit" className="text-xs">
                      Factor unit
                    </Label>
                    <select
                      id="fuel-unit"
                      value={customFuel.unit || groupUnit(scope, calculation.category, calculation.fuelCategory)}
                      onChange={(e) => setCustomFuel((prev) => ({ ...prev, unit: e.target.value }))}
                      className={selectClass}
                    >
                      {UNIT_NAMES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={onAddCustomFuel}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add custom fuel
                  </Button>
                  {isCustomSelected && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => onDeleteCustomFuel(calculation.fuelType)}>
                      <X className="mr-1.5 h-4 w-4" />
                      Delete &quot;{calculation.fuelType}&quot;
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GHGCalculatorForm;
