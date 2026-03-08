"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
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
type StudyingYear = { id: string; name: string };
type Section = { id: string; name: string };

const formSchema = z.object({
  fee_structure_ids: z.array(z.string()).min(1, "Please select at least one fee type"),
  due_date: z.string().min(1, "Due date is required"),
  class_filters: z.array(z.string()).min(1, "At least one class is required"),
  section_filters: z.array(z.string()).min(1, "At least one section is required"),
  student_type_filters: z.array(z.string()).min(1, "At least one student type is required"),
  studying_year_filters: z.array(z.string()).min(1, "At least one studying year is required"),
  penalty_amount: z.coerce.number().min(0, "Penalty must be 0 or more"),
});

export default function GenerateInvoicesPage() {
  const router = useRouter();
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [studentTypes, setStudentTypes] = useState<StudentType[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [studyingYears, setStudyingYears] = useState<StudyingYear[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      penalty_amount: 0, 
      class_filters: [], 
      section_filters: [], 
      student_type_filters: [],
      studying_year_filters: [],
      fee_structure_ids: []
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const [feesRes, typesRes, groupsRes, syRes, secRes] = await Promise.all([
        supabase.from("fee_structures").select("id, fee_name, amount"),
        supabase.from("student_types").select("id, name"),
        supabase.from("class_groups").select("id, name"),
        supabase.from("studying_years").select("id, name"),
        supabase.from("sections").select("id, name"),
      ]);
      if (feesRes.data) setFeeStructures(feesRes.data);
      if (typesRes.data) setStudentTypes(typesRes.data);
      if (groupsRes.data) setClassGroups(groupsRes.data);
      if (syRes.data) setStudyingYears(syRes.data);
      if (secRes.data) setSections(secRes.data);
    };
    fetchData();
  }, []);

  const fetchAllMatchingStudents = async (values: z.infer<typeof formSchema>) => {
    let allStudents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      let query = supabase
        .from('students')
        .select('id, class, section, student_type_id, studying_year')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      query = query.in('class', values.class_filters);
      query = query.in('section', values.section_filters);
      query = query.in('student_type_id', values.student_type_filters);
      query = query.in('studying_year', values.studying_year_filters);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allStudents = [...allStudents, ...data];
      if (data.length < pageSize) break;
      page++;
    }
    return allStudents;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Fetching all matched students...");
    
    try {
      const students = await fetchAllMatchingStudents(values);

      if (!students || students.length === 0) {
        toast.warning("No students found matching the selected criteria.", { id: toastId });
        setIsSubmitting(false);
        return;
      }

      toast.loading(`Generating invoices for ${students.length} students across selected fee types...`, { id: toastId });

      let totalInvoicesCreated = 0;

      for (const feeId of values.fee_structure_ids) {
        const selectedFee = feeStructures.find(fs => fs.id === feeId);
        if (!selectedFee) continue;

        const batch_id = uuidv4();
        // Updated description logic to be more descriptive based on filters
        const batch_description = `${selectedFee.fee_name} for ${values.studying_year_filters.join(', ')}`;

        const invoicesToInsert = students.map(student => ({
          student_id: student.id,
          due_date: values.due_date,
          status: 'unpaid',
          total_amount: selectedFee.amount,
          penalty_amount_per_day: values.penalty_amount,
          batch_id: batch_id,
          batch_description: batch_description,
          paid_amount: 0,
        }));

        const { data: newInvoices, error: invoiceError } = await supabase
          .from('invoices')
          .insert(invoicesToInsert)
          .select('id');

        if (invoiceError) throw invoiceError;
        if (!newInvoices) continue;

        const invoiceItemsToInsert = newInvoices.map(invoice => ({
          invoice_id: invoice.id,
          description: selectedFee.fee_name,
          amount: selectedFee.amount,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItemsToInsert);
        if (itemsError) throw itemsError;

        totalInvoicesCreated += newInvoices.length;
      }

      toast.success(`Successfully generated ${totalInvoicesCreated} total invoices!`, { id: toastId });
      form.reset();
      router.push('/billing'); // Navigating back to billing page where invoices tab is
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
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>Generate Bulk Invoices</CardTitle>
            <CardDescription>
              Assign fees to specific groups of students. All matched students will be included.
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
                      options={sections.map(sec => ({ label: `Section ${sec.name}`, value: sec.name }))} 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Select target sections..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="studying_year_filters" render={({ field }) => (
                <FormItem>
                  <FormLabel>Studying Years</FormLabel>
                  <FormControl>
                    <MultiSelect 
                      options={studyingYears.map(sy => ({ label: sy.name, value: sy.name }))} 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Select target years..."
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
              <Button type="submit" disabled={isSubmitting} className="min-w-[200px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
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