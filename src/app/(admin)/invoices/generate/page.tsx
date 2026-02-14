"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";

type FeeStructure = { id: string; fee_name: string; amount: number };
type StudentType = { id: string; name: string };
type ClassGroup = { id: string; name: string };

const formSchema = z.object({
  fee_structure_ids: z.array(z.string()).min(1, "Please select at least one fee type"),
  due_date: z.string().min(1, "Due date is required"),
  class_filters: z.array(z.string()).min(1, "At least one class is required"),
  section_filters: z.array(z.string()).min(1, "At least one section is required"),
  student_type_filters: z.array(z.string()).min(1, "At least one student type is required"),
  penalty_amount: z.coerce.number().min(0, "Penalty must be 0 or more"),
});

export default function GenerateInvoicesPage() {
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [studentTypes, setStudentTypes] = useState<StudentType[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      penalty_amount: 0, 
      class_filters: [], 
      section_filters: [], 
      student_type_filters: [],
      fee_structure_ids: []
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const [feesRes, typesRes, groupsRes] = await Promise.all([
        supabase.from("fee_structures").select("id, fee_name, amount"),
        supabase.from("student_types").select("id, name"),
        supabase.from("class_groups").select("id, name"),
      ]);
      if (feesRes.data) setFeeStructures(feesRes.data);
      if (typesRes.data) setStudentTypes(typesRes.data);
      if (groupsRes.data) setClassGroups(groupsRes.data);
    };
    fetchData();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Processing bulk invoices...");
    
    try {
      // 1. Fetch target students based on multiple filters
      let studentQuery = supabase
        .from('students')
        .select('id, class, section, student_type_id');
        
      studentQuery = studentQuery.in('class', values.class_filters);
      studentQuery = studentQuery.in('section', values.section_filters);
      studentQuery = studentQuery.in('student_type_id', values.student_type_filters);
      
      const { data: students, error: studentError } = await studentQuery;

      if (studentError) throw studentError;
      if (!students || students.length === 0) {
        toast.warning("No students found matching the selected criteria.", { id: toastId });
        setIsSubmitting(false);
        return;
      }

      let totalInvoicesCreated = 0;

      // 2. Loop through each selected fee type and generate a batch for matched students
      for (const feeId of values.fee_structure_ids) {
        const selectedFee = feeStructures.find(fs => fs.id === feeId);
        if (!selectedFee) continue;

        const batch_id = uuidv4();
        const batch_description = `${selectedFee.fee_name} (Bulk Generation)`;

        const invoicesToInsert = students.map(student => ({
          student_id: student.id,
          due_date: values.due_date,
          status: 'unpaid',
          total_amount: selectedFee.amount,
          penalty_amount_per_day: values.penalty_amount,
          batch_id: batch_id,
          batch_description: batch_description,
        }));

        const { data: newInvoices, error: invoiceError } = await supabase
          .from('invoices')
          .insert(invoicesToInsert)
          .select('id');

        if (invoiceError) throw invoiceError;
        if (!newInvoices) continue;

        // 3. Add line items for each invoice
        const invoiceItemsToInsert = newInvoices.map(invoice => ({
          invoice_id: invoice.id,
          description: selectedFee.fee_name,
          amount: selectedFee.amount,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItemsToInsert);
        if (itemsError) throw itemsError;

        totalInvoicesCreated += newInvoices.length;
      }

      toast.success(`Successfully generated ${totalInvoicesCreated} invoices across matched criteria!`, { id: toastId });
      form.reset();
    } catch (err: any) {
      toast.error(`Operation failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Generate Bulk Invoices</CardTitle>
            <CardDescription>
              Select multiple criteria to assign fees to specific groups of students.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="fee_structure_ids" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee Types</FormLabel>
                  <FormControl>
                    <MultiSelect 
                      options={feeStructures.map(f => ({ label: f.fee_name, value: f.id }))} 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Choose one or more fees..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="class_filters" render={({ field }) => (
                <FormItem>
                  <FormLabel>Classes</FormLabel>
                  <FormControl>
                    <MultiSelect 
                      options={classGroups.map(c => ({ label: c.name, value: c.name }))} 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Select target classes..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="section_filters" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sections</FormLabel>
                  <FormControl>
                    <MultiSelect 
                      options={['A', 'B', 'C', 'D', 'E'].map(sec => ({ label: `Section ${sec}`, value: sec }))} 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Select target sections..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="student_type_filters" render={({ field }) => (
                <FormItem>
                  <FormLabel>Student Types</FormLabel>
                  <FormControl>
                    <MultiSelect 
                      options={studentTypes.map(st => ({ label: st.name, value: st.id }))} 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Select student categories..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="penalty_amount" render={({ field }) => (
                <FormItem><FormLabel>Late Penalty (Per Day)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isSubmitting} className="min-w-[180px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Batch...
                  </>
                ) : 'Generate All Invoices'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}