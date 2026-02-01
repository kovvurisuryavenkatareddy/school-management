"use client";

import React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Invoice, StudentDetails, CashierProfile, Payment } from "@/types";
import { InvoicePaymentDialog } from "./InvoicePaymentDialog";
import { generateReceiptHtml } from "@/lib/receipt-generator";
import { toast } from "sonner";

interface OutstandingInvoicesProps {
  invoices: Invoice[];
  studentRecords: StudentDetails[];
  cashierProfile: CashierProfile | null;
  onSuccess: () => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
  isReadOnly?: boolean;
}

export function OutstandingInvoices({ invoices, studentRecords, cashierProfile, onSuccess, logActivity, isReadOnly = false }: OutstandingInvoicesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);

  const handlePayClick = (invoice: Invoice) => {
    setInvoiceToPay(invoice);
    setDialogOpen(true);
  };

  const handlePrint = async (student: StudentDetails, payment: Payment) => {
    const toastId = toast.loading("Preparing receipt...");
    const receiptHtml = await generateReceiptHtml(student, payment, cashierProfile?.name || null);
    
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        toast.dismiss(toastId);
      }, 250);
    } else {
      toast.error("Could not open print window. Please disable your pop-up blocker.", { id: toastId });
    }
  };

  const handlePaymentSuccess = (newPayment: Payment, studentRecord: StudentDetails) => {
    onSuccess();
    toast.success("Invoice payment recorded successfully!");
    handlePrint(studentRecord, newPayment);
  };

  if (invoices.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Outstanding Invoices</CardTitle>
          <CardDescription>Collect payments for generated invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead>{!isReadOnly && <TableHead>Action</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {invoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.batch_description.split(" for Class ")[0]}</TableCell>
                  <TableCell>{invoice.total_amount.toFixed(2)}</TableCell>
                  <TableCell className="font-medium">{(invoice.total_amount - (invoice.paid_amount || 0)).toFixed(2)}</TableCell>
                  {!isReadOnly && <TableCell><Button size="sm" onClick={() => handlePayClick(invoice)}>Collect Payment</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!isReadOnly && invoiceToPay && (
        <InvoicePaymentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          invoice={invoiceToPay}
          studentRecords={studentRecords}
          cashierProfile={cashierProfile}
          onSuccess={handlePaymentSuccess}
          logActivity={logActivity}
        />
      )}
    </>
  );
}