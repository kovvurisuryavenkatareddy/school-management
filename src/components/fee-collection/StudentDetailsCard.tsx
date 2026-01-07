"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentDetails } from "@/types";

interface StudentDetailsCardProps {
  student: StudentDetails;
}

export function StudentDetailsCard({ student }: StudentDetailsCardProps) {
  return (
    <Card className="print:hidden">
      <CardHeader><CardTitle>Student Details</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div><p className="font-medium">Name</p><p>{student.name}</p></div>
        <div><p className="font-medium">Roll No</p><p>{student.roll_number}</p></div>
        <div><p className="font-medium">Class</p><p>{student.class}</p></div>
        <div><p className="font-medium">Student Type</p><p>{student.student_types?.name}</p></div>
        <div><p className="font-medium">Caste</p><p>{student.caste || 'N/A'}</p></div>
      </CardContent>
    </Card>
  );
}