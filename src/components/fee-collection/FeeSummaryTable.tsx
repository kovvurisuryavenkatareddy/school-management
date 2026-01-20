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
import { StudentDetails, Payment } from "@/types";
import { cn } from "@/lib/utils";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";

interface FeeSummaryTableProps {
  onPay: (year: string, term: string) => void;
  isReadOnly?: boolean;
  student: StudentDetails | null;
  payments?: Payment[]; 
  data?: any; 
}

export function FeeSummaryTable({ student, payments = [], onPay, isReadOnly = false }: FeeSummaryTableProps) {
  if (!student) return null;

  const normalizedFeeDetails = useMemo(() => normalizeFeeStructure(student.fee_details), [student.fee_details]);
  const years = Object.keys(normalizedFeeDetails).sort((a, b) => a.localeCompare(b));

  const yearlyData = useMemo(() => {
    return years.map(year => {
      const items = normalizedFeeDetails[year] || [];
      const concession = items.find(i => i.name === 'Yearly Concession')?.concession || 0;
      
      const termMetrics = ['Term 1', 'Term 2', 'Term 3'].map(termName => {
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

      const yearTotal = termMetrics.reduce((sum, t) => sum + t.total, 0);
      const yearPaid = termMetrics.reduce((sum, t) => sum + t.paid, 0);
      const yearBalance = Math.max(0, yearTotal - concession - yearPaid);

      return { year, termMetrics, yearTotal, yearPaid, yearBalance, concession };
    });
  }, [normalizedFeeDetails, payments, years]);

  const overallBalance = yearlyData.reduce((sum, y) => sum + y.yearBalance, 0);

  return (
    <Card className="overflow-hidden border-primary/10 shadow-lg">
      <CardHeader className="bg-muted/30 border-b py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-ubuntu text-primary">Consolidated Fee Ledger</CardTitle>
            <CardDescription className="text-sm">Comprehensive view of all academic terms and collection status.</CardDescription>
          </div>
          <div className={cn("px-6 py-2 rounded-xl text-lg font-black border shadow-sm", 
            overallBalance > 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100")}>
            Total Due: ₹{overallBalance.toLocaleString()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6 w-[150px] text-xs font-black uppercase tracking-widest">Academic Year</TableHead>
                <TableHead className="w-[120px] text-xs font-black uppercase tracking-widest">Term</TableHead>
                <TableHead className="text-right text-xs font-black uppercase tracking-widest">Gross Fee</TableHead>
                <TableHead className="text-right text-xs font-black uppercase tracking-widest">Collected</TableHead>
                <TableHead className="text-right text-xs font-black uppercase tracking-widest">Remaining</TableHead>
                {!isReadOnly && <TableHead className="w-[120px] pr-6 text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyData.map((d, yearIndex) => (
                <React.Fragment key={d.year}>
                  {d.termMetrics.map((term, termIndex) => (
                    <TableRow key={`${d.year}-${term.name}`} className="group hover:bg-muted/5 transition-colors">
                      {termIndex === 0 && (
                        <TableCell rowSpan={5} className="pl-6 font-bold text-sm bg-muted/5 border-r align-top py-6">
                          {d.year}
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-sm text-muted-foreground">{term.name}</TableCell>
                      <TableCell className="text-right font-medium">₹{term.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600 font-bold">₹{term.paid.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500 font-black">₹{term.balance.toLocaleString()}</TableCell>
                      {!isReadOnly && (
                        <TableCell className="pr-6 text-right">
                          <Button 
                            size="sm" 
                            variant={term.balance <= 0 ? "outline" : "default"}
                            disabled={term.balance <= 0}
                            onClick={() => onPay(d.year, term.name)}
                            className="h-8 min-w-[85px] text-[10px] font-black uppercase tracking-wider shadow-sm"
                          >
                            {term.balance <= 0 ? "Settled" : "Collect"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  
                  {/* Concession Row */}
                  <TableRow className="bg-muted/5">
                    <TableCell className="font-bold text-sm italic text-green-600">Yearly Concession</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-black text-green-600 bg-green-50/50">- ₹{d.concession.toLocaleString()}</TableCell>
                    {!isReadOnly && <TableCell className="pr-6"></TableCell>}
                  </TableRow>

                  {/* Year Subtotal Row */}
                  <TableRow className="bg-primary/[0.03] border-b-2 border-primary/10 hover:bg-primary/[0.03]">
                    <TableCell className="font-black text-xs uppercase tracking-tighter text-primary">Yearly Total ({d.year})</TableCell>
                    <TableCell className="text-right font-black text-primary">₹{(d.yearTotal - d.concession).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-primary">₹{d.yearPaid.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-lg text-primary">₹{d.yearBalance.toLocaleString()}</TableCell>
                    {!isReadOnly && <TableCell className="pr-6"></TableCell>}
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}