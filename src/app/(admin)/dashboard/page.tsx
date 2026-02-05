"use client";

import { useState, useEffect } from "react";
import { Users, Building2, History, UserPlus, GraduationCap, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DashboardData = {
  totalStudents: number;
  recentActivity: any[];
  enrollmentStats: { name: string; count: number }[];
  activeCashiers: number;
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [
          studentsRes,
          logsRes,
          cashiersRes,
          settingsRes,
          classRes
        ] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }),
          supabase.from("activity_logs").select("*, students(name, roll_number)").order("timestamp", { ascending: false }).limit(6),
          supabase.from("cashiers").select("*", { count: "exact", head: true }),
          supabase.from("school_settings").select("school_name, logo_url").order('updated_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from("students").select("studying_year")
        ]);

        // Process enrollment stats
        const yearCounts: Record<string, number> = {};
        classRes.data?.forEach(s => {
            const y = s.studying_year || 'Unknown';
            yearCounts[y] = (yearCounts[y] || 0) + 1;
        });

        const enrollmentStats = Object.entries(yearCounts).map(([name, count]) => ({ name, count }));

        setData({
          totalStudents: studentsRes.count || 0,
          recentActivity: logsRes.data || [],
          enrollmentStats: enrollmentStats.sort((a, b) => a.name.localeCompare(b.name)),
          activeCashiers: cashiersRes.count || 0,
        });

        if (settingsRes.data) {
          setSchoolSettings(settingsRes.data);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Branded Header Section */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-background p-6 rounded-2xl border shadow-sm">
        <div className="h-16 w-16 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {schoolSettings?.logo_url ? (
            <img src={schoolSettings.logo_url} alt="College Logo" className="h-full w-full object-contain p-1" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>
        <div className="text-center md:text-left space-y-0.5">
          {isLoading ? (
            <Skeleton className="h-7 w-64" />
          ) : (
            <h1 className="text-2xl font-ubuntu font-black text-primary tracking-tight">
              {schoolSettings?.school_name || "School Portal"}
            </h1>
          )}
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">Management Overview</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard 
          title="Total Enrollment" 
          value={data?.totalStudents || 0} 
          icon={Users} 
          description="Total active student records" 
          isLoading={isLoading} 
          color="blue"
        />
        <StatCard 
          title="Active Cashiers" 
          value={data?.activeCashiers || 0} 
          icon={UserPlus} 
          description="Provisioned billing accounts" 
          isLoading={isLoading} 
          color="emerald"
        />
        <StatCard 
          title="Graduation Flow" 
          value={data?.enrollmentStats.find(s => s.name.includes('3rd'))?.count || 0} 
          icon={GraduationCap} 
          description="Students in final year" 
          isLoading={isLoading} 
          color="rose"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Enrollment Breakdown */}
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Enrollment Distribution</CardTitle>
            <CardDescription>Student count by studying year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : data?.enrollmentStats.length ? (
                data.enrollmentStats.map((stat) => (
                  <div key={stat.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                    <span className="font-semibold text-sm">{stat.name}</span>
                    <Badge variant="secondary" className="font-black">{stat.count} Students</Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No enrollment data available.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent System Activity */}
        <Card className="lg:col-span-4 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions performed in the portal</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
                <Link href="/activity-logs">View Logs <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-6">Action</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right pr-6">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : data?.recentActivity.length ? (
                  data.recentActivity.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-2">
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-bold uppercase tracking-tighter">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">{log.students?.name || 'System'}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6 text-[10px] text-muted-foreground font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">No recent activity.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, description, isLoading, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
  };

  return (
    <Card className="shadow-sm border-muted/60 hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg", colorMap[color] || colorMap.blue)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2 mb-1" />
        ) : (
          <div className="text-2xl font-black font-ubuntu">{value}</div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{description}</p>
      </CardContent>
    </Card>
  );
}