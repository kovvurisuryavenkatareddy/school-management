"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Search, Loader2, UserPlus, Check, FilterX, Users, FileSpreadsheet, Download, PieChart } from "lucide-react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

type StudentInvoice = {
  id: string;
  status: "paid" | "unpaid";
  paid_amount: number;
  total_amount: number;
  students: {
    id: string;
    roll_number: string;
    name: string;
  };
};

export default function InvoiceBatchDetailPage({ params }: { params: { batchId: string } }) {
  const { batchId } = params;
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [dialogSearch, setDialogSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSY, setFilterSY] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [options, setOptions] = useState<{
    classes: any[];
    years: any[];
    sections: any[];
    types: any[];
  }>({ classes: [], years: [], sections: [], types: [] });

  const fetchBatchDetails = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("id, status, paid_amount, total_amount, batch_description, due_date, penalty_amount_per_day, students(id, roll_number, name)")
      .eq("batch_id", batchId);

    if (error) {
      toast.error("Failed to fetch batch details.");
    } else {
      const normalized: StudentInvoice[] = (data || []).map((row: any) => ({
        id: row.id,
        status: row.status,
        paid_amount: row.paid_amount || 0,
        total_amount: row.total_amount || 0,
        students: row.students
          ? { id: row.students.id, roll_number: row.students.roll_number, name: row.students.name }
          : { id: "N/A", roll_number: "N/A", name: "Student not found" },
      }));

      setInvoices(normalized);
      if (data && data.length > 0) {
        setBatchInfo({
            description: data[0].batch_description,
            amount: data[0].total_amount,
            due_date: data[0].due_date,
            penalty: data[0].penalty_amount_per_day
        });
      }
    }
    setIsLoading(false);
  };

  const fetchLookupData = async () => {
    const [classesRes, yearsRes, sectionsRes, typesRes] = await Promise.all([
      supabase.from('class_groups').select('id, name'),
      supabase.from('studying_years').select('id, name'),
      supabase.from('sections').select('id, name'),
      supabase.from('student_types').select('id, name')
    ]);

    setOptions({
        classes: classesRes.data || [],
        years: yearsRes.data || [],
        sections: sectionsRes.data || [],
        types: typesRes.data || []
    });

    let fetchedStudents: any[] = [];
    let page = 0;
    const CHUNK_SIZE = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('students')
            .select('id, name, roll_number, class, section, studying_year, student_type_id')
            .order('name', { ascending: true })
            .range(page * CHUNK_SIZE, (page + 1) * CHUNK_SIZE - 1);

        if (error) {
            toast.error("Error loading complete student list.");
            break;
        }
        if (!data || data.length === 0) break;
        fetchedStudents = [...fetchedStudents, ...data];
        if (data.length < CHUNK_SIZE) break;
        page++;
    }
    setAllStudents(fetchedStudents);
  };

  useEffect(() => {
    fetchBatchDetails();
    fetchLookupData();
  }, [batchId]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter(i => i.status === 'paid').length;
    const partial = invoices.filter(i => i.status === 'unpaid' && i.paid_amount > 0).length;
    const unpaid = invoices.filter(i => i.status === 'unpaid' && i.paid_amount === 0).length;
    const totalCollected = invoices.reduce((sum, i) => sum + i.paid_amount, 0);

    return { total, paid, partial, unpaid, totalCollected };
  }, [invoices]);

  const getRowStatus = (invoice: StudentInvoice) => {
    if (invoice.status === 'paid') return 'Paid';
    if (invoice.paid_amount > 0) return 'Partial';
    return 'Unpaid';
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (invoices.length === 0) {
        toast.info("No data to export.");
        return;
    }

    const dataToExport = invoices.map(inv => ({
        "Roll Number": inv.students.roll_number,
        "Student Name": inv.students.name,
        "Status": getRowStatus(inv),
        "Total Amount": inv.total_amount,
        "Paid Amount": inv.paid_amount,
        "Balance": inv.total_amount - inv.paid_amount,
        "Due Date": batchInfo?.due_date || ""
    }));

    if (format === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Fee Batch Report: ${batchInfo?.description || 'Batch Details'}`, 14, 15);
        
        doc.setFontSize(10);
        doc.text(`Total Students: ${stats.total}`, 14, 22);
        doc.text(`Paid: ${stats.paid} | Partial: ${stats.partial} | Unpaid: ${stats.unpaid}`, 14, 27);
        doc.text(`Total Collected: Rs. ${stats.totalCollected.toLocaleString()}`, 14, 32);

        autoTable(doc, {
            startY: 38,
            head: [["Roll No", "Student Name", "Status", "Total", "Paid", "Balance"]],
            body: dataToExport.map(row => [
                row["Roll Number"], 
                row["Student Name"], 
                row["Status"], 
                row["Total Amount"],
                row["Paid Amount"],
                row["Balance"]
            ]),
            theme: 'striped',
            headStyles: { fillColor: [51, 122, 183] }
        });
        doc.save(`Batch_Report_${batchId}.pdf`);
    } else {
        const rows: any[] = [];
        rows.push(["FEE BATCH REPORT: " + batchInfo?.description]);
        rows.push(["Generated on: " + new Date().toLocaleDateString()]);
        rows.push([]);
        rows.push(["SUMMARY"]);
        rows.push(["Status", "Count"]);
        rows.push(["Total Students", stats.total]);
        rows.push(["Paid", stats.paid]);
        rows.push(["Partially Paid", stats.partial]);
        rows.push(["Unpaid", stats.unpaid]);
        rows.push(["Total Collected", stats.totalCollected]);
        rows.push([]);
        rows.push(["Roll Number", "Student Name", "Status", "Total Amount", "Paid Amount", "Balance", "Due Date"]);
        
        dataToExport.forEach(row => {
            rows.push([
                row["Roll Number"], 
                row["Student Name"], 
                row["Status"], 
                row["Total Amount"], 
                row["Paid Amount"], 
                row["Balance"], 
                row["Due Date"]
            ]);
        });

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Batch_Export_${batchId}.csv`;
        link.click();
    }
    toast.success("Detailed report exported successfully!");
  };

  const handleDeleteInvoice = async () => {
    if (!deleteId) return;
    const toastId = toast.loading("Removing student from batch...");
    const { error } = await supabase.from("invoices").delete().eq("id", deleteId);
    if (error) toast.error(`Failed to delete: ${error.message}`, { id: toastId });
    else {
      toast.success("Student removed from batch.", { id: toastId });
      setInvoices(prev => prev.filter(inv => inv.id !== deleteId));
    }
    setDeleteId(null);
  };

  const handleAddStudent = async (studentId: string, silent: boolean = false) => {
    if (invoices.some(inv => inv.students.id === studentId)) {
        if (!silent) toast.error("Student is already in this batch.");
        return null;
    }
    if (!batchInfo) {
        if (!silent) toast.error("Batch info loading...");
        return null;
    }

    if (!silent) setProcessingId(studentId);

    try {
        const { data: newInvoice, error } = await supabase.from('invoices').insert({
            student_id: studentId,
            batch_id: batchId,
            batch_description: batchInfo.description,
            total_amount: batchInfo.amount,
            due_date: batchInfo.due_date,
            penalty_amount_per_day: batchInfo.penalty,
            status: 'unpaid',
            paid_amount: 0
        }).select('id, status, paid_amount, total_amount, students(id, roll_number, name)').single();

        if (error) throw error;

        await supabase.from('invoice_items').insert({
            invoice_id: (newInvoice as any).id,
            description: batchInfo.description,
            amount: batchInfo.amount
        });

        const normalizedInvoice = newInvoice as StudentInvoice;
        if (!silent) {
            setInvoices(prev => [...prev, normalizedInvoice]);
            toast.success("Student added successfully!");
        }
        return normalizedInvoice;
    } catch (err: any) {
        if (!silent) toast.error(`Error: ${err.message}`);
        return null;
    } finally {
        if (!silent) setProcessingId(null);
    }
  };

  const handleBulkAdd = async () => {
    const toAdd = searchedStudents.filter(s => !invoices.some(inv => inv.students.id === s.id));
    if (toAdd.length === 0) {
        toast.info("No new students to add.");
        return;
    }

    setIsProvisioning(true);
    const toastId = toast.loading(`Assigning fee to ${toAdd.length} students...`);
    let successCount = 0;
    const newInvoices: StudentInvoice[] = [];

    for (const student of toAdd) {
        const res = await handleAddStudent(student.id, true);
        if (res) {
            successCount++;
            newInvoices.push(res);
        }
    }

    if (successCount > 0) {
        setInvoices(prev => [...prev, ...newInvoices]);
        toast.success(`Provisioned ${successCount} students!`, { id: toastId });
    }
    setIsProvisioning(false);
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.students.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.students.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchedStudents = useMemo(() => {
    return allStudents.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(dialogSearch.toLowerCase()) || 
                           s.roll_number.toLowerCase().includes(dialogSearch.toLowerCase());
      const matchesClass = filterClass === 'all' || s.class === filterClass;
      const matchesSY = filterSY === 'all' || s.studying_year === filterSY;
      const matchesSection = filterSection === 'all' || s.section === filterSection;
      const matchesType = filterType === 'all' || s.student_type_id === filterType;
      return matchesSearch && matchesClass && matchesSY && matchesSection && matchesType;
    });
  }, [allStudents, dialogSearch, filterClass, filterSY, filterSection, filterType]);

  const resetDialogFilters = () => {
    setDialogSearch(""); setFilterClass("all"); setFilterSY("all"); setFilterSection("all"); setFilterType("all");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/billing"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <CardTitle className="text-2xl font-ubuntu">{batchInfo?.description || "Loading..."}</CardTitle>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Batch Performance:</span>
                        <Badge variant="outline" className="text-[10px] font-black border-emerald-200 text-emerald-700 bg-emerald-50">PAID: {stats.paid}</Badge>
                        <Badge variant="outline" className="text-[10px] font-black border-amber-200 text-amber-700 bg-amber-50">PARTIAL: {stats.partial}</Badge>
                        <Badge variant="outline" className="text-[10px] font-black border-rose-200 text-rose-700 bg-rose-50">UNPAID: {stats.unpaid}</Badge>
                        <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">Total: {stats.total}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9 font-bold">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="gap-2 h-9 font-bold">
                    <Download className="h-4 w-4" /> PDF
                </Button>
                <Button onClick={() => setAddStudentDialogOpen(true)} className="gap-2 h-9 font-bold">
                    <UserPlus className="h-4 w-4" /> Add Student
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filter list by name or roll..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <div className="rounded-md border overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="text-right">Collection</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => {
                    const status = getRowStatus(invoice);
                    return (
                        <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.students.roll_number}</TableCell>
                        <TableCell className="font-medium text-sm">{invoice.students.name}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-black">₹{invoice.paid_amount.toLocaleString()}</span>
                                <span className="text-[9px] text-muted-foreground uppercase">of ₹{invoice.total_amount.toLocaleString()}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            {status === 'Paid' ? (
                                <Badge className="bg-emerald-500 text-white border-0 text-[10px]">PAID</Badge>
                            ) : status === 'Partial' ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 text-[10px]">PARTIAL</Badge>
                            ) : (
                                <Badge variant="destructive" className="text-[10px]">UNPAID</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => setDeleteId(invoice.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No students matched.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
            <AlertDialogDescription>This will delete the invoice record for this student from the batch.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive hover:bg-destructive/90">Confirm Removal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Student Dialog */}
      <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <div className="flex items-center justify-between pr-8">
                    <div>
                        <DialogTitle>Assign Fee to Student</DialogTitle>
                        <DialogDescription>Filter and select students to add to this batch.</DialogDescription>
                    </div>
                    {searchedStudents.length > 0 && (
                        <Button size="sm" onClick={handleBulkAdd} disabled={isProvisioning} className="gap-2 font-bold">
                            <Users className="h-4 w-4" /> Provision Matched
                        </Button>
                    )}
                </div>
            </DialogHeader>
            
            <div className="space-y-4 py-4 overflow-hidden flex flex-col flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                    <div className="col-span-full relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search name or roll..." className="pl-9 h-9" value={dialogSearch} onChange={(e) => setDialogSearch(e.target.value)} />
                    </div>
                    <Select value={filterClass} onValueChange={setFilterClass}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Class" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Classes</SelectItem>{options.classes.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterSY} onValueChange={setFilterSY}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Years</SelectItem>{options.years.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterSection} onValueChange={setFilterSection}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sec" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Sections</SelectItem>{options.sections.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={resetDialogFilters} className="h-8 text-[10px] uppercase font-bold gap-1"><FilterX className="h-3 w-3" /> Clear</Button>
                </div>

                <div className="flex items-center justify-between px-1 shrink-0">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Available Students: {searchedStudents.length}</span>
                </div>

                <ScrollArea className="flex-1 border rounded-xl bg-muted/20">
                    {searchedStudents.length > 0 ? (
                        <div className="divide-y">
                            {searchedStudents.slice(0, 100).map(student => {
                                const isAlreadyIn = invoices.some(inv => inv.students.id === student.id);
                                const isProcessing = processingId === student.id;
                                return (
                                    <div key={student.id} className="flex items-center justify-between p-3 hover:bg-background transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-primary">{student.name}</span>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                                                <span>Roll: {student.roll_number}</span>
                                                <span>•</span>
                                                <span>{student.class}-{student.section}</span>
                                            </div>
                                        </div>
                                        {isAlreadyIn ? (
                                            <Badge variant="secondary" className="gap-1 h-6 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-100"><Check className="h-2 w-2" /> Assigned</Badge>
                                        ) : (
                                            <Button size="sm" className="h-7 font-black text-[9px] uppercase px-3" onClick={() => handleAddStudent(student.id)} disabled={isProvisioning || isProcessing}>
                                                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><FilterX className="h-8 w-8 opacity-20" /><p>No students found.</p></div>
                    )}
                </ScrollArea>
            </div>
            
            <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setAddStudentDialogOpen(false)}>Close</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}