import { v4 as uuidv4 } from "uuid";
import { FeeStructure, FeeItem, StudyingYear, Term, FIXED_TERMS } from "@/types";

const BASE_FEE_TYPES = ['Tuition Fee', 'Management Fee', 'JVD Fee'];

export function generateInitialFeeDetails(
  studentTypeName: string | null,
  studyingYears: StudyingYear[]
): FeeStructure {
  const initialStructure: FeeStructure = {};

  studyingYears.forEach(sYear => {
    const yearName = sYear.name;
    initialStructure[yearName] = [];

    FIXED_TERMS.forEach(term => {
      if (yearName === '1st Year' && studentTypeName?.toLowerCase().includes('jvd')) {
        // Simplified JVD logic for 1st Year
        if (term.name === 'Term 1' || term.name === 'Term 2') {
          initialStructure[yearName].push({
            id: uuidv4(),
            name: 'Tuition Fee',
            amount: 15000, 
            concession: 0,
            term_name: term.name,
          });
        } else if (term.name === 'Term 3') {
          initialStructure[yearName].push({
            id: uuidv4(),
            name: 'JVD Fee',
            amount: 15000,
            concession: 0,
            term_name: term.name,
          });
        }
        // No other fee types for 1st Year JVD students in these terms
      } else {
        // Default structure for other years or non-JVD students
        BASE_FEE_TYPES.forEach(feeType => {
          if (feeType === 'JVD Fee') return; // JVD is specific to 1st year JVD students
          initialStructure[yearName].push({
            id: uuidv4(),
            name: feeType,
            amount: 0, // Default to 0, can be edited
            concession: 0,
            term_name: term.name,
          });
        });
      }
    });
  });

  return initialStructure;
}

export function getFeeTypesFromStructure(feeStructure: FeeStructure): string[] {
  const allFeeTypeNames = new Set<string>();
  Object.values(feeStructure).forEach(feeItems => {
    feeItems.forEach(item => allFeeTypeNames.add(item.name));
  });
  return Array.from(allFeeTypeNames).sort();
}