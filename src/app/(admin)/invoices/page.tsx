"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusCircle, Eye } from "lucide-react";

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
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchSummaries = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.rpc("get_invoice_summary");
      if (error) {
        toast.error("Failed to fetch invoice summaries.");
        console.error(error);
      } else {
        setSummaries(data || []);
      }
      setIsLoading(false);
    };
    fetchSummaries();
  }, []);

  const paginatedSummaries = summaries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const totalPages = Math.ceil(summaries.length / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>
              View and manage generated invoice batches.
            </CardDescription>
          </div>
          <Link href="/invoices/generate">
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Generate Invoices
              </span>
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Total Students</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedSummaries.length > 0 ? (
              paginatedSummaries.map((summary) => (
                <TableRow key={summary.batch_id}>
                  <TableCell className="font-medium">
                    {summary.batch_description}
                  </TableCell>
                  <TableCell>{summary.amount}</TableCell>
                  <TableCell>{summary.total_students}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">
                      {summary.paid_students}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {summary.pending_students}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(summary.due_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link href={`/invoices/${summary.batch_id}`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        View Students
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No invoice batches found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalCount={summaries.length}
          pageSize={PAGE_SIZE}
        />
      </CardContent>
    </Card>
  );
}