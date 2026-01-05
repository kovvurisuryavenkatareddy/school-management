import { v4 as uuidv4 } from "uuid";
import { FeeStructure, FeeItem, StudyingYear, Term, FIXED_TERMS } from "@/types";

const BASE_FEE_TYPES = ['Tuition Fee', 'Management Fee', 'JVD Fee'];

export function generateInitialFeeDetails(
  studentTypeName: string | null,
  studyingYears: StudyingYear[]
): FeeStructure {
  const initialStructure: FeeStructure = {};
  const isJvd = studentTypeName?.toLowerCase().includes('jvd');

  studyingYears.forEach(sYear => {
    const yearName = sYear.name;
    initialStructure[yearName] = [];

    FIXED_TERMS.forEach(term => {
      // 1. Management Fee
      initialStructure[yearName].push({
        id: uuidv4(),
        name: 'Management Fee',
        amount: 0,
        concession: 0,
        term_name: term.name,
      });

      // 2. Tuition Fee logic
      let tuitionAmount = 0;
      if (isJvd && yearName === '1st Year') {
        if (term.name === 'Term 1' || term.name === 'Term 2') {
          tuitionAmount = 15000;
        } else {
          tuitionAmount = 0;
        }
      }

      initialStructure[yearName].push({
        id: uuidv4(),
        name: 'Tuition Fee',
        amount: tuitionAmount,
        concession: 0,
        term_name: term.name,
      });

      // 3. JVD Fee logic - ONLY for Term 3
      if (term.name === 'Term 3') {
        let jvdAmount = 0;
        if (isJvd && yearName === '1st Year') {
          jvdAmount = 15000;
        }
        initialStructure[yearName].push({
          id: uuidv4(),
          name: 'JVD Fee',
          amount: jvdAmount,
          concession: 0,
          term_name: term.name,
        });
      }
    });
  });

  return initialStructure;
}

/**
 * Normalizes existing/legacy fee structure.
 * If items don't have term_name, it splits them into terms based on business logic.
 */
export function normalizeFeeStructure(rawStructure: any): FeeStructure {
  if (!rawStructure || typeof rawStructure !== 'object') return {};
  
  const normalized: FeeStructure = {};

  Object.entries(rawStructure).forEach(([year, items]) => {
    if (!Array.isArray(items)) return;

    normalized[year] = [];
    
    items.forEach((item: any) => {
      // If item already has a term, keep it
      if (item.term_name) {
        normalized[year].push(item);
        return;
      }

      // LEGACY DATA HANDLING: Split by business rules
      if (item.name === 'Tuition Fee') {
        normalized[year].push({ ...item, id: uuidv4(), term_name: 'Term 1', amount: item.amount / 2, concession: item.concession / 2 });
        normalized[year].push({ ...item, id: uuidv4(), term_name: 'Term 2', amount: item.amount / 2, concession: item.concession / 2 });
      } else if (item.name === 'JVD Fee') {
        normalized[year].push({ ...item, term_name: 'Term 3' });
      } else {
        // Default everything else to Term 1
        normalized[year].push({ ...item, term_name: 'Term 1' });
      }
    });
  });

  return normalized;
}

export function getFeeTypesFromStructure(feeStructure: FeeStructure): string[] {
  const allFeeTypeNames = new Set<string>();
  Object.values(feeStructure).forEach(feeItems => {
    feeItems.forEach(item => allFeeTypeNames.add(item.name));
  });
  return Array.from(allFeeTypeNames).sort();
}