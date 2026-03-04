"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Loader2, 
    Calendar as CalendarIcon, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Wallet, 
    FileSpreadsheet 
} from "lucide-react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { format, startOfDay, endOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRange } from "react-day-picker";

export function DaySheetView() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{ payments: any[], expenses: any[] }>({ payments: [], expenses: [] });

  const fetchData = async () => {
    if (!date?.from) return;
    
    setIsLoading(true);
    
    const fromStr = startOfDay(date.from).toISOString();
    const toStr = endOfDay(date.to || date.from).toISOString();
    
    // For expenses, we use the simple date string comparison
    const expenseFrom = format(date.from, "yyyy-MM-dd");
    const expenseTo = format(date.to || date.from, "yyyy-MM-dd");

    try {
      const [paymentsRes, expensesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, students(name, roll_number), cashiers(name)')
          .gte('created_at', fromStr)
          .lte('created_at', toStr)
          .order('created_at', { ascending: true }),
        supabase
          .from('expenses')
          .select('*, departments(name), cashiers(name)')
          .gte('expense_date', expenseFrom)
          .lte('expense_date', expenseTo)
          .order('expense_date', { ascending: true })
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setData({
        payments: paymentsRes.data || [],
        expenses: expensesRes.data || []
      });
    } catch (error: any) {
      toast.error(`Failed to fetch day sheet: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const totals = useMemo(() => {
    const income = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const expense = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    return { income, expense, balance: income - expense };
  }, [data]);

  const handleExportExcel = () => {
    if (!date?.from) return;
    if (data.payments.length === 0 && data.expenses.length === 0) {
      toast.error("No data available to export for the selected range.");
      return;
    }

    const fromLabel = format(date.from, "yyyy-MM-dd");
    const toLabel = format(date.to || date.from, "yyyy-MM-dd");

    const reportRows: any[] = [];
    reportRows.push(["CONSOLIDATED CASH FLOW REPORT"]);
    reportRows.push([`Period: ${fromLabel} to ${toLabel}`]);
    reportRows.push([]);
    reportRows.push(["INCOME (COLLECTIONS)"]);
    reportRows.push(["Date", "Roll Number", "Student Name", "Fee Description", "Mode", "Collected By", "Amount"]);
    data.payments.forEach(p => {
      reportRows.push([
        new Date(p.created_at).toLocaleDateString(),
        p.students?.roll_number,
        p.students?.name,
        p.fee_type,
        p.payment_method?.toUpperCase(),
        p.cashiers?.name || "Admin",
        p.amount
      ]);
    });
    reportRows.push(["", "", "", "", "", "TOTAL INCOME:", totals.income]);
    reportRows.push([]);
    reportRows.push(["EXPENDITURE (EXPENSES)"]);
    reportRows.push(["Date", "Department", "Description", "Mode", "Recorded By", "Amount"]);
    data.expenses.forEach(e => {
      reportRows.push([
        new Date(e.expense_date).toLocaleDateString(),
        e.departments?.name || "N/A",
        e.description || "N/A",
        e.payment_mode || "N/A",
        e.cashiers?.name || "Admin",
        e.amount
      ]);
    });
    reportRows.push(["", "", "", "", "TOTAL EXPENDITURE:", totals.expense]);
    reportRows.push([]);
    reportRows.push(["SUMMARY"]);
    reportRows.push(["Net Day Balance:", totals.balance]);

    const csv = Papa.unparse(reportRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `CashFlow_Report_${fromLabel}_to_${toLabel}.csv`;
    link.click();
    toast.success("Excel report downloaded successfully!");
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/10">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div className="space-y-1">
            <CardTitle>Daily Transaction Sheet</CardTitle>
            <CardDescription>Consolidated view of all cash flows. Select a range in the calendar.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[260px] justify-start text-left font-normal h-9",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 h-9 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="flex flex-col p-4 rounded-xl bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <ArrowUpCircle className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Total Income</span>
              </div>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">₹{totals.income.toLocaleString()}</span>
            </div>
            <div className="flex flex-col p-4 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
                <ArrowDownCircle className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Total Expenditure</span>
              </div>
              <span className="text-2xl font-black text-rose-700 dark:text-rose-300">₹{totals.expense.toLocaleString()}</span>
            </div>
            <div className="flex flex-col p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Net Period Balance</span>
              </div>
              <span className={cn("text-2xl font-black", totals.balance >= 0 ? "text-primary" : "text-rose-600")}>
                ₹{totals.balance.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Table */}
        <Card className="shadow-sm">
          <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/10 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Income Details</CardTitle>
            <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-700 font-bold">{data.payments.length} Records</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : data.payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Student (Roll No)</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6 text-[10px] font-mono text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold">{p.students?.name}</div>
                        <div className="text-[10px] text-muted-foreground">{p.students?.roll_number}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">₹{p.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No income recorded for this period.</div>
            )}
          </CardContent>
        </Card>

        {/* Expenditure Table */}
        <Card className="shadow-sm">
          <CardHeader className="bg-rose-50/50 dark:bg-rose-950/10 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-400">Expenditure Details</CardTitle>
            <Badge variant="outline" className="bg-white border-rose-200 text-rose-700 font-bold">{data.expenses.length} Records</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : data.expenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Department / Desc</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6 text-[10px] font-mono text-muted-foreground">{new Date(e.expense_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold">{e.departments?.name || 'N/A'}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{e.description || 'N/A'}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-rose-600">₹{e.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No expenses recorded for this period.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}