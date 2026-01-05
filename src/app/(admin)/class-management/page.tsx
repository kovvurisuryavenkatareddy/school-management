"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ManagementTable } from "@/components/admin/management-table";
import { AcademicYearManagement } from "@/components/admin/academic-year-management";

export default function ClassManagementPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Management</CardTitle>
        <CardDescription>
          Manage all academic and student-related classifications from one place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="classes">
          <TabsList>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="studying_years">Studying Years</TabsTrigger>
            <TabsTrigger value="student_types">Student Types</TabsTrigger>
            <TabsTrigger value="academic_years">Academic Years</TabsTrigger>
          </TabsList>
          <TabsContent value="classes" className="pt-6">
            <ManagementTable tableName="class_groups" columnName="name" title="Class" />
          </TabsContent>
          <TabsContent value="sections" className="pt-6">
            <ManagementTable tableName="sections" columnName="name" title="Section" />
          </TabsContent>
          <TabsContent value="studying_years" className="pt-6">
            <ManagementTable tableName="studying_years" columnName="name" title="Studying Year" />
          </TabsContent>
          <TabsContent value="student_types" className="pt-6">
            <ManagementTable tableName="student_types" columnName="name" title="Student Type" />
          </TabsContent>
          <TabsContent value="academic_years" className="pt-6">
            <AcademicYearManagement />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}