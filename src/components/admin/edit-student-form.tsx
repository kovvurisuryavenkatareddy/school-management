"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Check, ChevronsUpDown, PlusCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  DialogDescription,
} from "@/components/ui/dialog";
import { AcademicYear, StudentType, ClassGroup, StudyingYear, Term, FeeStructure } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeStructureEditor } from "@/components/admin/fee-structure-editor";
import { CreatableStringCombobox } from "@/components/admin/creatable-combobox"; // Assuming this is for string options

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
  fee_details: z.any().optional(), // Will be FeeStructure type
});

interface EditStudentFormProps {
  studentId: string;
}

export function EditStudentForm({ studentId }: EditStudentFormProps) {
  const [studentTypes, setStudentTypes] = useState<StudentType[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [sections, setSections] = useState<Term[]>([]); // Renamed to Term for consistency
  const [studyingYears, setStudyingYears] = useState<StudyingYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]); // New state for terms
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
  });

  const fetchData = async () => {
    setIsLoading(true);
    const [typesRes, yearsRes, studentRes, groupsRes, sectionsRes, studyingYearsRes, termsRes] = await Promise.all([
      supabase.from("student_types").select("*"),
      supabase.from("academic_years").select("*").eq('is_active', true).order("year_name", { ascending: false }),
      supabase.from("students").select("*, student_types(name)").eq("id", studentId).single(), // Fetch student_types name for initial fee details
      supabase.from("class_groups").select("*"),
      supabase.from("sections").select("*"),
      supabase.from("studying_years").select("*"),
      supabase.from("terms").select("*").order("name", { ascending: true }), // Fetch terms
    ]);

    if (typesRes.error) toast.error("Failed to fetch student types.");
    else setStudentTypes(typesRes.data || []);

    if (yearsRes.error) toast.error("Failed to fetch academic years.");
    else setAcademicYears(yearsRes.data || []);

    if (studentRes.error) {
      toast.error("Failed to fetch student data.");
      router.push("/students");
    } else {
      form.reset(studentRes.data);
    }

    if (groupsRes.error) toast.error("Failed to fetch class groups.");
    else setClassGroups(groupsRes.data || []);

    if (sectionsRes.error) toast.error("Failed to fetch sections.");
    else setSections(sectionsRes.data || []);

    if (studyingYearsRes.error) toast.error("Failed to fetch studying years.");
    else setStudyingYears(studyingYearsRes.data || []);

    if (termsRes.error) toast.error("Failed to fetch terms.");
    else setTerms(termsRes.data || []);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [studentId, router]);

  const onStudentSubmit = async (values: z.infer<typeof studentFormSchema>) => {
    setIsSubmitting(true);
    
    const { data, error } = await supabase
      .from("students")
      .update(values)
      .eq("id", studentId)
      .select()
      .single();

    if (error) {
      toast.error(`Failed to update student: ${error.message}`);
    } else if (!data) {
      toast.error("Update failed. The student record could not be found or was not updated.");
    } else {
      toast.success("Student updated successfully!");
      router.push("/students");
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading student details...</div>;
  }

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
            <CardTitle>Edit Student</CardTitle>
            <CardDescription>Update the details for {form.getValues("name")}.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
                <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="class" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Class</FormLabel>
                  <ClassCombobox classGroups={classGroups} value={field.value} onChange={field.onChange} onNewGroupAdded={fetchData} />
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Section</FormLabel>
                  <CreatableStringCombobox options={sections.map(s => s.name)} value={field.value} onChange={field.onChange} placeholder="Select or type section..." />
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="studying_year" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Studying Year</FormLabel>
                  <CreatableStringCombobox options={studyingYears.map(s => s.name)} value={field.value} onChange={field.onChange} placeholder="Select or type year..." />
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="academic_year_id" render={({ field }) => (
                <FormItem><FormLabel>Academic Year</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select academic year..." /></SelectTrigger></FormControl>
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
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            
            <FormField
              control={form.control}
              name="fee_details"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FeeStructureEditor 
                      value={field.value || {}} 
                      onChange={field.onChange} 
                      studyingYears={studyingYears}
                      terms={terms}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ClassCombobox({ classGroups, value, onChange, onNewGroupAdded }: { classGroups: ClassGroup[], value: string, onChange: (value: string) => void, onNewGroupAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNewGroup = async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;
    setIsAdding(true);

    const { data: existing } = await supabase.from("class_groups").select("id").ilike("name", trimmedName).single();
    if (existing) {
      toast.error(`Class group "${trimmedName}" already exists.`);
      setIsAdding(false);
      return;
    }

    const { data, error } = await supabase.from("class_groups").insert({ name: trimmedName }).select().single();
    if (error) {
      toast.error(`Failed to add group: ${error.message}`);
    } else {
      toast.success("New class group added!");
      onNewGroupAdded();
      onChange(data.name);
      setDialogOpen(false);
      setNewGroupName("");
    }
    setIsAdding(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {value || "Select class..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search class..." />
            <CommandList>
              <CommandEmpty>No class found.</CommandEmpty>
              <CommandGroup>
                {classGroups.map((cg) => (
                  <CommandItem key={cg.id} value={cg.name} onSelect={() => { onChange(cg.name); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === cg.name ? "opacity-100" : "opacity-0")} />
                    {cg.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => { setOpen(false); setDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Group
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Class Group</DialogTitle></DialogHeader>
          <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g., BSc" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNewGroup} disabled={isAdding}>{isAdding ? "Adding..." : "Add Group"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreatableStringCombobox({ options, value, onChange, placeholder }: { options: string[], value: string, onChange: (value: string) => void, placeholder: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
          <CommandInput placeholder="Search or type new..." value={value} onValueChange={onChange} />
          <CommandList>
            <CommandEmpty>No results. Press enter to add.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => { onChange(option); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StudentTypeCombobox({ studentTypes, value, onChange, onNewTypeAdded }: { studentTypes: StudentType[], value: string, onChange: (value: string) => void, onNewTypeAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNewType = async () => {
    const trimmedName = newTypeName.trim();
    if (!trimmedName) return;
    setIsAdding(true);

    const { data: existingType } = await supabase.from("student_types").select("id").ilike("name", trimmedName).single();
    if (existingType) {
      toast.error(`Student type "${trimmedName}" already exists.`);
      setIsAdding(false);
      return;
    }

    const { data, error } = await supabase.from("student_types").insert({ name: trimmedName }).select().single();
    if (error) {
      toast.error(`Failed to add type: ${error.message}`);
    } else {
      toast.success("New student type added!");
      onNewTypeAdded();
      onChange(data.id);
      setDialogOpen(false);
      setNewTypeName("");
    }
    setIsAdding(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {value ? studentTypes.find((st) => st.id === value)?.name : "Select student type..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search student type..." />
            <CommandList>
              <CommandEmpty>No student type found.</CommandEmpty>
              <CommandGroup>
                {studentTypes.map((st) => (
                  <CommandItem key={st.id} value={st.name} onSelect={() => { onChange(st.id); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === st.id ? "opacity-100" : "opacity-0")} />
                    {st.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => { setOpen(false); setDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Type
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Student Type</DialogTitle>
            <DialogDescription>Enter the name for the new student type.</DialogDescription>
          </DialogHeader>
          <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="e.g., Day Scholar" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNewType} disabled={isAdding}>{isAdding ? "Adding..." : "Add Type"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}