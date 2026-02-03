"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, Trash2, Loader2, ShieldCheck, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const adminFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().min(1, "Role is required"),
});

export default function AdminsManagementPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<any | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const form = useForm<z.infer<typeof adminFormSchema>>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: { email: "", password: "", role: "admin" },
  });

  const fetchAdmins = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserRole(user?.user_metadata?.role || 'admin');

    const response = await fetch('/api/admin/system');
    const data = await response.json();
    if (response.ok) setAdmins(data.admins);
    else toast.error("Failed to fetch user list.");
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const onSubmit = async (values: z.infer<typeof adminFormSchema>) => {
    setIsSubmitting(true);
    const response = await fetch('/api/admin/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    const result = await response.json();

    if (response.ok) {
      toast.success("User created successfully!");
      fetchAdmins();
      setDialogOpen(false);
      form.reset();
    } else {
      toast.error(result.error || "Failed to create user.");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!adminToDelete) return;
    
    const response = await fetch('/api/admin/system', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: adminToDelete.id }),
    });

    if (response.ok) {
      toast.success("Access revoked successfully.");
      fetchAdmins();
      setDeleteAlertOpen(false);
    } else {
      const result = await response.json();
      toast.error(result.error || "Failed to remove user.");
    }
  };

  const availableRoles = currentUserRole === 'superior' 
    ? [{ id: 'superadmin', label: 'Super Admin' }, { id: 'admin', label: 'Admin' }]
    : [{ id: 'admin', label: 'Admin' }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-ubuntu font-black text-primary tracking-tight">User Access Management</h1>
          <p className="text-muted-foreground font-medium">Manage administrative hierarchy and system permissions.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl h-11 px-6 shadow-lg shadow-primary/20">
              <UserPlus className="h-5 w-5" />
              Provision New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Create Access Account</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="admin@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="text" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Assigned Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Create Account"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead className="pl-6">Administrator</TableHead><TableHead>Platform Role</TableHead><TableHead>Access Status</TableHead><TableHead className="text-right pr-6">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
              ) : admins.length > 0 ? (
                admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{admin.email[0].toUpperCase()}</div>
                        <div className="flex flex-col">
                          <span className="font-semibold">{admin.email}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Last active: {new Date(admin.last_sign_in_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[10px]">{admin.user_metadata?.role || 'admin'}</Badge></TableCell>
                    <TableCell><Badge className="bg-emerald-100 text-emerald-700">Verified</Badge></TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" onClick={() => { setAdminToDelete(admin); setDeleteAlertOpen(true); }} className="text-rose-600 hover:bg-rose-50 rounded-full">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">No administrative users found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Revoke Access?</AlertDialogTitle><AlertDialogDescription>This will immediately terminate <strong>{adminToDelete?.email}</strong>'s access to the system. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">Confirm Revocation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}