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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Button } from "@/components/ui/button";
import { ExternalLink, Search, Eye, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("activity_logs")
        .select("*, cashiers(name), students(name, roll_number)", { count: 'exact' });

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

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
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
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-4">Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right pr-4">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">Loading audit trail...</TableCell></TableRow>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id} className="group">
                      <TableCell className="text-[10px] pl-4 text-muted-foreground font-mono">
                        {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell>
                        {log.cashiers ? (
                          <span className="font-medium text-xs">{log.cashiers.name}</span>
                        ) : (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] h-4">ADMIN</Badge>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-tight h-5">{log.action}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {log.students ? (
                          <div className="flex flex-col">
                              <span className="font-semibold">{log.students.name}</span>
                              <span className="text-muted-foreground text-[10px]">Roll: {log.students.roll_number}</span>
                          </div>
                        ) : <span className="text-muted-foreground italic">N/A</span>}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Detail</span>
                        </Button>
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

      {/* Full Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <ClipboardList className="h-5 w-5" />
              <DialogTitle className="text-xl">Action Insight</DialogTitle>
            </div>
            <DialogDescription>
              Complete metadata for the action performed on {selectedLog && new Date(selectedLog.timestamp).toLocaleString()}.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {selectedLog && (
              <div className="space-y-6 py-4">
                {/* Header Context */}
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border shadow-inner">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Performed By</p>
                    <p className="font-semibold text-sm">{selectedLog.cashiers?.name || "System Administrator"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Event Category</p>
                    <Badge variant="secondary" className="font-black text-[10px]">{selectedLog.action}</Badge>
                  </div>
                  {selectedLog.students && (
                    <div className="col-span-2 pt-2 border-t mt-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Student Reference</p>
                      <p className="font-semibold text-sm">{selectedLog.students.name} ({selectedLog.students.roll_number})</p>
                    </div>
                  )}
                </div>

                {/* Specific Details List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-tighter flex items-center gap-2">
                    <div className="h-1 w-4 bg-primary rounded-full" />
                    Activity Metadata
                  </h4>
                  
                  <div className="grid gap-3">
                    {selectedLog.details && typeof selectedLog.details === 'object' ? (
                      Object.entries(selectedLog.details).map(([key, value]) => {
                        if (key === 'document_url' && value) {
                          return (
                            <div key={key} className="flex flex-col gap-2 p-3 rounded-lg border bg-blue-50/50">
                              <p className="text-[10px] font-bold text-blue-600 uppercase">{formatKey(key)}</p>
                              <Button variant="outline" size="sm" className="w-full bg-white h-9 font-bold text-blue-700" asChild>
                                <a href={value as string} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" /> View Permission Document
                                </a>
                              </Button>
                            </div>
                          );
                        }
                        
                        return (
                          <div key={key} className="flex justify-between items-center py-2 border-b last:border-0">
                            <span className="text-xs text-muted-foreground font-medium">{formatKey(key)}</span>
                            <span className="text-xs font-black">
                              {typeof value === 'number' && (key.includes('amount') || key.includes('balance')) 
                                ? `₹${value.toLocaleString()}` 
                                : String(value)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs italic text-muted-foreground">No metadata recorded for this action.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedLog(null)}>Close Inspection</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}