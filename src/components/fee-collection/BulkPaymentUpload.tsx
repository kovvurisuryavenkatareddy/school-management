"use client";

import { useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { Download, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AcademicYear, CashierProfile } from "@/types";

interface BulkPaymentUploadProps {
  cashierProfile: CashierProfile | null;
  academicYears: AcademicYear[];
}

type StudentMap = Map<string, { id: string }>;

export function BulkPaymentUpload({ cashierProfile, academicYears }: BulkPaymentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleDownloadSample = () => {
    const headers = ["roll_number", "academic_year", "amount", "fee_type", "payment_method", "payment_date", "notes"];
    const sampleData = ["101", "2024-2025", "5000", "1st Year - Tuition Fee", "cash", "2024-08-01", "First installment"];
    const csv = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_payments.csv");
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
        const rows = results.data as any[];
        if (rows.length === 0) {
          toast.error("CSV file is empty or invalid.", { id: toastId });
          setIsUploading(false);
          return;
        }

        const studentIdentifiers = new Set(rows.map(row => `${row.roll_number?.trim()}::${row.academic_year?.trim()}`));
        
        const { data: students, error: studentError } = await supabase
          .from('students')
          .select('id, roll_number, academic_years(year_name)')
          .in('roll_number', Array.from(studentIdentifiers).map(id => id.split('::')[0]));

        if (studentError) {
          toast.error(`Failed to fetch students: ${studentError.message}`, { id: toastId });
          setIsUploading(false);
          return;
        }

        const studentMap: StudentMap = new Map();
        students?.forEach((s: any) => {
          if (s.academic_years) {
            studentMap.set(`${s.roll_number}::${s.academic_years.year_name}`, { id: s.id });
          }
        });

        const paymentsToInsert: any[] = [];
        const skippedRows: { row: number; reason: string }[] = [];

        rows.forEach((row, index) => {
          const key = `${row.roll_number?.trim()}::${row.academic_year?.trim()}`;
          const student = studentMap.get(key);

          if (!student) {
            skippedRows.push({ row: index + 2, reason: `Student with roll number '${row.roll_number}' in academic year '${row.academic_year}' not found.` });
            return;
          }

          const amount = parseFloat(row.amount);
          if (isNaN(amount) || amount <= 0) {
            skippedRows.push({ row: index + 2, reason: `Invalid amount: ${row.amount}` });
            return;
          }

          const payment_method = row.payment_method?.toLowerCase().trim();
          if (!['cash', 'upi'].includes(payment_method)) {
            skippedRows.push({ row: index + 2, reason: `Invalid payment method: ${row.payment_method}` });
            return;
          }

          paymentsToInsert.push({
            student_id: student.id,
            cashier_id: cashierProfile?.id || null,
            amount,
            fee_type: row.fee_type?.trim(),
            payment_method,
            created_at: row.payment_date ? new Date(row.payment_date).toISOString() : new Date().toISOString(),
            notes: row.notes?.trim(),
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

        if (paymentsToInsert.length > 0) {
          const { error } = await supabase.from('payments').insert(paymentsToInsert);
          if (error) {
            toast.error(`Bulk upload failed: ${error.message}`, { id: toastId });
          } else {
            // LOG ACTIVITY FOR BULK IMPORT
            await supabase.from('activity_logs').insert({
              cashier_id: cashierProfile?.id || null,
              action: 'Bulk Payment Import',
              details: { count: paymentsToInsert.length, file_name: file.name },
            });
            
            toast.success(`${paymentsToInsert.length} payments uploaded successfully!`, { id: toastId });
          }
        } else {
          if (skippedRows.length === 0) {
            toast.error("No valid payments found in the CSV file.", { id: toastId });
          } else {
            toast.dismiss(toastId);
          }
        }

        setIsUploading(false);
        (event.target as HTMLInputElement).value = "";
      },
      error: (error) => {
        toast.error(`CSV parsing error: ${error.message}`, { id: toastId });
        setIsUploading(false);
      }
    });
  };

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Bulk Payment Upload</CardTitle>
        <CardDescription>Upload a CSV file to record multiple payments at once.</CardDescription>
      </CardHeader>
      <CardContent>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}