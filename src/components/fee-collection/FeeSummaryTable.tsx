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

interface FeeSummaryTableProps {
  data: any | null; // Keep for compatibility if needed, but we'll use student/payments
  onPay: (year: string, term: string) => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
  payments?: Payment[]; // We'll need payments for term-level totals
}

export function FeeSummaryTable({ student, payments = [], onPay, isReadOnly = false }: FeeSummaryTableProps) {
  if (!student) return null;

  const years = Object.keys(student.fee_details).sort((a, b) => a.localeCompare(b));
  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  // Calculate detailed grid data
  const yearlyGrids = useMemo(() => {
    const grids: any = {};

    years.forEach(year => {
      const items = student.fee_details[year] || [];
      const feeTypes = Array.from(new Set(items.map(i => i.name))).sort();
      
      grids[year] = {
        feeTypes,
        matrix: feeTypes.reduce((acc: any, type) => {
          acc[type] = sortedTerms.reduce((tAcc: any, term) => {
            const match = items.find(i => i.name === type && i.term_name === term.name);
            tAcc[term.name] = {
              amount: match?.amount || 0,
              concession: match?.concession || 0,
              net: (match?.amount || 0) - (match?.concession || 0)
            };
            return tAcc;
          }, {});
          return acc;
        }, {}),
        termTotals: sortedTerms.reduce((acc: any, term) => {
          const totalNet = items
            .filter(i => i.term_name === term.name)
            .reduce((sum, i) => sum + (i.amount - i.concession), 0);
          
          const paid = payments
            .filter(p => p.fee_type.startsWith(`${year} - ${term.name}`))
            .reduce((sum, p) => sum + p.amount, 0);

          acc[term.name] = {
            total: totalNet,
            paid: paid,
            balance: Math.max(0, totalNet - paid)
          };
          return acc;
        }, {})
      };
    });

    return grids;
  }, [student, payments, years, sortedTerms]);

  const overallBalance = Object.values(yearlyGrids).reduce((sum: number, year: any) => {
    return sum + Object.values(year.termTotals).reduce((tSum: number, t: any) => tSum + t.balance, 0);
  }, 0);

  return (
    <div className="space-y-8">
      {years.map((year) => {
        const grid = yearlyGrids[year];
        const yearBalance = Object.values(grid.termTotals).reduce((sum: number, t: any) => sum + t.balance, 0);

        return (
          <Card key={year} className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{year} Fee Details</CardTitle>
                  <CardDescription>Breakdown of fees across terms.</CardDescription>
                </div>
                <div className={cn("text-lg font-bold", yearBalance > 0 ? "text-red-600" : "text-green-600")}>
                  Year Balance: ₹{yearBalance.toFixed(2)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] pl-6 bg-muted/10">Fee Type</TableHead>
                    {sortedTerms.map(term => (
                      <TableHead key={term.id} className="text-right min-w-[120px]">{term.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.feeTypes.map((type: string) => (
                    <TableRow key={type}>
                      <TableCell className="pl-6 font-medium bg-muted/5">{type}</TableCell>
                      {sortedTerms.map(term => {
                        const cell = grid.matrix[type][term.name];
                        return (
                          <TableCell key={term.id} className="text-right">
                            <div className="flex flex-col">
                              <span className={cn(cell.amount === 0 && "text-muted-foreground/40")}>
                                ₹{cell.amount.toFixed(2)}
                              </span>
                              {cell.concession > 0 && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  -₹{cell.concession.toFixed(2)} Conc.
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  
                  {/* Summary Rows */}
                  <TableRow className="border-t-2 bg-primary/5 font-bold">
                    <TableCell className="pl-6">Term Total</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right">
                        ₹{grid.termTotals[term.name].total.toFixed(2)}
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  <TableRow className="bg-green-50/50 text-green-700 font-bold">
                    <TableCell className="pl-6">Amount Paid</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right">
                        ₹{grid.termTotals[term.name].paid.toFixed(2)}
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow className="bg-red-50/30 text-red-600 font-bold">
                    <TableCell className="pl-6">Balance</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right">
                        ₹{grid.termTotals[term.name].balance.toFixed(2)}
                      </TableCell>
                    ))}
                  </TableRow>

                  {!isReadOnly && (
                    <TableRow className="bg-muted/5">
                      <TableCell className="pl-6 font-medium">Action</TableCell>
                      {sortedTerms.map(term => (
                        <TableCell key={term.id} className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => onPay(year, term.name)} 
                            disabled={grid.termTotals[term.name].balance <= 0}
                            className="w-20"
                            variant={grid.termTotals[term.name].balance <= 0 ? "outline" : "default"}
                          >
                            {grid.termTotals[term.name].balance <= 0 ? "Paid" : "Pay"}
                          </Button>
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end p-6 rounded-lg bg-primary text-primary-foreground">
        <div className="text-right">
          <p className="text-sm opacity-80">Total Outstanding Balance (All Years)</p>
          <p className="text-4xl font-bold">₹{overallBalance.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}