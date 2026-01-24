"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Invoice, StudentDetails, CashierProfile, Payment, FIXED_TERMS } from "@/types";

const invoicePaymentSchema = z.object({
  payment_year: z.string().min(1, "Please select a year"),
  term_name: z.string().min(1, "Please select a term."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
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
});

interface InvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  studentRecords: StudentDetails[];
  cashierProfile: CashierProfile | null;
  onSuccess: (newPayment: Payment, studentRecord: StudentDetails) => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
}

export function InvoicePaymentDialog({ open, onOpenChange, invoice, studentRecords, cashierProfile, onSuccess, logActivity }: InvoicePaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof invoicePaymentSchema>>({
    resolver: zodResolver(invoicePaymentSchema),
  });

  const watchedPaymentMethod = form.watch("payment_method");
  const masterFeeDetails = studentRecords.length > 0 ? studentRecords[studentRecords.length - 1].fee_details || {} : {};
  const currentYearRecord = studentRecords.find(r => r.academic_years?.is_active);

  useEffect(() => {
    if (invoice && open) {
      const remainingBalance = invoice.total_amount - (invoice.paid_amount || 0);
      
      const batchDescParts = invoice.batch_description.split(' for Class ')[0].split(' - ');
      let extractedTerm = '';
      if (batchDescParts.length > 1) {
        extractedTerm = FIXED_TERMS.find(term => batchDescParts.includes(term.name))?.name || '';
      }

      form.reset({
        payment_year: currentYearRecord?.studying_year || Object.keys(masterFeeDetails)[0] || '',
        term_name: extractedTerm || FIXED_TERMS[0].name,
        amount: parseFloat(remainingBalance.toFixed(2)),
        payment_method: "cash",
        notes: "",
        utr_number: "",
      });
    }
  }, [invoice, currentYearRecord, form, open, masterFeeDetails]);

  const onSubmit = async (values: z.infer<typeof invoicePaymentSchema>) => {
    const studentRecordForPayment = studentRecords[0];
    if (!studentRecordForPayment) {
      toast.error("Cannot process payment. Missing student context.");
      return;
    }
    setIsSubmitting(true);

    const feeName = invoice.batch_description.split(" for Class ")[0];
    const feeTypeForDb = `${values.payment_year} - ${values.term_name} - ${feeName}`;

    const paymentData = {
      student_id: studentRecordForPayment.id,
      cashier_id: cashierProfile?.id || null,
      amount: values.amount,
      payment_method: values.payment_method,
      fee_type: feeTypeForDb,
      notes: values.notes,
      utr_number: values.payment_method === 'upi' ? values.utr_number : null,
    };

    const { data: newPayment, error: paymentError } = await supabase.from('payments').insert(paymentData).select().single();
    if (paymentError) {
      toast.error(`Payment failed: ${paymentError.message}`);
      setIsSubmitting(false);
      return;
    }

    const newPaidAmount = (invoice.paid_amount || 0) + values.amount;
    const newStatus = newPaidAmount >= invoice.total_amount ? 'paid' : 'unpaid';

    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({ paid_amount: newPaidAmount, status: newStatus })
      .eq('id', invoice.id);

    if (invoiceError) {
      toast.error(`Payment recorded, but failed to update invoice status: ${invoiceError.message}`);
    } else {
      await logActivity("Invoice Payment", { description: invoice.batch_description, amount: values.amount }, studentRecordForPayment.id);
    }

    onOpenChange(false);
    onSuccess(newPayment as Payment, studentRecordForPayment);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Collect Invoice Payment</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm bg-muted/30 p-3 rounded-md">
          <p><strong>Description:</strong> {invoice?.batch_description}</p>
          <p><strong>Total Amount:</strong> ₹{invoice?.total_amount.toFixed(2)}</p>
          <p><strong>Remaining Balance:</strong> ₹{((invoice?.total_amount || 0) - (invoice?.paid_amount || 0)).toFixed(2)}</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="payment_year" render={({ field }) => (
                <FormItem><FormLabel>Year Attribution</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Year..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.keys(masterFeeDetails).map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="term_name" render={({ field }) => (
                <FormItem><FormLabel>Term Attribution</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Term..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FIXED_TERMS.map(term => <SelectItem key={term.id} value={term.name}>{term.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
            </div>
            <FormDescription className="text-[10px] mt-0">Payments will also debit balances from the year/term selected above.</FormDescription>

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount to Collect</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="payment_method" render={({ field }) => (
              <FormItem><FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Processing..." : "Confirm Payment"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}