"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  StudentDetails,
  StudentListItem,
  StudyingYear,
  Payment,
} from "@/types";
import { FeeSummaryTable } from "@/components/fee-collection/FeeSummaryTable";
import { StudentDetailsCard } from "@/components/fee-collection/StudentDetailsCard";
import { OutstandingInvoices } from "@/components/fee-collection/OutstandingInvoices";
import { PaymentHistory } from "@/components/fee-collection/PaymentHistory";

const BASE_FEE_TYPES = ['Tuition Fee', 'Management Fee', 'JVD Fee'];

// Mark page as dynamic to support useSearchParams during export
export const dynamic = 'force-dynamic';

function StudentFeesPageContent() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(null);
  const [studyingYears, setStudyingYears] = useState<StudyingYear[]>([]);
  const [searchText, setSearchText] = useState("");
  const [studentPayments, setStudentPayments] = useState<Payment[]>([]);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]); // Using any for now, will refine with Invoice type

  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");

  const [isLoading, setIsLoading] = useState(false);

  const fetchStudentFinancials = async (studentId: string) => {
    const [paymentsRes, invoicesRes] = await Promise.all([
      supabase.from('payments').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('student_id', studentId).eq('status', 'unpaid').order('due_date', { ascending: true })
    ]);

    if (paymentsRes.error) toast.error("Failed to fetch payments.");
    else setStudentPayments(paymentsRes.data as Payment[] || []);

    if (invoicesRes.error) toast.error("Failed to fetch outstanding invoices.");
    else setStudentInvoices(invoicesRes.data || []);
  };

  useEffect(() => {
    if (studentId) {
      const fetchStudentDetails = async () => {
        setIsLoading(true);
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("*, student_types(name), academic_years(*)")
          .eq("id", studentId)
          .single();

        if (studentError) {
          toast.error("Failed to fetch student details.");
          setIsLoading(false);
          return;
        }

        const { data: studyingYearData, error: studyingYearError } = await supabase
          .from("studying_years")
          .select("*")
          .order("name", { ascending: false });

        if (studyingYearError) {
          toast.error("Failed to fetch studying years.");
          setIsLoading(false);
          return;
        }

        setStudyingYears(studyingYearData || []);
        setSelectedStudent(studentData);
        await fetchStudentFinancials(studentData.id);
        setIsLoading(false);
      };

      fetchStudentDetails();
    }
  }, [studentId]);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, roll_number")
        .order("name", { ascending: true });

      if (error) {
        toast.error("Failed to fetch students.");
        return;
      }
      setStudents(data || []);
    };
    fetchStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!searchText) return students;
    return students.filter((student) =>
      student.name.toLowerCase().includes(searchText.toLowerCase()) ||
      student.roll_number.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [students, searchText]);

  const handlePayClick = (year: string, term: string) => {
    // This is read-only, so this won't be called, but we need to match the signature
    // If needed in the future, we can implement payment collection here
  };

  const handlePaymentSuccess = async () => {
    // Refresh student financials after payment (even though this is read-only)
    if (selectedStudent) {
      await fetchStudentFinancials(selectedStudent.id);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p>Loading student details...</p></div>;
  }

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-6xl space-y-6">
        <div className="print-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Student Fee Portal</CardTitle>
              <CardDescription>Search for a student to view their fee structure and payment history.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  placeholder="Search by name or roll number..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-grow"
                />
                <Select onValueChange={async (value) => {
                  const studentListItem = students.find(s => s.id === value);
                  if (studentListItem) {
                    setIsLoading(true);
                    const { data: studentData, error: studentError } = await supabase
                      .from("students")
                      .select("*, student_types(name), academic_years(*)")
                      .eq("id", studentListItem.id)
                      .single();

                    if (studentError) {
                      toast.error("Failed to fetch student details.");
                      setIsLoading(false);
                      return;
                    }

                    setSelectedStudent(studentData);
                    await fetchStudentFinancials(studentListItem.id);
                    setIsLoading(false);
                  } else {
                    setSelectedStudent(null);
                  }
                }} value={selectedStudent?.id || ""}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.roll_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedStudent && (
          <div className="print-area space-y-6">
            <StudentDetailsCard student={selectedStudent} />
            
            <FeeSummaryTable
              student={selectedStudent}
              payments={studentPayments}
              onPay={handlePayClick}
              onEditConcession={() => {}}
              isReadOnly={true}
              cashierProfile={null}
            />

            <OutstandingInvoices 
              invoices={studentInvoices} 
              studentRecords={[selectedStudent]} 
              cashierProfile={null} 
              onSuccess={handlePaymentSuccess} 
              logActivity={async () => {}} 
              isReadOnly={true} 
            />

            <PaymentHistory payments={studentPayments} student={selectedStudent} isReadOnly={true}/>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentFeesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p>Loading...</p></div>}>
      <StudentFeesPageContent />
    </Suspense>
  );
}