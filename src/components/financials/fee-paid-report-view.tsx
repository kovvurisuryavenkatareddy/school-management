"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Payment, FIXED_TERMS, AcademicYear } from "@/types";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 15;

export function FeePaidReportView() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");

  const fetchData = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from('payments').select('*, students(name, roll_number)', { count: 'exact' });
    if (searchTerm) query = query.or(`notes.ilike.%${searchTerm}%,students.name.ilike.%${searchTerm}%,students.roll_number.ilike.%${searchTerm}%`);
    if (selectedYear !== 'all') query = query.ilike('fee_type', `${selectedYear}%`);
    if (selectedTerm !== 'all') query = query.ilike('fee_type', `%${selectedTerm}%`);

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) toast.error("Failed to fetch records.");
    else { setPayments(data as any[]); setTotalCount(count || 0); }

    const { data: years } = await supabase.from('academic_years').select('*').order('year_name', { ascending: false });
    if (years) setAcademicYears(years);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentPage, selectedYear, selectedTerm, searchTerm]);

  const totalAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.text("Fee Paid Report", 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["Date", "Student", "Term", "Amount"]],
      body: payments.map(p => [new Date(p.created_at).toLocaleDateString(), `${p.students?.name} (${p.students?.roll_number})`, p.fee_type, p.amount.toFixed(2)]),
      theme: 'striped'
    });
    doc.save(`Fee_Report.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Fee Paid Report</CardTitle><CardDescription>Payment history audit log.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2"><Download className="h-4 w-4" /> PDF</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{academicYears.map(y => <SelectItem key={y.id} value={y.year_name}>{y.year_name}</SelectItem>)}</SelectContent></Select>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}><SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger><SelectContent><SelectItem value="all">All Terms</SelectItem>{FIXED_TERMS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent></Select>
            <div className="flex items-center justify-end font-bold text-primary bg-primary/10 px-4 rounded-md">Total: ₹{totalAmount.toLocaleString()}</div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Term</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><div>{p.students?.name}</div><div className="text-xs text-muted-foreground">{p.students?.roll_number}</div></TableCell>
                  <TableCell><Badge variant="outline">{p.fee_type}</Badge></TableCell>
                  <TableCell className="text-right font-bold text-green-700">₹{p.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination currentPage={currentPage} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onPageChange={setCurrentPage} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
    </div>
  );
}