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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar as CalendarIcon, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function DaySheetView() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{ payments: any[], expenses: any[] }>({ payments: [], expenses: [] });

  const fetchData = async () => {
    setIsLoading(true);
    const dateStr = selectedDate;
    
    // Payments are stored with timestamp, Expenses with date.
    // We need to fetch payments for the whole day.
    const startOfDay = `${dateStr}T00:00:00Z`;
    const endOfDay = `${dateStr}T23:59:59Z`;

    try {
      const [paymentsRes, expensesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, students(name, roll_number), cashiers(name)')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),
        supabase
          .from('expenses')
          .select('*, departments(name), cashiers(name)')
          .eq('expense_date', dateStr)
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
  }, [selectedDate]);

  const totals = useMemo(() => {
    const income = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const expense = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    return { income, expense, balance: income - expense };
  }, [data]);

  return (
    <div className="space-y-6">
      <Card className="border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle>Daily Transaction Sheet</CardTitle>
            <CardDescription>Consolidated view of all cash flows for a specific date.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-picker" className="sr-only">Select Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="date-picker"
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                className="pl-9 w-[180px]"
              />
            </div>
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
                <span className="text-xs font-bold uppercase tracking-wider">Net Day Balance</span>
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
        <Card>
          <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/10 border-b">
            <CardTitle className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Income (Collections)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : data.payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Roll No</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6 text-xs font-medium">{p.students?.roll_number}</TableCell>
                      <TableCell className="text-xs">{p.students?.name}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">₹{p.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No income recorded for this date.</div>
            )}
          </CardContent>
        </Card>

        {/* Expenditure Table */}
        <Card>
          <CardHeader className="bg-rose-50/50 dark:bg-rose-950/10 border-b">
            <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-400">Expenditure (Expenses)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : data.expenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Department</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6 text-xs font-medium">{e.departments?.name || 'N/A'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{e.description || 'N/A'}</TableCell>
                      <TableCell className="text-right font-bold text-rose-600">₹{e.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No expenses recorded for this date.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}