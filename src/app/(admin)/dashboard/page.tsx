"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart, DollarSign, Receipt, TrendingDown, TrendingUp, Users, CreditCard, Activity, Building2 } from "lucide-react";
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

type Stats = {
  paidInvoices: number;
  pendingInvoices: number;
  totalInvoices: number;
  monthlyCollection: number;
  monthlyExpenses: number;
  totalStudents: number;
};

type SchoolSettings = {
  school_name: string;
  logo_url: string | null;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [barChartData, setBarChartData] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<{ year_name: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        const [
          invoiceRes,
          collectionRes,
          expensesRes,
          yearsRes,
          studentsRes,
          settingsRes,
        ] = await Promise.all([
          supabase.from("invoices").select("status"),
          supabase.from("payments").select("amount").gte("created_at", currentMonthStart),
          supabase.from("expenses").select("amount").gte("expense_date", currentMonthStart),
          supabase.from("academic_years").select("year_name").order("year_name", { ascending: false }),
          supabase.from("students").select("*", { count: "exact", head: true }),
          supabase.from("school_settings").select("school_name, logo_url").single(),
        ]);

        const invoiceData = invoiceRes.data || [];
        const paidCount = invoiceData.filter(i => i.status === 'paid').length;
        const pendingCount = invoiceData.filter(i => i.status === 'unpaid').length;
        
        const monthlyCollection = collectionRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const monthlyExpenses = expensesRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0;
        
        setStats({
          paidInvoices: paidCount,
          pendingInvoices: pendingCount,
          totalInvoices: invoiceData.length,
          monthlyCollection,
          monthlyExpenses,
          totalStudents: studentsRes.count || 0,
        });

        if (settingsRes.data) {
          setSchoolSettings(settingsRes.data);
        }

        const yearSet = new Set<string>();
        yearSet.add(new Date().getFullYear().toString());
        if (yearsRes.data) {
          yearsRes.data.forEach(y => {
            const matched = y.year_name.match(/\d{4}/);
            if (matched) yearSet.add(matched[0]);
          });
        }
        
        const uniqueYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a)).map(y => ({ year_name: y }));
        setAcademicYears(uniqueYears);
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchBarChartData = async () => {
      if (!selectedYear) return;

      const yearNum = parseInt(selectedYear);
      const [paymentsRes, expensesRes] = await Promise.all([
        supabase.rpc('get_monthly_payments', { year_in: yearNum }),
        supabase.rpc('get_monthly_expenses', { year_in: yearNum }),
      ]);

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthData = monthNames.map(name => ({
        month: name,
        income: 0,
        expenses: 0,
      }));

      if (paymentsRes.data) {
        paymentsRes.data.forEach((p: any) => {
          const date = new Date(p.month);
          const monthIndex = date.getUTCMonth();
          if (monthIndex >= 0 && monthIndex < 12) monthData[monthIndex].income = Number(p.total);
        });
      }

      if (expensesRes.data) {
        expensesRes.data.forEach((e: any) => {
          const date = new Date(e.month);
          const monthIndex = date.getUTCMonth();
          if (monthIndex >= 0 && monthIndex < 12) monthData[monthIndex].expenses = Number(e.total);
        });
      }

      setBarChartData(monthData);
    };

    fetchBarChartData();
  }, [selectedYear]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    if (stats.totalInvoices === 0) return [{ name: 'No Invoices', value: 1 }];
    return [
      { name: 'Paid', value: stats.paidInvoices },
      { name: 'Pending', value: stats.pendingInvoices }
    ];
  }, [stats]);

  const COLORS = ['#3b82f6', '#f43f5e', '#e2e8f0'];
  const profit = (stats?.monthlyCollection || 0) - (stats?.monthlyExpenses || 0);

  return (
    <div className="space-y-6">
      {/* Branded Header Section */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-background p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md">
        <div className="h-20 w-20 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {schoolSettings?.logo_url ? (
            <img src={schoolSettings.logo_url} alt="College Logo" className="h-full w-full object-contain p-1" />
          ) : (
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
          )}
        </div>
        <div className="text-center md:text-left space-y-1">
          {isLoading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <h1 className="text-2xl md:text-3xl font-ubuntu font-black text-primary tracking-tight">
              {schoolSettings?.school_name || "Welcome to the Portal"}
            </h1>
          )}
          <p className="text-muted-foreground text-sm font-medium">Administrative Overview Dashboard</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={stats?.totalStudents || 0} icon={Users} description="Enrolled across all years" isLoading={isLoading} color="blue" />
        <StatCard title="Monthly Collection" value={currencyFormatter.format(stats?.monthlyCollection || 0)} icon={TrendingUp} description="Collected this month" isLoading={isLoading} color="emerald" />
        <StatCard title="Monthly Expenses" value={currencyFormatter.format(stats?.monthlyExpenses || 0)} icon={TrendingDown} description="Spent this month" isLoading={isLoading} color="rose" />
        <StatCard title="Current Profit" value={currencyFormatter.format(profit)} icon={Activity} description="Monthly net balance" isLoading={isLoading} color={profit >= 0 ? "emerald" : "rose"} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border-muted/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Financial Overview</CardTitle>
              <CardDescription>Monthly Fee Collection vs. Expenses</CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Year" /></SelectTrigger>
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
                <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value) => currencyFormatter.format(value as number)} />
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
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-8 w-full px-4 mt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Invoices</p>
                <p className="text-2xl font-bold">{stats?.totalInvoices || 0}</p>
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