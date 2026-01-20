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
import { FIXED_TERMS, StudentDetails, Payment } from "@/types";
import { cn } from "@/lib/utils";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";

interface FeeSummaryTableProps {
  onPay: (year: string, term: string) => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
  payments?: Payment[]; 
  data?: any; // Kept for prop compatibility
}

export function FeeSummaryTable({ student, payments = [], onPay, isReadOnly = false }: FeeSummaryTableProps) {
  if (!student) return null;

  const normalizedFeeDetails = useMemo(() => normalizeFeeStructure(student.fee_details), [student.fee_details]);
  const years = Object.keys(normalizedFeeDetails).sort((a, b) => a.localeCompare(b));

  const yearlyData = useMemo(() => {
    const data: any = {};

    years.forEach(year => {
      const items = normalizedFeeDetails[year] || [];
      const concession = items.find(i => i.name === 'Yearly Concession')?.concession || 0;
      
      const termMetrics = ['Term 1', 'Term 2', 'Term 3'].map(termName => {
        const item = items.find(i => i.name === termName);
        const total = item?.amount || 0;
        
        // Find payments for this specific term
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

      const yearTotal = termMetrics.reduce((sum, t) => sum + t.total, 0);
      const yearPaid = termMetrics.reduce((sum, t) => sum + t.paid, 0);
      const yearBalance = Math.max(0, yearTotal - concession - yearPaid);

      data[year] = { termMetrics, yearTotal, yearPaid, yearBalance, concession };
    });

    return data;
  }, [normalizedFeeDetails, payments, years]);

  const overallBalance = Object.values(yearlyData).reduce((sum: number, y: any) => sum + y.yearBalance, 0);

  return (
    <div className="space-y-6">
      {years.map((year) => {
        const d = yearlyData[year];

        return (
          <Card key={year} className="overflow-hidden border-primary/10 shadow-md">
            <CardHeader className="bg-muted/40 border-b py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg text-primary">{year} Fee Summary</CardTitle>
                  <CardDescription className="text-xs">Consolidated term-wise collection status.</CardDescription>
                </div>
                <div className={cn("px-4 py-1.5 rounded-full text-sm font-bold border", 
                  d.yearBalance > 0 ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20" : "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20")}>
                  Balance: ₹{d.yearBalance.toLocaleString()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="pl-6 text-xs font-bold uppercase tracking-wider">Term</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Gross Fee</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Collected</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Remaining</TableHead>
                    {!isReadOnly && <TableHead className="w-[100px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.termMetrics.map((term: any) => (
                    <TableRow key={term.name} className="group hover:bg-muted/5">
                      <TableCell className="pl-6 font-bold text-sm text-muted-foreground">{term.name}</TableCell>
                      <TableCell className="text-right font-medium">₹{term.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">₹{term.paid.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500 font-black">₹{term.balance.toLocaleString()}</TableCell>
                      {!isReadOnly && (
                        <TableCell className="pr-6 text-right">
                          <Button 
                            size="sm" 
                            variant={term.balance <= 0 ? "outline" : "default"}
                            disabled={term.balance <= 0}
                            onClick={() => onPay(year, term.name)}
                            className="h-7 text-[10px] font-bold uppercase"
                          >
                            {term.balance <= 0 ? "Settled" : "Collect"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  
                  {/* Totals & Concession Row */}
                  <TableRow className="bg-muted/10 border-t-2">
                    <TableCell className="pl-6 font-bold text-sm">Yearly Concession</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-black text-green-600 dark:text-green-400">- ₹{d.concession.toLocaleString()}</TableCell>
                    {!isReadOnly && <TableCell></TableCell>}
                  </TableRow>

                  <TableRow className="bg-primary/5 font-black text-primary border-t">
                    <TableCell className="pl-6 text-sm">NET YEAR TOTAL</TableCell>
                    <TableCell className="text-right">₹{(d.yearTotal - d.concession).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{d.yearPaid.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-lg">₹{d.yearBalance.toLocaleString()}</TableCell>
                    {!isReadOnly && <TableCell></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end pt-4">
        <div className="bg-primary text-primary-foreground rounded-xl px-10 py-6 text-right shadow-xl">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-80 mb-2">Total Outstanding (All Academic Years)</p>
          <p className="text-4xl font-black font-ubuntu">₹{overallBalance.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}