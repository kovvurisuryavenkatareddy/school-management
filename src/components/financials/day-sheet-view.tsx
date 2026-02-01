"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Printer, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function DaySheetView() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [income, setIncome] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    const startOfDay = `${selectedDate}T00:00:00Z`;
    const endOfDay = `${selectedDate}T23:59:59Z`;

    try {
      const [paymentsRes, expensesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, students(name, roll_number)')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),
        supabase
          .from('expenses')
          .select('*, departments(name)')
          .gte('expense_date', selectedDate)
          .lte('expense_date', selectedDate)
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setIncome(paymentsRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daily Accounts Sheet</CardTitle>
              <CardDescription>Consolidated income and expenditure for a single day.</CardDescription>
            </div>
            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="day-sheet-date">Select Date</Label>
                <Input 
                  id="day-sheet-date" 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="w-40"
                />
              </div>
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="Total Income" amount={totalIncome} icon={TrendingUp} color="emerald" />
        <SummaryCard title="Total Expense" amount={totalExpense} icon={TrendingDown} color="rose" />
        <SummaryCard title="Closing Balance" amount={netBalance} icon={Wallet} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Side */}
        <Card className="shadow-sm">
          <CardHeader className="bg-emerald-50/50 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-700">Income (Fee Collections)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin inline-block mr-2" /> Loading...</TableCell></TableRow>
                ) : income.length > 0 ? (
                  income.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6 text-xs">
                        <div className="font-bold">{item.students?.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.students?.roll_number}</div>
                      </TableCell>
                      <TableCell className="text-xs italic">{item.fee_type}</TableCell>
                      <TableCell className="text-right pr-6 font-bold text-emerald-600">₹{item.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No income recorded for this day.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Expense Side */}
        <Card className="shadow-sm">
          <CardHeader className="bg-rose-50/50 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-rose-700">Expenditure (Expenses)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Department</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin inline-block mr-2" /> Loading...</TableCell></TableRow>
                ) : expenses.length > 0 ? (
                  expenses.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6 text-xs font-bold">{item.departments?.name || 'N/A'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{item.description || 'N/A'}</TableCell>
                      <TableCell className="text-right pr-6 font-bold text-rose-600">₹{item.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No expenses recorded for this day.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Print-only View */}
      <div className="hidden print:block p-8 space-y-6">
        <div className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold">DAILY DAY SHEET</h1>
          <p>Date: {new Date(selectedDate).toLocaleDateString()}</p>
        </div>
        <div className="grid grid-cols-2 gap-8">
           <div>
             <h2 className="font-bold border-b mb-2">INCOME</h2>
             {income.map(i => (
               <div key={i.id} className="flex justify-between text-sm py-1 border-b border-dashed">
                 <span>{i.students?.name} ({i.students?.roll_number})</span>
                 <span className="font-bold">₹{i.amount}</span>
               </div>
             ))}
             <div className="flex justify-between font-bold mt-2 text-lg">
               <span>TOTAL INCOME:</span>
               <span>₹{totalIncome}</span>
             </div>
           </div>
           <div>
             <h2 className="font-bold border-b mb-2">EXPENDITURE</h2>
             {expenses.map(e => (
               <div key={e.id} className="flex justify-between text-sm py-1 border-b border-dashed">
                 <span>{e.departments?.name || 'N/A'} - {e.description}</span>
                 <span className="font-bold">₹{e.amount}</span>
               </div>
             ))}
             <div className="flex justify-between font-bold mt-2 text-lg">
               <span>TOTAL EXPENSE:</span>
               <span>₹{totalExpense}</span>
             </div>
           </div>
        </div>
        <div className="border-t-2 pt-4 flex justify-end">
           <div className="text-right">
             <p className="text-xl font-bold">CLOSING BALANCE: ₹{netBalance}</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, amount, icon: Icon, color }: any) {
  const colorMap: any = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
  };

  return (
    <Card className={cn("border shadow-none", colorMap[color])}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("p-2 rounded-full bg-white/50")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{title}</p>
          <p className="text-xl font-black">₹{amount.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}