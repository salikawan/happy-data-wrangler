import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Users, BarChart3, Settings, LogOut, LayoutDashboard,
  Clock, CalendarCheck, Wallet, ClipboardCheck, MapPin,
  Menu, Bell, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const employeeNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "My Attendance", icon: ClipboardCheck },
  { to: "/leave-requests", label: "Leave Requests", icon: CalendarCheck },
];

const adminNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/shifts", label: "Shift Management", icon: Clock },
  { to: "/leave-requests", label: "Leave Requests", icon: CalendarCheck },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/history", label: "Attendance", icon: ClipboardCheck },
  { to: "/locations", label: "Locations", icon: MapPin },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav = role === "admin" ? adminNav : employeeNav;
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
            P
          </div>
          <div className="text-lg font-semibold">Paismo</div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-3">
        {nav.map((n) => {
          const active = pathname === n.to;
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/70 hover:bg-accent/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent/60"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r shadow-xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9 rounded-full bg-muted border-0" />
          </div>
          <button className="rounded-full p-2 text-muted-foreground hover:bg-accent">
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {initial}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
