"use client";

import React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { FeeSummaryTable } from "@/components/fee-collection/FeeSummaryTable";
import { PaymentDialog } from "@/components/fee-collection/PaymentDialog";
import { EditConcessionDialog } from "@/components/fee-collection/EditConcessionDialog";
import { StudentDetails, Payment, CashierProfile, FIXED_TERMS } from "@/types";
import { generateReceiptHtml } from "@/lib/receipt-generator";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";

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
  const [paymentContext, setPaymentContext] = useState<{ 
    year: string, 
    term: string, 
    total: number, 
    paid: number, 
    balance: number 
  } | null>(null);

  const handlePrint = (student: StudentDetails, payment: Payment) => {
    const receiptHtml = generateReceiptHtml(student, payment, cashierProfile?.name || null);
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
    // Re-calculate the specific context for the popup
    const record = studentRecords.find(r => r.studying_year === year) || studentRecords[0];
    if (!record) return;

    const normalized = normalizeFeeStructure(record.fee_details);
    const items = normalized[year] || [];
    
    const termTotal = items
        .filter(i => i.term_name === term)
        .reduce((sum, i) => sum + (i.amount - i.concession), 0);
    
    const termPaid = payments
        .filter(p => p.fee_type.startsWith(`${year} - ${term}`))
        .reduce((sum, p) => sum + p.amount, 0);

    setPaymentContext({
      year,
      term,
      total: termTotal,
      paid: termPaid,
      balance: Math.max(0, termTotal - termPaid)
    });
    setPaymentDialogOpen(true);
  };

  return (
    <>
      <FeeSummaryTable
        student={studentRecords[0]}
        payments={payments}
        onPay={handlePayClick}
        data={null} // Cleanup legacy prop
      />
      {paymentContext && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          studentRecords={studentRecords}
          cashierProfile={cashierProfile}
          onSuccess={handlePaymentSuccess}
          logActivity={logActivity}
          context={paymentContext}
        />
      )}
      <EditConcessionDialog
        open={editConcessionDialogOpen}
        onOpenChange={setEditConcessionDialogOpen}
        studentRecords={studentRecords}
        onSuccess={onSuccess}
        logActivity={logActivity}
      />
    </>
  );
}