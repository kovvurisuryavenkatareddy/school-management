"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ExpensesPage from "../expenses/page";
import DepartmentsPage from "../departments/page";
import { TrendingUp, Building } from "lucide-react";

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-ubuntu text-primary">Operations</CardTitle>
          <CardDescription>Track institutional spending and manage academic departments.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="expenses" className="space-y-6">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="expenses" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building className="h-4 w-4" />
            Departments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <ExpensesPage />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}