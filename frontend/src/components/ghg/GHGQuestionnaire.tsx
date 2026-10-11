'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { QuestionnaireData } from '@/types/ghg';
import { selectClass } from './field-styles';

interface GHGQuestionnaireProps {
  questionnaire: QuestionnaireData;
  setQuestionnaire: Dispatch<SetStateAction<QuestionnaireData>>;
  errors: string[];
  onSubmit: () => void;
}

const GHGQuestionnaire = ({ questionnaire, setQuestionnaire, errors, onSubmit }: GHGQuestionnaireProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Assessment questionnaire</CardTitle>
        <CardDescription>Your organization and the boundaries of this assessment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
            <p className="mb-2 flex items-center gap-2 font-medium text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              Please fix the following:
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-red-700 dark:text-red-300">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ghg-org">Organization name *</Label>
          <Input
            id="ghg-org"
            value={questionnaire.orgName}
            onChange={(e) => setQuestionnaire((prev) => ({ ...prev, orgName: e.target.value }))}
            placeholder="Your organization"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ghg-boundary">Organizational boundary *</Label>
          <select
            id="ghg-boundary"
            value={questionnaire.boundaryApproach}
            onChange={(e) => setQuestionnaire((prev) => ({ ...prev, boundaryApproach: e.target.value, controlSubtype: '' }))}
            className={selectClass}
          >
            <option value="">Select boundary approach</option>
            <option value="Control Approach">Control Approach</option>
            <option value="Equity Share Approach">Equity Share Approach</option>
          </select>
        </div>

        {questionnaire.boundaryApproach === 'Control Approach' && (
          <div className="space-y-2">
            <Label htmlFor="ghg-control">Control approach type *</Label>
            <select
              id="ghg-control"
              value={questionnaire.controlSubtype}
              onChange={(e) => setQuestionnaire((prev) => ({ ...prev, controlSubtype: e.target.value }))}
              className={selectClass}
            >
              <option value="">Select control type</option>
              <option value="Operational">Operational</option>
              <option value="Financial">Financial</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ghg-operational">Operational boundary *</Label>
          <select
            id="ghg-operational"
            value={questionnaire.operationalBoundary}
            onChange={(e) => setQuestionnaire((prev) => ({ ...prev, operationalBoundary: e.target.value }))}
            className={selectClass}
          >
            <option value="">Select operational boundary</option>
            <option value="Facility-level">Facility-level</option>
            <option value="Corporate-level">Corporate-level</option>
            <option value="Product-level">Product-level</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ghg-sources">Where do you start? *</Label>
          <select
            id="ghg-sources"
            value={questionnaire.emissionSources}
            onChange={(e) => setQuestionnaire((prev) => ({ ...prev, emissionSources: e.target.value }))}
            className={selectClass}
          >
            <option value="">Select emission sources</option>
            <option value="Scope 1 (direct emissions)">Scope 1 (direct emissions)</option>
            <option value="Scope 2 (indirect emissions)">Scope 2 (indirect emissions)</option>
          </select>
          <p className="text-xs text-muted-foreground">You can add entries for both scopes in the calculator.</p>
        </div>

        <div className="flex justify-center pt-2">
          <Button onClick={onSubmit} size="lg" className="w-full sm:w-auto">
            Continue to calculator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GHGQuestionnaire;
