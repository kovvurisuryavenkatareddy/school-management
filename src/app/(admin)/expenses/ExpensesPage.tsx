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

    const [expensesRes, deptsRes, cashiersRes] = await Promise.all([
      expensesQuery,
      supabase.from("departments").select("id, name"),
      userRole === 'admin' ? supabase.from("cashiers").select("id, name") : Promise.resolve({ data: [], error: null }),
    ]);

    if (expensesRes.error) toast.error("Failed to fetch expenses.");
    else {
      setExpenses(expensesRes.data as Expense[] || []);
      setTotalCount(expensesRes.count || 0);
    }

    if (deptsRes.error) toast.error("Failed to fetch departments.");
    else setDepartments(deptsRes.data || []);

    if (cashiersRes.error) toast.error("Failed to fetch cashiers.");
    else setCashiers(cashiersRes.data || []);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, selectedCashier, selectedPaymentMode, userRole]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    if (editingExpense) {
      // When admin edits, we only update form values, preserving the original cashier_id
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
      // When creating a new expense
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
    const toastId = toast.loading("Generating report...");

    let paymentsQuery = supabase.from("payments")
      .select("created_at, amount, fee_type, notes, payment_method, students(name, roll_number), cashiers(name)")
      .gte('created_at', new Date(start).toISOString())
      .lte('created_at', new Date(end + 'T23:59:59Z').toISOString());

    let expensesQuery = supabase.from("expenses")
      .select("expense_date, amount, description, payment_mode, departments(name), cashiers(name)")
      .gte('expense_date', start)
      .lte('expense_date', end);

    if (userRole === 'cashier' && cashierProfile) {
      paymentsQuery = paymentsQuery.eq('cashier_id', cashierProfile.id);
      expensesQuery = expensesQuery.eq('cashier_id', cashierProfile.id);
    } else if (userRole === 'admin' && selectedCashier && selectedCashier !== 'all') {
      paymentsQuery = paymentsQuery.eq('cashier_id', selectedCashier);
      expensesQuery = expensesQuery.eq('cashier_id', selectedCashier);
    }

    const [paymentsRes, expensesRes] = await Promise.all([paymentsQuery, expensesQuery]);

    if (paymentsRes.error || expensesRes.error) {
      toast.error("Failed to fetch report data.", { id: toastId });
      return;
    }

    const paymentsData = paymentsRes.data || [];
    const expensesData = expensesRes.data || [];

    if (paymentsData.length === 0 && expensesData.length === 0) {
      toast.info("No payments or expenses recorded in the selected date range.", { id: toastId });
      setExportDialogOpen(false);
      return;
    }

    let totalIncome = paymentsData.reduce((sum, p) => sum + p.amount, 0);
    let totalExpense = expensesData.reduce((sum, e) => sum + e.amount, 0);

    if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text(`Report from ${start} to ${end}`, 14, 15);
      let lastY = 15;

      if (paymentsData.length > 0) {
        autoTable(doc, {
          startY: lastY + 7,
          head: [['Payments (Income)']],
          theme: 'plain',
          styles: { fontStyle: 'bold' }
        });
        autoTable(doc, {
          head: [["Date", "Student", "Description", "Mode", "Cashier", "Amount"]],
          body: paymentsData.map((p: any) => [
            new Date(p.created_at).toLocaleDateString(),
            `${p.students?.name || 'N/A'} (${p.students?.roll_number || 'N/A'})`,
            p.fee_type,
            p.payment_method,
            p.cashiers?.name || 'Admin/System',
            p.amount.toFixed(2),
          ]),
          foot: [[{ content: 'Total Income:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalIncome.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }]],
          showFoot: 'lastPage',
          theme: 'striped',
        });
        lastY = (doc as any).lastAutoTable.finalY;
      }

      if (expensesData.length > 0) {
        autoTable(doc, {
          startY: lastY + 10,
          head: [['Expenses']],
          theme: 'plain',
          styles: { fontStyle: 'bold' }
        });
        autoTable(doc, {
          head: [["Date", "Department", "Description", "Mode", "Cashier", "Amount"]],
          body: expensesData.map((e: any) => [
            new Date(e.expense_date).toLocaleDateString(),
            e.departments?.name || "N/A",
            e.description || "",
            e.payment_mode || "N/A",
            e.cashiers?.name || 'Admin/System',
            e.amount.toFixed(2),
          ]),
          foot: [[{ content: 'Total Expense:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalExpense.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }]],
          showFoot: 'lastPage',
          theme: 'striped',
        });
        lastY = (doc as any).lastAutoTable.finalY;
      }

      autoTable(doc, {
        startY: lastY + 10,
        head: [[{ content: 'Summary', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } }]],
        body: [
            ['Net Balance:', { content: (totalIncome - totalExpense).toFixed(2), styles: { halign: 'right' } }]
        ],
        theme: 'grid',
      });

      doc.save(`report_${start}_to_${end}.pdf`);

    } else { // CSV export
      const reportData = [];
      reportData.push([`Report from ${start} to ${end}`]);
      reportData.push([]);

      reportData.push(["Payments (Income)"]);
      reportData.push(["Date", "Student Name", "Roll Number", "Description", "Payment Mode", "Cashier", "Amount"]);
      paymentsData.forEach((p: any) => {
        reportData.push([
          new Date(p.created_at).toLocaleDateString(),
          p.students?.name || 'N/A',
          p.students?.roll_number || 'N/A',
          p.fee_type,
          p.payment_method,
          p.cashiers?.name || 'Admin/System',
          p.amount.toFixed(2),
        ]);
      });
      reportData.push(["", "", "", "", "", "Total Income:", totalIncome.toFixed(2)]);
      reportData.push([]);

      reportData.push(["Expenses"]);
      reportData.push(["Date", "Department", "Description", "Payment Mode", "Cashier", "Amount"]);
      expensesData.forEach((e: any) => {
        reportData.push([
          new Date(e.expense_date).toLocaleDateString(),
          e.departments?.name || "N/A",
          e.description || "",
          e.payment_mode || "N/A",
          e.cashiers?.name || 'Admin/System',
          e.amount.toFixed(2),
        ]);
      });
      reportData.push(["", "", "", "", "Total Expense:", totalExpense.toFixed(2)]);
      reportData.push([]);

      reportData.push(["Summary"]);
      reportData.push(["Net Balance:", (totalIncome - totalExpense).toFixed(2)]);

      const csv = Papa.unparse(reportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `report_${start}_to_${end}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    toast.success("Report downloaded successfully.", { id: toastId });
    setExportDialogOpen(false);
  };

  const openExportDialog = (start: string, end: string) => {
    if (!start || !end) {
      toast.error("Please select both a start and end date for the report.");
      return;
    }
    setExportDateRange({ start, end });
    setExportDialogOpen(true);
  };

  const handleDateRangeDownload = () => openExportDialog(startDate, endDate);
  const handleTodayDownload = () => {
    const today = new Date().toISOString().split('T')[0];
    openExportDialog(today, today);
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingExpense(null);
      form.reset({ expense_date: new Date().toISOString().split('T')[0], amount: 0, description: "", department_id: "", payment_mode: "Cash", utr_number: "" });
    }
  }, [dialogOpen, form]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Expenses & Reports</CardTitle>
              <CardDescription>Track expenses and generate financial reports.</CardDescription>
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
                        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSubmitting ? "Saving..." : "Save"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4 pt-4">
            {userRole === 'admin' && (
              <>
                <div className="flex-grow">
                  <Label>Cashier</Label>
                  <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                    <SelectTrigger><SelectValue placeholder="All Cashiers" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cashiers</SelectItem>
                      {cashiers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-grow">
                  <Label>Payment Mode</Label>
                  <Select value={selectedPaymentMode} onValueChange={setSelectedPaymentMode}>
                    <SelectTrigger><SelectValue placeholder="All Modes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modes</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex-grow">
              <Label htmlFor="start-date">From</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-grow">
              <Label htmlFor="end-date">To</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1" onClick={handleDateRangeDownload}>
                <Download className="h-3.5 w-3.5" />
                <span>Download Report</span>
              </Button>
              <Button variant="outline" className="gap-1" onClick={handleTodayDownload}>
                <Download className="h-3.5 w-3.5" />
                <span>Today's Report</span>
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
                <TableHead>Payment Mode</TableHead>
                <TableHead>UTR Number</TableHead>
                <TableHead>Description</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
              ) : expenses.length > 0 ? (
                expenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{new Date(exp.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell>{exp.departments?.name || 'N/A'}</TableCell>
                    <TableCell>{exp.cashiers?.name || 'Admin/System'}</TableCell>
                    <TableCell>{exp.amount}</TableCell>
                    <TableCell>{exp.payment_mode}</TableCell>
                    <TableCell>{exp.utr_number || 'N/A'}</TableCell>
                    <TableCell>{exp.description}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleEdit(exp)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setExpenseToDelete(exp); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="text-center">No expenses found.</TableCell></TableRow>
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
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the expense record.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Export Format</DialogTitle>
            <DialogDescription>Select the format for your report.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => handleDownload('csv')}>Download as CSV (Excel)</Button>
            <Button onClick={() => handleDownload('pdf')} variant="secondary">Download as PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}