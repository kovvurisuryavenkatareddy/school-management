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
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('org-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('org-assets')
        .getPublicUrl(filePath);

      setLogoPreview(publicUrl);
      form.setValue('logo_url', publicUrl);
      toast.success("Logo uploaded successfully!", { id: toastId });
    } catch (error: any) {
      toast.error(`Logo upload failed: ${error.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    form.setValue('logo_url', '');
  };

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSaving(true);
    const { error } = await supabase
      .from("school_settings")
      .update(values)
      .eq("id", settingsId);

    if (error) {
      toast.error(`Update failed: ${error.message}`);
    } else {
      toast.success("Organization details updated successfully!");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
            <CardDescription>
              Emergency actions only available to the Super Administrator.
            </CardDescription>
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
                          <Power className={cn("h-4 w-4", field.value ? "text-rose-600" : "text-emerald-600")} />
                          Maintenance Mode
                        </FormLabel>
                        <FormDescription>
                          Stop website access for all Admins and Cashiers. Only you can log in.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-rose-600"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                   <Button type="submit" disabled={isSaving} variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100">
                     Update System State
                   </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-ubuntu">Organization Settings</CardTitle>
          <CardDescription>
            Manage the information that appears on receipts and documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="flex flex-col items-center justify-center space-y-4 pb-4 border-b">
                <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">College Logo</FormLabel>
                <div className="relative group">
                  <div className="h-32 w-32 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-contain" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  {logoPreview && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={removeLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleLogoUpload} 
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </Button>
              </div>

              <FormField
                control={form.control}
                name="school_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      College / School Name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. IDEAL COLLEGE OF ENGINEERING" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Postal Address
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter the full campus address..." 
                        className="resize-none min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving} className="gap-2 px-8">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}