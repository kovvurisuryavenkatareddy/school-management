"use client";

import Link from "next/link";
import {
  PanelLeft,
  Package2,
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  UserCircle,
  Building,
  TrendingUp,
  Library,
  Settings,
  History,
  PanelRight,
  Coins,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

const allNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ['superadmin', 'admin'] },
    { href: "/students", icon: Users, label: "Students", roles: ['superadmin', 'admin'] },
    { href: "/fees", icon: Receipt, label: "Fee Structure", roles: ['superadmin', 'admin'] },
    { href: "/invoices", icon: FileText, label: "Invoices", roles: ['superadmin', 'admin'] },
    { href: "/cashiers", icon: UserCircle, label: "Cashiers", roles: ['superadmin', 'admin'] },
    { href: "/departments", icon: Building, label: "Departments", roles: ['superadmin', 'admin'] },
    { href: "/expenses", icon: TrendingUp, label: "Expenses", roles: ['superadmin', 'admin', 'cashier'] },
    { href: "/class-management", icon: Library, label: "Class Management", roles: ['superadmin', 'admin'] },
    { href: "/financials", icon: Coins, label: "Financials", roles: ['superadmin', 'admin', 'cashier'] },
    { href: "/activity-logs", icon: History, label: "Activity Logs", roles: ['superadmin', 'admin'] },
    { href: "/settings", icon: Settings, label: "Settings", roles: ['superadmin', 'admin'] },
];

export function Header({ userName, userRole, isSidebarExpanded, onToggleSidebar, cashierProfile }: { userName: string | null, userRole: 'superadmin' | 'admin' | 'cashier', isSidebarExpanded: boolean, onToggleSidebar: () => void, cashierProfile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const navItems = allNavItems.filter(item => {
    if (!item.roles.includes(userRole)) return false;
    if (userRole === 'cashier' && item.href === '/expenses') {
      return cashierProfile?.has_expenses_permission;
    }
    return true;
  });

  const pageItem = allNavItems.find(item => pathname.startsWith(item.href));
  const pageTitle = pageItem?.label || "Portal";
  const portalTitle = userRole === 'cashier' ? 'Cashier Portal' : 'Admin Portal';
  const homeLink = userRole === 'cashier' ? '/financials' : '/dashboard';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Logout failed. Please try again.");
    } else {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 sm:h-16 sm:px-6 print:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] sm:w-[350px]">
          <nav className="grid gap-4 text-base font-medium pt-8">
            <Link
              href={homeLink}
              className="flex items-center gap-2 text-primary font-bold text-xl mb-4"
            >
              <Package2 className="h-6 w-6" />
              <span className="font-ubuntu tracking-tight">{portalTitle}</span>
            </Link>
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 rounded-md px-3 py-2 transition-colors hover:bg-muted",
                  pathname.startsWith(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      
      <Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={onToggleSidebar}>
        {isSidebarExpanded ? <PanelLeft className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      <div className="flex-1">
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={homeLink} className="text-muted-foreground hover:text-primary transition-colors">Portal</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground">{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full border bg-muted/50 p-0 hover:bg-muted transition-colors"
            >
              <UserCircle className="h-6 w-6 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">{userName || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground uppercase tracking-wider">{userRole}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}