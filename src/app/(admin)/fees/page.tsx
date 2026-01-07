"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Types
type FeeStructure = {
  id: string;
  fee_name: string;
  amount: number;
  fee_type: 'Tuition' | 'Custom';
  created_at: string;
  class_groups: { id: string; name: string } | null;
  student_types: { id: string; name: string } | null;
};
type ClassGroup = { id: string; name: string };
type StudentType = { id: string; name: string };

// Zod Schema for Form Validation
const formSchema = z.object({
  fee_name: z.string().min(1, "Fee name is required"),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  class_group_id: z.string().optional(),
  student_type_id: z.string().optional(),
  fee_type: z.enum(["Tuition", "Custom"]),
});

export default function FeesPage() {
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [studentTypes, setStudentTypes] = useState<StudentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState<FeeStructure | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fee_name: "", amount: 0, fee_type: "Tuition" },
  });

  // Data Fetching
  const fetchData = async () => {
    setIsLoading(true);
    const [feesRes, groupsRes, typesRes] = await Promise.all([
      supabase.from("fee_structures").select("*, class_groups(*), student_types(*)"),
      supabase.from("class_groups").select("*"),
      supabase.from("student_types").select("*"),
    ]);

    if (feesRes.error) toast.error("Failed to fetch fee structures.");
    else setFeeStructures(feesRes.data || []);

    if (groupsRes.error) toast.error("Failed to fetch class groups.");
    else setClassGroups(groupsRes.data || []);

    if (typesRes.error) toast.error("Failed to fetch student types.");
    else setStudentTypes(typesRes.data || []);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form Submission (Create/Update)
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const dataToSubmit = {
      ...values,
      class_group_id: values.class_group_id === 'all' ? null : values.class_group_id,
      student_type_id: values.student_type_id === 'both' ? null : values.student_type_id,
    };

    const query = editingFee
      ? supabase.from("fee_structures").update(dataToSubmit).eq("id", editingFee.id)
      : supabase.from("fee_structures").insert([dataToSubmit]);

    const { error } = await query;

    if (error) {
      toast.error(`Operation failed: ${error.message}`);
    } else {
      toast.success(`Fee structure ${editingFee ? 'updated' : 'created'} successfully!`);
      await fetchData();
      setDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  // Delete Operation
  const handleDelete = async () => {
    if (!feeToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("fee_structures").delete().eq("id", feeToDelete.id);
    if (error) {
      toast.error("Failed to delete fee structure.");
    } else {
      toast.success("Fee structure deleted successfully!");
      fetchData();
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  // Handlers for UI actions
  const handleEdit = (fee: FeeStructure) => {
    setEditingFee(fee);
    form.reset({
      ...fee,
      class_group_id: fee.class_groups?.id || 'all',
      student_type_id: fee.student_types?.id || 'both',
    });
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingFee(null);
      form.reset({ fee_name: "", amount: 0, fee_type: "Tuition", class_group_id: 'all', student_type_id: 'both' });
    }
  }, [dialogOpen, form]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fee Structure</CardTitle>
              <CardDescription>Manage fee structures for different student and class types.</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Fee</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFee ? "Edit" : "Add"} Fee Structure</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="fee_name" render={({ field }) => (
                      <FormItem><FormLabel>Fee Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="amount" render={({ field }) => (
                      <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="class_group_id" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Class Group</FormLabel>
                        <ClassGroupCombobox classGroups={classGroups} value={field.value} onChange={field.onChange} onNewGroupAdded={fetchData} />
                      <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="student_type_id" render={({ field }) => (
                      <FormItem><FormLabel>Student Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a student type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="both">Both</SelectItem>
                            {studentTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="fee_type" render={({ field }) => (
                      <FormItem><FormLabel>Fee Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a fee type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Tuition">Tuition</SelectItem>
                            <SelectItem value="Custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? "Saving..." : "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Class Group</TableHead>
                <TableHead>Student Type</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
              ) : feeStructures.length > 0 ? (
                feeStructures.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{fee.fee_name}</TableCell>
                    <TableCell>{fee.amount}</TableCell>
                    <TableCell>{fee.class_groups?.name || "All"}</TableCell>
                    <TableCell>{fee.student_types?.name || "Both"}</TableCell>
                    <TableCell>{fee.fee_type}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleEdit(fee)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setFeeToDelete(fee); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center">No fee structures found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the fee structure "{feeToDelete?.fee_name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Reusable Combobox for Class Groups
function ClassGroupCombobox({ classGroups, value, onChange, onNewGroupAdded }: { classGroups: ClassGroup[], value?: string, onChange: (value: string) => void, onNewGroupAdded: () => void }) {
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
      onChange(data.id);
      setDialogOpen(false);
      setNewGroupName("");
    }
    setIsAdding(false);
  };

  const displayValue = value === 'all' ? "All" : classGroups.find((cg) => cg.id === value)?.name;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {displayValue || "Select class group..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search class group..." />
            <CommandList>
              <CommandEmpty>No class group found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="all" onSelect={() => { onChange("all"); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  All
                </CommandItem>
                {classGroups.map((cg) => (
                  <CommandItem key={cg.id} value={cg.name} onSelect={() => { onChange(cg.id); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === cg.id ? "opacity-100" : "opacity-0")} />
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
          <DialogHeader>
            <DialogTitle>Add New Class Group</DialogTitle>
          </DialogHeader>
          <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g., BSc" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNewGroup} disabled={isAdding}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAdding ? "Adding..." : "Add Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}