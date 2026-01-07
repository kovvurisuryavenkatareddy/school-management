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
  data: any | null; 
  onPay: (year: string, term: string) => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
  payments?: Payment[]; 
}

export function FeeSummaryTable({ student, payments = [], onPay, isReadOnly = false }: FeeSummaryTableProps) {
  if (!student) return null;

  const years = Object.keys(student.fee_details).sort((a, b) => a.localeCompare(b));
  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  const yearlyGrids = useMemo(() => {
    const grids: any = {};

    years.forEach(year => {
      const items = student.fee_details[year] || [];
      // Filter out 'Management Fee' as requested
      const feeTypes = Array.from(new Set(items.map(i => i.name)))
        .filter(name => name !== "Management Fee")
        .sort();
      
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
          // Total Net still includes Management Fee in calculation to ensure financial accuracy
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
    <div className="space-y-6">
      {years.map((year) => {
        const grid = yearlyGrids[year];
        const yearBalance = Object.values(grid.termTotals).reduce((sum: number, t: any) => sum + t.balance, 0);

        return (
          <Card key={year} className="overflow-hidden border-muted-foreground/20">
            <CardHeader className="bg-muted/30 border-b py-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base">{year} Fee Details</CardTitle>
                  <CardDescription className="text-xs">Detailed breakdown per term.</CardDescription>
                </div>
                <div className={cn("text-sm font-bold px-3 py-1 rounded-full", 
                  yearBalance > 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}>
                  Year Balance: ₹{yearBalance.toLocaleString()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px] pl-6 bg-muted/20 text-xs font-semibold uppercase tracking-wider">Fee Type</TableHead>
                    {sortedTerms.map(term => (
                      <TableHead key={term.id} className="text-right text-xs font-semibold uppercase tracking-wider">{term.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.feeTypes.map((type: string) => (
                    <TableRow key={type} className="group transition-colors">
                      <TableCell className="pl-6 font-medium text-sm border-r bg-muted/5 group-hover:bg-muted/10">{type}</TableCell>
                      {sortedTerms.map(term => {
                        const cell = grid.matrix[type][term.name];
                        return (
                          <TableCell key={term.id} className="text-right py-2">
                            <div className="flex flex-col items-end">
                              <span className={cn("text-sm", cell.amount === 0 && "text-muted-foreground/30")}>
                                ₹{cell.amount.toLocaleString()}
                              </span>
                              {cell.concession > 0 && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium bg-green-100 dark:bg-green-900/30 px-1 rounded">
                                  -₹{cell.concession.toLocaleString()} Conc.
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  
                  {/* Summary Rows */}
                  <TableRow className="border-t-2 bg-primary/5 font-semibold hover:bg-primary/5">
                    <TableCell className="pl-6 text-sm border-r">Term Total</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right text-sm">
                        ₹{grid.termTotals[term.name].total.toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  <TableRow className="bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-400 font-bold hover:bg-green-50/70 dark:hover:bg-green-900/20">
                    <TableCell className="pl-6 text-sm border-r">Amount Paid</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right text-sm">
                        ₹{grid.termTotals[term.name].paid.toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow className="bg-red-50/30 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-50/50 dark:hover:bg-red-900/20">
                    <TableCell className="pl-6 text-sm border-r">Balance</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right text-sm">
                        ₹{grid.termTotals[term.name].balance.toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>

                  {!isReadOnly && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="pl-6 text-xs font-semibold uppercase text-muted-foreground border-r">Action</TableCell>
                      {sortedTerms.map(term => (
                        <TableCell key={term.id} className="text-right py-3">
                          <Button 
                            size="sm" 
                            onClick={() => onPay(year, term.name)} 
                            disabled={grid.termTotals[term.name].balance <= 0}
                            className="h-8 w-20 text-xs"
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

      <div className="flex justify-end pt-2">
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-6 py-3 text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Outstanding (All Years)</p>
          <p className={cn("text-2xl font-black", overallBalance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
            ₹{overallBalance.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}