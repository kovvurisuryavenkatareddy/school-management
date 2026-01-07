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
import { StudentDetails, Payment, CashierProfile } from "@/types";

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.enum(["cash", "upi"]),
  notes: z.string().optional(),
  utr_number: z.string().optional(),
});

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentRecords: StudentDetails[];
  cashierProfile: CashierProfile | null;
  onSuccess: (newPayment: Payment, studentRecord: StudentDetails) => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
  context: { 
    year: string, 
    term: string, 
    total: number, 
    paid: number, 
    balance: number 
  };
}

export function PaymentDialog({ open, onOpenChange, studentRecords, cashierProfile, onSuccess, logActivity, context }: PaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: context.balance, payment_method: "cash", notes: "", utr_number: "" },
  });
  
  const watchedAmount = form.watch("amount");
  const watchedMethod = form.watch("payment_method");

  // Immediate validation logic
  const isAmountValid = watchedAmount > 0 && watchedAmount <= context.balance;
  const isUtrRequired = watchedMethod === 'upi' && (!form.getValues("utr_number")?.trim());

  useEffect(() => {
    if (open) {
      form.reset({
        amount: parseFloat(context.balance.toFixed(2)),
        payment_method: "cash",
        notes: "",
        utr_number: "",
      });
    }
  }, [open, context]);

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    if (!isAmountValid) {
      toast.error("Invalid amount. Amount must be less than or equal to balance.");
      return;
    }

    const studentRecord = studentRecords.find(r => r.studying_year === context.year) || studentRecords[0];
    if (!studentRecord) return;

    setIsSubmitting(true);
    const feeType = `${context.year} - ${context.term}`;
    
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
      await logActivity("Term Fee Collection", { ...values, fee_type: feeType }, studentRecord.id);
      onOpenChange(false);
      onSuccess(newPayment as Payment, studentRecord);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Term Payment Collection</DialogTitle></DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 text-sm mb-4 border">
          <div className="space-y-1">
            <p className="text-muted-foreground">Term Name</p>
            <p className="font-bold">{context.term}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Total Amount</p>
            <p className="font-bold">₹{context.total.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Already Paid</p>
            <p className="font-bold text-green-600">₹{context.paid.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Remaining Balance</p>
            <p className="font-bold text-red-600">₹{context.balance.toFixed(2)}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Enter Amount to Pay</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                {watchedAmount > context.balance && (
                  <p className="text-[0.8rem] font-medium text-destructive">Amount exceeds remaining balance!</p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="payment_method" render={({ field }) => (
              <FormItem><FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem></SelectContent>
                </Select>
              <FormMessage /></FormItem>
            )} />

            {watchedMethod === 'upi' && (
              <FormField control={form.control} name="utr_number" render={({ field }) => (
                <FormItem><FormLabel>UTR Number</FormLabel><FormControl><Input placeholder="Enter UTR number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Note (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="pt-4">
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