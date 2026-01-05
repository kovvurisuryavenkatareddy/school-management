"use client";

import { EditStudentForm } from "@/components/admin/edit-student-form";

export default function EditStudentPage({ params }: { params: { studentId: string } }) {
  return <EditStudentForm studentId={params.studentId} />;
}