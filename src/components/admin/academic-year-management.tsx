"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type AcademicYear = {
  id: string;
  year_name: string;
  is_active: boolean;
  created_at: string;
};

const formSchema = z.object({
  year_name: z.string().min(1, "Academic year name is required"),
  is_active: z.boolean(),
});

export function AcademicYearManagement() {
  const [items, setItems] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AcademicYear | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AcademicYear | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { year_name: "", is_active: false },
  });

  const fetchData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("academic_years")
      .select("*")
      .order("year_name", { ascending: false });

    if (error) {
      toast.error("Failed to fetch academic years.");
    } else {
      setItems(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Saving academic year...");

    // Perform the insert or update
    if (editingItem) {
      const { error } = await supabase
        .from("academic_years")
        .update(values)
        .eq("id", editingItem.id);

      if (error) {
        toast.error(`Update failed: ${error.message}`, { id: toastId });
      } else {
        toast.success("Academic Year updated successfully!", { id: toastId });
      }
    } else { // Creating a new item
      const { error } = await supabase
        .from("academic_years")
        .insert([values]);

      if (error) {
        toast.error(`Creation failed: ${error.message}`, { id: toastId });
      } else {
        toast.success("Academic Year created successfully!", { id: toastId });
      }
    }

    await fetchData();
    setDialogOpen(false);
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.is_active) {
        toast.error("Cannot delete the active academic year. Please set another year as active first.");
        setDeleteAlertOpen(false);
        return;
    }
    setIsDeleting(true);
    const { error } = await supabase.from("academic_years").delete().eq("id", itemToDelete.id);
    if (error) {
      toast.error("Failed to delete academic year.");
    } else {
      toast.success("Academic year deleted successfully!");
      fetchData();
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  const handleEdit = (item: AcademicYear) => {
    setEditingItem(item);
    form.reset({ year_name: item.year_name, is_active: item.is_active });
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingItem(null);
      form.reset({ year_name: "", is_active: false });
    }
  }, [dialogOpen, form]);

  return (
    <>
      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add New</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit" : "Add"} Academic Year</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="year_name" render={({ field }) => (
                  <FormItem><FormLabel>Academic Year Name</FormLabel><FormControl><Input {...field} placeholder="e.g., 2024-2025" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Set as Active Year</FormLabel>
                      <FormDescription>
                        Active years will appear in student-related dropdowns.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
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
      <div className="mt-4 border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
            ) : items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.year_name}</TableCell>
                  <TableCell>
                    {item.is_active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleEdit(item)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onSelect={() => { setItemToDelete(item); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="text-center">No items found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the "{itemToDelete?.year_name}" academic year.</AlertDialogDescription>
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