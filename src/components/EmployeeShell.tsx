import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Clock, CalendarDays, User, LogOut, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

type HeroProps = {
  title: string;
  subtitle?: string;
  showBell?: boolean;
  right?: ReactNode;
};

const tabs = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/history", label: "Timesheets", icon: Clock },
  { to: "/leave-requests", label: "Leaves", icon: CalendarDays },
  { to: "/profile", label: "Menu", icon: User },
] as const;

export function EmployeeShell({
  hero,
  children,
}: {
  hero: HeroProps;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.005_300)] pb-32">
      {/* Purple gradient hero */}
      <div
        className="relative px-5 pt-8 pb-20 text-white"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.55 0.22 295) 0%, oklch(0.62 0.24 300) 60%, oklch(0.7 0.2 310) 100%)",
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{hero.title}</h1>
            {hero.subtitle && (
              <p className="mt-1 truncate text-xs text-white/80 sm:text-sm">{hero.subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {hero.right}
            {hero.showBell && (
              <button
                onClick={() => navigate({ to: "/notifications" })}
                className="rounded-full bg-white/15 p-2 backdrop-blur hover:bg-white/25"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={signOut}
              className="rounded-full bg-white/15 p-2 backdrop-blur hover:bg-white/25"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary text-sm font-semibold shadow">
              {initial}
            </div>
          </div>
        </div>
      </div>

      {/* Content lifts over hero */}
      <div className="-mt-12 px-4">
        <div className="mx-auto max-w-2xl space-y-4">{children}</div>
      </div>

      {/* Bottom tab nav */}
      <nav
        className="fixed left-1/2 z-40 -translate-x-1/2 w-[min(96%,28rem)]"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <div className="flex items-center justify-around rounded-2xl border bg-card/95 p-2 shadow-xl backdrop-blur">
          {tabs.map((t) => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

