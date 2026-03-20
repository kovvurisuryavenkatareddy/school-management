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
  const [exportDateRange, setExportDateRange] = useState<{ start: string, end: string } | null>(null);

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
      const { error } = await supabase
        .from("expenses")
        .update(values)
        .eq("id", editingExpense.id);

      if (error) {
        toast.error(`Operation failed: ${error.message}`);
      } else {
        toast.success(`Expense updated successfully!`);
        await fetchData();
        setDialogOpen(false);
      }
    } else {
      const dataToSubmit = {
        ...values,
        cashier_id: cashierProfile?.id || null,
      };
      const { error } = await supabase.from("expenses").insert([dataToSubmit]);

      if (error) {
        toast.error(`Operation failed: ${error.message}`);
      } else {
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
    if (!exportDateRange) return;
    const { start, end } = exportDateRange;
    const toastId = toast.loading("Generating receipts report...");

    let paymentsQuery = supabase.from("payments")
      .select("created_at, amount, fee_type, notes, payment_method, students(name, roll_number, class), cashiers(name)")
      .gte('created_at', new Date(start).toISOString())
      .lte('created_at', new Date(end + 'T23:59:59Z').toISOString());

    if (selectedClasses.length > 0) {
      // Note: Supabase nested filtering might require special handling depending on schema
      // Here we assume standard relational filtering
    }

    const [paymentsRes, expensesRes] = await Promise.all([
      paymentsQuery,
      supabase.from("expenses")
        .select("expense_date, amount, description, payment_mode, departments(name), cashiers(name)")
        .gte('expense_date', start)
        .lte('expense_date', end)
    ]);

    if (paymentsRes.error) {
      toast.error("Failed to fetch income data.", { id: toastId });
      return;
    }

    const allPaymentsRaw = paymentsRes.data || [];
    
    // Manual filtering for classes if applied
    const paymentsData = selectedClasses.length > 0 
      ? allPaymentsRaw.filter((p: any) => {
          const s = Array.isArray(p.students) ? p.students[0] : p.students;
          return selectedClasses.includes(s?.class);
        })
      : allPaymentsRaw;

    const expensesData = expensesRes.data || [];

    const totalIncome = paymentsData.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalCashIncome = paymentsData.filter(p => p.payment_method?.toLowerCase() === 'cash').reduce((sum, p) => sum + p.amount, 0);
    const totalUpiIncome = paymentsData.filter(p => p.payment_method?.toLowerCase() === 'upi').reduce((sum, p) => sum + p.amount, 0);
    const totalExpense = expensesData.reduce((sum, e) => sum + (e.amount || 0), 0);

    if (paymentsData.length === 0 && expensesData.length === 0) {
      toast.info("No records found.", { id: toastId });
      setExportDialogOpen(false);
      return;
    }

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text(`Receipts: ${formatDate(start)} to ${formatDate(end)}`, 14, 15);
      
      autoTable(doc, {
        startY: 25,
        head: [["S.No", "Date", "Student Name", "Group", "Cash", "UPI", "Cashier"]],
        body: paymentsData.map((p: any, idx) => {
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

      const finalY = (doc as any).lastAutoTable.finalY || 30;

      autoTable(doc, {
        startY: finalY + 10,
        head: [[{ content: 'FINANCE SUMMARY', colSpan: 2, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }]],
        body: [
            ['Total Cash Collections', `Rs. ${totalCashIncome.toFixed(2)}`],
            ['Total UPI Collections', `Rs. ${totalUpiIncome.toFixed(2)}`],
            ['Total Income', `Rs. ${totalIncome.toFixed(2)}`],
            ['Total Expenditure', `Rs. ${totalExpense.toFixed(2)}`],
            ['Net Balance', `Rs. ${(totalIncome - totalExpense).toFixed(2)}`]
        ],
        theme: 'grid',
        styles: { fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 100 } }
      });

      doc.save(`Receipts_${start}_to_${end}.pdf`);
    } else {
      const reportRows: any[] = [];
      reportRows.push(["Receipts Report"]);
      reportRows.push([`Period: ${formatDate(start)} to ${formatDate(end)}`]);
      reportRows.push([]);
      reportRows.push(["S.No", "Date", "Student Name", "Group", "Cash", "UPI", "Cashier"]);
      
      paymentsData.forEach((p, idx) => {
        const s = Array.isArray(p.students) ? p.students[0] : p.students;
        const isCash = p.payment_method?.toLowerCase() === 'cash';
        reportRows.push([
            idx + 1,
            formatDate(p.created_at),
            s?.name || 'N/A',
            s?.class || 'N/A',
            isCash ? p.amount : '-',
            !isCash ? p.amount : '-',
            p.cashiers?.name || 'Admin'
        ]);
      });

      reportRows.push([]);
      reportRows.push(["FINANCE SUMMARY"]);
      reportRows.push(["Total Cash", totalCashIncome.toFixed(2)]);
      reportRows.push(["Total UPI", totalUpiIncome.toFixed(2)]);
      reportRows.push(["Total Income", totalIncome.toFixed(2)]);
      reportRows.push(["Total Expenditure", totalExpense.toFixed(2)]);
      reportRows.push(["Net Balance", (totalIncome - totalExpense).toFixed(2)]);

      const csv = Papa.unparse(reportRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Receipts_${start}_to_${end}.csv`;
      link.click();
    }
    
    toast.success("Receipts report generated successfully.", { id: toastId });
    setExportDialogOpen(false);
  };

  const openExportDialog = (start: string, end: string) => {
    if (!start || !end) {
      toast.error("Please select both a start and end date.");
      return;
    }
    setExportDateRange({ start, end });
    setExportDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Expenses & Reports</CardTitle>
              <CardDescription>Track institutional spending and audit collection receipts.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">Add Expense</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingExpense ? "Edit" : "Add"} Expense</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="expense_date" render={({ field }) => (
                        <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="department_id" render={({ field }) => (
                        <FormItem><FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl>
                            <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                          </Select>
                        <FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="payment_mode" render={({ field }) => (
                        <FormItem><FormLabel>Payment Mode</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a payment mode" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem></SelectContent>
                          </Select>
                        <FormMessage /></FormItem>
                      )} />
                      {watchedPaymentMode === 'UPI' && (
                        <FormField control={form.control} name="utr_number" render={({ field }) => (
                          <FormItem>
                            <FormLabel>UTR Number</FormLabel>
                            <FormControl><Input {...field} placeholder="Enter UTR number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormMessage /></FormItem>
                      )} />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 items-end">
            <div className="space-y-1.5">
              <Label>Filter Group (Class)</Label>
              <MultiSelect
                options={classes.map(c => ({ label: c.name, value: c.name }))}
                value={selectedClasses}
                onChange={setSelectedClasses}
                placeholder="All Groups"
              />
            </div>
            <div className="space-y-1.5">
              <Label>From Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1" onClick={() => openExportDialog(startDate, endDate)}>
                <Download className="h-3.5 w-3.5" /> Report
              </Button>
              <Button variant="outline" className="flex-1 gap-1" onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                openExportDialog(today, today);
              }}>
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Description</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
              ) : expenses.length > 0 ? (
                expenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{new Date(exp.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell>{exp.departments?.name || 'N/A'}</TableCell>
                    <TableCell>{exp.cashiers?.name || 'Admin'}</TableCell>
                    <TableCell className="font-bold">₹{exp.amount.toLocaleString()}</TableCell>
                    <TableCell>{exp.payment_mode}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{exp.description}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handleEdit(exp)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setExpenseToDelete(exp); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center">No expenses found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <DataTablePagination currentPage={currentPage} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onPageChange={setCurrentPage} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the expense record.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Export Receipts Report</DialogTitle><DialogDescription>Format: Indian Date, Group breakdown.</DialogDescription></DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => handleDownload('csv')}>Excel (CSV)</Button>
            <Button onClick={() => handleDownload('pdf')} variant="secondary">PDF Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}