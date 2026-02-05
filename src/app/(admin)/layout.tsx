"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<'superior' | 'superadmin' | 'admin' | 'cashier' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [cashierProfile, setCashierProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  useEffect(() => {
    const checkStatusAndRole = async () => {
      // Use getSession for initial check
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Double check with a small delay to handle session hydration issues
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
      }

      const user = session?.user;
      if (!user) return;

      // 1. Check Maintenance Mode
      const { data: settings } = await supabase.from('school_settings').select('is_maintenance_mode').single();
      const metadataRole = user.user_metadata?.role;
      const isSuperior = user.email === 'superior@gmail.com' || metadataRole === 'superior';
      const isSuperAdmin = user.email === 'superadmin@gmail.com' || metadataRole === 'superadmin';
      
      if (settings?.is_maintenance_mode && !isSuperior && pathname !== '/maintenance') {
        router.push('/maintenance');
        return;
      }

      // 2. Determine Role
      if (isSuperior) {
        setUserRole('superior');
        setUserName('Superior Admin');
      } else if (isSuperAdmin) {
        setUserRole('superadmin');
        setUserName('Super Admin');
      } else {
        // Check if Cashier
        const { data: cashier } = await supabase
          .from('cashiers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (cashier) {
          setUserRole('cashier');
          setUserName(cashier.name);
          setCashierProfile(cashier);
          if (cashier.password_change_required && pathname !== '/change-password') {
            router.push('/change-password');
            return;
          }
        } else {
          // Standard Admin
          setUserRole('admin');
          setUserName(user.email || 'Admin');
        }
      }
      
      setIsLoading(false);
    };

    checkStatusAndRole();

    // Set up a listener for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  // Role-based route protection
  useEffect(() => {
    if (!userRole) return;

    const superOnly = ['/admins'];
    const adminOrHigher = ['/dashboard', '/students', '/billing', '/fees', '/invoices', '/cashiers', '/departments', '/operations', '/class-management', '/activity-logs', '/settings'];
    
    if (userRole === 'cashier') {
      const isProtected = adminOrHigher.some(p => pathname.startsWith(p)) || superOnly.some(p => pathname.startsWith(p));
      // Cashiers can access financials and potentially operations (expenses) if permitted
      if (isProtected && !pathname.startsWith('/financials') && !pathname.startsWith('/operations') && !pathname.startsWith('/expenses')) {
        router.push('/financials');
      }
    } else if (userRole === 'admin') {
      // Admins cannot access superadmin only pages
      if (superOnly.some(p => pathname.startsWith(p))) {
        router.push('/dashboard');
        toast.error("Access denied.");
      }
    }
  }, [userRole, pathname, router]);

  if (isLoading || !userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium animate-pulse">Verifying Access...</p>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  const effectiveRoleForUi = userRole === 'superior' ? 'superadmin' : userRole;

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <Sidebar userRole={effectiveRoleForUi} isExpanded={isSidebarExpanded} cashierProfile={cashierProfile} />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 print:p-0",
        isSidebarExpanded ? "sm:pl-56 print:!pl-0" : "sm:pl-14 print:!pl-0"
      )}>
        <Header 
          userName={userName} 
          userRole={effectiveRoleForUi} 
          isSidebarExpanded={isSidebarExpanded} 
          onToggleSidebar={() => setIsSidebarExpanded(prev => !prev)} 
          cashierProfile={cashierProfile} 
        />
        <main className="flex-1 grid items-start gap-4 p-4 sm:px-6 sm:py-4 md:gap-8">
          {children}
        </main>
        <footer className="text-center text-sm text-muted-foreground py-4 border-t bg-background print:hidden mt-auto">
          © Copyrights {currentYear} Sanju Animations. All rights reserved
        </footer>
      </div>
    </div>
  );
}