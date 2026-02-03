"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusCircle, Eye, Trash2, Loader2 } from "lucide-react";

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

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const [summaries, setSummaries] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

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
    const { error } = await supabase.from("invoices").delete().in("batch_id", selectedItems);
    if (error) {
      toast.error("Failed to delete invoice batches.");
    } else {
      toast.success(`${selectedItems.length} batch(es) deleted successfully!`);
      fetchSummaries();
      setSelectedItems([]);
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
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
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
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
                    <TableCell>{summary.amount}</TableCell>
                    <TableCell>{summary.total_students}</TableCell>
                    <TableCell><Badge className="bg-green-100 text-green-800">{summary.paid_students}</Badge></TableCell>
                    <TableCell><Badge variant="destructive">{summary.pending_students}</Badge></TableCell>
                    <TableCell>{new Date(summary.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/invoices/${summary.batch_id}`}>
                        <Button variant="outline" size="sm" className="gap-1"><Eye className="h-3.5 w-3.5" /> View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="text-center">No invoice batches found.</TableCell></TableRow>
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
            <AlertDialogDescription>This will permanently delete the selected invoice batch(es) and all associated student invoices.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}