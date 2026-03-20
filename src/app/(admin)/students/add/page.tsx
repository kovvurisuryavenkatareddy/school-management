"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Check, ChevronsUpDown, PlusCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AcademicYear, StudentType, ClassGroup, StudyingYear, Term } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeStructureEditor } from "@/components/admin/fee-structure-editor";
import { CreatableCombobox } from "@/components/admin/creatable-combobox";
import { BulkStudentUpload } from "@/components/admin/bulk-student-upload";
import { generateInitialFeeDetails } from "@/lib/fee-structure-utils";

const studentFormSchema = z.object({
  roll_number: z.string().min(1, "Roll number is required"),
  name: z.string().min(1, "Name is required"),
  class: z.string().min(1, "Class is required"),
  section: z.string().min(1, "Section is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  student_type_id: z.string().min(1, "Student type is required"),
  academic_year_id: z.string().min(1, "Academic year is required"),
  studying_year: z.string().min(1, "Studying year is required"),
  caste: z.string().optional(),
  fee_details: z.any().optional(),
});

export default function StudentsPage() {
  const [studentTypes, setStudentTypes] = useState<StudentType[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [sections, setSections] = useState<Term[]>([]);
  const [studyingYears, setStudyingYears] = useState<StudyingYear[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      roll_number: "", name: "", class: "", section: "", email: "", phone: "",
      student_type_id: "", academic_year_id: "", studying_year: "", caste: "", fee_details: {},
    },
  });

  const watchedStudentTypeId = form.watch('student_type_id');

  const fetchData = async () => {
    const [typesRes, yearsRes, groupsRes, sectionsRes, studyingYearsRes] = await Promise.all([
      supabase.from("student_types").select("*"),
      supabase.from("academic_years").select("*").eq('is_active', true).order("year_name", { ascending: false }),
      supabase.from("class_groups").select("*"),
      supabase.from("sections").select("*"),
      supabase.from("studying_years").select("*"),
    ]);

    if (typesRes.data) setStudentTypes(typesRes.data);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
    if (groupsRes.data) setClassGroups(groupsRes.data);
    if (sectionsRes.data) setSections(sectionsRes.data);
    if (studyingYearsRes.data) setStudyingYears(studyingYearsRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (watchedStudentTypeId && studyingYears.length > 0) {
      const selectedStudentType = studentTypes.find(st => st.id === watchedStudentTypeId);
      const initialFeeDetails = generateInitialFeeDetails(selectedStudentType?.name || null, studyingYears);
      form.setValue('fee_details', initialFeeDetails);
    }
  }, [watchedStudentTypeId, studyingYears, studentTypes, form]);

  const onStudentSubmit = async (values: z.infer<typeof studentFormSchema>) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Adding student and assigning fees...");
    
    const { data: student, error } = await supabase.from("students").insert([values]).select().single();
    
    if (error) {
      toast.error(`Failed: ${error.message}`, { id: toastId });
      setIsSubmitting(false);
      return;
    }

    // Auto-assign existing invoices from the same class/year
    const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('batch_id, batch_description, total_amount, due_date, penalty_amount_per_day, students(class, studying_year, student_type_id)')
        .limit(100);

    const batchesToClone = new Map();
    existingInvoices?.forEach(inv => {
        const s = inv.students as any;
        if (s?.class === values.class && s?.studying_year === values.studying_year && s?.student_type_id === values.student_type_id) {
            if (!batchesToClone.has(inv.batch_id)) {
                batchesToClone.set(inv.batch_id, inv);
            }
        }
    });

    if (batchesToClone.size > 0) {
        const invoicesToInsert = Array.from(batchesToClone.values()).map(batch => ({
            student_id: student.id,
            batch_id: batch.batch_id,
            batch_description: batch.batch_description,
            total_amount: batch.total_amount,
            due_date: batch.due_date,
            penalty_amount_per_day: batch.penalty_amount_per_day,
            status: 'unpaid',
            paid_amount: 0
        }));

        await supabase.from('invoices').insert(invoicesToInsert);
        toast.success(`Student added and ${invoicesToInsert.length} pending invoices assigned!`, { id: toastId });
    } else {
        toast.success("Student added successfully!", { id: toastId });
    }

    form.reset();
    fetchData();
    setIsSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/students">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle>Add Student</CardTitle>
            <CardDescription>Fees from existing batches will be assigned automatically.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single">Single Student</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onStudentSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField control={form.control} name="roll_number" render={({ field }) => (
                    <FormItem><FormLabel>Roll Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  
                  <FormField control={form.control} name="class" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Group (Class)</FormLabel>
                      <ClassCombobox classGroups={classGroups} value={field.value} onChange={field.onChange} onNewGroupAdded={fetchData} />
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="section" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Section</FormLabel>
                      <CreatableCombobox
                        options={sections}
                        value={field.value}
                        onChange={field.onChange}
                        onNewOptionAdded={fetchData}
                        tableName="sections"
                        placeholder="Select..."
                        dialogTitle="Add Section"
                      />
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="studying_year" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Studying Year</FormLabel>
                      <CreatableCombobox
                        options={studyingYears}
                        value={field.value}
                        onChange={field.onChange}
                        onNewOptionAdded={fetchData}
                        tableName="studying_years"
                        placeholder="Select..."
                        dialogTitle="Add Year"
                      />
                    <FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="academic_year_id" render={({ field }) => (
                    <FormItem><FormLabel>Academic Year</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select year..." /></SelectTrigger></FormControl>
                        <SelectContent>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.year_name}</SelectItem>)}</SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="student_type_id" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Student Type</FormLabel>
                      <StudentTypeCombobox studentTypes={studentTypes} value={field.value} onChange={field.onChange} onNewTypeAdded={fetchData} />
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="caste" render={({ field }) => (
                    <FormItem><FormLabel>Caste</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                
                <FormField control={form.control} name="fee_details" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FeeStructureEditor value={field.value || {}} onChange={field.onChange} studyingYears={studyingYears} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Processing..." : "Add Student"}</Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="bulk" className="pt-6">
            <BulkStudentUpload onSuccess={fetchData} studyingYears={studyingYears} studentTypes={studentTypes} academicYears={academicYears} classGroups={classGroups} sections={sections} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ClassCombobox({ classGroups, value, onChange, onNewGroupAdded }: any) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newGroupName.trim()) return;
    setIsAdding(true);
    const { data, error } = await supabase.from("class_groups").insert({ name: newGroupName.trim() }).select().single();
    if (error) toast.error(error.message);
    else { toast.success("Group added!"); onNewGroupAdded(); onChange(data.name); setDialogOpen(false); setNewGroupName(""); }
    setIsAdding(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{value || "Select class..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>{classGroups.map((cg: any) => (<CommandItem key={cg.id} value={cg.name} onSelect={() => { onChange(cg.name); setOpen(false); }}>{cg.name}</CommandItem>))}</CommandGroup>
              <CommandSeparator />
              <CommandGroup><CommandItem onSelect={() => { setOpen(false); setDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add New</CommandItem></CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Class Group</DialogTitle></DialogHeader>
          <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
          <DialogFooter><Button onClick={handleAdd} disabled={isAdding}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StudentTypeCombobox({ studentTypes, value, onChange, onNewTypeAdded }: any) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTypeName.trim()) return;
    setIsAdding(true);
    const { data, error } = await supabase.from("student_types").insert({ name: newTypeName.trim() }).select().single();
    if (error) toast.error(error.message);
    else { toast.success("Type added!"); onNewTypeAdded(); onChange(data.id); setDialogOpen(false); setNewTypeName(""); }
    setIsAdding(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{value ? studentTypes.find((st: any) => st.id === value)?.name : "Select type..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>{studentTypes.map((st: any) => (<CommandItem key={st.id} value={st.name} onSelect={() => { onChange(st.id); setOpen(false); }}>{st.name}</CommandItem>))}</CommandGroup>
              <CommandSeparator />
              <CommandGroup><CommandItem onSelect={() => { setOpen(false); setDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add New</CommandItem></CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Student Type</DialogTitle></DialogHeader>
          <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
          <DialogFooter><Button onClick={handleAdd} disabled={isAdding}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}