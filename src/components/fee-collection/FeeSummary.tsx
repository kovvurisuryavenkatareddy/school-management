"use client";

import React from "react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { FeeSummaryTable } from "@/components/fee-collection/FeeSummaryTable";
import { PaymentDialog } from "@/components/fee-collection/PaymentDialog";
import { EditConcessionDialog } from "@/components/fee-collection/EditConcessionDialog";
import { StudentDetails, Payment, CashierProfile, FIXED_TERMS, FeeSummaryData } from "@/types";
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

  const feeSummaryData: FeeSummaryData | null = useMemo(() => {
    if (studentRecords.length === 0) return null;

    // 1. Normalize all records to ensure they have term splitting
    const normalizedRecords = studentRecords.map(record => ({
      ...record,
      fee_details: normalizeFeeStructure(record.fee_details)
    }));

    // 2. Merge normalized fee structures across all years found in student records
    const mergedFeeDetails = normalizedRecords.reduce<{[year: string]: any[]}>((acc, record) => {
        if (record.fee_details) {
            Object.assign(acc, record.fee_details);
        }
        return acc;
    }, {});

    const years = Object.keys(mergedFeeDetails).sort();
    const summary: FeeSummaryData = {};

    // 3. Build summary from granular term-specific items
    years.forEach(year => {
        summary[year] = {};
        const feeItems = mergedFeeDetails[year] || [];

        feeItems.forEach(item => {
            const feeName = item.name;
            const termName = item.term_name;

            if (!summary[year][feeName]) {
                summary[year][feeName] = {};
                FIXED_TERMS.forEach(t => {
                    summary[year][feeName][t.name] = { total: 0, paid: 0, concession: 0, balance: 0 };
                });
            }

            if (summary[year][feeName][termName]) {
                summary[year][feeName][termName].total += item.amount;
                summary[year][feeName][termName].concession += item.concession;
            }
        });
    });

    // 4. Add payments to the summary
    payments.forEach(p => {
        const parts = p.fee_type.split(' - ');
        if (parts.length >= 3) {
            const year = parts[0].trim();
            const term = parts[1].trim();
            const feeType = parts.slice(2).join(' - ').trim();
            
            if (summary[year]?.[feeType]?.[term]) {
                summary[year][feeType][term].paid += p.amount;
            }
        }
    });

    // 5. Calculate final balances
    years.forEach(year => {
        Object.keys(summary[year]).forEach(feeType => {
            Object.keys(summary[year][feeType]).forEach(term => {
                const item = summary[year][feeType][term];
                item.balance = Math.max(0, item.total - item.concession - item.paid);
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
    setPaymentDialogInitialState({ fee_item_name: "", payment_year: "Other", term_name: "" });
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