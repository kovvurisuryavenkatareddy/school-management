"use client";
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { Payment, StudentDetails, CashierProfile } from "@/types";
import { generateReceiptHtml } from '@/lib/receipt-generator';
import { toast } from 'sonner';

interface PaymentHistoryProps {
  payments: Payment[];
  student: StudentDetails;
  cashierProfile?: CashierProfile | null;
  isReadOnly?: boolean;
}

export function PaymentHistory({ payments, student, cashierProfile = null, isReadOnly = false }: PaymentHistoryProps) {
  const [isPrinting, setIsPrinting] = React.useState<string | null>(null);

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

  return (
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
                  <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{p.fee_type}</TableCell>
                  <TableCell className="text-right">₹{p.amount.toFixed(2)}</TableCell>
                  {!isReadOnly && (
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePrint(p)}
                        disabled={!!isPrinting}
                      >
                        {isPrinting === p.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="mr-2 h-4 w-4" />
                        )}
                        Print
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isReadOnly ? 3 : 4} className="text-center">No payments recorded.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}