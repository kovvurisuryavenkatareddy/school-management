"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Bar, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, BarChart as RechartsBarChart } from "recharts";
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
const COLORS = ["#3b82f6", "#f43f5e"];

type Stats = {
  paidInvoices: number;
  pendingInvoices: number;
  totalInvoices: number;
  yearlyCollection: number;
  yearlyExpenses: number;
  totalStudents: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [barChartData, setBarChartData] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string, year_name: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch academic years once on mount
  useEffect(() => {
    const fetchYears = async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("id, year_name")
        .order("year_name", { ascending: false });

      if (error) {
        toast.error("Failed to fetch academic years");
        return;
      }

      if (data && data.length > 0) {
        setAcademicYears(data);
        // Default to current year if exists, otherwise the first one
        const currentYearStr = new Date().getFullYear().toString();
        const found = data.find(y => y.year_name.includes(currentYearStr));
        setSelectedYear(found ? found.year_name.substring(0, 4) : data[0].year_name.substring(0, 4));
      }
    };
    fetchYears();
  }, []);

  // 2. Fetch all dashboard data when selectedYear changes
  const fetchDashboardData = useCallback(async (yearStr: string) => {
    if (!yearStr) return;
    setIsLoading(true);

    try {
      const year = parseInt(yearStr);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Parallel fetch for all year-specific data
      const [
        invoiceRes,
        collectionRes,
        expensesRes,
        studentsRes,
        paymentsRpc,
        expensesRpc
      ] = await Promise.all([
        supabase.from("invoices").select("status", { count: "exact" }).gte("created_at", yearStart).lte("created_at", yearEnd),
        supabase.from("payments").select("amount").gte("created_at", yearStart).lte("created_at", yearEnd),
        supabase.from("expenses").select("amount").gte("expense_date", yearStart).lte("expense_date", yearEnd),
        supabase.from("students").select("*", { count: "exact", head: true }).ilike("studying_year", `%${yearStr}%`),
        supabase.rpc('get_monthly_payments', { year_in: year }),
        supabase.rpc('get_monthly_expenses', { year_in: year }),
      ]);

      // Calculate Stats
      const paidInvoices = invoiceRes.data?.filter(i => i.status === 'paid').length || 0;
      const totalInvoices = invoiceRes.count || 0;
      const yearlyCollection = collectionRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const yearlyExpenses = expensesRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0;

      setStats({
        paidInvoices,
        pendingInvoices: totalInvoices - paidInvoices,
        totalInvoices,
        yearlyCollection,
        yearlyExpenses,
        totalStudents: studentsRes.count || 0,
      });

      // Format Bar Chart Data
      const monthData = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(0, i).toLocaleString('default', { month: 'short' }),
        income: 0,
        expenses: 0,
      }));

      paymentsRpc.data?.forEach((p: any) => {
        const monthIndex = new Date(p.month).getUTCMonth();
        if (monthIndex >= 0 && monthIndex < 12) monthData[monthIndex].income = p.total;
      });
      expensesRpc.data?.forEach((e: any) => {
        const monthIndex = new Date(e.month).getUTCMonth();
        if (monthIndex >= 0 && monthIndex < 12) monthData[monthIndex].expenses = e.total;
      });

      setBarChartData(monthData);
    } catch (error) {
      console.error("Dashboard error:", error);
      toast.error("Error updating dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(selectedYear);
  }, [selectedYear, fetchDashboardData]);

  const profit = (stats?.yearlyCollection || 0) - (stats?.yearlyExpenses || 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Students" 
          value={stats?.totalStudents || 0} 
          icon={Users} 
          description={`Enrolled in ${selectedYear}`} 
          isLoading={isLoading} 
          color="blue"
        />
        <StatCard 
          title="Yearly Collection" 
          value={currencyFormatter.format(stats?.yearlyCollection || 0)} 
          icon={TrendingUp} 
          description={`Total collected in ${selectedYear}`} 
          isLoading={isLoading} 
          color="emerald"
        />
        <StatCard 
          title="Yearly Expenses" 
          value={currencyFormatter.format(stats?.yearlyExpenses || 0)} 
          icon={TrendingDown} 
          description={`Total spent in ${selectedYear}`} 
          isLoading={isLoading} 
          color="rose"
        />
        <StatCard 
          title="Yearly Profit" 
          value={currencyFormatter.format(profit)} 
          icon={Activity} 
          description="Annual net balance" 
          isLoading={isLoading} 
          color={profit >= 0 ? "emerald" : "rose"}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border-muted/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Financial Overview</CardTitle>
              <CardDescription>Monthly Fee Collection vs. Expenses for {selectedYear}</CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set(academicYears.map(y => y.year_name.substring(0, 4)))).map(yStr => (
                  <SelectItem key={yStr} value={yStr}>{yStr}</SelectItem>
                ))}
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
                <Bar dataKey="income" fill="#3b82f6" name="Collections" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="expenses" fill="#f43f5e" name="Expenses" radius={[4, 4, 0, 0]} barSize={24} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-muted/60">
          <CardHeader>
            <CardTitle className="text-xl">Invoice Status</CardTitle>
            <CardDescription>Tracking for invoices generated in {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center pt-0">
            <div className="w-full h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
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
                    innerRadius={65} 
                    outerRadius={85} 
                    paddingAngle={5}
                    animationBegin={0}
                    animationDuration={800}
                  >
                    <Cell fill="#3b82f6" strokeWidth={0} />
                    <Cell fill="#f43f5e" strokeWidth={0} />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-8 w-full px-4 mt-6">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Invoices</p>
                <p className="text-2xl font-black">{stats?.totalInvoices}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Pending Rate</p>
                <p className="text-2xl font-black text-rose-600">
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
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
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
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{description}</p>
      </CardContent>
    </Card>
  );
}