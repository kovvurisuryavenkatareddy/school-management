export type AcademicYear = {
  id: string;
  year_name: string;
  is_active: boolean;
  created_at: string;
};

export type Term = {
  id: string;
  name: string; // e.g., "Term 1", "Term 2", "Term 3"
  created_at: string;
};

// Hardcoded terms for consistency across the application
export const FIXED_TERMS: Term[] = [
  { id: 'term-1', name: 'Term 1', created_at: new Date().toISOString() },
  { id: 'term-2', name: 'Term 2', created_at: new Date().toISOString() },
  { id: 'term-3', name: 'Term 3', created_at: new Date().toISOString() },
];

export type StudyingYear = {
  id: string;
  name: string; // e.g., "1st Year", "2nd Year", "3rd Year"
  created_at: string;
};

export type StudentType = {
  id: string;
  name: string; // e.g., "Day Scholar", "Hostel"
  created_at: string;
};

export type ClassGroup = {
  id: string;
  name: string; // e.g., "BSc", "BA"
  created_at: string;
};

export type FeeItem = {
  id: string;
  name: string; // e.g., "Tuition Fee", "Management Fee", "JVD Fee"
  amount: number;
  concession: number;
  term_name: string; // e.g., "Term 1", "Term 2", "Term 3"
};

export type FeeStructure = { [studyingYear: string]: FeeItem[] };

export type StudentListItem = {
  id: string;
  name: string;
  roll_number: string;
};

export type StudentDetails = {
  id: string; name: string; roll_number: string; class: string; section: string; studying_year: string;
  caste: string | null;
  student_types: { name: string } | null;
  fee_details: FeeStructure; // Updated type
  academic_years: AcademicYear | null;
  email?: string | null;
  phone?: string | null;
};

export type Payment = {
  id: string; 
  student_id: string; 
  amount: number; 
  fee_type: string; // e.g., "1st Year - Term 1 - Management Fee"
  payment_method: string; 
  created_at: string; 
  notes: string | null;
  utr_number: string | null;
  receipt_number: number;
};

export type Invoice = {
  id: string; due_date: string; status: 'paid' | 'unpaid'; total_amount: number; paid_amount: number; batch_description: string;
};

export type CashierProfile = {
  id: string;
  name: string;
  has_discount_permission: boolean;
  has_expenses_permission: boolean;
};

// New type for Fee Summary Table data structure
export type FeeSummaryData = {
  [year: string]: {
    [feeType: string]: {
      [term: string]: {
        total: number;
        paid: number;
        concession: number;
        balance: number;
      };
    };
  };
};