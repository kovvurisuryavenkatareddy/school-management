"use client";

import { useFeeCollection } from "@/hooks/use-fee-collection";
import { StudentSearch } from "@/components/fee-collection/StudentSearch";
import { StudentDetailsCard } from "@/components/fee-collection/StudentDetailsCard";
import { FeeSummary } from "@/components/fee-collection/FeeSummary";
import { OutstandingInvoices } from "@/components/fee-collection/OutstandingInvoices";
import { PaymentHistory } from "@/components/fee-collection/PaymentHistory";
import { BulkPaymentUpload } from "@/components/fee-collection/BulkPaymentUpload";

export function FeeCollectionView() {
  const { state, actions } = useFeeCollection();
  const { academicYears, isSearching, studentRecords, payments, invoices, cashierProfile, userRole, isInitializing } = state;
  const { searchStudent, refetchStudent, logActivity } = actions;

  const hasStudent = studentRecords.length > 0;

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Initializing Fee Collection...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StudentSearch
        academicYears={academicYears}
        onSearch={searchStudent}
        isSearching={isSearching}
        isInitializing={isInitializing}
      />

      {userRole === 'admin' && <BulkPaymentUpload cashierProfile={cashierProfile} academicYears={academicYears} />}

      {hasStudent && (
        <>
          <StudentDetailsCard student={studentRecords[0]} />
          <div className="space-y-6">
            <FeeSummary
              studentRecords={studentRecords}
              payments={payments}
              cashierProfile={cashierProfile}
              onSuccess={refetchStudent}
              logActivity={logActivity}
            />
            <OutstandingInvoices
              invoices={invoices}
              studentRecords={studentRecords}
              cashierProfile={cashierProfile}
              onSuccess={refetchStudent}
              logActivity={logActivity}
            />
            <PaymentHistory
              payments={payments}
              student={studentRecords[0]}
              cashierProfile={cashierProfile}
            />
          </div>
        </>
      )}
    </div>
  );
}