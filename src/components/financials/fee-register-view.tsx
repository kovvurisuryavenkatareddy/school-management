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
import { Loader2, Search, FileSpreadsheet } from "lucide-react";
import { FIXED_TERMS, AcademicYear, ClassGroup } from "@/types";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";
import Papa from "papaparse";

export function FeeRegisterView() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [registerData, setRegisterData] = useState<any[]>([]);

  useEffect(() => {
    const fetchFilters = async () => {
      const [ayRes, classRes] = await Promise.all([
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }),
        supabase.from('class_groups').select('*').order('name', { ascending: true })
      ]);
      
      if (ayRes.data) setAcademicYears(ayRes.data);
      if (classRes.data) setClasses(classRes.data);
      setIsInitialLoad(false);
    };
    fetchFilters();
  }, []);

  const handleShowRegister = async () => {
    setIsLoading(true);
    try {
      let studentQuery = supabase.from('students').select('*, student_types(name)');
      if (selectedYear !== "all") studentQuery = studentQuery.eq('academic_year_id', selectedYear);
      if (selectedClass !== "all") studentQuery = studentQuery.eq('class', selectedClass);

      const { data: students, error: studentError } = await studentQuery;
      if (studentError) throw studentError;

      if (!students || students.length === 0) {
        setRegisterData([]);
        toast.info("No students found.");
        setIsLoading(false);
        return;
      }

      const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .in('student_id', students.map(s => s.id));

      if (paymentError) throw paymentError;

      const processed = students.map(student => {
        const normalizedFee = normalizeFeeStructure(student.fee_details);
        const yearKey = student.studying_year;
        const feeItems = normalizedFee[yearKey] || [];
        
        let expectedAmount = 0;
        let totalPaid = 0;

        if (selectedTerm === "all") {
          expectedAmount = feeItems.filter(i => i.name.startsWith('Term')).reduce((sum, i) => sum + i.amount, 0);
          totalPaid = (payments || []).filter(p => p.student_id === student.id && p.fee_type.startsWith(yearKey)).reduce((sum, p) => sum + p.amount, 0);
        } else {
          const termItem = feeItems.find(i => i.term_name === selectedTerm);
          expectedAmount = termItem?.amount || 0;
          totalPaid = (payments || []).filter(p => p.student_id === student.id && p.fee_type.includes(`${yearKey} - ${selectedTerm}`)).reduce((sum, p) => sum + p.amount, 0);
        }

        return { ...student, expected: expectedAmount, paid: totalPaid, status: expectedAmount === 0 || totalPaid >= expectedAmount ? 'Paid' : 'Pending' };
      });

      setRegisterData(processed);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(registerData.map(s => ({
      "Roll Number": s.roll_number, "Name": s.name, "Class": s.class, "Section": s.section,
      "Year": s.studying_year, "Term": selectedTerm === "all" ? "All Terms" : selectedTerm,
      "Expected": s.expected, "Paid": s.paid, "Status": s.status
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Fee_Register.csv`;
    link.click();
  };

  if (isInitialLoad) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Fee Tracking Register</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Years</SelectItem>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.year_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger><SelectValue placeholder="All Terms" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Terms</SelectItem>{FIXED_TERMS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleShowRegister} disabled={isLoading} className="gap-2">{isLoading ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />} Show Register</Button>
          </div>
        </CardContent>
      </Card>
      {registerData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Register Data</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Export CSV</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead className="pl-6">Roll No</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {registerData.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-6 font-medium">{s.roll_number}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right">₹{s.expected.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600">₹{s.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-center"><Badge variant={s.status === 'Paid' ? 'default' : 'destructive'} className={s.status === 'Paid' ? 'bg-green-500' : ''}>{s.status}</Badge></TableCell>
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