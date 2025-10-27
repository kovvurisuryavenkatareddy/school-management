"use client";

import { useFeeCollection } from "@/hooks/use-fee-collection";
import { StudentSearch } from "@/components/fee-collection/StudentSearch";
import { StudentDetailsCard } from "@/components/fee-collection/StudentDetailsCard";
import { FeeSummary } from "@/components/fee-collection/FeeSummary";
import { OutstandingInvoices } from "@/components/fee-collection/OutstandingInvoices";
import { PaymentHistory } from "@/components/fee-collection/PaymentHistory";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BulkPaymentUpload } from "@/components/fee-collection/BulkPaymentUpload";

export default function FeeCollectionPage() {
  const { state, actions } = useFeeCollection();
  const { academicYears, isSearching, studentRecords, payments, invoices, cashierProfile, isInitializing } = state;
  const { searchStudent, refetchStudent, logActivity } = actions;

  const hasStudent = studentRecords.length > 0;

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Initializing Fee Collection...</p>
      </div>
    );
  }

  if (!cashierProfile && !isInitializing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Could not load cashier profile. You may not have the required permissions to access this page. Please try logging out and back in.</CardDescription>
        </CardHeader>
      </Card>
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

      <BulkPaymentUpload cashierProfile={cashierProfile} academicYears={academicYears} />

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
            />
          </div>
        </>
      )}
    </div>
  );
}