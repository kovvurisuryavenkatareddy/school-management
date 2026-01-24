"use client";

import { useState, useEffect } from "react";
import { BarChart, DollarSign, Receipt, TrendingDown, TrendingUp, Users, CreditCard, Activity } from "lucide-react";
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
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 });
const yAxisFormatter = (value: number) => `₹ ${value}`;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type Stats = {
  paidInvoices: number;
  pendingInvoices: number;
  totalInvoices: number;
  monthlyCollection: number;
  monthlyExpenses: number;
  totalStudents: number;
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
        studentsRes,
      ] = await Promise.all([
        supabase.from("invoices").select("status", { count: "exact" }),
        supabase.from("payments").select("amount").gte("created_at", currentMonthStart),
        supabase.from("expenses").select("amount").gte("expense_date", currentMonthStart),
        supabase.from("payments").select("fee_type, amount"),
        supabase.from("expenses").select("amount, departments(name)"),
        supabase.from("academic_years").select("year_name").order("year_name", { ascending: false }),
        supabase.from("students").select("*", { count: "exact", head: true }),
      ]);

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
        totalStudents: studentsRes.count || 0,
      });

      const incomeMap = new Map<string, number>();
      incomeBreakdownRes.data?.forEach(p => {
        const type = p.fee_type.includes("Tuition") ? "Tuition Fee" : "Other Fees";
        incomeMap.set(type, (incomeMap.get(type) || 0) + p.amount);
      });
      setIncomeBreakdown(Array.from(incomeMap, ([name, value]) => ({ name, value })));

      const expenseMap = new Map<string, number>();
      expenseBreakdownRes.data?.forEach((e: any) => {
        const dept = e.departments?.name || "Uncategorized";
        expenseMap.set(dept, (expenseMap.get(dept) || 0) + e.amount);
      });
      setExpenseBreakdown(Array.from(expenseMap, ([name, value]) => ({ name, value })));

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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Students" 
          value={stats?.totalStudents || 0} 
          icon={Users} 
          description="Enrolled across all years" 
          isLoading={isLoading} 
          color="blue"
        />
        <StatCard 
          title="Monthly Collection" 
          value={currencyFormatter.format(stats?.monthlyCollection || 0)} 
          icon={TrendingUp} 
          description="Collected this month" 
          isLoading={isLoading} 
          color="emerald"
        />
        <StatCard 
          title="Monthly Expenses" 
          value={currencyFormatter.format(stats?.monthlyExpenses || 0)} 
          icon={TrendingDown} 
          description="Spent this month" 
          isLoading={isLoading} 
          color="rose"
        />
        <StatCard 
          title="Current Profit" 
          value={currencyFormatter.format(profit)} 
          icon={Activity} 
          description="Monthly net balance" 
          isLoading={isLoading} 
          color={profit >= 0 ? "emerald" : "rose"}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border-muted/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Financial Overview</CardTitle>
              <CardDescription>Monthly Fee Collection vs. Expenses</CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => <SelectItem key={y.year_name} value={y.year_name}>{y.year_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={yAxisFormatter} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} 
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} 
                  formatter={(value) => currencyFormatter.format(value as number)} 
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" fill="hsl(var(--primary))" name="Collections" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="expenses" fill="#f43f5e" name="Expenses" radius={[4, 4, 0, 0]} barSize={24} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-muted/60">
          <CardHeader>
            <CardTitle className="text-xl">Invoice Status</CardTitle>
            <CardDescription>Overall tracking of generated invoices</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="240px">
              <PieChart>
                <Pie 
                  data={[
                    { name: 'Paid', value: stats?.paidInvoices || 0 },
                    { name: 'Pending', value: stats?.pendingInvoices || 0 }
                  ]} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={70} 
                  outerRadius={90} 
                  paddingAngle={5}
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#f43f5e" />
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-8 w-full px-4 mt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Invoices</p>
                <p className="text-2xl font-bold">{stats?.totalInvoices}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Pending Rate</p>
                <p className="text-2xl font-bold text-rose-600">
                  {stats?.totalInvoices ? Math.round((stats.pendingInvoices / stats.totalInvoices) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, description, isLoading, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
  };

  return (
    <Card className="shadow-sm border-muted/60 hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg", colorMap[color] || colorMap.blue)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4 mb-1" />
        ) : (
          <div className="text-2xl font-black font-ubuntu">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}