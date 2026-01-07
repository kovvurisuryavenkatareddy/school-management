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
  onPay: (year: string, term: string) => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
}

export function FeeSummaryTable({ data, onPay, isReadOnly = false, student }: FeeSummaryTableProps) {
  if (!data || !student) return null;

  const years = Object.keys(data).sort((a, b) => a.localeCompare(b));
  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  const calculateYearlyTotal = (year: string, field: 'total' | 'paid' | 'concession' | 'balance') => {
    let sum = 0;
    Object.values(data[year]).forEach(termData => {
      sum += termData[field] || 0;
    });
    return sum;
  };

  const overallBalance = years.reduce((sum, year) => sum + calculateYearlyTotal(year, 'balance'), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Term-Wise Fee Summary</CardTitle>
          <CardDescription>Consolidated fee structure at the Term level.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {years.map((year) => {
            const yearBalance = calculateYearlyTotal(year, 'balance');

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
                      <TableHead className="pl-6">Term Name</TableHead>
                      <TableHead className="text-right">Term Amount</TableHead>
                      <TableHead className="text-right">Paid Amount</TableHead>
                      <TableHead className="text-right">Balance Amount</TableHead>
                      {!isReadOnly && <TableHead className="text-right pr-6">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTerms.map((term) => {
                      const item = data[year][term.name];
                      if (!item || (item.total === 0 && item.paid === 0)) return null;

                      return (
                        <TableRow key={`${year}-${term.name}`}>
                          <TableCell className="pl-6 font-medium">{term.name}</TableCell>
                          <TableCell className="text-right">₹{(item.total - item.concession).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-green-600">₹{item.paid.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">₹{item.balance.toFixed(2)}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right pr-6">
                              <Button 
                                size="sm" 
                                onClick={() => onPay(year, term.name)} 
                                disabled={item.balance <= 0}
                                variant={item.balance <= 0 ? "outline" : "default"}
                              >
                                {item.balance <= 0 ? "Paid" : "Pay"}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
          
          <div className="p-6 bg-primary/5 border-t">
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm text-muted-foreground">Total Outstanding Balance</span>
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