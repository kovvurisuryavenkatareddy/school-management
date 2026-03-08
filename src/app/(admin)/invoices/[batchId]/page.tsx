"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Search, Loader2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";

type StudentInvoice = {
  id: string;
  status: "paid" | "unpaid";
  students: {
    roll_number: string;
    name: string;
  };
};

export default function InvoiceBatchDetailPage({ params }: { params: { batchId: string } }) {
  const { batchId } = params;
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [batchDescription, setBatchDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchBatchDetails = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("id, status, batch_description, students(roll_number, name)")
      .eq("batch_id", batchId);

    if (error) {
      toast.error("Failed to fetch batch details.");
    } else {
      const normalized: StudentInvoice[] = (data || []).map((row: any) => ({
        id: row.id,
        status: row.status,
        students: row.students
          ? { roll_number: row.students.roll_number, name: row.students.name }
          : { roll_number: "N/A", name: "Student not found" },
      }));

      setInvoices(normalized);
      if (data && data.length > 0) {
        setBatchDescription(data[0].batch_description || "Invoice Batch");
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBatchDetails();
  }, [batchId]);

  const handleDeleteInvoice = async () => {
    if (!deleteId) return;
    const toastId = toast.loading("Removing student from batch...");
    
    const { error } = await supabase.from("invoices").delete().eq("id", deleteId);
    
    if (error) {
      toast.error(`Failed to delete: ${error.message}`, { id: toastId });
    } else {
      toast.success("Student removed from batch.", { id: toastId });
      setInvoices(prev => prev.filter(inv => inv.id !== deleteId));
    }
    setDeleteId(null);
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.students.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.students.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/billing">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <CardTitle>{batchDescription || "Loading Batch..."}</CardTitle>
              <CardDescription>
                Detailed student list for this invoice batch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.students.roll_number}</TableCell>
                      <TableCell className="font-medium">
                        {invoice.students.name}
                      </TableCell>
                      <TableCell>
                        {invoice.status === "paid" ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200">Unpaid</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => setDeleteId(invoice.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      No matching student invoices found in this batch.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student from Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete this specific invoice. This action is permanent and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}