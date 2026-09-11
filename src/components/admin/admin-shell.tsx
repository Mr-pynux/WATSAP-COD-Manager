"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Home,
  ShoppingBag,
  Package,
  PhoneCall,
  Wallet,
  MoreHorizontal,
  Ban,
  Truck,
  MessageSquareText,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "الرئيسية", icon: Home, exact: true },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingBag },
  { href: "/admin/followup", label: "المتابعة", icon: PhoneCall, badge: true },
  { href: "/admin/finance", label: "المالية", icon: Wallet },
  { href: "/admin/products", label: "المنتجات", icon: Package, more: true },
  { href: "/admin/blacklist", label: "البلاك ليست", icon: Ban, more: true },
  { href: "/admin/couriers", label: "الناقلين", icon: Truck, more: true },
  { href: "/admin/templates", label: "الرسائل", icon: MessageSquareText, more: true },
];

const TITLES: Record<string, string> = {
  "/admin": "الرئيسية",
  "/admin/orders": "الطلبات",
  "/admin/followup": "المتابعة",
  "/admin/finance": "المالية",
  "/admin/products": "المنتجات",
  "/admin/blacklist": "البلاك ليست",
  "/admin/couriers": "الناقلين",
  "/admin/templates": "الرسائل",
};

function pageTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/admin/products")) {
    return pathname.endsWith("/new") ? "منتج جديد" : "تعديل المنتج";
  }
  return "لوحة التحكم";
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [followupCount, setFollowupCount] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // refresh the followup badge on every admin page navigation
  useEffect(() => {
    let cancelled = false;
    fetch("/api/followup")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { counts?: { queue: number } } | null) => {
        if (!cancelled && data) setFollowupCount(data.counts?.queue ?? 0);
      })
      .catch(() => {
        // silent — badge stays hidden
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const title = pageTitle(pathname);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors — cookie will expire anyway
    }
    toast.success("تسجلت الخروج");
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarProvider>
      {/* ── Desktop sidebar ─────────────────────────── */}
      <Sidebar collapsible="icon" side="right">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="bg-stone-900 rounded-xl p-1.5 flex items-center shrink-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
              <img src="/logo.png" alt="ShoeSpot" className="h-9 w-auto group-data-[collapsible=icon]:h-8" />
            </span>
            <SidebarMenuButton asChild className="flex-1 font-extrabold text-lg justify-start">
              <span>ShoeSpot</span>
            </SidebarMenuButton>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>لوحة التحكم</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(pathname, item.href, item.exact)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                        {item.badge && followupCount != null && followupCount > 0 && (
                          <Badge className="ms-auto bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30">
                            {followupCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip="الخروج">
                <LogOut />
                <span>الخروج</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ── Main area ───────────────────────────────── */}
      <SidebarInset className="min-h-screen pb-24 md:pb-8">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
          <SidebarTrigger className="hidden md:flex" aria-label="قائمة جانبية" />
          <h1 className="font-bold text-lg truncate flex-1">{title}</h1>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                aria-label="تبديل الوضع الليلي"
              >
                <Sun className="h-4 w-4 hidden dark:block" />
                <Moon className="h-4 w-4 dark:hidden" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4" /> فاتح
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4" /> داكن
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive"
            onClick={logout}
            aria-label="الخروج"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </SidebarInset>

      {/* ── Mobile bottom tab bar ───────────────────── */}
      <nav
        aria-label="التنقل الرئيسي"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background border-t shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 h-16">
          <Link
            href="/admin"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors",
              isActive(pathname, "/admin", true) && "text-primary font-bold"
            )}
          >
            <Home className="h-5 w-5" />
            <span className="text-[11px]">الرئيسية</span>
          </Link>
          <Link
            href="/admin/orders"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors",
              isActive(pathname, "/admin/orders") && "text-primary font-bold"
            )}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[11px]">الطلبات</span>
          </Link>
          <Link
            href="/admin/followup"
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors",
              isActive(pathname, "/admin/followup") && "text-primary font-bold"
            )}
          >
            <span className="relative">
              <PhoneCall className="h-5 w-5" />
              {followupCount != null && followupCount > 0 && (
                <span className="absolute -top-2 -end-2.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                  {followupCount > 99 ? "99+" : followupCount}
                </span>
              )}
            </span>
            <span className="text-[11px]">المتابعة</span>
          </Link>
          <Link
            href="/admin/finance"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors",
              isActive(pathname, "/admin/finance") && "text-primary font-bold"
            )}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-[11px]">المالية</span>
          </Link>

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors w-full"
                aria-label="المزيد"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[11px]">المزيد</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3">
              <SheetHeader className="text-start">
                <SheetTitle className="text-start">المزيد</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {NAV.filter((n) => n.more).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl border p-4 hover:bg-accent transition-colors"
                  >
                    <item.icon className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{item.label}</span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-3 rounded-xl border border-destructive/30 text-destructive p-4 hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-semibold">الخروج</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </SidebarProvider>
  );
}
