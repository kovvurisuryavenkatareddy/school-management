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

  const feeSummaryData: FeeSummaryData | null = useMemo(() => {
    if (studentRecords.length === 0) return null;

    const normalizedRecords = studentRecords.map(record => ({
      ...record,
      fee_details: normalizeFeeStructure(record.fee_details)
    }));

    const mergedFeeDetails = normalizedRecords.reduce<{[year: string]: any[]}>((acc, record) => {
        if (record.fee_details) {
            Object.entries(record.fee_details).forEach(([year, items]) => {
              if (!acc[year]) acc[year] = [];
              acc[year] = [...acc[year], ...items];
            });
        }
        return acc;
    }, {});

    const summary: FeeSummaryData = {};

    Object.keys(mergedFeeDetails).forEach(year => {
        summary[year] = {};
        FIXED_TERMS.forEach(t => {
          summary[year][t.name] = { total: 0, paid: 0, concession: 0, balance: 0 };
        });

        const feeItems = mergedFeeDetails[year] || [];
        feeItems.forEach(item => {
            const termName = item.term_name;
            if (summary[year][termName]) {
                summary[year][termName].total += (item.amount || 0);
                summary[year][termName].concession += (item.concession || 0);
            }
        });
    });

    payments.forEach(p => {
        const parts = p.fee_type.split(' - ');
        if (parts.length >= 2) {
            const year = parts[0].trim();
            const term = parts[1].trim();
            if (summary[year]?.[term]) {
                summary[year][term].paid += p.amount;
            }
        }
    });

    Object.keys(summary).forEach(year => {
        Object.keys(summary[year]).forEach(term => {
            const item = summary[year][term];
            item.balance = Math.max(0, item.total - item.concession - item.paid);
        });
    });

    return summary;
  }, [studentRecords, payments]);

  const handlePayClick = (year: string, term: string) => {
    if (!feeSummaryData || !feeSummaryData[year]?.[term]) return;
    const termData = feeSummaryData[year][term];
    
    setPaymentContext({
      year,
      term,
      total: termData.total - termData.concession,
      paid: termData.paid,
      balance: termData.balance
    });
    setPaymentDialogOpen(true);
  };

  return (
    <>
      <FeeSummaryTable
        data={feeSummaryData}
        onPay={handlePayClick}
        student={studentRecords[0]}
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