"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Save, Upload, ShieldAlert, Power, ImageIcon } from "lucide-react";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const settingsSchema = z.object({
  school_name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  logo_url: z.string().optional(),
  is_maintenance_mode: z.boolean(),
});

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isSuperior, setIsSuperior] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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

  const logoUrl = form.watch("logo_url");

  const fetchSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsSuperior(user?.email === 'superior@gmail.com');

      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        form.reset({
          school_name: data.school_name || "",
          address: data.address || "",
          logo_url: data.logo_url || "",
          is_maintenance_mode: !!data.is_maintenance_mode,
        });
      }
    } catch (err: any) {
      console.error("Fetch settings error:", err);
      toast.error("Failed to load organization settings.");
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB.");
      return;
    }

    setUploadingLogo(true);
    const toastId = toast.loading("Uploading logo...");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      form.setValue("logo_url", publicUrl);
      toast.success("Logo uploaded successfully!", { id: toastId });
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSaving(true);
    const toastId = toast.loading("Saving settings...");
    
    try {
      const payload: any = { ...values };
      if (settingsId) {
          payload.id = settingsId;
      }

      const { data, error } = await supabase
        .from("school_settings")
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      setSettingsId(data.id);
      toast.success("Settings saved successfully!", { id: toastId });
      
      // Update form state with saved data
      form.reset({
        school_name: data.school_name || "",
        address: data.address || "",
        logo_url: data.logo_url || "",
        is_maintenance_mode: !!data.is_maintenance_mode,
      });
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      {isSuperior && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-lg">System-wide Controls</CardTitle>
            </div>
            <CardDescription>Emergency actions only available to the Superior Administrator.</CardDescription>
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
                <div className="flex justify-end"><Button type="submit" variant="outline" disabled={isSaving}>Update System State</Button></div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-ubuntu">Organization Settings</CardTitle>
          <CardDescription>Update your college branding and basic information.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-4">
                <div 
                  className="relative group cursor-pointer"
                  onClick={handleLogoClick}
                >
                  <Avatar className="h-24 w-24 border-2 border-muted group-hover:border-primary transition-colors">
                    <AvatarImage src={logoUrl} className="object-contain" />
                    <AvatarFallback className="bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="h-6 w-6 text-white" />
                  </div>
                  {uploadingLogo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">College Logo</p>
                  <p className="text-xs text-muted-foreground">Click to change (JPG/PNG, Max 2MB)</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-4">
                <FormField control={form.control} name="school_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>College Name</FormLabel>
                    <FormControl><Input placeholder="e.g. IDEAL COLLEGE OF ENGINEERING" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Address</FormLabel>
                    <FormControl><Textarea placeholder="Enter the full postal address..." className="min-h-[100px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={isSaving || uploadingLogo} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}