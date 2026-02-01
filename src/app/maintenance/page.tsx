"use client";

import { ShieldAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/navigation";

export default function MaintenancePage() {
  const router = useRouter();

  const handleBackToLogin = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-background p-8 rounded-3xl border shadow-xl">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 text-amber-600 mb-4">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-ubuntu font-black text-foreground">Access Disabled</h1>
        <p className="text-muted-foreground">
          The school management portal is currently undergoing scheduled maintenance or has been temporarily disabled by the administrator.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground bg-muted p-3 rounded-xl">
          <Clock className="h-4 w-4" />
          <span>Expected back soon</span>
        </div>
        <div className="pt-4">
          <Button variant="outline" className="w-full rounded-xl" onClick={handleBackToLogin}>
            Go to Login Page
          </Button>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Contact System Administrator for details
        </p>
      </div>
    </div>
  );
}