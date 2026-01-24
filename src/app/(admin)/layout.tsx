"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";
import { cn } from '@/lib/utils';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [cashierProfile, setCashierProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: cashierProfileData } = await supabase
        .from('cashiers')
        .select('password_change_required, name, has_expenses_permission')
        .eq('user_id', session.user.id)
        .single();

      let role: 'admin' | 'cashier' = 'admin';
      if (cashierProfileData) {
        role = 'cashier';
        setUserName(cashierProfileData.name);
        setCashierProfile(cashierProfileData);
        if (cashierProfileData.password_change_required && pathname !== '/change-password') {
          router.push('/change-password');
          return;
        }
      } else {
        setUserName(session.user.email || 'Admin');
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

  useEffect(() => {
    if (userRole) {
      const adminOnlyPages = [
        '/dashboard', 
        '/students',
        '/fees', 
        '/invoices', 
        '/cashiers', 
        '/departments', 
        '/class-management',
        '/activity-logs',
        '/settings'
      ];
      const cashierOnlyPages: string[] = [];

      if (userRole === 'cashier') {
        if (pathname.startsWith('/expenses') && !cashierProfile?.has_expenses_permission) {
          router.push('/financials');
          return;
        }
      }

      const currentPageIsAdminOnly = adminOnlyPages.some(p => pathname.startsWith(p));
      const currentPageIsCashierOnly = cashierOnlyPages.some(p => pathname.startsWith(p));

      if (userRole === 'cashier' && currentPageIsAdminOnly) {
        router.push('/financials');
      } else if (userRole === 'admin' && currentPageIsCashierOnly) {
        router.push('/dashboard');
      }
    }
  }, [userRole, pathname, router, cashierProfile]);

  if (isLoading || !userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <p>Loading...</p>
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
        <Header userName={userName} userRole={userRole} isSidebarExpanded={isSidebarExpanded} onToggleSidebar={() => setIsSidebarExpanded(prev => !prev)} cashierProfile={cashierProfile} />
        <main className="flex-1 grid items-start gap-4 p-4 sm:px-6 sm:py-4 md:gap-8">
          {children}
        </main>
        <footer className="text-center text-sm text-muted-foreground py-4 border-t bg-background print:hidden mt-auto">
          © Copyrights {currentYear} Sanju Animations. All rights reserved Sanju Animations Team
        </footer>
      </div>
    </div>
  );
}