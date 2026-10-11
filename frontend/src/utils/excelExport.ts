import * as XLSX from 'xlsx';
import { QuestionnaireData, EmissionEntry } from '../types/ghg';

export interface ExportData {
  questionnaire: QuestionnaireData;
  entries: EmissionEntry[];
  emissionFactors: unknown;
  totalEmissions: number;
}

// Minimal type guard for emission factors
function isEmissionFactor(obj: unknown): obj is { custom: boolean; factor: number; timestamp?: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'custom' in obj &&
    typeof obj.custom === 'boolean' &&
    'factor' in obj
  );
}

// Minimal type guard for custom equipment
function isCustomEquipmentType(obj: unknown): obj is { custom: boolean; description: string; timestamp?: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'custom' in obj &&
    typeof obj.custom === 'boolean' &&
    'description' in obj
  );
}

export const exportToExcel = async (
  data: ExportData, 
  format: 'excel' | 'csv' = 'excel',
  customEquipmentTypes: Record<string, unknown> = {}
): Promise<void> => {
  const { questionnaire, entries, emissionFactors, totalEmissions } = data;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // 1. Questionnaire Sheet
  const questionnaireData = [
    ['Organization Name', questionnaire.orgName],
    ['Boundary Approach', questionnaire.boundaryApproach],
    ['Control Subtype', questionnaire.controlSubtype || 'N/A'],
    ['Operational Boundary', questionnaire.operationalBoundary],
    ['Emission Sources', questionnaire.emissionSources],
    ['Assessment Date', new Date(questionnaire.timestamp).toLocaleDateString()]
  ];
  const questionnaireWS = XLSX.utils.aoa_to_sheet(questionnaireData);
  XLSX.utils.book_append_sheet(wb, questionnaireWS, 'Questionnaire');

  // 2. Summary Sheet
  const scope1Emissions = entries.filter(e => e.scope === 'Scope 1').reduce((sum, e) => sum + e.emissions, 0);
  const scope2Emissions = entries.filter(e => e.scope === 'Scope 2').reduce((sum, e) => sum + e.emissions, 0);
  
  const summaryData = [
    ['Metric', 'Value', 'Unit'],
    ['Total Emissions', (totalEmissions / 1000).toFixed(2), 'tonnes CO2e'],
    ['Scope 1 Emissions', (scope1Emissions / 1000).toFixed(2), 'tonnes CO2e'],
    ['Scope 2 Emissions', (scope2Emissions / 1000).toFixed(2), 'tonnes CO2e'],
    ['Total Activities', entries.length, 'count'],
    ['Report Generated', new Date().toLocaleDateString(), 'date']
  ];
  const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

  // 3. Detailed Calculations Sheet
  if (entries.length > 0) {
    const calculationsData = [
      ['Scope', 'Category', 'Equipment Type', 'Fuel Category', 'Fuel Type', 'Amount', 'Unit', 'Emission Factor', 'Total Emissions (kg CO2e)', 'Date']
    ];
    
    entries.forEach(entry => {
      calculationsData.push([
        entry.scope,
        entry.category,
        entry.equipmentType || 'N/A',
        entry.fuelCategory,
        entry.fuelType,
        entry.amount.toString(),
        entry.unit_type,
        entry.convertedFactor.toFixed(6),
        entry.emissions.toFixed(2),
        new Date(entry.timestamp).toLocaleDateString()
      ]);
    });
    
    const calculationsWS = XLSX.utils.aoa_to_sheet(calculationsData);
    XLSX.utils.book_append_sheet(wb, calculationsWS, 'Calculations');
  }

  // 4. Activity Breakdown Sheet
  const activityBreakdown: { [key: string]: number } = {};
  entries.forEach(entry => {
    const key = `${entry.scope} - ${entry.fuelType}`;
    activityBreakdown[key] = (activityBreakdown[key] || 0) + entry.emissions;
  });

  const breakdownData = [['Activity', 'Emissions (kg CO2e)', 'Emissions (tonnes CO2e)']];
  Object.entries(activityBreakdown).forEach(([activity, emissions]) => {
    breakdownData.push([activity, emissions.toFixed(2), (emissions / 1000).toFixed(2)]);
  });
  
  const breakdownWS = XLSX.utils.aoa_to_sheet(breakdownData);
  XLSX.utils.book_append_sheet(wb, breakdownWS, 'Activity Breakdown');

  // 5. Custom Fuels Sheet (if any exist)
  const customFuels: { path: string; factor: number; timestamp: string }[] = [];
  const findCustomFuels = (obj: unknown, path: string[] = []) => {
    if (typeof obj !== 'object' || obj === null) return;
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        if (isEmissionFactor(value) && value.custom === true) {
          customFuels.push({
            path: [...path, key].join(' > '),
            factor: value.factor,
            timestamp: value.timestamp || 'Unknown'
          });
        } else {
          findCustomFuels(value, [...path, key]);
        }
      }
    });
  };

  findCustomFuels(emissionFactors);

  if (customFuels.length > 0) {
    const customFuelsData = [['Fuel Path', 'Emission Factor (kg CO2e/unit)', 'Date Added']];
    customFuels.forEach(fuel => {
      customFuelsData.push([
        fuel.path,
        fuel.factor.toString(),
        new Date(fuel.timestamp).toLocaleDateString()
      ]);
    });
    
    const customFuelsWS = XLSX.utils.aoa_to_sheet(customFuelsData);
    XLSX.utils.book_append_sheet(wb, customFuelsWS, 'Custom Fuels');
  }

  // 6. Custom Equipment Sheet (if any exist)
  const customEquipment: { category: string; name: string; description: string; timestamp: string }[] = [];
  Object.entries(customEquipmentTypes ?? {}).forEach(([category, equipment]) => {
    if (typeof equipment === 'object' && equipment !== null) {
      Object.entries(equipment as Record<string, unknown>).forEach(([name, details]) => {
        if (isCustomEquipmentType(details) && details.custom === true) {
          customEquipment.push({
            category,
            name,
            description: details.description,
            timestamp: details.timestamp || 'Unknown'
          });
        }
      });
    }
  });

  if (customEquipment.length > 0) {
    const customEquipmentData = [['Category', 'Equipment Name', 'Description', 'Date Added']];
    customEquipment.forEach(equipment => {
      customEquipmentData.push([
        equipment.category,
        equipment.name,
        equipment.description,
        new Date(equipment.timestamp).toLocaleDateString()
      ]);
    });
    
    const customEquipmentWS = XLSX.utils.aoa_to_sheet(customEquipmentData);
    XLSX.utils.book_append_sheet(wb, customEquipmentWS, 'Custom Equipment');
  }

  // Generate filename
  const orgName = questionnaire.orgName.replace(/[^a-zA-Z0-9]/g, '_') || 'Organization';
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `GHG_Report_${orgName}_${timestamp}`;

  if (format === 'excel') {
    // Export as Excel file
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else {
    // Export as CSV files in a ZIP (simplified - just export main sheets as CSV)
    const csvData: { [key: string]: string } = {};
    
    // Convert each sheet to CSV
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws);
      csvData[`${sheetName}.csv`] = csv;
    });

    // For simplicity, just download the main calculations as CSV
    const calculationsWS = wb.Sheets['Calculations'];
    if (calculationsWS) {
      const csv = XLSX.utils.sheet_to_csv(calculationsWS);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_Calculations.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
};