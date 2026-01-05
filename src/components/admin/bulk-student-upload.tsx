"use client";

import { useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { Download, Upload, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AcademicYear, StudentType, ClassGroup, StudyingYear, Term, FeeItem, FeeStructure } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInitialFeeDetails, getFeeTypesFromStructure } from "@/lib/fee-structure-utils";

// Hardcoded terms and base fee types
const FIXED_TERMS: Term[] = [
  { id: 'term-1', name: 'Term 1', created_at: new Date().toISOString() },
  { id: 'term-2', name: 'Term 2', created_at: new Date().toISOString() },
  { id: 'term-3', name: 'Term 3', created_at: new Date().toISOString() },
];
const BASE_FEE_TYPES = ['Tuition Fee', 'Management Fee', 'JVD Fee'];

interface BulkStudentUploadProps {
  onSuccess: () => void;
  studyingYears: StudyingYear[];
  studentTypes: StudentType[];
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
  sections: Term[]; // Assuming sections are also managed as terms
}

export function BulkStudentUpload({ onSuccess, studyingYears, studentTypes, academicYears, classGroups, sections }: BulkStudentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleDownloadSample = () => {
    const baseHeaders = [
      "roll_number", "name", "class", "section", "email", "phone", 
      "student_type", "academic_year", "studying_year", "caste",
    ];

    const feeHeaders: string[] = [];
    studyingYears.forEach(sYear => {
      FIXED_TERMS.forEach(term => {
        BASE_FEE_TYPES.forEach(feeType => {
          feeHeaders.push(`${sYear.name.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_${feeType.toLowerCase().replace(' ', '_')}`);
        });
      });
    });

    const headers = [...baseHeaders, ...feeHeaders];

    const sampleDataRow1 = [
      "101", "John Doe", "BSc", "A", "john.doe@example.com", "1234567890", 
      "Day Scholar", "2024-2025", "1st Year", "General",
    ];
    const sampleFeeData1: string[] = [];
    studyingYears.forEach(sYear => {
      FIXED_TERMS.forEach(term => {
        BASE_FEE_TYPES.forEach(feeType => {
          if (feeType === 'Tuition Fee') sampleFeeData1.push("15000");
          else sampleFeeData1.push("0");
        });
      });
    });
    const sampleRow1 = [...sampleDataRow1, ...sampleFeeData1];

    const sampleDataRow2 = [
      "102", "Jane Smith", "BSc", "B", "jane.smith@example.com", "0987654321", 
      "JVD Scholar", "2024-2025", "1st Year", "OBC",
    ];
    const sampleFeeData2: string[] = [];
    studyingYears.forEach(sYear => {
      FIXED_TERMS.forEach(term => {
        if (sYear.name === '1st Year' && studentTypes.find(st => st.name === 'JVD Scholar')?.name.toLowerCase().includes('jvd')) {
          if (term.name === 'Term 1' || term.name === 'Term 2') {
            BASE_FEE_TYPES.forEach(feeType => {
              if (feeType === 'Tuition Fee') sampleFeeData2.push("15000");
              else sampleFeeData2.push("0");
            });
          } else if (term.name === 'Term 3') {
            BASE_FEE_TYPES.forEach(feeType => {
              if (feeType === 'JVD Fee') sampleFeeData2.push("15000");
              else sampleFeeData2.push("0");
            });
          } else {
            BASE_FEE_TYPES.forEach(() => sampleFeeData2.push("0"));
          }
        } else {
          BASE_FEE_TYPES.forEach(() => sampleFeeData2.push("0"));
        }
      });
    });
    const sampleRow2 = [...sampleDataRow2, ...sampleFeeData2];

    const csv = [headers.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\n');
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_students_with_term_fees.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading("Processing CSV file...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (rows.length === 0) {
            throw new Error("CSV file is empty or invalid.");
          }

          // Create maps for existing data
          const classMap = new Map(classGroups?.map(i => [i.name.toLowerCase(), i.id]));
          const sectionMap = new Map(sections?.map(i => [i.name.toLowerCase(), i.id]));
          const studyingYearMap = new Map(studyingYears?.map(i => [i.name.toLowerCase(), i.id]));
          const studentTypeMap = new Map(studentTypes?.map(i => [i.name.toLowerCase(), i.id]));
          const academicYearMap = new Map(academicYears?.map(i => [i.year_name, i.id]));

          const studentsToInsert: any[] = [];
          const skippedRows: { row: number; reason: string }[] = [];

          rows.forEach((row, index) => {
            const academic_year_id = academicYearMap.get(row.academic_year?.trim());
            const student_type_id = studentTypeMap.get(row.student_type?.trim().toLowerCase());
            const student_type_name = row.student_type?.trim();
            const class_name = row.class?.trim();
            const section_name = row.section?.trim();
            const studying_year_name = row.studying_year?.trim();

            if (!row.roll_number || !row.name || !class_name || !section_name || !studying_year_name) {
              skippedRows.push({ row: index + 2, reason: "Missing required fields (roll_number, name, class, section, studying_year)." });
              return;
            }
            if (!academic_year_id) {
              skippedRows.push({ row: index + 2, reason: `Invalid or missing academic year: ${row.academic_year}` });
              return;
            }
            if (!student_type_id) {
              skippedRows.push({ row: index + 2, reason: `Invalid or missing student type: ${row.student_type}` });
              return;
            }

            const fee_details: FeeStructure = {};

            studyingYears.forEach(sYear => {
              const yearName = sYear.name;
              fee_details[yearName] = [];

              FIXED_TERMS.forEach(term => {
                const managementFeeKey = `${yearName.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_management_fee`;
                const jvdFeeKey = `${yearName.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_jvd_fee`;
                const tuitionFeeKey = `${yearName.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_tuition_fee`;

                const managementFee = parseFloat(row[managementFeeKey]) || 0;
                const jvdFee = parseFloat(row[jvdFeeKey]) || 0;
                const tuitionFee = parseFloat(row[tuitionFeeKey]) || 0;

                if (yearName === '1st Year' && student_type_name?.toLowerCase().includes('jvd')) {
                  // Apply fixed JVD logic for 1st Year JVD students
                  if (term.name === 'Term 1' || term.name === 'Term 2') {
                    fee_details[yearName].push({ id: uuidv4(), name: 'Tuition Fee', amount: 15000, concession: 0, term_name: term.name });
                  } else if (term.name === 'Term 3') {
                    fee_details[yearName].push({ id: uuidv4(), name: 'JVD Fee', amount: 15000, concession: 0, term_name: term.name });
                  }
                } else {
                  // For other years or non-JVD students, use CSV values or default
                  if (managementFee > 0) {
                    fee_details[yearName].push({ id: uuidv4(), name: 'Management Fee', amount: managementFee, concession: 0, term_name: term.name });
                  }
                  if (jvdFee > 0) {
                    fee_details[yearName].push({ id: uuidv4(), name: 'JVD Fee', amount: jvdFee, concession: 0, term_name: term.name });
                  }
                  if (tuitionFee > 0) {
                    fee_details[yearName].push({ id: uuidv4(), name: 'Tuition Fee', amount: tuitionFee, concession: 0, term_name: term.name });
                  }
                  // Ensure at least a default structure if no fees are provided for a term
                  if (fee_details[yearName].filter(item => item.term_name === term.name).length === 0) {
                    fee_details[yearName].push({ id: uuidv4(), name: 'Tuition Fee', amount: 0, concession: 0, term_name: term.name });
                  }
                }
              });
            });

            studentsToInsert.push({
              roll_number: row.roll_number.trim(),
              name: row.name.trim(),
              class: class_name,
              section: section_name,
              email: row.email?.trim() || null,
              phone: row.phone?.trim() || null,
              student_type_id,
              academic_year_id,
              studying_year: studying_year_name,
              caste: row.caste?.trim() || null,
              fee_details: fee_details,
            });
          });

          if (skippedRows.length > 0) {
            const skippedRowsDescription = skippedRows.slice(0, 5).map(skipped => `Row ${skipped.row}: ${skipped.reason}`).join('\n');
            const fullDescription = `Skipped ${skippedRows.length} of ${rows.length} rows.\n\nErrors:\n${skippedRowsDescription}${skippedRows.length > 5 ? '\n...' : ''}`;
            
            toast.warning("Some rows were skipped during upload.", {
                description: <pre className="mt-2 w-full rounded-md bg-muted p-4 text-muted-foreground"><code className="text-sm">{fullDescription}</code></pre>,
                duration: 15000,
            });
          }

          if (studentsToInsert.length > 0) {
            const { error } = await supabase.from('students').insert(studentsToInsert);
            if (error) {
              throw new Error(`Bulk upload failed: ${error.message}`);
            } else {
              toast.success(`${studentsToInsert.length} students uploaded successfully!`, { id: toastId });
              onSuccess();
            }
          } else {
            if (skippedRows.length === 0) {
              throw new Error("No valid students found in the CSV file.");
            } else {
              toast.dismiss(toastId);
            }
          }
        } catch (error: any) {
          toast.error(error.message, { id: toastId });
        } finally {
          setIsUploading(false);
          (event.target as HTMLInputElement).value = "";
        }
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Student Upload</CardTitle>
        <CardDescription>Upload a CSV file to add multiple students at once. Please ensure the column headers match the sample file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" onClick={handleDownloadSample} className="gap-2">
            <Download className="h-4 w-4" />
            Download Sample CSV
          </Button>
          <div className="flex items-center gap-2">
            <label htmlFor="csv-upload" className="sr-only">Upload CSV</label>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="cursor-pointer"
            />
            {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p><strong>Required Columns:</strong> roll_number, name, class, section, student_type, academic_year, studying_year</p>
          <p><strong>Optional Columns:</strong> email, phone, caste, and term-wise fee columns (e.g., <code>1st_year_term_1_management_fee</code>)</p>
          <p className="mt-2"><strong>Note for JVD Students:</strong> For 1st Year JVD students, the fee structure will be automatically set to 15,000 Tuition Fee for Term 1, 15,000 Tuition Fee for Term 2, and 15,000 JVD Fee for Term 3, regardless of CSV input for these specific fields.</p>
        </div>
      </CardContent>
    </Card>
  );
}