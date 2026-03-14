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
import { MultiSelect } from "@/components/ui/multi-select";

const paymentSchema = z.object({
  term_names: z.array(z.string()).min(1, "Please select at least one term"),
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
      term_names: [initialTerm],
      amount: 0, 
      payment_method: "cash", 
      notes: "", 
      utr_number: "" 
    },
  });
  
  const watchedTerms = form.watch("term_names") || [];
  const watchedAmount = form.watch("amount");
  const watchedMethod = form.watch("payment_method");

  // Calculate dynamic context based on selected terms
  const selectionContext = useMemo(() => {
    const record = studentRecords[0];
    if (!record || watchedTerms.length === 0) return { total: 0, paid: 0, balance: 0, termBalances: {} };
    
    const normalized = normalizeFeeStructure(record.fee_details);
    const items = normalized[initialYear] || [];
    
    let total = 0;
    let paid = 0;
    const termBalances: Record<string, number> = {};

    watchedTerms.forEach(termName => {
      const termItems = items.filter(item => item.term_name === termName);
      const termTotal = termItems.reduce((sum, i) => sum + i.amount, 0);
      
      const termPaid = payments
        .filter(p => p.fee_type === `${initialYear} - ${termName}`)
        .reduce((sum, p) => sum + p.amount, 0);

      const termBalance = Math.max(0, termTotal - termPaid);
      
      total += termTotal;
      paid += termPaid;
      termBalances[termName] = termBalance;
    });

    return {
      total,
      paid,
      balance: Math.max(0, total - paid),
      termBalances
    };
  }, [studentRecords, payments, initialYear, watchedTerms]);

  useEffect(() => {
    if (open) {
      form.setValue("term_names", [initialTerm]);
      const timer = setTimeout(() => {
        form.setValue("amount", parseFloat(selectionContext.balance.toFixed(2)));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, initialTerm]);

  // Update amount when selection changes
  useEffect(() => {
    if (open) {
        form.setValue("amount", parseFloat(selectionContext.balance.toFixed(2)));
    }
  }, [watchedTerms.length, selectionContext.balance]);

  const isAmountValid = watchedAmount > 0 && watchedAmount <= (selectionContext.balance + 0.1);

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    const studentRecord = studentRecords[0];
    if (!studentRecord) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Recording transactions...");

    try {
      let remainingToDistribute = values.amount;
      const createdPayments: Payment[] = [];

      // Loop through selected terms and create individual payment records
      for (const termName of values.term_names) {
        if (remainingToDistribute <= 0) break;

        const termMax = selectionContext.termBalances[termName] || 0;
        // If it's the last term, give it all the remaining money (handles overpayments)
        const isLastTerm = termName === values.term_names[values.term_names.length - 1];
        const amountForThisTerm = isLastTerm ? remainingToDistribute : Math.min(remainingToDistribute, termMax);

        if (amountForThisTerm <= 0) continue;

        const feeType = `${initialYear} - ${termName}`;
        const paymentData = {
          amount: amountForThisTerm,
          payment_method: values.payment_method,
          notes: values.notes,
          fee_type: feeType,
          student_id: studentRecord.id,
          cashier_id: cashierProfile?.id || null,
          utr_number: values.payment_method === 'upi' ? values.utr_number : null,
        };

        const { data: newPayment, error } = await supabase.from("payments").insert([paymentData]).select().single();
        if (error) throw error;
        
        createdPayments.push(newPayment as Payment);
        remainingToDistribute -= amountForThisTerm;
      }

      await logActivity("Multi-Term Fee Collection", { 
        terms: values.term_names, 
        total_amount: values.amount, 
        academic_year: initialYear 
      }, studentRecord.id);

      toast.success("Payments recorded successfully!", { id: toastId });
      onOpenChange(false);
      
      // Use the last created payment as the anchor for the receipt
      if (createdPayments.length > 0) {
        onSuccess(createdPayments[createdPayments.length - 1], studentRecord);
      }
    } catch (err: any) {
      toast.error(`Payment failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect Payment - {initialYear}</DialogTitle></DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField control={form.control} name="term_names" render={({ field }) => (
              <FormItem>
                <FormLabel>Select Term(s)</FormLabel>
                <MultiSelect
                  options={FIXED_TERMS.map(t => ({ label: t.name, value: t.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select terms to pay..."
                />
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3 text-sm border">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase font-semibold">Selected Total</p>
                <p className="font-bold">₹{selectionContext.total.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase font-semibold">Remaining Balance</p>
                <p className="font-bold text-red-600">₹{selectionContext.balance.toLocaleString()}</p>
              </div>
            </div>

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Total Amount to Pay</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                {watchedAmount > selectionContext.balance + 0.1 && (
                  <p className="text-[0.8rem] font-medium text-destructive">Warning: Amount exceeds selected balance.</p>
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