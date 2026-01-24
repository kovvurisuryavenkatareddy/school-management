"use client";

import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudentDetails, Payment, CashierProfile } from "@/types";
import { cn } from "@/lib/utils";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";
import { Settings2 } from "lucide-react";

interface FeeSummaryTableProps {
  onPay: (year: string, term: string) => void;
  onEditConcession: () => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
  payments?: Payment[]; 
  cashierProfile?: CashierProfile | null;
}

export function FeeSummaryTable({ student, payments = [], onPay, onEditConcession, isReadOnly = false, cashierProfile }: FeeSummaryTableProps) {
  if (!student) return null;

  const normalizedFeeDetails = useMemo(() => normalizeFeeStructure(student.fee_details), [student.fee_details]);
  const years = Object.keys(normalizedFeeDetails).sort((a, b) => a.localeCompare(b));

  const tableData = useMemo(() => {
    return years.map(year => {
      const items = normalizedFeeDetails[year] || [];
      const concession = items.find(i => i.name === 'Yearly Concession')?.concession || 0;
      
      const metrics = ['Term 1', 'Term 2', 'Term 3'].map(termName => {
        const item = items.find(i => i.name === termName);
        const total = item?.amount || 0;
        const paid = payments
          .filter(p => p.fee_type.includes(`${year} - ${termName}`))
          .reduce((sum, p) => sum + p.amount, 0);

        return {
          name: termName,
          total,
          paid,
          balance: Math.max(0, total - paid)
        };
      });

      return { year, metrics, concession };
    });
  }, [normalizedFeeDetails, payments, years]);

  const feeRows = [
    { label: "Term - 1 tuition fee", termKey: "Term 1" },
    { label: "Term - 2 tuition fee", termKey: "Term 2" },
    { label: "Term - 3 jvd fee", termKey: "Term 3" },
    { label: "concession fee", isConcession: true },
  ];

  // Only show concession button if it's an admin or a cashier with Discount Permission
  const canEditDiscount = !cashierProfile || cashierProfile.has_discount_permission;

  return (
    <Card className="overflow-hidden border-primary/10 shadow-lg">
      <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-ubuntu text-primary">Student Fee Summary</CardTitle>
          <CardDescription className="text-xs">Year-wise breakdown of tuition and JVD fees.</CardDescription>
        </div>
        {!isReadOnly && canEditDiscount && (
          <Button variant="outline" size="sm" onClick={onEditConcession} className="gap-2 h-8 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            Edit Yearly Concession
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6 font-black uppercase tracking-widest text-xs">Fee Description</TableHead>
                {years.map(year => (
                  <TableHead key={year} className="text-center font-black uppercase tracking-widest text-xs">
                    {year}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeRows.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="pl-6 font-medium text-sm text-muted-foreground whitespace-nowrap">
                    {row.label}
                  </TableCell>
                  {tableData.map((yearData) => {
                    if (row.isConcession) {
                      return (
                        <TableCell key={yearData.year} className="text-center font-bold text-green-600">
                          ₹{yearData.concession.toLocaleString()}
                        </TableCell>
                      );
                    }
                    const metric = yearData.metrics.find(m => m.name === row.termKey);
                    return (
                      <TableCell key={yearData.year} className="text-center">
                        <div className="flex flex-col items-center">
                          <span className={cn("text-sm font-black", metric?.balance === 0 ? "text-green-600" : "text-red-500")}>
                            ₹{metric?.balance.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase opacity-70">
                            of ₹{metric?.total.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}

              {!isReadOnly && (
                <TableRow className="bg-muted/10">
                  <TableCell className="pl-6 font-black text-xs uppercase tracking-tighter text-primary">
                    Action
                  </TableCell>
                  {tableData.map((yearData) => {
                    const firstUnpaidTerm = yearData.metrics.find(m => m.balance > 0);
                    return (
                      <TableCell key={yearData.year} className="text-center">
                        <Button 
                          variant={firstUnpaidTerm ? "default" : "outline"}
                          size="sm"
                          disabled={!firstUnpaidTerm}
                          onClick={() => firstUnpaidTerm && onPay(yearData.year, firstUnpaidTerm.name)}
                          className="h-8 min-w-[80px] text-[10px] font-black uppercase tracking-wider"
                        >
                          {firstUnpaidTerm ? "Pay" : "Settled"}
                        </Button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}