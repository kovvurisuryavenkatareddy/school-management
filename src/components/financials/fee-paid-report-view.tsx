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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Search, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 15;

export function FeePaidReportView() {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");
  
  // Details Modal state
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from('payments').select('*, students(name, roll_number), cashiers(name)', { count: 'exact' });
    
    if (searchTerm) {
        query = query.or(`notes.ilike.%${searchTerm}%,students.name.ilike.%${searchTerm}%,students.roll_number.ilike.%${searchTerm}%`);
    }
    if (selectedYear !== 'all') query = query.ilike('fee_type', `${selectedYear}%`);
    if (selectedTerm !== 'all') query = query.ilike('fee_type', `%${selectedTerm}%`);

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    
    if (error) {
        toast.error("Failed to fetch records.");
    } else { 
        setPayments(data || []); 
        setTotalCount(count || 0); 
    }

    const { data: years } = await supabase.from('academic_years').select('*').order('year_name', { ascending: false });
    if (years) setAcademicYears(years);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentPage, selectedYear, selectedTerm, searchTerm]);

  const totalAmount = useMemo(() => payments.reduce((sum, p) => sum + (p.amount || 0), 0), [payments]);

  const truncate = (str: string | null | undefined, length: number = 10) => {
    if (!str) return "N/A";
    if (str.length <= length) return str;
    return str.substring(0, length) + "...";
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.text("Fee Paid Report", 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["Date", "Student", "Term", "Cashier", "Amount"]],
      body: payments.map(p => [
        new Date(p.created_at).toLocaleDateString(), 
        `${p.students?.name} (${p.students?.roll_number})`, 
        p.fee_type,
        p.cashiers?.name || "Admin",
        p.amount.toFixed(2)
      ]),
      theme: 'striped'
    });
    doc.save(`Fee_Report.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fee Paid Report</CardTitle>
            <CardDescription>Detailed audit of all collected payments.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
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
            <div className="flex items-center justify-end font-black text-primary bg-primary/10 px-4 rounded-md border border-primary/20">
                Total: ₹{totalAmount.toLocaleString()}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Term/Type</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center w-[50px]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10">Loading payments...</TableCell></TableRow>
                ) : payments.length > 0 ? (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs">{p.students?.name}</div>
                        <div className="text-[10px] text-muted-foreground">{p.students?.roll_number}</div>
                      </TableCell>
                      <TableCell className="text-xs italic" title={p.fee_type}>
                        {truncate(p.fee_type, 10)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {p.cashiers?.name || <Badge variant="outline" className="text-[9px] h-4">Admin</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" title={p.notes}>
                        {truncate(p.notes, 10)}
                      </TableCell>
                      <TableCell className="text-right font-black text-green-700">₹{p.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setSelectedPayment(p)}
                        >
                            <Eye className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow><TableCell colSpan={7} className="text-center py-10">No payments found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination currentPage={currentPage} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onPageChange={setCurrentPage} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>Full audit information for receipt #{selectedPayment?.receipt_number?.toString().padStart(6, '0')}</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-semibold uppercase text-[10px]">Student Name</p>
                  <p className="font-medium">{selectedPayment.students?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase text-[10px]">Roll Number</p>
                  <p className="font-medium">{selectedPayment.students?.roll_number}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground font-semibold uppercase text-[10px]">Full Term/Description</p>
                  <p className="font-medium p-2 bg-muted rounded border mt-1">{selectedPayment.fee_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase text-[10px]">Collected By</p>
                  <p className="font-medium">{selectedPayment.cashiers?.name || "Administrator"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase text-[10px]">Amount Paid</p>
                  <p className="font-black text-green-700 text-lg">₹{selectedPayment.amount.toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground font-semibold uppercase text-[10px]">Full Note</p>
                  <p className="font-medium p-2 bg-muted rounded border mt-1 italic">{selectedPayment.notes || "No notes provided."}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}