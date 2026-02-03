"use client";

import { useEffect, useState, useMemo } from "react";
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
import { ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("activity_logs")
        .select("*, cashiers(name), students(name, roll_number)", { count: 'exact' });

      // If we are searching, we fetch all and filter in memory for fuzzy behavior OR use ilike (better)
      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,details->>cashier_name.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query
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
    
    const delayDebounce = setTimeout(() => {
        fetchLogs();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [currentPage, searchTerm]);

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
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle>Activity Logs</CardTitle>
          <CardDescription>Review system-wide actions performed by platform users.</CardDescription>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Fuzzy search logs..." 
            className="pl-9 h-9"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">Date & Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Student Context</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10">Loading audit trail...</TableCell></TableRow>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs pl-4">{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      {log.cashiers ? (
                        <span className="font-medium text-xs">{log.cashiers.name}</span>
                      ) : (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">PLATFORM ADMIN</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight">{log.action}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {log.students ? (
                        <div className="flex flex-col">
                            <span className="font-semibold">{log.students.name}</span>
                            <span className="text-muted-foreground text-[10px]">Roll: {log.students.roll_number}</span>
                        </div>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {renderDetails(log)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No logs found matching your search.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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