"use client";
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, RotateCcw } from "lucide-react";
import { Payment, StudentDetails, CashierProfile } from "@/types";
import { generateReceiptHtml } from '@/lib/receipt-generator';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PaymentHistoryProps {
  payments: Payment[];
  student: StudentDetails;
  cashierProfile?: CashierProfile | null;
  isReadOnly?: boolean;
  onRevert?: (payment: Payment) => Promise<void>;
  userRole?: string | null;
}

export function PaymentHistory({ 
    payments, 
    student, 
    cashierProfile = null, 
    isReadOnly = false, 
    onRevert,
    userRole 
}: PaymentHistoryProps) {
  const [isPrinting, setIsPrinting] = React.useState<string | null>(null);
  const [paymentToRevert, setPaymentToRevert] = React.useState<Payment | null>(null);

  const handlePrint = async (payment: Payment) => {
    setIsPrinting(payment.id);
    const receiptHtml = await generateReceiptHtml(student, payment, cashierProfile?.name || null);
    
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setIsPrinting(null);
      }, 250);
    } else {
      toast.error("Could not open print window. Please disable your pop-up blocker.");
      setIsPrinting(null);
    }
  };

  // Determine if user has revert permission
  const canRevert = userRole === 'admin' || userRole === 'superadmin' || userRole === 'superior' || cashierProfile?.has_revert_permission;

  return (
    <>
      <Card className="print-hidden">
        <CardHeader>
          <CardTitle>Overall Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length > 0 ? (
                payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs font-medium">{p.fee_type}</TableCell>
                    <TableCell className="text-right font-bold">₹{p.amount.toFixed(2)}</TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        {canRevert && onRevert && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
                                onClick={() => setPaymentToRevert(p)}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert
                            </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => handlePrint(p)}
                          disabled={!!isPrinting}
                        >
                          {isPrinting === p.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Printer className="mr-1 h-3.5 w-3.5" />
                          )}
                          Print
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isReadOnly ? 3 : 4} className="text-center py-8 text-muted-foreground italic text-sm">No payments recorded.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!paymentToRevert} onOpenChange={(open) => !open && setPaymentToRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the record of this ₹{paymentToRevert?.amount.toLocaleString()} payment and update any related invoice balances. This action is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                className="bg-rose-600 hover:bg-rose-700"
                onClick={async () => {
                    if (paymentToRevert && onRevert) {
                        await onRevert(paymentToRevert);
                        setPaymentToRevert(null);
                    }
                }}
            >
                Confirm Reversal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}