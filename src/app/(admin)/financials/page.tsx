"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeeCollectionView } from "@/components/financials/fee-collection-view";
import { FeeRegisterView } from "@/components/financials/fee-register-view";
import { FeePaidReportView } from "@/components/financials/fee-paid-report-view";
import { Receipt, Table as TableIcon, ClipboardList } from "lucide-react";

export default function FinancialsPage() {
  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-ubuntu text-primary">Financial Management</CardTitle>
          <CardDescription>Consolidated hub for collections, tracking, and reporting.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="collection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="collection" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Fee Collection</span>
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-2">
            <TableIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Fee Register</span>
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Paid Report</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collection">
          <FeeCollectionView />
        </TabsContent>

        <TabsContent value="register">
          <FeeRegisterView />
        </TabsContent>

        <TabsContent value="report">
          <FeePaidReportView />
        </TabsContent>
      </Tabs>
    </div>
  );
}