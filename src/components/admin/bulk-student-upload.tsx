"use client";

import { useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { Download, Upload, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AcademicYear, StudentType, ClassGroup, StudyingYear, Term, FeeItem, FeeStructure, FIXED_TERMS } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInitialFeeDetails, getFeeTypesFromStructure } from "@/lib/fee-structure-utils";

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
          // Only show JVD Fee for Term 3 in CSV sample
          if (feeType === 'JVD Fee' && term.name !== 'Term 3') return;
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
           if (feeType === 'JVD Fee' && term.name !== 'Term 3') return;
           if (feeType === 'Tuition Fee') sampleFeeData1.push("15000");
           else sampleFeeData1.push("0");
        });
      });
    });
    const sampleRow1 = [...sampleDataRow1, ...sampleFeeData1];

    const csv = [headers.join(','), sampleRow1.join(',')].join('\n');
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_students_fees.csv");
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
              skippedRows.push({ row: index + 2, reason: "Missing required fields." });
              return;
            }
            if (!academic_year_id || !student_type_id) {
              skippedRows.push({ row: index + 2, reason: `Invalid academic year (${row.academic_year}) or student type (${row.student_type}).` });
              return;
            }

            const fee_details: FeeStructure = {};
            const isJvd = student_type_name?.toLowerCase().includes('jvd');

            studyingYears.forEach(sYear => {
              const yearName = sYear.name;
              fee_details[yearName] = [];

              FIXED_TERMS.forEach(term => {
                // 1. Management Fee
                const mgtKey = `${yearName.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_management_fee`;
                fee_details[yearName].push({ id: uuidv4(), name: 'Management Fee', amount: parseFloat(row[mgtKey]) || 0, concession: 0, term_name: term.name });

                // 2. Tuition Fee
                const tuitionKey = `${yearName.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_tuition_fee`;
                let tuitionAmount = parseFloat(row[tuitionKey]) || 0;
                
                if (isJvd && yearName === '1st Year') {
                  if (term.name === 'Term 1' || term.name === 'Term 2') tuitionAmount = 15000;
                  else if (term.name === 'Term 3') tuitionAmount = 0;
                }
                fee_details[yearName].push({ id: uuidv4(), name: 'Tuition Fee', amount: tuitionAmount, concession: 0, term_name: term.name });

                // 3. JVD Fee - Term 3 only
                if (term.name === 'Term 3') {
                  const jvdKey = `${yearName.toLowerCase().replace(' ', '_')}_${term.name.toLowerCase().replace(' ', '_')}_jvd_fee`;
                  let jvdAmount = parseFloat(row[jvdKey]) || 0;
                  if (isJvd && yearName === '1st Year') jvdAmount = 15000;
                  
                  fee_details[yearName].push({ id: uuidv4(), name: 'JVD Fee', amount: jvdAmount, concession: 0, term_name: term.name });
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

          if (studentsToInsert.length > 0) {
            const { error } = await supabase.from('students').insert(studentsToInsert);
            if (error) throw new Error(`Bulk upload failed: ${error.message}`);
            toast.success(`${studentsToInsert.length} students uploaded successfully!`, { id: toastId });
            onSuccess();
          } else {
            throw new Error("No valid students found in the CSV file.");
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
        <CardDescription>Upload a CSV file to add multiple students at once. Note: JVD Fee is restricted to Term 3.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" onClick={handleDownloadSample} className="gap-2">
            <Download className="h-4 w-4" />
            Download Sample CSV
          </Button>
          <div className="flex items-center gap-2">
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
      </CardContent>
    </Card>
  );
}