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
import { StudentDetails, Payment, CashierProfile } from "@/types";
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
  
  // Normalize the master record's fee structure
  const masterRecord = studentRecords[0];
  const feeStructure = useMemo(() => masterRecord ? normalizeFeeStructure(masterRecord.fee_details) : {}, [masterRecord]);
  
  // Extract all unique term names available for the selected academic year
  const availableTerms = useMemo(() => {
    const yearItems = feeStructure[initialYear] || [];
    // We only want terms that aren't the special "Total" / "Yearly Concession" item
    return Array.from(new Set(yearItems.map(item => item.term_name)))
      .filter(t => t && t !== 'Total')
      .sort((a, b) => a.localeCompare(b));
  }, [feeStructure, initialYear]);

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

  // Calculate balance for the selected term
  const termContext = useMemo(() => {
    if (!watchedTerm || !initialYear) return { total: 0, paid: 0, balance: 0 };
    
    const items = feeStructure[initialYear] || [];
    // Use inclusive matching for terms to handle legacy data or typos
    const termItems = items.filter(item => item.term_name.toLowerCase() === watchedTerm.toLowerCase());
    
    const total = termItems.reduce((sum, i) => sum + i.amount, 0);
    const paid = payments
        .filter(p => p.fee_type.toLowerCase().includes(`${initialYear} - ${watchedTerm}`.toLowerCase()))
        .reduce((sum, p) => sum + p.amount, 0);

    return {
      total,
      paid,
      balance: Math.max(0, total - paid)
    };
  }, [feeStructure, payments, initialYear, watchedTerm]);

  useEffect(() => {
    if (open) {
      form.setValue("term_name", initialTerm);
      // Small delay ensures the form logic registers the default term selection first
      const timer = setTimeout(() => {
        form.setValue("amount", parseFloat(termContext.balance.toFixed(2)));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, initialTerm, termContext.balance, form]);

  const isAmountValid = watchedAmount > 0 && watchedAmount <= (termContext.balance + 0.1);

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    if (!masterRecord) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Recording transaction...");

    try {
      const feeType = `${initialYear} - ${values.term_name}`;
      const paymentData = {
        amount: values.amount,
        payment_method: values.payment_method,
        notes: values.notes,
        fee_type: feeType,
        student_id: masterRecord.id,
        cashier_id: cashierProfile?.id || null,
        utr_number: values.payment_method === 'upi' ? values.utr_number : null,
      };

      const { data: newPayment, error } = await supabase.from("payments").insert([paymentData]).select().single();
      if (error) throw error;

      await logActivity("Fee Collection", { 
        term: values.term_name, 
        amount: values.amount, 
        academic_year: initialYear,
        full_label: feeType
      }, masterRecord.id);

      toast.success("Payment recorded successfully!", { id: toastId });
      onOpenChange(false);
      onSuccess(newPayment as Payment, masterRecord);
    } catch (err: any) {
      toast.error(`Payment failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect Payment ({initialYear})</DialogTitle></DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            
            <FormField control={form.control} name="term_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Term</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {availableTerms.map(term => (
                      <SelectItem key={term} value={term}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4 text-sm border shadow-inner">
              <div className="space-y-0.5">
                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Total Fee</p>
                <p className="font-black text-lg">₹{termContext.total.toLocaleString()}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Remaining</p>
                <p className={cn("font-black text-lg", termContext.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                    ₹{termContext.balance.toLocaleString()}
                </p>
              </div>
            </div>

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Collection Amount</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} className="h-11 text-lg font-bold" /></FormControl>
                {watchedAmount > termContext.balance + 0.1 && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">Warning: Entry exceeds calculated balance.</p>
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
              <FormItem><FormLabel>Receipt Comment (Optional)</FormLabel><FormControl><Input placeholder="Internal notes..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !isAmountValid || (watchedMethod === 'upi' && !form.getValues('utr_number')?.trim())}>
                {isSubmitting ? "Processing..." : "Confirm & Print Receipt"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');