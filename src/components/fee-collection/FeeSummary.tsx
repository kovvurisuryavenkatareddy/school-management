"use client";

import React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { FeeSummaryTable } from "@/components/fee-collection/FeeSummaryTable";
import { PaymentDialog } from "@/components/fee-collection/PaymentDialog";
import { EditConcessionDialog } from "@/components/fee-collection/EditConcessionDialog";
import { StudentDetails, Payment, CashierProfile } from "@/types";
import { generateReceiptHtml } from "@/lib/receipt-generator";

interface FeeSummaryProps {
  studentRecords: StudentDetails[];
  payments: Payment[];
  cashierProfile: CashierProfile | null;
  onSuccess: () => void;
  logActivity: (action: string, details: object, studentId: string) => Promise<void>;
}

export function FeeSummary({ studentRecords, payments, cashierProfile, onSuccess, logActivity }: FeeSummaryProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editConcessionDialogOpen, setEditConcessionDialogOpen] = useState(false);
  const [initialContext, setInitialContext] = useState<{ year: string, term: string } | null>(null);

  const handlePrint = async (student: StudentDetails, payment: Payment) => {
    const receiptHtml = await generateReceiptHtml(student, payment, cashierProfile?.name || null);
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handlePaymentSuccess = (newPayment: Payment, studentForReceipt: StudentDetails) => {
    onSuccess();
    toast.success("Payment recorded successfully!");
    handlePrint(studentForReceipt, newPayment);
  };

  const handlePayClick = (year: string, term: string) => {
    setInitialContext({ year, term });
    setPaymentDialogOpen(true);
  };

  return (
    <>
      <FeeSummaryTable
        student={studentRecords[0]}
        payments={payments}
        onPay={handlePayClick}
        onEditConcession={() => setEditConcessionDialogOpen(true)}
        cashierProfile={cashierProfile}
      />
      {initialContext && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          studentRecords={studentRecords}
          payments={payments}
          cashierProfile={cashierProfile}
          onSuccess={handlePaymentSuccess}
          logActivity={logActivity}
          initialYear={initialContext.year}
          initialTerm={initialContext.term}
        />
      )}
      <EditConcessionDialog
        open={editConcessionDialogOpen}
        onOpenChange={setEditConcessionDialogOpen}
        studentRecords={studentRecords}
        onSuccess={onSuccess}
        logActivity={logActivity}
        cashierProfile={cashierProfile}
      />
    </>
  );
}