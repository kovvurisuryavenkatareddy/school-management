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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/data-table-pagination";

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

const formSchema = z.object({
  fee_name: z.string().min(1, "Fee name is required"),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  class_group_id: z.string().optional(),
  student_type_id: z.string().optional(),
  fee_type: z.enum(["Tuition", "Custom"]),
});

const PAGE_SIZE = 10;

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
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fee_name: "", amount: 0, fee_type: "Tuition" },
  });

  const fetchData = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [feesRes, groupsRes, typesRes] = await Promise.all([
      supabase.from("fee_structures").select("*, class_groups(*), student_types(*)", { count: 'exact' }).order("created_at", { ascending: false }).range(from, to),
      supabase.from("class_groups").select("*"),
      supabase.from("student_types").select("*"),
    ]);

    if (feesRes.error) toast.error("Failed to fetch fee structures.");
    else {
      setFeeStructures(feesRes.data || []);
      setTotalCount(feesRes.count || 0);
    }

    if (groupsRes.data) setClassGroups(groupsRes.data);
    if (typesRes.data) setStudentTypes(typesRes.data);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const dataToSubmit = {
      ...values,
      class_group_id: values.class_group_id === 'all' ? null : values.class_group_id,
      student_type_id: values.student_type_id === 'both' ? null : values.student_type_id,
    };

    const query = editingFee ? supabase.from("fee_structures").update(dataToSubmit).eq("id", editingFee.id) : supabase.from("fee_structures").insert([dataToSubmit]);
    const { error } = await query;

    if (error) toast.error(`Operation failed: ${error.message}`);
    else {
      toast.success(`Fee structure ${editingFee ? 'updated' : 'created'} successfully!`);
      await fetchData();
      setDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (itemsToDelete.length === 0) return;
    setIsDeleting(true);
    const { error } = await supabase.from("fee_structures").delete().in("id", itemsToDelete);
    if (error) toast.error("Failed to delete fee structure(s).");
    else {
      toast.success(`${itemsToDelete.length} structure(s) deleted successfully!`);
      fetchData();
      setSelectedItems([]);
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? feeStructures.map(f => f.id) : []);
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, id] : prev.filter(itemId => itemId !== id));
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fee Structure</CardTitle>
              <CardDescription>Manage fee structures for students.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && (
                <Button variant="destructive" size="sm" onClick={() => { setItemsToDelete(selectedItems); setDeleteAlertOpen(true); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected ({selectedItems.length})
                </Button>
              )}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><PlusCircle className="h-3.5 w-3.5" /> <span className="sr-only sm:not-sr-only">Add Fee</span></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingFee ? "Edit" : "Add"} Fee Structure</DialogTitle></DialogHeader>
                  <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="fee_name" render={({ field }) => (<FormItem><FormLabel>Fee Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="class_group_id" render={({ field }) => (<FormItem><FormLabel>Class Group</FormLabel><ClassGroupCombobox classGroups={classGroups} value={field.value} onChange={field.onChange} onNewGroupAdded={fetchData} /><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="student_type_id" render={({ field }) => (
                      <FormItem><FormLabel>Student Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="both">Both</SelectItem>{studentTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="fee_type" render={({ field }) => (
                      <FormItem><FormLabel>Fee Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Tuition">Tuition</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</Button></DialogFooter>
                  </form></Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-[40px]"><Checkbox checked={selectedItems.length === feeStructures.length && feeStructures.length > 0} onCheckedChange={handleSelectAll} /></TableHead>
              <TableHead>Fee Name</TableHead><TableHead>Amount</TableHead><TableHead>Class</TableHead><TableHead>Student Type</TableHead><TableHead>Type</TableHead><TableHead className="sr-only">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
              ) : feeStructures.length > 0 ? (
                feeStructures.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell><Checkbox checked={selectedItems.includes(fee.id)} onCheckedChange={(checked) => handleSelectItem(fee.id, !!checked)} /></TableCell>
                    <TableCell className="font-medium">{fee.fee_name}</TableCell>
                    <TableCell>{fee.amount}</TableCell><TableCell>{fee.class_groups?.name || "All"}</TableCell><TableCell>{fee.student_types?.name || "Both"}</TableCell><TableCell>{fee.fee_type}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => { setEditingFee(fee); form.reset({...fee, class_group_id: fee.class_groups?.id || 'all', student_type_id: fee.student_types?.id || 'both'}); setDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setItemsToDelete([fee.id]); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center">No structures found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the selected fee structure(s).</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function ClassGroupCombobox({ classGroups, value, onChange, onNewGroupAdded }: any) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const handleAdd = async () => {
    setIsAdding(true);
    const { data, error } = await supabase.from("class_groups").insert({ name: newGroupName.trim() }).select().single();
    if (error) toast.error(error.message);
    else { toast.success("Added!"); onNewGroupAdded(); onChange(data.id); setDialogOpen(false); setNewGroupName(""); }
    setIsAdding(false);
  };
  return (
    <><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{value === 'all' ? "All" : classGroups.find((cg: any) => cg.id === value)?.name || "Select group..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search..." /><CommandList><CommandEmpty>No results.</CommandEmpty><CommandGroup>
      <CommandItem value="all" onSelect={() => { onChange("all"); setOpen(false); }}><Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} /> All</CommandItem>
      {classGroups.map((cg: any) => (<CommandItem key={cg.id} value={cg.name} onSelect={() => { onChange(cg.id); setOpen(false); }}><Check className={cn("mr-2 h-4 w-4", value === cg.id ? "opacity-100" : "opacity-0")} /> {cg.name}</CommandItem>))}
    </CommandGroup><CommandSeparator /><CommandGroup><CommandItem onSelect={() => { setOpen(false); setDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add New</CommandItem></CommandGroup></CommandList></Command></PopoverContent></Popover>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>Add Class Group</DialogTitle></DialogHeader><Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} /><DialogFooter><Button onClick={handleAdd} disabled={isAdding}>Add</Button></DialogFooter></DialogContent></Dialog></>
  );
}