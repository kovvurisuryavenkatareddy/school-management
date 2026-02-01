"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeeCollectionView } from "@/components/financials/fee-collection-view";
import { FeeRegisterView } from "@/components/financials/fee-register-view";
import { FeePaidReportView } from "@/components/financials/fee-paid-report-view";
import { DaySheetView } from "@/components/financials/day-sheet-view";
import { Receipt, Table as TableIcon, ClipboardList, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function FinancialsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // If they exist in cashiers table, they are a cashier
        const { data: cashier } = await supabase
          .from('cashiers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        setIsAdmin(!cashier);
      }
    };
    checkRole();
  }, []);

  if (isAdmin === null) return <div className="p-8 text-center">Loading portal...</div>;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-ubuntu text-primary">Financial Management</CardTitle>
          <CardDescription>Consolidated hub for collections, tracking, and reporting.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="collection" className="space-y-6">
        <TabsList className={cn(
          "grid w-full lg:w-auto grid-cols-2",
          isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-2"
        )}>
          <TabsTrigger value="collection" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Fee Collection</span>
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-2">
            <TableIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Fee Register</span>
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="daysheet" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Day Sheet</span>
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Paid Report</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="collection">
          <FeeCollectionView />
        </TabsContent>

        <TabsContent value="register">
          <FeeRegisterView />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="daysheet">
              <DaySheetView />
            </TabsContent>
            <TabsContent value="report">
              <FeePaidReportView />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');