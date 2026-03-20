"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";

type Department = { id: string; name: string };
type Cashier = { id: string; name: string };
type Expense = {
  id: string;
  expense_date: string;
  amount: number;
  description: string | null;
  department_id: string | null;
  payment_mode: string | null;
  utr_number: string | null;
  departments: Department | null;
  cashiers: Cashier | null;
};

const formSchema = z.object({
  expense_date: z.string().min(1, "Date is required"),
  department_id: z.string().min(1, "Department is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  payment_mode: z.string().min(1, "Payment mode is required"),
  description: z.string().optional(),
  utr_number: z.string().optional(),
}).refine(data => {
  if (data.payment_mode === 'UPI') {
    return data.utr_number && data.utr_number.trim().length > 0;
  }
  return true;
}, {
  message: "UTR Number is required for UPI payments.",
  path: ["utr_number"],
});

const PAGE_SIZE = 10;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | null>(null);
  const [cashierProfile, setCashierProfile] = useState<{ id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { expense_date: new Date().toISOString().split('T')[0], amount: 0, payment_mode: "Cash", utr_number: "" },
  });

  const watchedPaymentMode = form.watch("payment_mode");

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('cashiers').select('id').eq('user_id', user.id).single();
        if (data) {
          setCashierProfile(data);
          setUserRole('cashier');
        } else {
          setUserRole('admin');
        }
      }
    };
    getProfile();
  }, []);

  const fetchData = async () => {
    if (!userRole) return;
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let expensesQuery = supabase
      .from("expenses")
      .select("*, departments(id, name), cashiers(id, name)", { count: 'exact' })
      .order("expense_date", { ascending: false })
      .range(from, to);
    
    if (userRole === 'cashier' && cashierProfile) {
      expensesQuery = expensesQuery.eq('cashier_id', cashierProfile.id);
    } else if (userRole === 'admin') {
      if (selectedCashier && selectedCashier !== 'all') {
        expensesQuery = expensesQuery.eq('cashier_id', selectedCashier);
      }
      if (selectedPaymentMode && selectedPaymentMode !== 'all') {
        expensesQuery = expensesQuery.eq('payment_mode', selectedPaymentMode);
      }
    }

    const [expensesRes, deptsRes, cashiersRes, classesRes] = await Promise.all([
      expensesQuery,
      supabase.from("departments").select("id, name"),
      userRole === 'admin' ? supabase.from("cashiers").select("id, name") : Promise.resolve({ data: [], error: null }),
      supabase.from("class_groups").select("id, name"),
    ]);

    if (expensesRes.error) toast.error("Failed to fetch expenses.");
    else {
      setExpenses(expensesRes.data as Expense[] || []);
      setTotalCount(expensesRes.count || 0);
    }

    if (deptsRes.data) setDepartments(deptsRes.data);
    if (cashiersRes.data) setCashiers(cashiersRes.data);
    if (classesRes.data) setClasses(classesRes.data);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, selectedCashier, selectedPaymentMode, userRole]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    if (editingExpense) {
      const { error } = await supabase.from("expenses").update(values).eq("id", editingExpense.id);
      if (error) toast.error(`Operation failed: ${error.message}`);
      else {
        toast.success(`Expense updated successfully!`);
        await fetchData();
        setDialogOpen(false);
      }
    } else {
      const dataToSubmit = { ...values, cashier_id: cashierProfile?.id || null };
      const { error } = await supabase.from("expenses").insert([dataToSubmit]);
      if (error) toast.error(`Operation failed: ${error.message}`);
      else {
        toast.success(`Expense added successfully!`);
        await fetchData();
        setDialogOpen(false);
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("expenses").delete().eq("id", expenseToDelete.id);
    if (error) toast.error("Failed to delete expense.");
    else {
      toast.success("Expense deleted successfully!");
      fetchData();
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    form.reset({
      ...expense,
      description: expense.description || "",
      department_id: expense.department_id || "",
      payment_mode: expense.payment_mode || "Cash",
      utr_number: expense.utr_number || "",
    });
    setDialogOpen(true);
  };

  const handleDownload = async (format: 'csv' | 'pdf') => {
    if (!startDate || !endDate) {
        toast.error("Please ensure date range is selected.");
        return;
    }

    const toastId = toast.loading("Generating Receipts report...");

    try {
        const { data: rawPayments, error: pErr } = await supabase.from("payments")
            .select("created_at, amount, fee_type, notes, payment_method, students(name, roll_number, class), cashiers(name)")
            .gte('created_at', new Date(startDate).toISOString())
            .lte('created_at', new Date(endDate + 'T23:59:59Z').toISOString());

        const { data: expensesData, error: eErr } = await supabase.from("expenses")
            .select("expense_date, amount, description, payment_mode, departments(name), cashiers(name)")
            .gte('expense_date', startDate)
            .lte('expense_date', endDate);

        if (pErr || eErr) throw new Error("Failed to fetch transaction data.");

        const filteredPayments = selectedClasses.length > 0 
            ? (rawPayments || []).filter((p: any) => {
                const s = Array.isArray(p.students) ? p.students[0] : p.students;
                return selectedClasses.includes(s?.class);
              })
            : (rawPayments || []);

        if (filteredPayments.length === 0 && (expensesData || []).length === 0) {
            toast.info("No records found for the selected criteria.", { id: toastId });
            setExportDialogOpen(false);
            return;
        }

        const totalIncome = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalCash = filteredPayments.filter(p => p.payment_method?.toLowerCase() === 'cash').reduce((sum, p) => sum + p.amount, 0);
        const totalUpi = filteredPayments.filter(p => p.payment_method?.toLowerCase() === 'upi').reduce((sum, p) => sum + p.amount, 0);
        const totalExp = (expensesData || []).reduce((sum, e) => sum + (e.amount || 0), 0);

        const formatDate = (d: string) => {
            const dt = new Date(d);
            return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
        };

        if (format === 'pdf') {
            const doc = new jsPDF();
            doc.text("Receipts", 14, 15);
            doc.setFontSize(10);
            doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, 22);

            autoTable(doc, {
                startY: 28,
                head: [["S.No", "Date", "Student Name", "Group", "Cash", "UPI", "Cashier"]],
                body: filteredPayments.map((p: any, idx) => {
                    const s = Array.isArray(p.students) ? p.students[0] : p.students;
                    const isCash = p.payment_method?.toLowerCase() === 'cash';
                    return [
                        idx + 1,
                        formatDate(p.created_at),
                        s?.name || 'N/A',
                        s?.class || 'N/A',
                        isCash ? p.amount.toFixed(2) : '-',
                        !isCash ? p.amount.toFixed(2) : '-',
                        p.cashiers?.name || 'Admin'
                    ];
                }),
                theme: 'striped',
                headStyles: { fillColor: [63, 81, 181] }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 35;
            autoTable(doc, {
                startY: finalY + 10,
                head: [[{ content: 'FINANCE SUMMARY', colSpan: 2, styles: { halign: 'left', fillColor: [240, 240, 240] } }]],
                body: [
                    ['Total Cash Collections', `Rs. ${totalCash.toFixed(2)}`],
                    ['Total UPI Collections', `Rs. ${totalUpi.toFixed(2)}`],
                    ['Total Income', `Rs. ${totalIncome.toFixed(2)}`],
                    ['Total Expenditure', `Rs. ${totalExp.toFixed(2)}`],
                    ['Net Balance', `Rs. ${(totalIncome - totalExp).toFixed(2)}`]
                ],
                theme: 'grid',
                styles: { fontStyle: 'bold' }
            });

            doc.save(`Receipts_${startDate}_to_${endDate}.pdf`);
        } else {
            const rows: any[] = [["Receipts Report"], [`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`], [], ["S.No", "Date", "Student Name", "Group", "Cash", "UPI", "Cashier"]];
            filteredPayments.forEach((p: any, idx) => {
                const s = Array.isArray(p.students) ? p.students[0] : p.students;
                const isCash = p.payment_method?.toLowerCase() === 'cash';
                rows.push([
                    idx + 1, 
                    formatDate(p.created_at), 
                    s?.name || 'N/A', 
                    s?.class || 'N/A', 
                    isCash ? p.amount : '-', 
                    !isCash ? p.amount : '-', 
                    p.cashiers?.name || 'Admin'
                ]);
            });
            rows.push([], ["SUMMARY"], ["Total Cash Collections", totalCash], ["Total UPI Collections", totalUpi], ["Total Income", totalIncome], ["Total Expenditure", totalExp], ["Net Balance", totalIncome - totalExp]);
            const csv = Papa.unparse(rows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Receipts_${startDate}_to_${endDate}.csv`;
            link.click();
        }
        toast.success("Report downloaded successfully!", { id: toastId });
    } catch (error: any) {
        toast.error(error.message, { id: toastId });
    } finally {
        setExportDialogOpen(false);
    }
  };

  const handleOpenExport = (todayOnly: boolean = false) => {
    if (todayOnly) {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
    } else {
        if (!startDate || !endDate) {
            toast.error("Please select a date range first.");
            return;
        }
    }
    setExportDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingExpense(null);
      form.reset({ expense_date: new Date().toISOString().split('T')[0], amount: 0, description: "", department_id: "", payment_mode: "Cash", utr_number: "" });
    }
  }, [dialogOpen, form]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><CardTitle>Expenses & Reports</CardTitle><CardDescription>Track institutional spending and audit collection receipts.</CardDescription></div>
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><PlusCircle className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Add Expense</span></Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>{editingExpense ? "Edit" : "Add"} Expense</DialogTitle></DialogHeader>
                  <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="expense_date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="department_id" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="payment_mode" render={({ field }) => (<FormItem><FormLabel>Mode</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    {watchedPaymentMode === 'UPI' && (<FormField control={form.control} name="utr_number" render={({ field }) => (<FormItem><FormLabel>UTR #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>Save</Button></DialogFooter>
                  </form></Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 items-end">
            <div className="space-y-1.5"><Label>Group Filter</Label><MultiSelect options={classes.map(c => ({ label: c.name, value: c.name }))} value={selectedClasses} onChange={setSelectedClasses} placeholder="All Groups" /></div>
            <div className="space-y-1.5"><Label>From</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1" onClick={() => handleOpenExport(false)}>
                <Download className="h-3.5 w-3.5" /> Report
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => handleOpenExport(true)}>Today</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Department</TableHead><TableHead>Cashier</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Description</TableHead><TableHead className="sr-only">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (<TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>) : expenses.length > 0 ? (expenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>{new Date(exp.expense_date).toLocaleDateString()}</TableCell>
                  <TableCell>{exp.departments?.name || 'N/A'}</TableCell>
                  <TableCell>{exp.cashiers?.name || 'Admin'}</TableCell>
                  <TableCell className="font-bold">₹{exp.amount.toLocaleString()}</TableCell>
                  <TableCell>{exp.payment_mode}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{exp.description}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem onClick={() => handleEdit(exp)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => { setExpenseToDelete(exp); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))) : (<TableRow><TableCell colSpan={7} className="text-center">No records.</TableCell></TableRow>)}
            </TableBody>
          </Table>
          <DataTablePagination currentPage={currentPage} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onPageChange={setCurrentPage} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the expense record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Export Receipts</DialogTitle><DialogDescription>Format: Indian Date, Group breakdown.</DialogDescription></DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => handleDownload('csv')}>Excel (CSV)</Button>
            <Button onClick={() => handleDownload('pdf')} variant="secondary">PDF Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}