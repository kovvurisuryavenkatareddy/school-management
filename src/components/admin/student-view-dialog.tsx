"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StudentDetails, FIXED_TERMS } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeFeeStructure } from '@/lib/fee-structure-utils';

interface StudentViewDialogProps {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentViewDialog({ studentId, open, onOpenChange }: StudentViewDialogProps) {
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchStudent = async () => {
      if (open && studentId) {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('students')
          .select('*, student_types(name), academic_years(*)')
          .eq('id', studentId)
          .single();

        if (error) {
          toast.error("Failed to fetch student details.");
          onOpenChange(false);
        } else {
          // Normalize the data for consistent display
          const normalizedStudent = {
            ...data,
            fee_details: normalizeFeeStructure(data.fee_details)
          };
          setStudent(normalizedStudent as StudentDetails);
        }
        setIsLoading(false);
      }
    };

    fetchStudent();
  }, [open, studentId, onOpenChange]);

  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Student Details</DialogTitle>
          <DialogDescription>
            Complete information for {isLoading ? <Skeleton className="h-4 w-24 inline-block" /> : student?.name}.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : student ? (
          <ScrollArea className="max-h-[70vh]">
            <div className="pr-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 text-sm">
                <div className="font-semibold">Name:</div><div>{student.name}</div>
                <div className="font-semibold">Roll Number:</div><div>{student.roll_number}</div>
                <div className="font-semibold">Class:</div><div>{student.class}</div>
                <div className="font-semibold">Section:</div><div>{student.section}</div>
                <div className="font-semibold">Studying Year:</div><div>{student.studying_year}</div>
                <div className="font-semibold">Academic Year:</div><div>{student.academic_years?.year_name}</div>
                <div className="font-semibold">Student Type:</div><div>{student.student_types?.name}</div>
                <div className="font-semibold">Caste:</div><div>{student.caste || 'N/A'}</div>
                <div className="font-semibold">Phone:</div><div>{student.phone || 'N/A'}</div>
                <div className="font-semibold">Email:</div><div>{student.email || 'N/A'}</div>
              </div>

              {student.fee_details && Object.keys(student.fee_details).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold mb-2 text-base">Fee Structure (Breakdown)</h4>
                  <div className="space-y-4">
                    {Object.entries(student.fee_details).sort(([yearA], [yearB]) => yearA.localeCompare(yearB)).map(([year, feeItems]) => (
                      <div key={year}>
                        <h5 className="font-medium text-sm mb-1">{year}</h5>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Term</TableHead>
                              <TableHead>Fee Type</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedTerms.map(term => {
                                const matchingItems = feeItems.filter(item => item.term_name === term.name);

                                return matchingItems.length > 0 ? (
                                    matchingItems.map((item, idx) => (
                                        <TableRow key={`${term.name}-${item.id}-${idx}`}>
                                            {idx === 0 && <TableCell rowSpan={matchingItems.length} className="font-medium">{term.name}</TableCell>}
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow key={`${term.name}-empty`}>
                                        <TableCell className="font-medium">{term.name}</TableCell>
                                        <TableCell colSpan={2} className="text-muted-foreground italic text-xs">N/A</TableCell>
                                    </TableRow>
                                );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}