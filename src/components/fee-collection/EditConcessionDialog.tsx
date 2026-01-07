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
import { StudentDetails } from "@/types";

const editConcessionSchema = z.object({
  year: z.string().min(1, "Please select a year"),
  amount: z.coerce.number().min(0, "Amount must be a non-negative number"),
});

interface EditConcessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRecords: StudentDetails[];
  onSuccess: () => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
}

export function EditConcessionDialog({ open, onOpenChange, studentRecords, onSuccess, logActivity }: EditConcessionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        const totalConcession = feeItems.reduce((sum, item) => sum + (item.concession || 0), 0);
        form.setValue('amount', totalConcession);
    }
  }, [watchedYear, studentRecords, form]);

  const onSubmit = async (values: z.infer<typeof editConcessionSchema>) => {
    const { year, amount } = values;
    const masterStudentRecord = studentRecords[studentRecords.length - 1];

    setIsSubmitting(true);
    const newFeeDetails = JSON.parse(JSON.stringify(masterStudentRecord.fee_details));
    const feeItemsForYear = newFeeDetails[year];

    if (!feeItemsForYear || feeItemsForYear.length === 0) {
        toast.error(`No fee items found for ${year} to apply concession.`);
        setIsSubmitting(false);
        return;
    }

    feeItemsForYear.forEach((item: any, index: number) => {
        item.concession = (index === 0) ? amount : 0;
    });

    const { error } = await supabase
        .from('students')
        .update({ fee_details: newFeeDetails })
        .eq('id', masterStudentRecord.id);

    if (error) {
        toast.error(`Failed to update concession: ${error.message}`);
    } else {
        toast.success("Concession updated successfully!");
        await logActivity("Yearly Concession Edited", { year, amount }, masterStudentRecord.id);
        onOpenChange(false);
        onSuccess();
    }
    setIsSubmitting(false);
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
                  <FormControl><SelectTrigger><SelectValue placeholder="Select year to edit..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.keys(masterFeeDetails).map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Total Concession Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Concession"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}