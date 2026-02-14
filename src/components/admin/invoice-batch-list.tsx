"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

interface StudentInvoice {
  id: string;
  status: "paid" | "unpaid";
  batch_description: string | null;
  student: {
    roll_number: string;
    name: string;
  } | null;
}

interface InvoiceBatchListProps {
  batchId: string;
}

export function InvoiceBatchList({ batchId }: InvoiceBatchListProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
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
          setInvoices(data.map((item: any) => ({
            id: item.id,
            status: item.status,
            batch_description: item.batch_description,
            student: item.student || null
          })));
        }
      }
      setIsLoading(false);
    };

    fetchBatchDetails();
  }, [batchId]);

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.student?.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <CardTitle>Invoice Batch Details</CardTitle>
            <CardDescription>View and manage invoices in this batch</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            placeholder="Search by student name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll Number</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.student?.roll_number}</TableCell>
                  <TableCell>{invoice.student?.name}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.status === "paid" ? "secondary" : "destructive"}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}