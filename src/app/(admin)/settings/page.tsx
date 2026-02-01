"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Save, Building2, MapPin, Upload, X, ShieldAlert, Power } from "lucide-react";

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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const settingsSchema = z.object({
  school_name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  logo_url: z.string().optional(),
  is_maintenance_mode: z.boolean().default(false),
});

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      school_name: "",
      address: "",
      logo_url: "",
      is_maintenance_mode: false,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsSuperAdmin(user?.email === 'superadmin@gmail.com');

      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .single();

      if (error) {
        toast.error("Failed to load organization settings.");
      } else if (data) {
        setSettingsId(data.id);
        form.reset({
          school_name: data.school_name,
          address: data.address,
          logo_url: data.logo_url || "",
          is_maintenance_mode: data.is_maintenance_mode || false,
        });
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
      setIsLoading(false);
    };

    fetchSettings();
  }, [form]);

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSaving(true);
    const { error } = await supabase
      .from("school_settings")
      .update(values)
      .eq("id", settingsId);

    if (error) {
      toast.error(`Update failed: ${error.message}`);
    } else {
      toast.success("Settings updated successfully!");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      {isSuperAdmin && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-lg">System-wide Controls</CardTitle>
            </div>
            <CardDescription>Emergency actions only available to the Super Administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_maintenance_mode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-2xl border bg-background p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <Power className={field.value ? "text-rose-600" : "text-emerald-600"} />
                          Website Shutdown
                        </FormLabel>
                        <FormDescription>Disable portal access for everyone except you.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end"><Button type="submit" variant="outline">Update System State</Button></div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-2xl font-ubuntu">Organization Settings</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="school_name" render={({ field }) => (
              <FormItem><FormLabel>College Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Postal Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form></Form>
        </CardContent>
      </Card>
    </div>
  );
}