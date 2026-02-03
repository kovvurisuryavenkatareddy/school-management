"use client";

import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { Download, Upload, Loader2, AlertCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AcademicYear, StudentType, ClassGroup, Term, FeeStructure } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BulkStudentUploadProps {
  onSuccess: () => void;
  studyingYears: { id: string; name: string }[];
  studentTypes: StudentType[];
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
  sections: Term[];
}

const REQUIRED_COLUMNS = [
  "roll_number", "name", "class", "section", "email", "phone", "student_type", "academic_year", "studying_year", "caste",
  "first_year_term1", "first_year_term2", "first_year_term3", "first_year_concession",
  "second_year_term1", "second_year_term2", "second_year_term3", "second_year_concession",
  "third_year_term1", "third_year_term2", "third_year_term3", "third_year_concession",
  "fourth_year_term1", "fourth_year_term2", "fourth_year_term3", "fourth_year_concession"
];

const YEAR_MAPPING: Record<string, string> = {
  first: "1st Year",
  second: "2nd Year",
  third: "3rd Year",
  fourth: "4th Year"
};

export function BulkStudentUpload({ onSuccess, studyingYears, studentTypes, academicYears, classGroups, sections }: BulkStudentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDownloadSample = () => {
    const ws = XLSX.utils.json_to_sheet([{
      roll_number: "240401",
      name: "ADAPA SAI",
      class: "BSc",
      section: "A",
      email: "sai@example.com",
      phone: "9876543210",
      student_type: "Day Scholar",
      academic_year: "2024-2025",
      studying_year: "1st Year",
      caste: "BC-B",
      first_year_term1: 25000, first_year_term2: 25000, first_year_term3: 15000, first_year_concession: 5000,
      second_year_term1: 0, second_year_term2: 0, second_year_term3: 0, second_year_concession: 0,
      third_year_term1: 0, third_year_term2: 0, third_year_term3: 0, third_year_concession: 0,
      fourth_year_term1: 0, fourth_year_term2: 0, fourth_year_term3: 0, fourth_year_concession: 0,
    }]);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "bulk_student_upload_template.xlsx");
  };

  const validateRow = (row: any, index: number, existingRolls: Set<string>, maps: any) => {
    const rowNum = index + 2;
    const rowErrors: string[] = [];

    // 1. Basic unique validation
    if (!row.roll_number) rowErrors.push(`Row ${rowNum}: Roll number is missing.`);
    else if (existingRolls.has(String(row.roll_number))) rowErrors.push(`Row ${rowNum}: Roll number "${row.roll_number}" already exists in database.`);

    // 2. Email validation
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push(`Row ${rowNum}: Invalid email format.`);
    }

    // 3. Phone validation
    if (!row.phone || !/^\d{10}$/.test(String(row.phone))) {
      rowErrors.push(`Row ${rowNum}: Phone must be numeric and exactly 10 digits.`);
    }

    // 4. Lookup validations
    if (!maps.classGroups.has(row.class)) rowErrors.push(`Row ${rowNum}: Class "${row.class}" does not exist.`);
    if (!maps.sections.has(row.section)) rowErrors.push(`Row ${rowNum}: Section "${row.section}" does not exist.`);
    if (!maps.studentTypes.has(String(row.student_type).toLowerCase())) rowErrors.push(`Row ${rowNum}: Student Type "${row.student_type}" does not exist.`);
    if (!maps.academicYears.has(row.academic_year)) rowErrors.push(`Row ${rowNum}: Academic Year "${row.academic_year}" does not exist.`);
    if (!maps.studyingYears.has(row.studying_year)) rowErrors.push(`Row ${rowNum}: Studying Year "${row.studying_year}" does not exist.`);

    return rowErrors;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrors([]);
    const toastId = toast.loading("Processing Excel file...");

    try {
      const reader = new FileReader();
      const data = await new Promise<ArrayBuffer>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
      });

      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) throw new Error("Excel file is empty.");

      // Verify column headers
      const headers = Object.keys(rows[0]);
      const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
      }

      // Prepare lookup maps
      const maps = {
        studentTypes: new Map(studentTypes.map(i => [i.name.toLowerCase(), i.id])),
        academicYears: new Map(academicYears.map(i => [i.year_name, i.id])),
        classGroups: new Set(classGroups.map(i => i.name)),
        sections: new Set(sections.map(i => i.name)),
        studyingYears: new Set(studyingYears.map(i => i.name))
      };

      // Fetch all existing roll numbers for uniqueness check
      const { data: existingStudents } = await supabase.from('students').select('roll_number');
      const existingRolls = new Set(existingStudents?.map(s => s.roll_number) || []);

      const studentsToInsert: any[] = [];
      const collectedErrors: string[] = [];
      const seenInFile = new Set<string>();

      rows.forEach((row, index) => {
        // Local uniqueness check (within file)
        const rollStr = String(row.roll_number);
        if (seenInFile.has(rollStr)) {
          collectedErrors.push(`Row ${index + 2}: Duplicate roll number "${rollStr}" found within the file.`);
          return;
        }
        seenInFile.add(rollStr);

        const rowErrors = validateRow(row, index, existingRolls, maps);
        if (rowErrors.length > 0) {
          collectedErrors.push(...rowErrors);
          return; // Skip this row
        }

        // Build fee structure
        const fee_details: FeeStructure = {};
        ["first", "second", "third", "fourth"].forEach(yearKey => {
          const dbYearName = YEAR_MAPPING[yearKey];
          fee_details[dbYearName] = [
            { id: uuidv4(), name: 'Term 1', amount: parseFloat(row[`${yearKey}_year_term1`]) || 0, concession: 0, term_name: 'Term 1' },
            { id: uuidv4(), name: 'Term 2', amount: parseFloat(row[`${yearKey}_year_term2`]) || 0, concession: 0, term_name: 'Term 2' },
            { id: uuidv4(), name: 'Term 3', amount: parseFloat(row[`${yearKey}_year_term3`]) || 0, concession: 0, term_name: 'Term 3' },
            { id: uuidv4(), name: 'Yearly Concession', amount: 0, concession: Math.max(0, parseFloat(row[`${yearKey}_year_concession`]) || 0), term_name: 'Total' }
          ];
        });

        studentsToInsert.push({
          roll_number: rollStr.trim(),
          name: String(row.name).trim(),
          class: String(row.class).trim(),
          section: String(row.section).trim(),
          email: row.email ? String(row.email).trim() : null,
          phone: String(row.phone).trim(),
          student_type_id: maps.studentTypes.get(String(row.student_type).toLowerCase()),
          academic_year_id: maps.academicYears.get(row.academic_year),
          studying_year: String(row.studying_year).trim(),
          caste: row.caste ? String(row.caste).trim() : null,
          fee_details,
        });
      });

      if (collectedErrors.length > 0) {
        setErrors(collectedErrors);
        toast.warning(`Processed with ${collectedErrors.length} validation errors.`, { id: toastId });
      }

      if (studentsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('students').insert(studentsToInsert);
        if (insertError) throw insertError;
        toast.success(`Successfully uploaded ${studentsToInsert.length} students!`, { id: toastId });
        onSuccess();
      } else if (collectedErrors.length === 0) {
        throw new Error("No valid student records found to upload.");
      }

    } catch (err: any) {
      toast.error(err.message, { id: toastId });
      setErrors([err.message]);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="text-xl font-ubuntu">Excel Bulk Upload</CardTitle>
        <CardDescription>
          Upload students with full 4-year fee breakdowns. Please ensure all lookups (Class, Section, etc.) are pre-configured.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" onClick={handleDownloadSample} className="gap-2 h-10">
            <Download className="h-4 w-4" /> Download Excel Template
          </Button>
          <div className="relative flex-grow">
            <Input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              disabled={isUploading} 
              className="cursor-pointer h-10 pr-10" 
            />
            <div className="absolute right-3 top-2.5">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation Errors Found</AlertTitle>
            <AlertDescription className="mt-2 max-h-48 overflow-auto text-xs space-y-1">
              {errors.map((err, i) => <p key={i}>• {err}</p>)}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}