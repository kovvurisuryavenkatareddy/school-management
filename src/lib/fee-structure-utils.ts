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
      // 1. Management Fee - always present for all terms
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
        // For JVD 1st Year: Tuition Fee is 15000 for Term 1 & 2, and 0 for Term 3
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

export function getFeeTypesFromStructure(feeStructure: FeeStructure): string[] {
  const allFeeTypeNames = new Set<string>();
  Object.values(feeStructure).forEach(feeItems => {
    feeItems.forEach(item => allFeeTypeNames.add(item.name));
  });
  return Array.from(allFeeTypeNames).sort();
}