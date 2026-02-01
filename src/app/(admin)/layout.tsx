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
  const [userRole, setUserRole] = useState<'superadmin' | 'admin' | 'cashier' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [cashierProfile, setCashierProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  useEffect(() => {
    // Run initialization of Super Admin
    const initSuper = async () => {
      try {
        await fetch('/api/admin/init', { method: 'POST' });
      } catch (err) {
        console.error("Failed to sync super admin status");
      }
    };
    initSuper();
  }, []);

  useEffect(() => {
    const checkStatusAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // 1. Check Maintenance Mode
      const { data: settings } = await supabase.from('school_settings').select('is_maintenance_mode').single();
      const isSuper = session.user.email === 'superadmin@gmail.com';
      
      if (settings?.is_maintenance_mode && !isSuper && pathname !== '/maintenance') {
        router.push('/maintenance');
        return;
      }

      // 2. Determine Role
      let role: 'superadmin' | 'admin' | 'cashier' = 'admin';
      
      if (isSuper) {
        role = 'superadmin';
        setUserName('Super Admin');
      } else {
        // Check if Cashier
        const { data: cashier } = await supabase
          .from('cashiers')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (cashier) {
          role = 'cashier';
          setUserName(cashier.name);
          setCashierProfile(cashier);
          if (cashier.password_change_required && pathname !== '/change-password') {
            router.push('/change-password');
            return;
          }
        } else {
          // It's a standard Admin
          setUserName(session.user.email || 'Admin');
        }
      }
      
      setUserRole(role);
      setIsLoading(false);
    };

    checkStatusAndRole();
  }, [router, pathname]);

  // Role-based protection
  useEffect(() => {
    if (!userRole) return;

    const superOnly = ['/admins'];
    const adminOrHigher = ['/dashboard', '/students', '/fees', '/invoices', '/cashiers', '/departments', '/class-management', '/activity-logs', '/settings'];
    
    if (userRole === 'cashier') {
      const isProtected = adminOrHigher.some(p => pathname.startsWith(p)) || superOnly.some(p => pathname.startsWith(p));
      if (isProtected && !pathname.startsWith('/expenses') && !pathname.startsWith('/financials')) {
        router.push('/financials');
      }
    } else if (userRole === 'admin') {
      if (superOnly.some(p => pathname.startsWith(p))) {
        router.push('/dashboard');
        toast.error("Super Admin access required.");
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

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <Sidebar userRole={userRole} isExpanded={isSidebarExpanded} cashierProfile={cashierProfile} />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 print:p-0",
        isSidebarExpanded ? "sm:pl-56 print:!pl-0" : "sm:pl-14 print:!pl-0"
      )}>
        <Header 
          userName={userName} 
          userRole={userRole} 
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