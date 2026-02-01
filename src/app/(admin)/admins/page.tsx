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

const adminFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function AdminsManagementPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<any | null>(null);

  const form = useForm<z.infer<typeof adminFormSchema>>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const fetchAdmins = async () => {
    setIsLoading(true);
    // Since Next.js client-side can't list users easily without service role,
    // we assume a simple 'admins' table is used to track them, 
    // or we filter them if we had a profiles table. 
    // For this implementation, we check users that aren't cashiers.
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      // If client-side listing fails (permissions), we'd usually use an API route.
      const response = await fetch('/api/admin/system');
      const data = await response.json();
      if (response.ok) setAdmins(data.admins);
      else toast.error("Failed to fetch admin list.");
    } else {
      setAdmins(users.filter(u => u.email !== 'superadmin@gmail.com'));
    }
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
      toast.success("Admin created successfully!");
      fetchAdmins();
      setDialogOpen(false);
      form.reset();
    } else {
      toast.error(result.error || "Failed to create admin.");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!adminToDelete) return;
    setIsDeleting(true);
    
    const response = await fetch('/api/admin/system', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: adminToDelete.id }),
    });

    if (response.ok) {
      toast.success("Admin removed successfully.");
      fetchAdmins();
      setDeleteAlertOpen(false);
    } else {
      const result = await response.json();
      toast.error(result.error || "Failed to remove admin.");
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-ubuntu font-black text-primary tracking-tight">Admin Management</h1>
          <p className="text-muted-foreground font-medium">Control who has administrative access to the system.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl h-11 px-6 shadow-lg shadow-primary/20">
              <UserPlus className="h-5 w-5" />
              Add New Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Sub-Admin</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="admin@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="text" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Admin"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-primary/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-6">Administrator</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
              ) : admins.length > 0 ? (
                admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {admin.email[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold">{admin.email}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Last active: {new Date(admin.last_sign_in_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Admin</Badge></TableCell>
                    <TableCell><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active Access</Badge></TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" onClick={() => { setAdminToDelete(admin); setDeleteAlertOpen(true); }} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-full">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">No sub-admins found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Admin Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke all administrative privileges for <strong>{adminToDelete?.email}</strong>. They will no longer be able to access the management portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 rounded-xl">
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}