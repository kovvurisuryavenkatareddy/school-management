"use client";

import React from "react";
import { useEffect, useState, useMemo } from "react";
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
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";

const paymentSchema = z.object({
  term_name: z.string().min(1, "Please select a term"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.enum(["cash", "upi"]),
  notes: z.string().optional(),
  utr_number: z.string().optional(),
});

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRecords: StudentDetails[];
  payments: Payment[];
  cashierProfile: CashierProfile | null;
  onSuccess: (newPayment: Payment, studentRecord: StudentDetails) => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
  initialYear: string;
  initialTerm: string;
}

export function PaymentDialog({ 
  open, 
  onOpenChange, 
  studentRecords, 
  payments, 
  cashierProfile, 
  onSuccess, 
  logActivity, 
  initialYear, 
  initialTerm 
}: PaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { 
      term_name: initialTerm,
      amount: 0, 
      payment_method: "cash", 
      notes: "", 
      utr_number: "" 
    },
  });
  
  const watchedTerm = form.watch("term_name");
  const watchedAmount = form.watch("amount");
  const watchedMethod = form.watch("payment_method");

  // Calculate dynamic context based on selected term
  const termContext = useMemo(() => {
    const record = studentRecords.find(r => r.studying_year === initialYear) || studentRecords[0];
    if (!record) return { total: 0, paid: 0, balance: 0, breakdown: [] };
    
    const normalized = normalizeFeeStructure(record.fee_details);
    const items = normalized[initialYear] || [];
    const termItems = items.filter(item => item.term_name === watchedTerm && item.amount > 0);
    
    const total = termItems.reduce((sum, i) => sum + i.amount, 0);
    const paid = payments
        .filter(p => p.fee_type.startsWith(`${initialYear} - ${watchedTerm}`))
        .reduce((sum, p) => sum + p.amount, 0);

    return {
      total,
      paid,
      balance: Math.max(0, total - paid),
      breakdown: termItems
    };
  }, [studentRecords, payments, initialYear, watchedTerm]);

  useEffect(() => {
    if (open) {
      form.setValue("term_name", initialTerm);
      form.setValue("amount", parseFloat(termContext.balance.toFixed(2)));
    }
  }, [open, initialTerm, termContext.balance, form]);

  const isAmountValid = watchedAmount > 0 && watchedAmount <= (termContext.balance + 0.01);

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    const studentRecord = studentRecords.find(r => r.studying_year === initialYear) || studentRecords[0];
    if (!studentRecord) return;

    setIsSubmitting(true);
    const feeType = `${initialYear} - ${values.term_name}`;
    
    const paymentData = {
        amount: values.amount,
        payment_method: values.payment_method,
        notes: values.notes,
        fee_type: feeType,
        student_id: studentRecord.id,
        cashier_id: cashierProfile?.id || null,
        utr_number: values.payment_method === 'upi' ? values.utr_number : null,
    };

    const { data: newPayment, error } = await supabase.from("payments").insert([paymentData]).select().single();
    if (error) {
      toast.error(`Payment failed: ${error.message}`);
    } else {
      await logActivity("Term Fee Collection", { ...values, fee_type: feeType, academic_year: initialYear }, studentRecord.id);
      onOpenChange(false);
      onSuccess(newPayment as Payment, studentRecord);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect Payment - {initialYear}</DialogTitle></DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField control={form.control} name="term_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Select Term</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {FIXED_TERMS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Term Summary Display */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3 text-sm border">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase font-semibold">Term Total</p>
                <p className="font-bold">₹{termContext.total.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase font-semibold">Remaining Balance</p>
                <p className="font-bold text-red-600">₹{termContext.balance.toLocaleString()}</p>
              </div>
            </div>

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Amount to Pay</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                {watchedAmount > termContext.balance && (
                  <p className="text-[0.8rem] font-medium text-destructive">Warning: Amount exceeds balance.</p>
                )}
                <FormMessage />
              </FormItem>
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

              {watchedMethod === 'upi' && (
                <FormField control={form.control} name="utr_number" render={({ field }) => (
                  <FormItem><FormLabel>UTR Number</FormLabel><FormControl><Input placeholder="UTR #" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Note (Optional)</FormLabel><FormControl><Input placeholder="Add a comment..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !isAmountValid || (watchedMethod === 'upi' && !form.getValues('utr_number')?.trim())}>
                {isSubmitting ? "Processing..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}