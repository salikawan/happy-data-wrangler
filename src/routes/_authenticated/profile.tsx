import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmployeeShell } from "@/components/EmployeeShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Briefcase, Wallet, Clock, CalendarDays, ChevronRight, MapPin, Bell, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Paismo" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { role, loading } = useCurrentUser();
  if (loading) return null;
  if (role === "admin") {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">
          Admin profile lives in Settings. <Link to="/settings" className="text-primary underline">Open Settings</Link>.
        </div>
      </AppShell>
    );
  }
  return <EmployeeProfile />;
}

function EmployeeProfile() {
  const { user } = useCurrentUser();

  const { data: profile } = useQuery({
    queryKey: ["profile-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, departments:department_id(name), shifts:shift_id(name, start_time, end_time), locations:location_id(name, address)")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const name = profile?.full_name || user?.email || "Employee";
  const initial = name.charAt(0).toUpperCase();
  type Rel = { name?: string | null } | null;
  const dept = (profile as unknown as { departments?: Rel })?.departments?.name;
  const shift = (profile as unknown as { shifts?: { name?: string; start_time?: string; end_time?: string } | null })?.shifts;
  const loc = (profile as unknown as { locations?: { name?: string; address?: string } | null })?.locations;

  const items = [
    {
      icon: Briefcase, tint: "bg-violet-100 text-violet-600",
      title: "Employment Details",
      subtitle: `${profile?.designation || "Employee"}${dept ? ` • ${dept}` : ""}`,
    },
    {
      icon: Wallet, tint: "bg-emerald-100 text-emerald-600",
      title: "Payroll Preferences",
      subtitle: profile?.basic_salary
        ? `PKR ${Number(profile.basic_salary).toLocaleString()} / ${profile?.salary_type ?? "monthly"}`
        : "Not configured",
    },
    {
      icon: Clock, tint: "bg-sky-100 text-sky-600",
      title: "My Shift Schedule",
      subtitle: shift?.name ? `${shift.name} • ${shift.start_time ?? "—"} – ${shift.end_time ?? "—"}` : "No shift assigned",
    },
    {
      icon: CalendarDays, tint: "bg-rose-100 text-rose-600",
      title: "Leaves",
      subtitle: "View and apply for time off",
      to: "/leave-requests",
    },
    {
      icon: MapPin, tint: "bg-amber-100 text-amber-600",
      title: "Work Location",
      subtitle: loc?.name ? `${loc.name}${loc.address ? ` • ${loc.address}` : ""}` : "Not assigned",
    },
    {
      icon: Bell, tint: "bg-fuchsia-100 text-fuchsia-600",
      title: "Notifications",
      subtitle: "Announcements from your team",
      to: "/notifications",
    },
    {
      icon: Shield, tint: "bg-slate-100 text-slate-600",
      title: "Account",
      subtitle: user?.email ?? "",
    },
  ];

  return (
    <EmployeeShell hero={{ title: "Profile", subtitle: "Your account & settings" }}>
      {/* Identity card */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.6_0.22_295)] to-[oklch(0.72_0.2_310)] text-white text-xl font-bold shadow">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-base truncate">{name}</div>
          <div className="text-xs text-muted-foreground">Employee</div>
          {profile?.designation && (
            <div className="text-xs text-primary font-medium mt-0.5 truncate">{profile.designation}</div>
          )}
        </div>
        {profile?.employee_id && (
          <div className="text-[10px] font-mono rounded-full bg-muted px-2 py-1 text-muted-foreground shrink-0">
            {profile.employee_id}
          </div>
        )}
      </div>

      {items.map((it) => {
        const Icon = it.icon;
        const inner = (
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm border">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${it.tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{it.title}</div>
              {it.subtitle && (
                <div className="text-xs text-muted-foreground truncate">{it.subtitle}</div>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        );
        return it.to ? (
          <Link key={it.title} to={it.to}>{inner}</Link>
        ) : (
          <div key={it.title}>{inner}</div>
        );
      })}
    </EmployeeShell>
  );
}
