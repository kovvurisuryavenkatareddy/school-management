import { v4 as uuidv4 } from "uuid";
import { FeeStructure, FeeItem, StudyingYear, Term, FIXED_TERMS } from "@/types";

/**
 * Generates initial fee details based on the new Term 1/2/3 structure.
 */
export function generateInitialFeeDetails(
  studentTypeName: string | null,
  studyingYears: StudyingYear[]
): FeeStructure {
  const initialStructure: FeeStructure = {};
  const isJvd = studentTypeName?.toLowerCase().includes('jvd');

  studyingYears.forEach(sYear => {
    const yearName = sYear.name;
    initialStructure[yearName] = [];

    // Create standard term items
    FIXED_TERMS.forEach((term, index) => {
      let amount = 0;
      
      // Default logic: Tuition split across T1/T2, JVD in T3
      if (isJvd && yearName === '1st Year') {
        if (term.name === 'Term 1' || term.name === 'Term 2') amount = 15000;
        else if (term.name === 'Term 3') amount = 15000;
      }

      initialStructure[yearName].push({
        id: uuidv4(),
        name: term.name, // The item name is now the Term name itself
        amount: amount,
        concession: 0,
        term_name: term.name,
      });
    });

    // Add the special Yearly Concession item
    initialStructure[yearName].push({
      id: uuidv4(),
      name: 'Yearly Concession',
      amount: 0,
      concession: 0,
      term_name: 'Total',
    });
  });

  return initialStructure;
}

/**
 * Normalizes existing fee structure to the new Term 1/2/3 format.
 */
export function normalizeFeeStructure(rawStructure: any): FeeStructure {
  if (!rawStructure || typeof rawStructure !== 'object') return {};
  
  const normalized: FeeStructure = {};

  Object.entries(rawStructure).forEach(([year, items]) => {
    if (!Array.isArray(items)) return;

    // Check if it's already in the new format (has "Term 1" as an item name)
    const isNewFormat = items.some(i => i.name === 'Term 1');
    
    if (isNewFormat) {
      normalized[year] = items;
      return;
    }

    // Convert legacy data to new format
    const t1: FeeItem = { id: uuidv4(), name: 'Term 1', amount: 0, concession: 0, term_name: 'Term 1' };
    const t2: FeeItem = { id: uuidv4(), name: 'Term 2', amount: 0, concession: 0, term_name: 'Term 2' };
    const t3: FeeItem = { id: uuidv4(), name: 'Term 3', amount: 0, concession: 0, term_name: 'Term 3' };
    let totalConc = 0;

    items.forEach((item: any) => {
      if (item.name === 'Tuition Fee' || item.name === 'Management Fee') {
        t1.amount += (item.amount / 2);
        t2.amount += (item.amount / 2);
      } else if (item.name === 'JVD Fee') {
        t3.amount += item.amount;
      }
      totalConc += (item.concession || 0);
    });

    normalized[year] = [
      t1, t2, t3,
      { id: uuidv4(), name: 'Yearly Concession', amount: 0, concession: totalConc, term_name: 'Total' }
    ];
  });

  return normalized;
}

export function getFeeTypesFromStructure(feeStructure: FeeStructure): string[] {
  return ['Term 1', 'Term 2', 'Term 3', 'Yearly Concession'];
}