"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<'superadmin' | 'admin' | 'cashier' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [cashierProfile, setCashierProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);

  useEffect(() => {
    const checkUserStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check Maintenance Mode Status
      const { data: settings } = await supabase.from('school_settings').select('maintenance_mode').single();
      const maintenanceActive = settings?.maintenance_mode || false;
      setIsMaintenanceActive(maintenanceActive);

      // Check Profile/Role
      const { data: profile } = await supabase
        .from('cashiers')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      let role: 'superadmin' | 'admin' | 'cashier' = 'superadmin';
      
      if (profile) {
        // If they have a profile, they are either an Admin or a Cashier
        role = profile.role === 'admin' ? 'admin' : 'cashier';
        setUserName(profile.name);
        setCashierProfile(profile);
        
        if (profile.password_change_required && pathname !== '/change-password') {
          router.push('/change-password');
          return;
        }
      } else {
        // No profile in 'cashiers' table means they are the master Superadmin
        setUserName('Super Admin');
        role = 'superadmin';
      }
      
      // Enforce Maintenance Mode: If active, only superadmin can pass
      if (maintenanceActive && role !== 'superadmin' && pathname !== '/login') {
        // We'll handle the UI below
      }

      setUserRole(role);
      setIsLoading(false);
    };

    checkUserStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  // Maintenance Screen for non-superadmins
  if (isMaintenanceActive && userRole !== 'superadmin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-amber-100 rounded-full">
              <AlertTriangle className="h-12 w-12 text-amber-600" />
            </div>
          </div>
          <h1 className="text-3xl font-ubuntu font-bold">System Maintenance</h1>
          <p className="text-muted-foreground">
            The portal is currently suspended by the Superadmin for scheduled maintenance. 
            Please check back later or contact your supervisor.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="text-sm font-bold text-primary hover:underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <Sidebar userRole={userRole!} isExpanded={isSidebarExpanded} cashierProfile={cashierProfile} />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 print:p-0",
        isSidebarExpanded ? "sm:pl-56 print:!pl-0" : "sm:pl-14 print:!pl-0"
      )}>
        <Header userName={userName} userRole={userRole!} isSidebarExpanded={isSidebarExpanded} onToggleSidebar={() => setIsSidebarExpanded(prev => !prev)} cashierProfile={cashierProfile} />
        <main className="flex-1 grid items-start gap-4 p-4 sm:px-6 sm:py-4 md:gap-8">
          {isMaintenanceActive && userRole === 'superadmin' && (
            <div className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4" />
              SYSTEM IS CURRENTLY STOPPED (KILL SWITCH ACTIVE) - ONLY YOU CAN ACCESS
            </div>
          )}
          {children}
        </main>
        <footer className="text-center text-sm text-muted-foreground py-4 border-t bg-background print:hidden mt-auto">
          © Copyrights {currentYear} Sanju Animations. All rights reserved Sanju Animations Team
        </footer>
      </div>
    </div>
  );
}