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
import { StudentDetails, Payment, CashierProfile, FIXED_TERMS } from "@/types";

const paymentSchema = z.object({
  payment_year: z.string().min(1, "Please select a year or 'Other'"),
  term_name: z.string().optional(), // New field
  fee_item_name: z.string().min(1, "This field is required"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  payment_method: z.enum(["cash", "upi"]),
  notes: z.string().optional(),
  utr_number: z.string().optional(),
}).refine(data => {
  if (data.payment_method === 'upi') {
    return data.utr_number && data.utr_number.trim().length > 0;
  }
  return true;
}, {
  message: "UTR Number is required for UPI payments.",
  path: ["utr_number"],
}).refine(data => {
  // term_name is required if payment_year is not 'Other'
  if (data.payment_year !== 'Other' && !data.term_name) {
    return false;
  }
  return true;
}, {
  message: "Please select a term.",
  path: ["term_name"],
});

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRecords: StudentDetails[];
  payments: Payment[];
  cashierProfile: CashierProfile | null;
  onSuccess: (newPayment: Payment, studentRecord: StudentDetails) => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
  initialState: { fee_item_name: string, payment_year: string, term_name: string } | null;
}

export function PaymentDialog({ open, onOpenChange, studentRecords, payments, cashierProfile, onSuccess, logActivity, initialState }: PaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, payment_method: "cash", notes: "", payment_year: "", fee_item_name: "", term_name: "", utr_number: "" },
  });
  const watchedPaymentYear = form.watch("payment_year");
  const watchedTermName = form.watch("term_name");
  const watchedPaymentMethod = form.watch("payment_method");
  const masterFeeDetails = studentRecords.length > 0 ? studentRecords[0].fee_details || {} : {};

  const handleFeeItemChange = (feeItemName: string, yearOverride?: string, termOverride?: string) => {
    form.setValue('fee_item_name', feeItemName);
    const year = yearOverride || form.getValues("payment_year");
    const term = termOverride || form.getValues("term_name");

    if (!year || year === 'Other' || !term) {
        form.setValue('amount', 0);
        return;
    };

    const feeItemsForYear = masterFeeDetails[year] || [];
    const selectedFeeItem = feeItemsForYear.find(item => item.name === feeItemName && item.term_name === term);

    if (selectedFeeItem) {
        const feeTypeString = `${year} - ${term} - ${feeItemName}`;
        const paidForThisItem = payments
            .filter(p => p.fee_type === feeTypeString)
            .reduce((sum, p) => sum + p.amount, 0);
        
        const balance = (selectedFeeItem.amount - (selectedFeeItem.concession || 0)) - paidForThisItem;
        
        form.setValue('amount', Math.max(0, parseFloat(balance.toFixed(2))));
    } else {
        form.setValue('amount', 0);
    }
  };

  useEffect(() => {
    if (open && initialState) {
      form.reset({
        amount: 0,
        payment_method: "cash",
        notes: "",
        payment_year: initialState.payment_year,
        term_name: initialState.term_name,
        fee_item_name: initialState.fee_item_name,
        utr_number: "",
      });

      if (initialState.payment_year && initialState.payment_year !== 'Other' && initialState.term_name && initialState.fee_item_name) {
        const year = initialState.payment_year;
        const term = initialState.term_name;
        const feeItemName = initialState.fee_item_name;
        
        const feeItemsForYear = masterFeeDetails[year] || [];
        const selectedFeeItem = feeItemsForYear.find(item => item.name === feeItemName && item.term_name === term);

        if (selectedFeeItem) {
            const feeTypeString = `${year} - ${term} - ${feeItemName}`;
            const paidForThisItem = payments
                .filter(p => p.fee_type === feeTypeString)
                .reduce((sum, p) => sum + p.amount, 0);
            
            const balance = (selectedFeeItem.amount - (selectedFeeItem.concession || 0)) - paidForThisItem;
            
            form.setValue('amount', Math.max(0, parseFloat(balance.toFixed(2))));
        }
      }
    }
  }, [open, initialState, form, masterFeeDetails, payments]);

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    const studentRecordForPayment = studentRecords.find(r => r.studying_year === values.payment_year) || studentRecords[0];
    
    if (!studentRecordForPayment) {
      toast.error("Cannot process payment: Student profile not found.");
      return;
    }

    setIsSubmitting(true);
    const feeTypeForDb = values.payment_year === 'Other' ? values.fee_item_name : `${values.payment_year} - ${values.term_name} - ${values.fee_item_name}`;
    const paymentData = {
        amount: values.amount,
        payment_method: values.payment_method,
        notes: values.notes,
        fee_type: feeTypeForDb,
        student_id: studentRecordForPayment.id,
        cashier_id: cashierProfile?.id || null,
        utr_number: values.payment_method === 'upi' ? values.utr_number : null,
    };

    const { data: newPayment, error } = await supabase.from("payments").insert([paymentData]).select().single();
    if (error) {
      toast.error(`Payment failed: ${error.message}`);
    } else {
      await logActivity("Fee Collection", { ...values, fee_type: feeTypeForDb }, studentRecordForPayment.id);
      onOpenChange(false);
      onSuccess(newPayment as Payment, studentRecordForPayment);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Collect New Payment</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="payment_year" render={({ field }) => (
              <FormItem><FormLabel>Year / Type</FormLabel>
                <Select onValueChange={(value) => {
                    field.onChange(value);
                    const currentFeeItemName = form.getValues('fee_item_name');
                    const currentTermName = form.getValues('term_name');
                    if (value === 'Other') {
                      form.setValue('fee_item_name', '');
                      form.setValue('term_name', '');
                      form.setValue('amount', 0);
                    } else if (currentFeeItemName && currentTermName) {
                      handleFeeItemChange(currentFeeItemName, value, currentTermName);
                    } else {
                      form.setValue('amount', 0);
                    }
                  }} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.keys(masterFeeDetails).map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              <FormMessage /></FormItem>
            )} />

            {watchedPaymentYear && watchedPaymentYear !== 'Other' && (
              <FormField control={form.control} name="term_name" render={({ field }) => (
                <FormItem><FormLabel>Term</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    const currentFeeItemName = form.getValues('fee_item_name');
                    if (currentFeeItemName) {
                      handleFeeItemChange(currentFeeItemName, watchedPaymentYear, value);
                    } else {
                      form.setValue('amount', 0);
                    }
                  }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select term..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FIXED_TERMS.map(term => <SelectItem key={term.id} value={term.name}>{term.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
            )}

            {watchedPaymentYear && watchedPaymentYear !== 'Other' && watchedTermName && (
              <FormField control={form.control} name="fee_item_name" render={({ field }) => (
                <FormItem><FormLabel>Fee Item</FormLabel>
                  <Select onValueChange={(value) => handleFeeItemChange(value)} value={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={!!initialState?.fee_item_name}>
                        <SelectValue placeholder="Select fee item..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(masterFeeDetails[watchedPaymentYear] || [])
                        .filter(item => item.term_name === watchedTermName)
                        .map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
            )}

            {watchedPaymentYear === 'Other' && (
              <FormField control={form.control} name="fee_item_name" render={({ field }) => (
                  <FormItem><FormLabel>Fee Description</FormLabel><FormControl><Input placeholder="e.g., Fine for late submission" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="payment_method" render={({ field }) => (
              <FormItem><FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem></SelectContent>
                </Select>
              <FormMessage /></FormItem>
            )} />
            {watchedPaymentMethod === 'upi' && (
              <FormField control={form.control} name="utr_number" render={({ field }) => (
                <FormItem><FormLabel>UTR Number</FormLabel><FormControl><Input placeholder="Enter UTR number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Processing..." : "Collect Payment"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}