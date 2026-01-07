"use client";

import { useState, useEffect } from "react";
import { BarChart, DollarSign, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, BarChart as RechartsBarChart } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 });
const yAxisFormatter = (value: number) => `₹ ${value}`;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

type Stats = {
  paidInvoices: number;
  pendingInvoices: number;
  totalInvoices: number;
  monthlyCollection: number;
  monthlyExpenses: number;
};

type BreakdownData = { name: string; value: number }[];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [barChartData, setBarChartData] = useState<any[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<BreakdownData>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<BreakdownData>([]);
  const [academicYears, setAcademicYears] = useState<{ year_name: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [
        invoiceRes,
        collectionRes,
        expensesRes,
        incomeBreakdownRes,
        expenseBreakdownRes,
        yearsRes,
      ] = await Promise.all([
        supabase.from("invoices").select("status", { count: "exact" }),
        supabase.from("payments").select("amount").gte("created_at", currentMonthStart),
        supabase.from("expenses").select("amount").gte("expense_date", currentMonthStart),
        supabase.from("payments").select("fee_type, amount"),
        supabase.from("expenses").select("amount, departments(name)"),
        supabase.from("academic_years").select("year_name").order("year_name", { ascending: false }),
      ]);

      // Process stats
      const paidInvoices = invoiceRes.data?.filter(i => i.status === 'paid').length || 0;
      const pendingInvoices = (invoiceRes.count || 0) - paidInvoices;
      const monthlyCollection = collectionRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const monthlyExpenses = expensesRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0;
      setStats({
        paidInvoices,
        pendingInvoices,
        totalInvoices: invoiceRes.count || 0,
        monthlyCollection,
        monthlyExpenses,
      });

      // Process income breakdown
      const incomeMap = new Map<string, number>();
      incomeBreakdownRes.data?.forEach(p => {
        const type = p.fee_type.includes("Tuition") ? "Tuition Fee" : "Other Fees";
        incomeMap.set(type, (incomeMap.get(type) || 0) + p.amount);
      });
      setIncomeBreakdown(Array.from(incomeMap, ([name, value]) => ({ name, value })));

      // Process expense breakdown
      const expenseMap = new Map<string, number>();
      expenseBreakdownRes.data?.forEach((e: any) => {
        const dept = e.departments?.name || "Uncategorized";
        expenseMap.set(dept, (expenseMap.get(dept) || 0) + e.amount);
      });
      setExpenseBreakdown(Array.from(expenseMap, ([name, value]) => ({ name, value })));

      // Set academic years
      if (yearsRes.data) {
        const yearSet = new Set(yearsRes.data.map(y => y.year_name.substring(0, 4)));
        const uniqueYears = Array.from(yearSet).map(y => ({ year_name: y }));
        setAcademicYears(uniqueYears);
        if (!uniqueYears.some(y => y.year_name === selectedYear)) {
          setSelectedYear(uniqueYears[0]?.year_name || new Date().getFullYear().toString());
        }
      }

      setIsLoading(false);
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchBarChartData = async () => {
      if (!selectedYear) return;

      const year = parseInt(selectedYear);
      const [paymentsRes, expensesRes] = await Promise.all([
        supabase.rpc('get_monthly_payments', { year_in: year }),
        supabase.rpc('get_monthly_expenses', { year_in: year }),
      ]);

      const monthData = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(0, i).toLocaleString('default', { month: 'short' }),
        income: 0,
        expenses: 0,
      }));

      paymentsRes.data?.forEach((p: any) => {
        const monthIndex = new Date(p.month).getMonth();
        monthData[monthIndex].income = p.total;
      });
      expensesRes.data?.forEach((e: any) => {
        const monthIndex = new Date(e.month).getMonth();
        monthData[monthIndex].expenses = e.total;
      });

      setBarChartData(monthData);
    };

    fetchBarChartData();
  }, [selectedYear]);

  const profit = (stats?.monthlyCollection || 0) - (stats?.monthlyExpenses || 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Invoices</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-12 w-full" /> : (
            <>
              <div className="text-2xl font-bold">{stats?.totalInvoices} Total</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{stats?.paidInvoices} Paid</span>, <span className="text-red-600">{stats?.pendingInvoices} Pending</span>
              </p>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fee Collection (This Month)</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-12 w-full" /> : (
            <div className="text-2xl font-bold">{currencyFormatter.format(stats?.monthlyCollection || 0)}</div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expenses (This Month)</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-12 w-full" /> : (
            <div className="text-2xl font-bold">{currencyFormatter.format(stats?.monthlyExpenses || 0)}</div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profit (This Month)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-12 w-full" /> : (
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {currencyFormatter.format(profit)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="col-span-1 lg:col-span-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fee Collection vs. Expenses</CardTitle>
              <CardDescription>Monthly comparison for the selected year.</CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => <SelectItem key={y.year_name} value={y.year_name}>{y.year_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={yAxisFormatter} />
              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'hsl(var(--background))' }} formatter={(value) => currencyFormatter.format(value as number)} />
              <Legend />
              <Bar dataKey="income" fill="#16a34a" name="Fee Collection" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#dc2626" name="Expenses" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Income Breakdown</CardTitle>
          <CardDescription>Distribution of all collected fees.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={incomeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80}>
                {incomeBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFormatter.format(value as number)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Expenses Breakdown</CardTitle>
          <CardDescription>Distribution of expenses by department.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80}>
                {expenseBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFormatter.format(value as number)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}