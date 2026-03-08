"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { PlusCircle, Eye, Trash2, Pencil, MoreHorizontal, Loader2 } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/data-table-pagination";

type InvoiceSummary = {
  batch_id: string;
  batch_description: string;
  due_date: string;
  amount: number;
  total_students: number;
  paid_students: number;
  pending_students: number;
};

const editBatchSchema = z.object({
  batch_description: z.string().min(1, "Description is required"),
  due_date: z.string().min(1, "Due date is required"),
});

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const [summaries, setSummaries] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<InvoiceSummary | null>(null);

  const form = useForm<z.infer<typeof editBatchSchema>>({
    resolver: zodResolver(editBatchSchema),
  });

  const fetchSummaries = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc("get_invoice_summary");
    if (error) {
      toast.error("Failed to fetch invoice summaries.");
    } else {
      setSummaries(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const handleDelete = async () => {
    if (selectedItems.length === 0) return;
    setIsDeleting(true);
    const toastId = toast.loading("Deleting selected batches...");
    const { error } = await supabase.from("invoices").delete().in("batch_id", selectedItems);
    if (error) {
      toast.error(`Failed to delete: ${error.message}`, { id: toastId });
    } else {
      toast.success("Invoice batches deleted successfully!", { id: toastId });
      fetchSummaries();
      setSelectedItems([]);
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  const onEditSubmit = async (values: z.infer<typeof editBatchSchema>) => {
    if (!editingBatch) return;
    setIsUpdating(true);
    const toastId = toast.loading("Updating batch details...");

    const { error } = await supabase
      .from("invoices")
      .update({
        batch_description: values.batch_description,
        due_date: values.due_date,
      })
      .eq("batch_id", editingBatch.batch_id);

    if (error) {
      toast.error(`Update failed: ${error.message}`, { id: toastId });
    } else {
      toast.success("Batch updated successfully!", { id: toastId });
      fetchSummaries();
      setEditDialogOpen(false);
    }
    setIsUpdating(false);
  };

  const handleSelectAll = (checked: boolean) => {
    const paginatedItems = summaries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    setSelectedItems(checked ? paginatedItems.map(s => s.batch_id) : []);
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, id] : prev.filter(itemId => itemId !== id));
  };

  const paginatedSummaries = summaries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(summaries.length / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>View and manage generated invoice batches.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setDeleteAlertOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected ({selectedItems.length})
                </Button>
              )}
              <Link href="/invoices/generate">
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Generate Invoices</span>
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedItems.length > 0 && selectedItems.length === paginatedSummaries.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : paginatedSummaries.length > 0 ? (
                paginatedSummaries.map((summary) => (
                  <TableRow key={summary.batch_id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedItems.includes(summary.batch_id)}
                        onCheckedChange={(checked) => handleSelectItem(summary.batch_id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{summary.batch_description}</TableCell>
                    <TableCell>₹{summary.amount.toLocaleString()}</TableCell>
                    <TableCell>{summary.total_students}</TableCell>
                    <TableCell><Badge className="bg-green-100 text-green-800">{summary.paid_students}</Badge></TableCell>
                    <TableCell><Badge variant="destructive">{summary.pending_students}</Badge></TableCell>
                    <TableCell>{new Date(summary.due_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Batch Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/invoices/${summary.batch_id}`}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingBatch(summary);
                            form.reset({
                              batch_description: summary.batch_description,
                              due_date: summary.due_date,
                            });
                            setEditDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => {
                            setSelectedItems([summary.batch_id]);
                            setDeleteAlertOpen(true);
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Batch
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground italic">No invoice batches found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalCount={summaries.length} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected invoice batch(es) and all associated student invoices. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting..." : "Confirm Deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch Details</DialogTitle>
            <DialogDescription>Update the description and due date for all invoices in this batch.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={form.control} name="batch_description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Description</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}