"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type StudentInvoice = {
  id: string;
  status: "paid" | "unpaid";
  batch_description: string | null;
  student: {
    roll_number: string;
    name: string;
  } | null;
};

interface InvoiceBatchViewProps {
  batchId: string;
}

export function InvoiceBatchView({ batchId }: InvoiceBatchViewProps) {
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [batchDescription, setBatchDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchBatchDetails = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("id, status, batch_description, student:students(roll_number, name)")
        .eq("batch_id", batchId);

      if (error) {
        toast.error("Failed to fetch batch details.");
      } else {
        if (data) {
          setInvoices(
            data.map((item: any) => ({
              id: item.id,
              status: item.status,
              batch_description: item.batch_description,
              student: item.student ? {
                roll_number: item.student.roll_number,
                name: item.student.name
              } : null
            }))
          );
        }
        if (data && data.length > 0) {
          setBatchDescription(data[0].batch_description || "Invoice Batch");
        }
      }
      setIsLoading(false);
    };
    fetchBatchDetails();
  }, [batchId]);

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.student?.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <CardTitle>{batchDescription}</CardTitle>
            <CardDescription>
              Showing {filteredInvoices.length} of {invoices.length} students in this batch.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll Number</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.student?.roll_number || 'N/A'}</TableCell>
                  <TableCell className="font-medium">
                    {invoice.student?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {invoice.status === "paid" ? (
                      <Badge className="bg-green-100 text-green-800">Paid</Badge>
                    ) : (
                      <Badge variant="destructive">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No students found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}