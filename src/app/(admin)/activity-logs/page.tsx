"use client";

import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type ActivityLog = {
  id: string;
  timestamp: string;
  action: string;
  details: any;
  cashiers: { name: string } | null;
  students: { name: string; roll_number: string } | null;
};

const PAGE_SIZE = 15;

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("activity_logs")
        .select("*, cashiers(name), students(name, roll_number)", { count: 'exact' })
        .order("timestamp", { ascending: false })
        .range(from, to);

      if (error) {
        toast.error("Failed to fetch activity logs.");
      } else {
        setLogs(data as ActivityLog[]);
        setTotalCount(count || 0);
      }
      setIsLoading(false);
    };
    fetchLogs();
  }, [currentPage]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const renderDetails = (log: ActivityLog) => {
    if (!log.details) return "N/A";
    
    switch (log.action) {
      case 'Fee Collection':
        return `Amount: ${log.details.amount}, Type: ${log.details.fee_type || 'N/A'}`;
      case 'Concession Applied':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-xs">Amount: ₹{log.details.amount.toLocaleString()}</span>
            {log.details.document_url && (
              <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs font-bold" asChild>
                <a href={log.details.document_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3 w-3" /> View Permission Letter
                </a>
              </Button>
            )}
          </div>
        );
      case 'Invoice Payment':
        return `Amount: ${log.details.amount}, Desc: ${log.details.description || 'N/A'}`;
      case 'Bulk Payment Import':
        return `Count: ${log.details.count} records imported.`;
      default:
        return typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
        <CardDescription>
          Review actions performed by Admins and Cashiers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell>
                    {log.cashiers ? (
                      <span className="font-medium">{log.cashiers.name}</span>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{log.action}</Badge></TableCell>
                  <TableCell className="text-xs">{log.students ? `${log.students.name} (${log.students.roll_number})` : 'N/A'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {renderDetails(log)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No activity logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
        />
      </CardContent>
    </Card>
  );
}