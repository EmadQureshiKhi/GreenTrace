'use client';

import { ArrowLeft, Calculator, ListChecks, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGHGCalculator } from '@/hooks/useGHGCalculator';
import { formatTonnes } from '@/lib/format';
import GHGCalculatorForm from './GHGCalculatorForm';
import GHGQuestionnaire from './GHGQuestionnaire';
import GHGResults from './GHGResults';
import GHGResultsSidebar from './GHGResultsSidebar';
import SuccessNotification from './SuccessNotification';

const GHGCalculator = () => {
  const calc = useGHGCalculator();
  const [confirmReset, setConfirmReset] = useState(false);
  const { currentStep, questionnaire, entries, totalEmissions } = calc;

  // Whether a session from an earlier visit was restored. Captured once, when loading finishes, so the
  // banner does not appear for the session being typed right now.
  const [restored, setRestored] = useState<{ orgName: string; entries: number } | null | undefined>(undefined);
  useEffect(() => {
    if (calc.isDataLoaded && restored === undefined) {
      setRestored(entries.length > 0 || questionnaire.orgName ? { orgName: questionnaire.orgName, entries: entries.length } : null);
    }
  }, [calc.isDataLoaded, restored, entries.length, questionnaire.orgName]);

  if (!calc.isDataLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Restoring your saved calculator data...</p>
        </div>
      </div>
    );
  }

  if (currentStep === 'questionnaire') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">GHG emissions calculator</h1>
          <p className="text-muted-foreground">Enter Scope 1 and 2 activity data. Factors come from the GreenTrace emission factor catalog.</p>
        </div>
        {restored && (
          <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40">
            <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sky-900 dark:text-sky-100">
                <span className="font-medium">Saved session found:</span> {restored.orgName ? `"${restored.orgName}"` : 'unnamed'}
                {restored.entries > 0 && `, ${restored.entries} ${restored.entries === 1 ? 'entry' : 'entries'}`}
              </p>
              {restored.orgName && (
                <Button size="sm" variant="outline" onClick={() => calc.setCurrentStep('calculator')} className="bg-background">
                  Continue
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        <GHGQuestionnaire questionnaire={questionnaire} setQuestionnaire={calc.setQuestionnaire} errors={calc.errors} onSubmit={calc.submitQuestionnaire} />
      </div>
    );
  }

  if (currentStep === 'results') {
    return (
      <GHGResults
        questionnaire={questionnaire}
        entries={entries}
        totalEmissions={totalEmissions}
        emissionFactors={calc.emissionFactors}
        customEquipmentTypes={calc.customEquipmentTypes}
        onBackToCalculator={() => calc.setCurrentStep('calculator')}
        onDeleteEntry={calc.deleteEntry}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-md">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">GHG calculator</h1>
            <p className="truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{questionnaire.orgName || 'Organization'}</span>
              {' · '}
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              {totalEmissions > 0 && <span className="font-medium text-emerald-700 dark:text-emerald-400"> · {formatTonnes(totalEmissions)} CO2e</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => calc.setCurrentStep('questionnaire')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Questionnaire
          </Button>
          <Button onClick={calc.goToResults}>
            <ListChecks className="mr-2 h-4 w-4" />
            Results and save ({entries.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Organizational boundary</p>
            <p className="font-medium">{questionnaire.boundaryApproach || 'Not set'}</p>
            {questionnaire.controlSubtype && <p className="text-muted-foreground">{questionnaire.controlSubtype} control</p>}
          </div>
          <div>
            <p className="text-muted-foreground">Operational boundary</p>
            <p className="font-medium">{questionnaire.operationalBoundary || 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Emission sources</p>
            <p className="font-medium">{questionnaire.emissionSources || 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Saved</p>
            <p className="font-medium">Automatically, in this browser</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <GHGCalculatorForm
            calculation={calc.currentCalculation}
            updateCalculation={calc.updateCalculation}
            amountText={calc.amountText}
            setAmountText={calc.setAmountText}
            source={calc.source}
            customFuels={calc.customFuels}
            customFuel={calc.customFuel}
            setCustomFuel={calc.setCustomFuel}
            customEquipment={calc.customEquipment}
            setCustomEquipment={calc.setCustomEquipment}
            customEquipmentTypes={calc.customEquipmentTypes}
            errors={calc.errors}
            onCalculate={calc.calculateEmissions}
            onAddCustomFuel={calc.addCustomFuel}
            onDeleteCustomFuel={calc.deleteCustomFuel}
            onAddCustomEquipment={calc.addCustomEquipment}
            onDeleteCustomEquipment={calc.deleteCustomEquipment}
            questionnaireScope={questionnaire.emissionSources}
          />
        </div>
        <div className="min-w-0">
          <GHGResultsSidebar
            entries={entries}
            totalEmissions={totalEmissions}
            onDeleteEntry={calc.deleteEntry}
            onDeleteAll={calc.deleteAllEntries}
            highlightResults={calc.highlightResults}
            lastEntryId={entries.length > 0 ? entries[entries.length - 1].id : undefined}
          />
        </div>
      </div>

      <SuccessNotification
        isVisible={calc.showSuccessNotification}
        onClose={() => calc.setShowSuccessNotification(false)}
        emissionAmount={calc.lastCalculation?.emissionAmount ?? 0}
        fuelType={calc.lastCalculation?.fuelType ?? ''}
        totalEmissions={totalEmissions}
        scope={calc.lastCalculation?.scope ?? ''}
      />

      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium text-red-900 dark:text-red-200">Reset calculator</h2>
            <p className="text-sm text-red-700 dark:text-red-300">Clears the questionnaire, all entries and custom types saved in this browser.</p>
          </div>
          {confirmReset ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmReset(false)}>
                Keep data
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  calc.resetToQuestionnaire();
                  setConfirmReset(false);
                }}
              >
                Yes, reset
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset all
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GHGCalculator;
