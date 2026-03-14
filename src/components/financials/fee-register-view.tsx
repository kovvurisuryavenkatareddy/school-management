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
import { Loader2, Search, FileSpreadsheet, XCircle } from "lucide-react";
import { FIXED_TERMS, AcademicYear, ClassGroup, StudyingYear } from "@/types";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";
import { MultiSelect } from "@/components/ui/multi-select";
import Papa from "papaparse";
import React from "react";

type TermData = {
  termName: string;
  expected: number;
  paid: number;
  pending: number;
  status: 'Paid' | 'Pending' | 'Partial';
};

type YearData = {
  yearName: string;
  terms: TermData[];
};

type StudentRegisterRecord = {
  id: string;
  roll_number: string;
  name: string;
  class: string;
  section: string;
  years: YearData[];
};

export function FeeRegisterView() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [studyingYears, setStudyingYears] = useState<StudyingYear[]>([]);
  
  const [selectedEnrollmentYear, setSelectedEnrollmentYear] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStudyingYears, setSelectedStudyingYears] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [registerData, setRegisterData] = useState<StudentRegisterRecord[]>([]);

  useEffect(() => {
    const fetchFilters = async () => {
      const [ayRes, classRes, syRes] = await Promise.all([
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }),
        supabase.from('class_groups').select('*').order('name', { ascending: true }),
        supabase.from('studying_years').select('*').order('name', { ascending: true })
      ]);
      
      if (ayRes.data) setAcademicYears(ayRes.data);
      if (classRes.data) setClasses(classRes.data);
      if (syRes.data) setStudyingYears(syRes.data);
      setIsInitialLoad(false);
    };
    fetchFilters();
  }, []);

  const handleShowRegister = async () => {
    setIsLoading(true);
    try {
      let studentQuery = supabase.from('students').select('*, student_types(name)');
      
      if (selectedEnrollmentYear !== "all") studentQuery = studentQuery.eq('academic_year_id', selectedEnrollmentYear);
      if (selectedClass !== "all") studentQuery = studentQuery.eq('class', selectedClass);
      
      const { data: students, error: studentError } = await studentQuery;
      if (studentError) throw studentError;

      if (!students || students.length === 0) {
        setRegisterData([]);
        toast.info("No students found matching these filters.");
        setIsLoading(false);
        return;
      }

      const studentIds = students.map((s: any) => s.id);
      
      // Batch fetch payments to avoid URL length issues (400 Bad Request)
      const allPayments: any[] = [];
      const CHUNK_SIZE = 100;
      for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
        const chunk = studentIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkPayments, error: paymentError } = await supabase
          .from('payments')
          .select('*')
          .in('student_id', chunk);
        
        if (paymentError) throw paymentError;
        if (chunkPayments) allPayments.push(...chunkPayments);
      }

      const processed: StudentRegisterRecord[] = students.map(student => {
        const normalizedFee = normalizeFeeStructure(student.fee_details);
        
        const yearEntries = Object.entries(normalizedFee).filter(([yearName]) => {
          if (selectedStudyingYears.length === 0) return true;
          return selectedStudyingYears.includes(yearName);
        });

        const years: YearData[] = yearEntries.map(([yearName, feeItems]) => {
          const terms: TermData[] = FIXED_TERMS.filter(t => {
            if (selectedTerms.length === 0) return true;
            return selectedTerms.includes(t.name);
          }).map(term => {
            const termItem = feeItems.find(i => i.term_name === term.name);
            const expected = termItem?.amount || 0;
            
            const paid = allPayments
              .filter(p => p.student_id === student.id && p.fee_type === `${yearName} - ${term.name}`)
              .reduce((sum, p) => sum + p.amount, 0);

            const pending = Math.max(0, expected - paid);
            let status: 'Paid' | 'Pending' | 'Partial' = 'Pending';
            
            if (expected > 0) {
              if (paid >= expected - 0.05) status = 'Paid';
              else if (paid > 0.01) status = 'Partial';
            } else if (paid > 0.01) {
              status = 'Paid';
            } else {
              status = 'Paid';
            }

            return { termName: term.name, expected, paid, pending, status };
          });

          return { yearName, terms };
        }).filter(y => y.terms.length > 0);

        return {
          id: student.id,
          roll_number: student.roll_number,
          name: student.name,
          class: student.class,
          section: student.section,
          years
        };
      }).filter(s => s.years.length > 0);

      setRegisterData(processed);
      toast.success(`Loaded records for ${processed.length} students.`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    const rows: any[] = [];
    registerData.forEach(student => {
      student.years.forEach(year => {
        year.terms.forEach(term => {
          rows.push({
            "Roll Number": student.roll_number,
            "Student Name": student.name,
            "Class": `${student.class}-${student.section}`,
            "Academic Year": year.yearName,
            "Term": term.termName,
            "Expected Amount": term.expected,
            "Paid Amount": term.paid,
            "Pending Amount": term.pending,
            "Status": term.status
          });
        });
      });
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Fee_Register_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px]">Paid</Badge>;
      case 'Partial': return <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50 text-[10px]">Partial</Badge>;
      default: return <Badge variant="destructive" className="text-[10px]">Pending</Badge>;
    }
  };

  if (isInitialLoad) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-ubuntu">Fee Tracking Register</CardTitle>
          <CardDescription>Select specific studying years and terms to generate audit data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Enrollment Year</Label>
              <Select value={selectedEnrollmentYear} onValueChange={setSelectedEnrollmentYear}>
                <SelectTrigger className="h-10"><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.year_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-10"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Studying Years (Multi-select)</Label>
              <MultiSelect
                options={studyingYears.map(sy => ({ label: sy.name, value: sy.name }))}
                value={selectedStudyingYears}
                onChange={setSelectedStudyingYears}
                placeholder="Choose years..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Terms (Multi-select)</Label>
              <MultiSelect
                options={FIXED_TERMS.map(t => ({ label: t.name, value: t.name }))}
                value={selectedTerms}
                onChange={setSelectedTerms}
                placeholder="Choose terms..."
              />
            </div>

            <div className="lg:col-span-2 flex gap-3">
              <Button onClick={handleShowRegister} disabled={isLoading} className="flex-1 h-10 gap-2 font-bold">
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                Show Records
              </Button>
              {registerData.length > 0 && (
                <Button variant="outline" onClick={() => setRegisterData([])} className="h-10 px-3 text-rose-600 border-rose-200">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {registerData.length > 0 && (
        <Card className="border-primary/10 shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg">Register Audit Data</CardTitle>
              <CardDescription>Records found: {registerData.length}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-6 w-[250px]">Student Context</TableHead>
                    <TableHead>Fee Year / Term</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registerData.map((student) => {
                    const totalRows = student.years.reduce((acc, y) => acc + y.terms.length, 0);
                    return (
                      <React.Fragment key={student.id}>
                        {student.years.map((year, yIdx) => (
                          <React.Fragment key={`${student.id}-${year.yearName}`}>
                            {year.terms.map((term, tIdx) => (
                              <TableRow key={`${student.id}-${year.yearName}-${term.termName}`} className="hover:bg-muted/5">
                                {yIdx === 0 && tIdx === 0 && (
                                  <TableCell rowSpan={totalRows} className="pl-6 align-top pt-4 border-r">
                                    <div className="flex flex-col">
                                      <span className="font-black text-sm text-primary">{student.name}</span>
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Roll: {student.roll_number}</span>
                                      <span className="text-[10px] mt-1 font-medium">{student.class}-{student.section}</span>
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4">{year.yearName}</Badge>
                                    <span className="text-xs font-semibold">{term.termName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium text-xs">₹{term.expected.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-emerald-600 font-bold text-xs">₹{term.paid.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-rose-500 font-bold text-xs">₹{term.pending.toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  {getStatusBadge(term.status)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                        <TableRow className="h-1 bg-muted/20"><TableCell colSpan={6} className="p-0 h-1"></TableCell></TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && registerData.length === 0 && !isInitialLoad && (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/20">
          <Search className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-4" />
          <p className="text-muted-foreground font-medium">No results to display. Adjust filters and click "Show Records".</p>
        </div>
      )}
    </div>
  );
}