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
import { Invoice, StudentDetails, CashierProfile, Payment } from "@/types";

const invoicePaymentSchema = z.object({
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

  useEffect(() => {
    if (invoice && open) {
      const remainingBalance = invoice.total_amount - (invoice.paid_amount || 0);
      form.reset({
        amount: parseFloat(remainingBalance.toFixed(2)),
        payment_method: "cash",
        notes: "",
        utr_number: "",
      });
    }
  }, [invoice, open, form]);

  const onSubmit = async (values: z.infer<typeof invoicePaymentSchema>) => {
    const studentRecordForPayment = studentRecords[0];
    if (!studentRecordForPayment) {
      toast.error("Cannot process payment. Missing student context.");
      return;
    }
    setIsSubmitting(true);

    // fee_type for invoices is just the descriptive label, it won't affect the summary table logic
    const feeTypeLabel = `Invoice: ${invoice.batch_description}`;

    const paymentData = {
      student_id: studentRecordForPayment.id,
      cashier_id: cashierProfile?.id || null,
      amount: values.amount,
      payment_method: values.payment_method,
      fee_type: feeTypeLabel,
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
      await logActivity("Invoice Payment", { 
        description: invoice.batch_description, 
        amount: values.amount,
        invoice_id: invoice.id 
      }, studentRecordForPayment.id);
    }

    onOpenChange(false);
    onSuccess(newPayment as Payment, studentRecordForPayment);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect Invoice Payment</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm bg-muted/30 p-4 rounded-lg border">
          <p><strong>Description:</strong> {invoice?.batch_description}</p>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span>Total Due: ₹{invoice?.total_amount.toLocaleString()}</span>
            <span className="font-bold text-primary">Balance: ₹{((invoice?.total_amount || 0) - (invoice?.paid_amount || 0)).toLocaleString()}</span>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel className="font-bold">Amount to Collect</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="payment_method" render={({ field }) => (
                <FormItem><FormLabel>Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem></SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              {watchedPaymentMethod === 'upi' && (
                <FormField control={form.control} name="utr_number" render={({ field }) => (
                  <FormItem><FormLabel>UTR Number</FormLabel><FormControl><Input placeholder="Enter UTR #" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Input placeholder="Receipt notes..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Processing..." : "Confirm Payment"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}