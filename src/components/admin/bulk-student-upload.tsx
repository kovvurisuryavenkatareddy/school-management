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

interface BulkStudentUploadProps {
  onSuccess: () => void;
  studyingYears: StudyingYear[];
  studentTypes: StudentType[];
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
  sections: Term[];
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
      const prefix = sYear.name.toLowerCase().replace(' ', '_');
      feeHeaders.push(`${prefix}_term_1`, `${prefix}_term_2`, `${prefix}_term_3`, `${prefix}_concession`);
    });

    const headers = [...baseHeaders, ...feeHeaders];

    const sampleRow = [
      "240401", "ADAPA SAI", "BSc", "A", "sai@example.com", "1234567890", 
      "Day Scholar", "2024-2025", "1st Year", "BC-B",
      "25000", "25000", "25000", "25000"
    ];

    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_students_v2.csv");
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
          if (rows.length === 0) throw new Error("CSV file is empty.");

          const studentTypeMap = new Map(studentTypes?.map(i => [i.name.toLowerCase(), i.id]));
          const academicYearMap = new Map(academicYears?.map(i => [i.year_name, i.id]));

          const studentsToInsert: any[] = [];

          rows.forEach((row, index) => {
            const academic_year_id = academicYearMap.get(row.academic_year?.trim());
            const student_type_id = studentTypeMap.get(row.student_type?.trim().toLowerCase());
            
            if (!academic_year_id || !student_type_id) return;

            const fee_details: FeeStructure = {};
            studyingYears.forEach(sYear => {
              const yearName = sYear.name;
              const prefix = yearName.toLowerCase().replace(' ', '_');
              
              fee_details[yearName] = [
                { id: uuidv4(), name: 'Term 1', amount: parseFloat(row[`${prefix}_term_1`]) || 0, concession: 0, term_name: 'Term 1' },
                { id: uuidv4(), name: 'Term 2', amount: parseFloat(row[`${prefix}_term_2`]) || 0, concession: 0, term_name: 'Term 2' },
                { id: uuidv4(), name: 'Term 3', amount: parseFloat(row[`${prefix}_term_3`]) || 0, concession: 0, term_name: 'Term 3' },
                { id: uuidv4(), name: 'Yearly Concession', amount: 0, concession: parseFloat(row[`${prefix}_concession`]) || 0, term_name: 'Total' }
              ];
            });

            studentsToInsert.push({
              roll_number: row.roll_number?.trim(),
              name: row.name?.trim(),
              class: row.class?.trim(),
              section: row.section?.trim(),
              email: row.email?.trim() || null,
              phone: row.phone?.trim() || null,
              student_type_id,
              academic_year_id,
              studying_year: row.studying_year?.trim(),
              caste: row.caste?.trim() || null,
              fee_details,
            });
          });

          if (studentsToInsert.length > 0) {
            const { error } = await supabase.from('students').insert(studentsToInsert);
            if (error) throw error;
            toast.success(`${studentsToInsert.length} students uploaded!`, { id: toastId });
            onSuccess();
          } else {
            throw new Error("No valid records found.");
          }
        } catch (error: any) {
          toast.error(error.message, { id: toastId });
        } finally {
          setIsUploading(false);
          event.target.value = "";
        }
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Student Upload</CardTitle>
        <CardDescription>Upload CSV with Term 1, Term 2, Term 3, and Concession columns.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-4">
        <Button variant="outline" onClick={handleDownloadSample} className="gap-2">
          <Download className="h-4 w-4" /> Download Format
        </Button>
        <div className="flex items-center gap-2">
          <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
          {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      </CardContent>
    </Card>
  );
}