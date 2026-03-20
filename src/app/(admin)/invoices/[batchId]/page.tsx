"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Search, Loader2, UserPlus, Check } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [isProvisioning, setIsProvisioning] = useState(false);

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

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('id, name, roll_number').order('name', { ascending: true });
    if (data) setAllStudents(data);
  };

  useEffect(() => {
    fetchBatchDetails();
    fetchStudents();
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

  const handleAddStudent = async (studentId: string) => {
    if (invoices.some(inv => inv.students.id === studentId)) {
        toast.error("Student is already in this batch.");
        return;
    }

    setIsProvisioning(true);
    const toastId = toast.loading("Provisioning fee to student...");

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

        // Add to invoice items
        await supabase.from('invoice_items').insert({
            invoice_id: (newInvoice as any).id,
            description: batchInfo.description,
            amount: batchInfo.amount
        });

        toast.success("Student added successfully!", { id: toastId });
        setInvoices(prev => [...prev, newInvoice as any]);
        setAddStudentDialogOpen(false);
    } catch (err: any) {
        toast.error(`Provisioning failed: ${err.message}`, { id: toastId });
    } finally {
        setIsProvisioning(false);
    }
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.students.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.students.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchedStudents = allStudents.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(studentSearch.toLowerCase())
  ).slice(0, 10);

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
              placeholder="Filter by name or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="rounded-md border">
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
                      <TableCell>{invoice.students.roll_number}</TableCell>
                      <TableCell className="font-medium">
                        {invoice.students.name}
                      </TableCell>
                      <TableCell>
                        {invoice.status === "paid" ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
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
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      No matching student invoices found.
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
              This will delete this specific invoice. This action is permanent and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Assign Fee to Student</DialogTitle>
                <DialogDescription>Search for a student who does not yet have this fee assigned.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search name or roll number..." 
                        className="pl-9"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                    />
                </div>
                <ScrollArea className="h-64 border rounded-md">
                    {searchedStudents.length > 0 ? (
                        <div className="divide-y">
                            {searchedStudents.map(student => {
                                const isAlreadyIn = invoices.some(inv => inv.students.id === student.id);
                                return (
                                    <div key={student.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{student.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Roll: {student.roll_number}</span>
                                        </div>
                                        {isAlreadyIn ? (
                                            <Badge variant="secondary" className="gap-1 h-6"><Check className="h-3 w-3" /> Already In</Badge>
                                        ) : (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 font-bold"
                                                onClick={() => handleAddStudent(student.id)}
                                                disabled={isProvisioning}
                                            >
                                                Add
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground italic">No students found.</div>
                    )}
                </ScrollArea>
            </div>
            <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setAddStudentDialogOpen(false)}>Close</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}