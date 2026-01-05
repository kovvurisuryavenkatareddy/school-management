"use client";

import React from "react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { FeeSummaryTable } from "@/components/fee-collection/FeeSummaryTable";
import { PaymentDialog } from "@/components/fee-collection/PaymentDialog";
import { EditConcessionDialog } from "@/components/fee-collection/EditConcessionDialog";
import { StudentDetails, Payment, CashierProfile, FIXED_TERMS } from "@/types";
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
  const [paymentDialogInitialState, setPaymentDialogInitialState] = useState<{ fee_item_name: string, payment_year: string, term_name: string } | null>(null);

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
    } else {
      toast.error("Could not open print window. Please disable your pop-up blocker.");
    }
  };

  const handlePaymentSuccess = (newPayment: Payment, studentForReceipt: StudentDetails) => {
    onSuccess();
    toast.success("Payment recorded successfully!");
    handlePrint(studentForReceipt, newPayment);
  };

  const feeSummaryData: any = useMemo(() => { // Changed to any for now, will refine with FeeSummaryData type
    if (studentRecords.length === 0) return null;

    const mergedFeeDetails = studentRecords.reduce<{[year: string]: any[]}>((acc, record) => {
        if (record.fee_details) {
            Object.assign(acc, record.fee_details);
        }
        return acc;
    }, {});

    const years = Object.keys(mergedFeeDetails).sort();
    const allFeeTypeNames = new Set<string>();
    Object.values(mergedFeeDetails).forEach(items => {
        items.forEach(item => allFeeTypeNames.add(item.name));
    });
    const feeTypes = Array.from(allFeeTypeNames).sort();

    const paymentsByYearTermAndType: { [year: string]: { [term: string]: { [feeType: string]: number } } } = {};
    payments.forEach(p => {
        const parts = p.fee_type.split(' - ');
        if (parts.length >= 3) {
            const year = parts[0].trim();
            const term = parts[1].trim();
            const feeType = parts.slice(2).join(' - ').trim();
            
            if (!paymentsByYearTermAndType[year]) paymentsByYearTermAndType[year] = {};
            if (!paymentsByYearTermAndType[year][term]) paymentsByYearTermAndType[year][term] = {};
            
            paymentsByYearTermAndType[year][term][feeType] = (paymentsByYearTermAndType[year][term][feeType] || 0) + p.amount;
        }
    });

    const summary: any = {}; // Will be FeeSummaryData

    years.forEach(year => {
        summary[year] = {};
        FIXED_TERMS.forEach(term => {
            feeTypes.forEach(feeType => {
                if (!summary[year][feeType]) summary[year][feeType] = {};

                const feeItem = (mergedFeeDetails[year] || []).find(item => item.name === feeType && item.term_name === term.name);
                
                const total = feeItem?.amount || 0;
                const concession = feeItem?.concession || 0;
                const paid = paymentsByYearTermAndType[year]?.[term.name]?.[feeType] || 0;
                const balance = Math.max(0, total - concession - paid);

                summary[year][feeType][term.name] = { total, paid, concession, balance };
            });
        });
    });

    return summary;
  }, [studentRecords, payments]);

  const handlePayClick = (feeType: string, termName: string) => {
    const currentRecord = studentRecords.find(r => r.academic_years?.is_active) || studentRecords[studentRecords.length - 1];
    const currentStudyingYear = currentRecord?.studying_year || "";

    setPaymentDialogInitialState({ fee_item_name: feeType, payment_year: currentStudyingYear, term_name: termName });
    setPaymentDialogOpen(true);
  };

  const handleCollectOtherClick = () => {
    setPaymentDialogInitialState({ fee_item_name: "", payment_year: "Other", term_name: "" }); // Term name not applicable for 'Other'
    setPaymentDialogOpen(true);
  };

  return (
    <>
      <FeeSummaryTable
        data={feeSummaryData}
        onPay={handlePayClick}
        onCollectOther={handleCollectOtherClick}
        hasDiscountPermission={cashierProfile?.has_discount_permission || false}
        onEditConcession={() => setEditConcessionDialogOpen(true)}
        student={studentRecords[0]}
      />
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        studentRecords={studentRecords}
        payments={payments}
        cashierProfile={cashierProfile}
        onSuccess={handlePaymentSuccess}
        logActivity={logActivity}
        initialState={paymentDialogInitialState}
      />
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