"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Search, Loader2, UserPlus, Check, FilterX, Users } from "lucide-react";

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
  
  // Dialog state
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Dialog filters
  const [dialogSearch, setDialogSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSY, setFilterSY] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Options for filters
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
      .select("id, status, batch_description, total_amount, due_date, penalty_amount_per_day, students(id, roll_number, name)")
      .eq("batch_id", batchId);

    if (error) {
      toast.error("Failed to fetch batch details.");
    } else {
      const normalized: StudentInvoice[] = (data || []).map((row: any) => ({
        id: row.id,
        status: row.status,
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
    // 1. Fetch Lookups
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

    // 2. Fetch ALL students in chunks (Supabase has a 1000 row limit by default)
    let fetchedStudents: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('students')
            .select('id, name, roll_number, class, section, studying_year, student_type_id')
            .order('name', { ascending: true })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            toast.error("Error loading complete student list.");
            break;
        }

        if (!data || data.length === 0) break;
        
        fetchedStudents = [...fetchedStudents, ...data];
        if (data.length < PAGE_SIZE) break;
        page++;
    }
    
    setAllStudents(fetchedStudents);
  };

  useEffect(() => {
    fetchBatchDetails();
    fetchLookupData();
  }, [batchId]);

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
        }).select('id, status, students(id, roll_number, name)').single();

        if (error) throw error;

        await supabase.from('invoice_items').insert({
            invoice_id: (newInvoice as any).id,
            description: batchInfo.description,
            amount: batchInfo.amount
        });

        return newInvoice as StudentInvoice;
    } catch (err: any) {
        if (!silent) toast.error(`Provisioning failed: ${err.message}`);
        return null;
    }
  };

  const handleBulkAdd = async () => {
    const toAdd = searchedStudents.filter(s => !invoices.some(inv => inv.students.id === s.id));
    if (toAdd.length === 0) {
        toast.info("No new students to add based on current filters.");
        return;
    }

    setIsProvisioning(true);
    const toastId = toast.loading(`Provisioning fee to ${toAdd.length} students...`);
    
    let successCount = 0;
    const results = [];

    for (const student of toAdd) {
        const res = await handleAddStudent(student.id, true);
        if (res) {
            successCount++;
            results.push(res);
        }
    }

    setInvoices(prev => [...prev, ...results]);
    toast.success(`Successfully assigned fee to ${successCount} students!`, { id: toastId });
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
    setDialogSearch("");
    setFilterClass("all");
    setFilterSY("all");
    setFilterSection("all");
    setFilterType("all");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                <Link href="/billing">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                </Button>
                <div>
                <CardTitle>{batchInfo?.description || "Loading Batch..."}</CardTitle>
                <CardDescription>
                    {invoices.length} total students assigned to this fee batch.
                </CardDescription>
                </div>
            </div>
            <Button onClick={() => setAddStudentDialogOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" /> Add Student to Batch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter list by name or roll..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.students.roll_number}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {invoice.students.name}
                      </TableCell>
                      <TableCell>
                        {invoice.status === "paid" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200">Unpaid</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => setDeleteId(invoice.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                      No matching students found in this batch.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student from Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete this specific invoice record. This action is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <div className="flex items-center justify-between pr-8">
                    <div>
                        <DialogTitle>Assign Fee to Student</DialogTitle>
                        <DialogDescription>Filter and select students to add to this invoice batch.</DialogDescription>
                    </div>
                    {searchedStudents.length > 0 && (
                        <Button size="sm" onClick={handleBulkAdd} disabled={isProvisioning} className="gap-2">
                            <Users className="h-4 w-4" /> Provision All Matched
                        </Button>
                    )}
                </div>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="col-span-full relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search name or roll number..." 
                            className="pl-9 h-9"
                            value={dialogSearch}
                            onChange={(e) => setDialogSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Class</Label>
                        <Select value={filterClass} onValueChange={setFilterClass}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Classes</SelectItem>
                                {options.classes.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Studying Year</Label>
                        <Select value={filterSY} onValueChange={setFilterSY}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {options.years.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Section</Label>
                        <Select value={filterSection} onValueChange={setFilterSection}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {options.sections.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Student Type</Label>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {options.types.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="flex items-end">
                        <Button variant="ghost" size="sm" onClick={resetDialogFilters} className="h-8 text-[10px] uppercase font-bold gap-1">
                            <FilterX className="h-3 w-3" /> Clear Filters
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Matched: {searchedStudents.length}</span>
                </div>

                <ScrollArea className="h-72 border rounded-xl bg-muted/20">
                    {searchedStudents.length > 0 ? (
                        <div className="divide-y">
                            {searchedStudents.slice(0, 250).map(student => {
                                const isAlreadyIn = invoices.some(inv => inv.students.id === student.id);
                                return (
                                    <div key={student.id} className="flex items-center justify-between p-3 hover:bg-background transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-primary">{student.name}</span>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                                                <span>Roll: {student.roll_number}</span>
                                                <span>•</span>
                                                <span>{student.class}-{student.section}</span>
                                                <span>•</span>
                                                <span>{student.studying_year}</span>
                                            </div>
                                        </div>
                                        {isAlreadyIn ? (
                                            <Badge variant="secondary" className="gap-1 h-6 text-[9px]"><Check className="h-2 w-2" /> Assigned</Badge>
                                        ) : (
                                            <Button 
                                                size="sm" 
                                                className="h-8 font-black text-[10px] uppercase px-4"
                                                onClick={() => handleAddStudent(student.id)}
                                                disabled={isProvisioning}
                                            >
                                                Add Student
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-sm text-muted-foreground italic flex flex-col items-center gap-2">
                            <FilterX className="h-8 w-8 opacity-20" />
                            <p>No matching students found with current filters.</p>
                        </div>
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