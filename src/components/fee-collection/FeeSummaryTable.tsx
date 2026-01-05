"use client";

import React from "react";
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
import { FeeSummaryData, FIXED_TERMS, StudentDetails } from "@/types";
import { cn } from "@/lib/utils";

interface FeeSummaryTableProps {
  data: FeeSummaryData | null;
  onPay: (feeType: string, termName: string) => void;
  onCollectOther?: () => void;
  hasDiscountPermission?: boolean;
  onEditConcession?: (year: string) => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
}

export function FeeSummaryTable({ data, onPay, onCollectOther, isReadOnly = false, student }: FeeSummaryTableProps) {
  if (!data || !student) return null;

  const years = Object.keys(data).sort((a, b) => a.localeCompare(b));
  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  const calculateYearlyTotal = (year: string, field: 'total' | 'paid' | 'concession' | 'balance') => {
    let sum = 0;
    Object.values(data[year]).forEach(feeTypeData => {
      Object.values(feeTypeData).forEach(termData => {
        sum += termData[field] || 0;
      });
    });
    return sum;
  };

  const overallBalance = years.reduce((sum, year) => sum + calculateYearlyTotal(year, 'balance'), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fee Summary</CardTitle>
            <CardDescription>Breakdown of fees grouped by academic year and term.</CardDescription>
          </div>
          <div className="flex gap-2">
            {!isReadOnly && <Button onClick={onCollectOther}>Collect Other</Button>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {years.map((year) => {
            const yearTotal = calculateYearlyTotal(year, 'total');
            const yearPaid = calculateYearlyTotal(year, 'paid');
            const yearBalance = calculateYearlyTotal(year, 'balance');
            const yearConcession = calculateYearlyTotal(year, 'concession');

            return (
              <div key={year} className="border-b last:border-0">
                <div className="bg-muted/30 px-6 py-2 font-bold flex justify-between items-center border-y">
                  <span>{year} Fees</span>
                  <span className={cn("text-sm", yearBalance > 0 ? "text-red-600" : "text-green-600")}>
                    Balance: ₹{yearBalance.toFixed(2)}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Term</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      {!isReadOnly && <TableHead className="text-right pr-6">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTerms.map((term) => {
                      const feeTypesInTerm = Object.keys(data[year]).filter(ft => 
                        data[year][ft][term.name] && (data[year][ft][term.name].total > 0 || data[year][ft][term.name].paid > 0)
                      );

                      if (feeTypesInTerm.length === 0) return null;

                      return feeTypesInTerm.map((feeType, index) => {
                        const item = data[year][feeType][term.name];
                        return (
                          <TableRow key={`${year}-${term.name}-${feeType}`}>
                            {index === 0 && (
                              <TableCell rowSpan={feeTypesInTerm.length} className="pl-6 font-medium align-top pt-4">
                                {term.name}
                              </TableCell>
                            )}
                            <TableCell>{feeType}</TableCell>
                            <TableCell className="text-right">₹{(item.total - item.concession).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-green-600">₹{item.paid.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">₹{item.balance.toFixed(2)}</TableCell>
                            {!isReadOnly && (
                              <TableCell className="text-right pr-6">
                                <Button size="sm" variant="ghost" onClick={() => onPay(feeType, term.name)} disabled={item.balance <= 0}>
                                  Pay
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      });
                    })}
                  </TableBody>
                </Table>
                <div className="bg-muted/10 px-6 py-3 flex justify-end gap-8 text-sm font-semibold">
                   <div>Year Total: ₹{(yearTotal - yearConcession).toFixed(2)}</div>
                   <div className="text-green-700">Year Paid: ₹{yearPaid.toFixed(2)}</div>
                   <div className="text-red-700 underline decoration-2">Year Balance: ₹{yearBalance.toFixed(2)}</div>
                </div>
              </div>
            );
          })}
          
          <div className="p-6 bg-primary/5 border-t">
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm text-muted-foreground">Overall Outstanding Balance</span>
              <span className={cn("text-3xl font-bold", overallBalance > 0 ? "text-red-600" : "text-green-600")}>
                ₹{overallBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}