"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StudentDetails, CashierProfile } from "@/types";
import { Upload } from "lucide-react";

const editConcessionSchema = z.object({
  year: z.string().min(1, "Please select a year"),
  amount: z.coerce.number().min(0, "Amount must be a non-negative number"),
  document: z.any().optional(),
});

interface EditConcessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRecords: StudentDetails[];
  onSuccess: () => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
  cashierProfile: CashierProfile | null;
}

export function EditConcessionDialog({ open, onOpenChange, studentRecords, onSuccess, logActivity, cashierProfile }: EditConcessionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<z.infer<typeof editConcessionSchema>>({
    resolver: zodResolver(editConcessionSchema),
    defaultValues: { year: "", amount: 0 },
  });

  const watchedYear = form.watch("year");
  const masterFeeDetails = studentRecords.length > 0 ? studentRecords[studentRecords.length - 1].fee_details || {} : {};

  useEffect(() => {
    if (watchedYear && studentRecords.length > 0) {
        const masterStudentRecord = studentRecords[studentRecords.length - 1];
        const feeItems = masterStudentRecord.fee_details[watchedYear] || [];
        const totalConcession = feeItems.find(i => i.name === 'Yearly Concession')?.concession || 0;
        form.setValue('amount', totalConcession);
    }
  }, [watchedYear, studentRecords, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 1024 * 1024) {
        toast.error("File size exceeds 1MB limit.");
        e.target.value = "";
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Only JPG, PNG, and JPEG files are allowed.");
        e.target.value = "";
        return;
      }
      setFile(selectedFile);
    }
  };

  const onSubmit = async (values: z.infer<typeof editConcessionSchema>) => {
    if (!file) {
      toast.error("Please upload the permission letter image.");
      return;
    }

    const { year, amount } = values;
    const masterStudentRecord = studentRecords[studentRecords.length - 1];

    setIsSubmitting(true);
    const toastId = toast.loading("Processing concession and uploading document...");

    try {
      // 1. Upload the file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `concession_${masterStudentRecord.roll_number}_${year}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('permission-letters')
        .upload(fileName, file);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('permission-letters')
        .getPublicUrl(fileName);

      // 2. Update student record
      const newFeeDetails = JSON.parse(JSON.stringify(masterStudentRecord.fee_details));
      const feeItemsForYear = newFeeDetails[year];

      if (!feeItemsForYear || feeItemsForYear.length === 0) {
        throw new Error(`No fee items found for ${year} to apply concession.`);
      }

      let concItem = feeItemsForYear.find((i: any) => i.name === 'Yearly Concession');
      if (!concItem) {
        concItem = { id: Math.random().toString(36), name: 'Yearly Concession', amount: 0, concession: 0, term_name: 'Total' };
        feeItemsForYear.push(concItem);
      }
      concItem.concession = amount;

      const { error: updateError } = await supabase
        .from('students')
        .update({ fee_details: newFeeDetails })
        .eq('id', masterStudentRecord.id);

      if (updateError) throw updateError;

      // 3. Log activity with detailed info
      await logActivity("Concession Applied", { 
        year, 
        amount, 
        document_url: publicUrl,
        cashier_name: cashierProfile?.name || 'Admin',
        student_roll: masterStudentRecord.roll_number
      }, masterStudentRecord.id);

      toast.success("Concession updated and logged successfully!", { id: toastId });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Yearly Concession</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="year" render={({ field }) => (
              <FormItem><FormLabel>Academic Year</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select year..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.keys(masterFeeDetails).map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Total Concession Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <FormItem>
              <FormLabel>Permission Letter (JPG/PNG, Max 1MB)</FormLabel>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".jpg,.jpeg,.png" onChange={handleFileChange} className="cursor-pointer" />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
            </FormItem>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !file}>{isSubmitting ? "Processing..." : "Confirm Concession"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}