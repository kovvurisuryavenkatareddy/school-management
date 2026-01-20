"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Download, FileSpreadsheet } from "lucide-react";
import { FIXED_TERMS, AcademicYear, ClassGroup, StudentDetails } from "@/types";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";
import Papa from "papaparse";

export default function FeeRegisterPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  
  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>(FIXED_TERMS[0].name);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [registerData, setRegisterData] = useState<any[]>([]);

  useEffect(() => {
    const fetchFilters = async () => {
      const [ayRes, classRes] = await Promise.all([
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }),
        supabase.from('class_groups').select('*').order('name', { ascending: true })
      ]);
      
      if (ayRes.data) {
        setAcademicYears(ayRes.data);
        const active = ayRes.data.find(y => y.is_active);
        if (active) setSelectedYear(active.id);
      }
      if (classRes.data) {
        setClasses(classRes.data);
        if (classRes.data.length > 0) setSelectedClass(classRes.data[0].name);
      }
      setIsInitialLoad(false);
    };
    fetchFilters();
  }, []);

  const handleShowRegister = async () => {
    if (!selectedYear || !selectedClass || !selectedTerm) {
      toast.error("Please select all filters first.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch all students for the selected cohort
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('*, student_types(name)')
        .eq('academic_year_id', selectedYear)
        .eq('class', selectedClass);

      if (studentError) throw studentError;

      if (!students || students.length === 0) {
        setRegisterData([]);
        toast.info("No students found for this selection.");
        setIsLoading(false);
        return;
      }

      // 2. Fetch all payments for these students for the selected term
      const studentIds = students.map(s => s.id);
      const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .in('student_id', studentIds)
        .ilike('fee_type', `%${selectedTerm}%`);

      if (paymentError) throw paymentError;

      // 3. Process status for each student
      const processed = students.map(student => {
        const normalizedFee = normalizeFeeStructure(student.fee_details);
        const yearKey = student.studying_year;
        const feeItems = normalizedFee[yearKey] || [];
        
        // Expected amount for this specific term
        const termItem = feeItems.find(i => i.term_name === selectedTerm);
        const expectedAmount = termItem?.amount || 0;

        // If expected is 0, it's considered "Paid/Exempt"
        if (expectedAmount === 0) {
          return { ...student, status: 'Paid', paid: 0, expected: 0 };
        }

        // Total paid for this term (matching Year and Term)
        const totalPaid = (payments || [])
          .filter(p => p.student_id === student.id && p.fee_type.startsWith(yearKey))
          .reduce((sum, p) => sum + p.amount, 0);

        const isPaid = totalPaid >= expectedAmount;

        return {
          ...student,
          expected: expectedAmount,
          paid: totalPaid,
          status: isPaid ? 'Paid' : 'Pending'
        };
      });

      setRegisterData(processed);
    } catch (error: any) {
      toast.error(`Failed to generate register: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    const csvData = registerData.map(s => ({
      "Roll Number": s.roll_number,
      "Name": s.name,
      "Class": s.class,
      "Section": s.section,
      "Year": s.studying_year,
      "Term": selectedTerm,
      "Expected Amount": s.expected,
      "Paid Amount": s.paid,
      "Status": s.status
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Fee_Register_${selectedClass}_${selectedTerm}.csv`);
    link.click();
  };

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>Fee Tracking Register</CardTitle>
          <CardDescription>Generate granular term-wise collection reports for specific cohorts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>
                  {academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.year_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Class / Degree</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Academic Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                <SelectContent>
                  {FIXED_TERMS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleShowRegister} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Show Register
            </Button>
          </div>
        </CardContent>
      </Card>

      {registerData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
            <div>
              <CardTitle className="text-lg">Collection Register: {selectedClass} - {selectedTerm}</CardTitle>
              <CardDescription>Real-time status tracking based on current collection data.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-6">Roll Number</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Year / Section</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registerData.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="pl-6 font-medium">{student.roll_number}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.studying_year} - {student.section}</TableCell>
                    <TableCell className="text-right font-semibold">₹{student.expected.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">₹{student.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={student.status === 'Paid' ? 'default' : 'destructive'}
                        className={student.status === 'Paid' ? 'bg-green-500 hover:bg-green-600' : ''}
                      >
                        {student.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}