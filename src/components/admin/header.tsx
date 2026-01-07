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
  ClipboardList,
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
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ['admin'] },
    { href: "/students", icon: Users, label: "Students", roles: ['admin'] },
    { href: "/fees", icon: Receipt, label: "Fee Structure", roles: ['admin'] },
    { href: "/invoices", icon: FileText, label: "Invoices", roles: ['admin'] },
    { href: "/cashiers", icon: UserCircle, label: "Cashiers", roles: ['admin'] },
    { href: "/departments", icon: Building, label: "Departments", roles: ['admin'] },
    { href: "/expenses", icon: TrendingUp, label: "Expenses", roles: ['admin', 'cashier'] },
    { href: "/class-management", icon: Library, label: "Class Management", roles: ['admin'] },
    { href: "/activity-logs", icon: History, label: "Activity Logs", roles: ['admin'] },
    { href: "/fee-collection", icon: Receipt, label: "Fee Collection", roles: ['admin', 'cashier'] },
    { href: "/fee-paid-report", icon: ClipboardList, label: "Fee Paid Report", roles: ['admin', 'cashier'] },
    { href: "/settings", icon: Settings, label: "Settings", roles: ['admin'] },
];

export function Header({ userName, userRole, isSidebarExpanded, onToggleSidebar, cashierProfile }: { userName: string | null, userRole: 'admin' | 'cashier', isSidebarExpanded: boolean, onToggleSidebar: () => void, cashierProfile: any }) {
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
  const pageTitle = pageItem?.label || "Admin";
  const portalTitle = userRole === 'admin' ? 'Admin Portal' : 'Cashier Portal';
  const homeLink = userRole === 'admin' ? '/dashboard' : '/fee-collection';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Logout failed. Please try again.");
    } else {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 print:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href={homeLink}
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <Package2 className="h-5 w-5 transition-all group-hover:scale-110" />
              <span className="sr-only">{portalTitle}</span>
            </Link>
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                  pathname.startsWith(item.href) && "text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <Button size="icon" variant="outline" className="hidden sm:inline-flex" onClick={onToggleSidebar}>
        {isSidebarExpanded ? <PanelLeft className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={homeLink}>Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full"
            >
              <UserCircle className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{userName || 'My Account'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}