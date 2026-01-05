"use client";

import React from "react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { FeeSummaryTable } from "@/components/fee-collection/FeeSummaryTable";
import { PaymentDialog } from "@/components/fee-collection/PaymentDialog";
import { EditConcessionDialog } from "@/components/fee-collection/EditConcessionDialog";
import { StudentDetails, Payment, CashierProfile, FIXED_TERMS, FeeSummaryData } from "@/types";
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

  const feeSummaryData: FeeSummaryData | null = useMemo(() => {
    if (studentRecords.length === 0) return null;

    const mergedFeeDetails = studentRecords.reduce<{[year: string]: any[]}>((acc, record) => {
        if (record.fee_details) {
            Object.assign(acc, record.fee_details);
        }
        return acc;
    }, {});

    const years = Object.keys(mergedFeeDetails).sort();
    const summary: FeeSummaryData = {};

    // 1. Process base fees into term structure
    years.forEach(year => {
        summary[year] = {};
        const feeItems = mergedFeeDetails[year] || [];

        feeItems.forEach(item => {
            const feeName = item.name;
            if (!summary[year][feeName]) {
                summary[year][feeName] = {};
                FIXED_TERMS.forEach(t => {
                    summary[year][feeName][t.name] = { total: 0, paid: 0, concession: 0, balance: 0 };
                });
            }

            // Apply Business Rules for Splitting
            if (feeName === 'Tuition Fee') {
                // Split across Term 1 and Term 2
                summary[year][feeName]['Term 1'].total += item.amount / 2;
                summary[year][feeName]['Term 2'].total += item.amount / 2;
                summary[year][feeName]['Term 1'].concession += item.concession / 2;
                summary[year][feeName]['Term 2'].concession += item.concession / 2;
            } else if (feeName === 'JVD Fee') {
                // All in Term 3
                summary[year][feeName]['Term 3'].total += item.amount;
                summary[year][feeName]['Term 3'].concession += item.concession;
            } else {
                // Other fees (Management, etc.) go to Term 1 by default
                summary[year][feeName]['Term 1'].total += item.amount;
                summary[year][feeName]['Term 1'].concession += item.concession;
            }
        });
    });

    // 2. Add payments to the summary
    payments.forEach(p => {
        const parts = p.fee_type.split(' - ');
        if (parts.length >= 3) {
            const year = parts[0].trim();
            const term = parts[1].trim();
            const feeType = parts.slice(2).join(' - ').trim();
            
            if (summary[year]?.[feeType]?.[term]) {
                summary[year][feeType][term].paid += p.amount;
            }
        } else {
            // Handle legacy payments or "Other" payments by trying to find a match
            // This is a safety fallback
            const amount = p.amount;
            years.forEach(y => {
                Object.keys(summary[y]).forEach(ft => {
                    if (p.fee_type.includes(ft)) {
                        // If it doesn't have a term, put it in Term 1
                        if (summary[y][ft]['Term 1']) {
                           // summary[y][ft]['Term 1'].paid += amount; // Disabled to prevent double counting if not structured
                        }
                    }
                });
            });
        }
    });

    // 3. Calculate balances
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