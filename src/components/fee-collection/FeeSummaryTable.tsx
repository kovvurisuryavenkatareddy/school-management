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
          <Card key={year} className="overflow-hidden border-muted-foreground/10 shadow-sm">
            <CardHeader className="bg-muted/50 border-b py-4">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-primary">{year} Fee Breakdown</CardTitle>
                  <CardDescription className="text-xs">Summary of charges and credits per term.</CardDescription>
                </div>
                <div className={cn("text-sm font-bold px-4 py-1.5 rounded-full border", 
                  yearBalance > 0 
                    ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50" 
                    : "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50")}>
                  Balance: ₹{yearBalance.toLocaleString()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    <TableHead className="w-[200px] pl-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Fee Item</TableHead>
                    {sortedTerms.map(term => (
                      <TableHead key={term.id} className="text-right text-xs font-bold uppercase tracking-widest text-muted-foreground">{term.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.feeTypes.map((type: string) => (
                    <TableRow key={type} className="group transition-colors border-b last:border-0">
                      <TableCell className="pl-6 font-semibold text-sm border-r bg-muted/5 group-hover:bg-muted/10">{type}</TableCell>
                      {sortedTerms.map(term => {
                        const cell = grid.matrix[type][term.name];
                        return (
                          <TableCell key={term.id} className="text-right py-3">
                            <div className="flex flex-col items-end">
                              <span className={cn("text-sm font-medium", cell.amount === 0 && "text-muted-foreground/30")}>
                                ₹{cell.amount.toLocaleString()}
                              </span>
                              {cell.concession > 0 && (
                                <span className="text-[10px] mt-0.5 text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-800">
                                  -₹{cell.concession.toLocaleString()} Conc.
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  
                  {/* Totals Section */}
                  <TableRow className="border-t-2 bg-primary/[0.03] font-bold hover:bg-primary/[0.03]">
                    <TableCell className="pl-6 text-sm border-r">Term Total</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right text-sm">
                        ₹{grid.termTotals[term.name].total.toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  <TableRow className="bg-green-500/[0.03] text-green-700 dark:text-green-400 font-bold border-b">
                    <TableCell className="pl-6 text-sm border-r">Received</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right text-sm">
                        ₹{grid.termTotals[term.name].paid.toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow className="bg-red-500/[0.03] text-red-600 dark:text-red-400 font-black">
                    <TableCell className="pl-6 text-sm border-r">Remaining</TableCell>
                    {sortedTerms.map(term => (
                      <TableCell key={term.id} className="text-right text-sm">
                        ₹{grid.termTotals[term.name].balance.toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>

                  {!isReadOnly && (
                    <TableRow className="hover:bg-transparent border-t">
                      <TableCell className="pl-6 text-[10px] font-bold uppercase text-muted-foreground border-r">Action</TableCell>
                      {sortedTerms.map(term => (
                        <TableCell key={term.id} className="text-right py-4">
                          <Button 
                            size="sm" 
                            onClick={() => onPay(year, term.name)} 
                            disabled={grid.termTotals[term.name].balance <= 0}
                            className="h-8 min-w-[80px] text-xs font-bold shadow-sm"
                            variant={grid.termTotals[term.name].balance <= 0 ? "outline" : "default"}
                          >
                            {grid.termTotals[term.name].balance <= 0 ? "Settled" : "Collect"}
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

      <div className="flex justify-end pt-4">
        <div className="bg-primary/10 border-2 border-primary/20 rounded-xl px-8 py-4 text-right shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1">Total Due (All Academic Years)</p>
          <p className={cn("text-3xl font-black font-ubuntu", overallBalance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
            ₹{overallBalance.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}