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
import { FeeSummaryData, FIXED_TERMS, Payment, StudentDetails } from "@/types";
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

export function FeeSummaryTable({ data, onPay, onCollectOther, hasDiscountPermission, onEditConcession, isReadOnly = false, student }: FeeSummaryTableProps) {
  if (!data || !student) return null;

  const years = Object.keys(data).sort((a, b) => a.localeCompare(b)); // Sort years ascending
  const allFeeTypes = Array.from(new Set(
    Object.values(data).flatMap(yearData =>
      Object.keys(yearData)
    )
  )).sort();

  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  const calculateFeeTypeTotal = (feeType: string, field: 'total' | 'paid' | 'concession' | 'balance') => {
    let sum = 0;
    years.forEach(year => {
      sortedTerms.forEach(term => {
        sum += data[year]?.[feeType]?.[term.name]?.[field] || 0;
      });
    });
    return sum;
  };

  const calculateYearlyTotal = (year: string, field: 'total' | 'paid' | 'concession' | 'balance') => {
    let sum = 0;
    allFeeTypes.forEach(feeType => {
      sortedTerms.forEach(term => {
        sum += data[year]?.[feeType]?.[term.name]?.[field] || 0;
      });
    });
    return sum;
  };

  const calculateOverallTotal = (field: 'total' | 'paid' | 'concession' | 'balance') => {
    let sum = 0;
    years.forEach(year => {
      sum += calculateYearlyTotal(year, field);
    });
    return sum;
  };

  const overallTotalAmount = calculateOverallTotal('total');
  const overallPaidAmount = calculateOverallTotal('paid');
  const overallConcessionAmount = calculateOverallTotal('concession');
  const overallBalanceAmount = calculateOverallTotal('balance');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Fee Summary</CardTitle>
            <CardDescription>Detailed breakdown of fees across all academic years and terms.</CardDescription>
        </div>
        {!isReadOnly && <Button onClick={onCollectOther}>Collect Other Payment</Button>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-full border">
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="sticky left-0 z-10 bg-background border-r min-w-[150px] align-middle">Fee Type</TableHead>
                <TableHead rowSpan={2} className="bg-background border-r min-w-[100px] align-middle">Term</TableHead>
                {years.map(year => (
                  <TableHead key={year} colSpan={3} className="text-center border-l">{year}</TableHead>
                ))}
                <TableHead rowSpan={2} className="border-l align-middle">Overall Balance</TableHead>
                {!isReadOnly && <TableHead rowSpan={2} className="border-l align-middle">Actions</TableHead>}
              </TableRow>
              <TableRow>
                {years.map(year => (
                    <React.Fragment key={`${year}-cols`}>
                        <TableHead className="text-center border-l">Total</TableHead>
                        <TableHead className="text-center">Paid</TableHead>
                        <TableHead className="text-center">Balance</TableHead>
                    </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allFeeTypes.map(feeType => (
                <React.Fragment key={feeType}>
                  {sortedTerms.map((term, termIndex) => {
                    const isFirstTerm = termIndex === 0;
                    const rowSpan = isFirstTerm ? sortedTerms.length : 1;
                    const feeTypeTotalBalance = calculateFeeTypeTotal(feeType, 'balance');

                    return (
                      <TableRow key={`${feeType}-${term.id}`}>
                        {isFirstTerm && (
                          <TableCell rowSpan={rowSpan} className="font-medium sticky left-0 z-10 bg-background border-r">
                            {feeType}
                          </TableCell>
                        )}
                        <TableCell className={cn("border-r", !isFirstTerm && "sticky left-[150px] bg-background")}>
                          {term.name}
                        </TableCell>
                        {years.map(year => {
                          const termData = data[year]?.[feeType]?.[term.name] || { total: 0, paid: 0, concession: 0, balance: 0 };
                          return (
                            <React.Fragment key={`${year}-${term.id}`}>
                              <TableCell className="text-center border-l">{(termData.total - termData.concession).toFixed(2)}</TableCell>
                              <TableCell className="text-center text-green-600">{termData.paid.toFixed(2)}</TableCell>
                              <TableCell className="text-center text-red-600 font-medium">{termData.balance.toFixed(2)}</TableCell>
                            </React.Fragment>
                          );
                        })}
                        {isFirstTerm && (
                          <TableCell rowSpan={rowSpan} className="text-center font-bold border-l text-red-600">
                            {feeTypeTotalBalance.toFixed(2)}
                          </TableCell>
                        )}
                        {!isReadOnly && isFirstTerm && (
                          <TableCell rowSpan={rowSpan} className="text-center border-l">
                            <Button size="sm" variant="outline" onClick={() => onPay(feeType, term.name)}>Pay</Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {/* Subtotal row for each fee type */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2} className="sticky left-0 z-10 bg-muted/50 border-r text-right">Subtotal ({feeType})</TableCell>
                    {years.map(year => {
                      const yearFeeTypeTotal = sortedTerms.reduce((sum, term) => sum + (data[year]?.[feeType]?.[term.name]?.total || 0), 0);
                      const yearFeeTypePaid = sortedTerms.reduce((sum, term) => sum + (data[year]?.[feeType]?.[term.name]?.paid || 0), 0);
                      const yearFeeTypeConcession = sortedTerms.reduce((sum, term) => sum + (data[year]?.[feeType]?.[term.name]?.concession || 0), 0);
                      const yearFeeTypeBalance = sortedTerms.reduce((sum, term) => sum + (data[year]?.[feeType]?.[term.name]?.balance || 0), 0);
                      return (
                        <React.Fragment key={`${year}-subtotal-${feeType}`}>
                          <TableCell className="text-center border-l">{(yearFeeTypeTotal - yearFeeTypeConcession).toFixed(2)}</TableCell>
                          <TableCell className="text-center text-green-600">{yearFeeTypePaid.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-red-600">{yearFeeTypeBalance.toFixed(2)}</TableCell>
                        </React.Fragment>
                      );
                    })}
                    <TableCell className="text-center font-bold border-l text-red-600">
                      {calculateFeeTypeTotal(feeType, 'balance').toFixed(2)}
                    </TableCell>
                    {!isReadOnly && <TableCell className="border-l"></TableCell>}
                  </TableRow>
                </React.Fragment>
              ))}

              {/* Overall Totals Row */}
              <TableRow className="bg-primary/10 font-bold text-base">
                <TableCell colSpan={2} className="sticky left-0 z-10 bg-primary/10 border-r text-right">Overall Totals</TableCell>
                {years.map(year => {
                  const yearTotal = calculateYearlyTotal(year, 'total');
                  const yearPaid = calculateYearlyTotal(year, 'paid');
                  const yearConcession = calculateYearlyTotal(year, 'concession');
                  const yearBalance = calculateYearlyTotal(year, 'balance');
                  return (
                    <React.Fragment key={`${year}-overall`}>
                      <TableCell className="text-center border-l">{(yearTotal - yearConcession).toFixed(2)}</TableCell>
                      <TableCell className="text-center text-green-700">{yearPaid.toFixed(2)}</TableCell>
                      <TableCell className="text-center text-red-700">{yearBalance.toFixed(2)}</TableCell>
                    </React.Fragment>
                  );
                })}
                <TableCell className="text-center border-l text-red-700">
                  {overallBalanceAmount.toFixed(2)}
                </TableCell>
                {!isReadOnly && <TableCell className="border-l"></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}