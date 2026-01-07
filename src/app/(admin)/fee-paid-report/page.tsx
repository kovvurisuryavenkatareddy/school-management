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

export default function FeePaidReportPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");

  const fetchData = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('payments')
      .select('*, students(name, roll_number)', { count: 'exact' });

    if (searchTerm) {
      query = query.or(`notes.ilike.%${searchTerm}%,students.name.ilike.%${searchTerm}%,students.roll_number.ilike.%${searchTerm}%`);
    }

    if (selectedYear !== 'all') {
      query = query.ilike('fee_type', `${selectedYear}%`);
    }

    if (selectedTerm !== 'all') {
      query = query.ilike('fee_type', `%${selectedTerm}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      toast.error("Failed to fetch payment records.");
    } else {
      setPayments(data as any[]);
      setTotalCount(count || 0);
    }

    const { data: years } = await supabase.from('academic_years').select('*').order('year_name', { ascending: false });
    if (years) setAcademicYears(years);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, selectedYear, selectedTerm, searchTerm]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const totalAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.text("Fee Paid Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Filters: Year: ${selectedYear}, Term: ${selectedTerm}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [["Date", "Student", "Year/Term", "Method", "Amount"]],
      body: payments.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        `${p.students?.name} (${p.students?.roll_number})`,
        p.fee_type.split(' - ').slice(0, 2).join(' / '),
        p.payment_method.toUpperCase(),
        p.amount.toFixed(2)
      ]),
      foot: [["", "", "", "Total", totalAmount.toFixed(2)]],
      theme: 'striped'
    });

    doc.save(`Fee_Paid_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Fee Paid Report</CardTitle>
            <CardDescription>Verified payment history audit log.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Student or ID..." 
              className="pl-8" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger><SelectValue placeholder="Academic Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {academicYears.map(y => <SelectItem key={y.id} value={y.year_name}>{y.year_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              {FIXED_TERMS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end font-bold text-primary bg-primary/10 px-4 rounded-md border border-primary/20">
            Total: ₹{totalAmount.toFixed(2)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student Details</TableHead>
              <TableHead>Year / Term</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading Records...</TableCell></TableRow>
            ) : payments.length > 0 ? (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="font-medium">{payment.students?.name}</div>
                    <div className="text-xs text-muted-foreground">{payment.students?.roll_number}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {payment.fee_type.split(' - ').slice(0, 2).join(' / ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{payment.payment_method}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700">₹{payment.amount.toFixed(2)}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">{payment.notes || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="text-center py-8">No payments found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
        />
      </CardContent>
    </Card>
  );
}