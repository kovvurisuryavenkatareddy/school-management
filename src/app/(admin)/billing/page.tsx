"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FeesPage from "../fees/page";
import InvoicesPage from "../invoices/page";
import { Receipt, FileText } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-ubuntu text-primary">Billing & Fees</CardTitle>
          <CardDescription>Manage your revenue streams, fee structures, and invoice batches.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="structure" className="space-y-6">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="structure" className="gap-2">
            <Receipt className="h-4 w-4" />
            Fee Structure
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure">
          <FeesPage />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}