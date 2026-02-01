"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Save, Building2, MapPin, Upload, X, Power, AlertCircle } from "lucide-react";

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
import { cn } from "@/lib/utils";

const settingsSchema = z.object({
  school_name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  logo_url: z.string().optional(),
  maintenance_mode: z.boolean().default(false),
});

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      school_name: "",
      address: "",
      logo_url: "",
      maintenance_mode: false,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('cashiers').select('role').eq('user_id', user.id).single();
        setIsSuperAdmin(!profile); // No profile = Superadmin
      }

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
          maintenance_mode: data.maintenance_mode || false,
        });
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
      setIsLoading(false);
    };

    fetchSettings();
  }, [form]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size should be less than 2MB");
      return;
    }
    setIsSaving(true);
    const toastId = toast.loading("Uploading logo...");
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('org-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('org-assets').getPublicUrl(fileName);
      setLogoPreview(publicUrl);
      form.setValue('logo_url', publicUrl);
      toast.success("Logo uploaded successfully!", { id: toastId });
    } catch (error: any) {
      toast.error(`Logo upload failed: ${error.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSaving(true);
    const { error } = await supabase.from("school_settings").update(values).eq("id", settingsId);
    if (error) toast.error(`Update failed: ${error.message}`);
    else toast.success("Settings updated successfully!");
    setIsSaving(false);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      {/* Superadmin Kill Switch Section */}
      {isSuperAdmin && (
        <Card className={cn("border-2 transition-all", form.watch('maintenance_mode') ? "border-amber-500 bg-amber-50/50" : "border-muted")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Power className={cn("h-5 w-5", form.watch('maintenance_mode') ? "text-amber-600" : "text-emerald-600")} />
                  System Master Control
                </CardTitle>
                <CardDescription>Emergency switch to stop/start the entire website.</CardDescription>
              </div>
              <Switch 
                checked={form.watch('maintenance_mode')} 
                onCheckedChange={(val) => {
                  form.setValue('maintenance_mode', val);
                  toast.warning(val ? "System stopping... only you will have access." : "System starting... restoring public access.");
                }} 
              />
            </div>
          </CardHeader>
          {form.watch('maintenance_mode') && (
            <CardContent>
              <div className="p-3 bg-amber-100 rounded-lg border border-amber-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium">
                  <strong>Kill Switch Active:</strong> All Admins and Cashiers are currently locked out. 
                  They will see a "System Maintenance" screen. Only your account remains functional.
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-ubuntu">Organization Settings</CardTitle>
          <CardDescription>Manage organization branding and appearance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4 pb-4 border-b">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 overflow-hidden">
                    {logoPreview ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" /> : <Upload className="h-8 w-8 text-muted-foreground/40" />}
                  </div>
                </div>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </Button>
              </div>

              <FormField control={form.control} name="school_name" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-2"><Building2 className="h-4 w-4" /> College Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Postal Address</FormLabel><FormControl><Textarea className="resize-none min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving} className="gap-2 px-8">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save All Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}