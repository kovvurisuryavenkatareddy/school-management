"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Sparkles, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { DataTablePagination } from "@/components/data-table-pagination";

type Cashier = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  has_discount_permission: boolean;
  has_expenses_permission: boolean;
  created_at: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  has_discount_permission: z.boolean().default(false),
  has_expenses_permission: z.boolean().default(false),
  password: z.string().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const PAGE_SIZE = 10;

export default function CashiersPage() {
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingCashier, setEditingCashier] = useState<Cashier | null>(null);
  const [cashierForPassword, setCashierForPassword] = useState<Cashier | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", phone: "", has_discount_permission: false, has_expenses_permission: false, password: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  const fetchCashiers = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("cashiers")
      .select("*", { count: 'exact' })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) toast.error("Failed to fetch cashiers.");
    else {
      setCashiers(data || []);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCashiers();
  }, [currentPage]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    if (editingCashier) {
      const { error } = await supabase.from("cashiers").update({ 
        name: values.name, phone: values.phone,
        has_discount_permission: values.has_discount_permission,
        has_expenses_permission: values.has_expenses_permission,
      }).eq("id", editingCashier.id);
      
      if (error) toast.error(`Update failed: ${error.message}`);
      else {
        toast.success("Cashier updated successfully!");
        await fetchCashiers();
        setDialogOpen(false);
      }
    } else {
      if (!values.password || values.password.length < 8) {
        form.setError("password", { type: "manual", message: "Password must be at least 8 characters." });
        setIsSubmitting(false);
        return;
      }
      const response = await fetch('/api/cashiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) toast.error(`Failed to create cashier: ${result.error || 'An unknown error occurred.'}`);
      else {
        toast.success("Cashier created successfully!");
        await fetchCashiers();
        setDialogOpen(false);
      }
    }
    setIsSubmitting(false);
  };

  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    if (!cashierForPassword) return;
    setIsSubmitting(true);
    const response = await fetch('/api/cashiers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: cashierForPassword.user_id, password: values.password }) });
    const result = await response.json();
    if (!response.ok) toast.error(`Failed to update password: ${result.error || 'An unknown error occurred.'}`);
    else {
      toast.success("Password reset successfully!");
      setPasswordDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (itemsToDelete.length === 0) return;
    setIsDeleting(true);
    
    const uids = cashiers.filter(c => itemsToDelete.includes(c.id)).map(c => c.user_id);

    const response = await fetch('/api/cashiers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: uids }),
    });

    const result = await response.json();

    if (!response.ok) toast.error(`Failed to delete cashier(s): ${result.error || 'An unknown error occurred.'}`);
    else {
      toast.success("Cashier(s) deleted successfully!");
      fetchCashiers();
      setSelectedItems([]);
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? cashiers.map(c => c.id) : []);
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, id] : prev.filter(itemId => itemId !== id));
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingCashier(null);
      form.reset({ name: "", email: "", phone: "", has_discount_permission: false, has_expenses_permission: false, password: "" });
    }
  }, [dialogOpen, form]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cashiers</CardTitle>
              <CardDescription>Manage cashier accounts and permissions.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => { setItemsToDelete(selectedItems); setDeleteAlertOpen(true); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected ({selectedItems.length})
                </Button>
              )}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Cashier</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader><DialogTitle>{editingCashier ? "Edit" : "Add"} Cashier</DialogTitle></DialogHeader>
                  <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={!!editingCashier} /></FormControl><FormMessage /></FormItem>)} />
                    {!editingCashier && (
                      <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="text" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    )}
                    <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="has_discount_permission" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Discount Permission</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="has_expenses_permission" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Expenses Permission</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</Button>
                    </DialogFooter>
                  </form></Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedItems.length === cashiers.length && cashiers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
              ) : cashiers.length > 0 ? (
                cashiers.map((cashier) => (
                  <TableRow key={cashier.id}>
                    <TableCell><Checkbox checked={selectedItems.includes(cashier.id)} onCheckedChange={(checked) => handleSelectItem(cashier.id, !!checked)} /></TableCell>
                    <TableCell className="font-medium">{cashier.name}</TableCell>
                    <TableCell>{cashier.email}</TableCell>
                    <TableCell>{cashier.has_discount_permission ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell>{cashier.has_expenses_permission ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => { setEditingCashier(cashier); form.reset(cashier); setDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit Profile</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => { setCashierForPassword(cashier); setPasswordDialogOpen(true); }}><KeyRound className="mr-2 h-4 w-4" />Change Password</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setItemsToDelete([cashier.id]); setDeleteAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete Account</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center">No cashiers found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the selected cashier account(s).</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}