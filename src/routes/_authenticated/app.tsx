import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmployeeShell } from "@/components/EmployeeShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SelfieCapture } from "@/components/SelfieCapture";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { distanceMeters, getCurrentPosition, todayISO } from "@/lib/geo";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, LogOut, MapPin, Users,
  CalendarCheck, Wallet, TrendingUp, UserPlus, Building2, BarChart3, Settings as SettingsIcon,
  Send, Target, ChevronRight,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — Paismo" }] }),
  component: AppPage,
});

function AppPage() {
  const { role, loading } = useCurrentUser();
  if (loading) return null;
  if (role === "admin") return <AppShell><AdminDashboard /></AppShell>;
  return <EmployeeDashboard />;
}

// ============ Employee Dashboard ============
function EmployeeDashboard() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [mode, setMode] = useState<"idle" | "checkin" | "checkout">("idle");

  const { data: today } = useQuery({
    queryKey: ["attendance-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .eq("date", todayISO())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!selfie) throw new Error("Please capture a selfie first");

      const pos = await getCurrentPosition();
      const { latitude, longitude } = pos.coords;

      if (
        settings?.enforce_geofence &&
        settings.allowed_lat != null &&
        settings.allowed_lng != null
      ) {
        const dist = distanceMeters(
          latitude,
          longitude,
          settings.allowed_lat,
          settings.allowed_lng,
        );
        if (dist > settings.allowed_radius_meters) {
          throw new Error(
            `You're ${Math.round(dist)}m away from allowed location (max ${settings.allowed_radius_meters}m).`,
          );
        }
      }

      const path = `${user.id}/${todayISO()}-checkin-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("selfies")
        .upload(path, selfie, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const now = new Date();
      let status = "present";
      if (settings?.late_after_time) {
        const [h, m] = settings.late_after_time.split(":").map(Number);
        const cutoff = new Date();
        cutoff.setHours(h, m, 0, 0);
        if (now > cutoff) status = "late";
      }

      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        date: todayISO(),
        check_in_time: now.toISOString(),
        check_in_selfie_url: path,
        check_in_lat: latitude,
        check_in_lng: longitude,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked in!");
      setSelfie(null);
      setMode("idle");
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!user || !today) throw new Error("No check-in record");
      const requireSelfie = !!settings?.require_checkout_selfie;
      if (requireSelfie && !selfie) throw new Error("Selfie required for checkout");

      const pos = await getCurrentPosition().catch(() => null);
      let path: string | null = null;
      if (selfie) {
        path = `${user.id}/${todayISO()}-checkout-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("selfies")
          .upload(path, selfie, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
      }

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_time: new Date().toISOString(),
          check_out_selfie_url: path,
          check_out_lat: pos?.coords.latitude ?? null,
          check_out_lng: pos?.coords.longitude ?? null,
        })
        .eq("id", today.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked out!");
      setSelfie(null);
      setMode("idle");
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasCheckedIn = !!today?.check_in_time;
  const hasCheckedOut = !!today?.check_out_time;

  const { data: upcomingShift } = useQuery({
    queryKey: ["upcoming-shift"],
    queryFn: async () => {
      const { data } = await supabase.from("shifts").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: siteCount = 0 } = useQuery({
    queryKey: ["locations-count"],
    queryFn: async () => {
      const { count } = await supabase.from("locations").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const firstName =
    (user?.user_metadata?.full_name as string)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <EmployeeShell
      hero={{
        title: `Hi, ${firstName} 👋`,
        subtitle: "Have a great day at work",
        showBell: true,
      }}
    >
      {/* 2x2 tile grid */}
      <div className="grid grid-cols-2 gap-3">
        <DashTile to="/leave-requests" icon={CalendarCheck} label="Leave Requests" tint="bg-rose-100 text-rose-500" />
        <DashTile to="/profile" icon={Wallet} label="Payslips" tint="bg-emerald-100 text-emerald-600" />
        <DashTile to="/leave-requests" icon={Send} label="Payment Request" tint="bg-sky-100 text-sky-600" />
        <DashTile to="/profile" icon={Target} label="Goals" tint="bg-amber-100 text-amber-600" />
      </div>

      {/* Upcoming shift / clock in card */}
      <div className="rounded-2xl bg-card p-5 shadow-sm border">
        {mode === "idle" ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Upcoming Shift</h2>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <MapPin className="h-3 w-3" /> {siteCount} {siteCount === 1 ? "site" : "sites"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{upcomingShift?.name ?? "Standard 9-5"}</div>
                <div className="text-xs text-muted-foreground">
                  {upcomingShift ? `${upcomingShift.start_time?.slice(0,5)} – ${upcomingShift.end_time?.slice(0,5)}` : "09:00 – 17:00"}
                </div>
              </div>
            </div>

            {today?.status && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Today:</span>
                <StatusBadge status={today.status} />
                {today?.check_in_time && (
                  <span className="text-muted-foreground">
                    · in {new Date(today.check_in_time).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}
                  </span>
                )}
                {today?.check_out_time && (
                  <span className="text-muted-foreground">
                    · out {new Date(today.check_out_time).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4">
              {hasCheckedOut ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Great work today!
                </div>
              ) : !hasCheckedIn ? (
                <Button
                  size="lg"
                  onClick={() => setMode("checkin")}
                  className="w-full h-12 rounded-full text-white shadow-md"
                  style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 295), oklch(0.7 0.2 310))" }}
                >
                  <Clock className="h-4 w-4" /> Clock in <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => setMode("checkout")}
                  className="w-full h-12 rounded-full text-white shadow-md"
                  style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 295), oklch(0.7 0.2 310))" }}
                >
                  <LogOut className="h-4 w-4" /> Clock out <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-base">
              {mode === "checkin" ? "Take a check-in selfie" : "Take a check-out selfie"}
            </h2>
            <div className="mt-4 space-y-3">
              <SelfieCapture onCapture={setSelfie} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setSelfie(null); setMode("idle"); }}>Cancel</Button>
                <Button className="flex-1 rounded-xl" disabled={!selfie || checkIn.isPending || checkOut.isPending}
                  onClick={() => (mode === "checkin" ? checkIn.mutate() : checkOut.mutate())}>
                  {mode === "checkin" ? "Confirm check-in" : "Confirm check-out"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Your location will be captured
              </p>
            </div>
          </>
        )}
      </div>
    </EmployeeShell>
  );
}

function DashTile({ to, icon: Icon, label, tint }: {
  to: string; icon: typeof Clock; label: string; tint: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-card p-4 shadow-sm border hover:border-primary transition-colors flex flex-col gap-3 min-h-[110px]"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-semibold text-sm leading-tight">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Tap to open</div>
      </div>
    </Link>
  );
}




function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    late: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    absent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <Badge className={`${map[status] ?? ""} border-0`} variant="secondary">
      {status}
    </Badge>
  );
}

// ============ Admin Dashboard ============

function AdminDashboard() {
  const today = todayISO();

  const { data: employees = 0 } = useQuery({
    queryKey: ["employees-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: shiftsCount = 0 } = useQuery({
    queryKey: ["shifts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("shifts").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: pendingLeaves = 0 } = useQuery({
    queryKey: ["pending-leaves-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("leave_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: payroll = 0 } = useQuery({
    queryKey: ["monthly-payroll"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("basic_salary");
      return (data ?? []).reduce((s, r) => s + Number(r.basic_salary || 0), 0);
    },
  });

  const { data: attendanceRate = 0 } = useQuery({
    queryKey: ["attendance-rate", today],
    queryFn: async () => {
      const { count: total } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: present } = await supabase
        .from("attendance").select("*", { count: "exact", head: true }).eq("date", today);
      if (!total || total === 0) return 0;
      return Math.round(((present ?? 0) / total) * 100);
    },
  });

  const fmtK = (n: number) => n >= 1000 ? `${(n/1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening across your organization today.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction to="/employees" icon={UserPlus} label="Add Employee" tone="violet" />
        <QuickAction to="/departments" icon={Building2} label="Add Department" tone="sky" />
        <QuickAction to="/reports" icon={BarChart3} label="View Reports" tone="emerald" />
        <QuickAction to="/settings" icon={SettingsIcon} label="Configure Settings" tone="amber" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard icon={Users} tone="violet" value={String(employees)} label="Total Employees" trend="+12%" />
        <MetricCard icon={Clock} tone="sky" value={String(shiftsCount)} label="Active Shifts" trend={`+${shiftsCount}`} />
        <MetricCard icon={CalendarCheck} tone="rose" value={String(pendingLeaves)} label="Pending Leaves" trend="review" />
        <MetricCard icon={Wallet} tone="emerald" value={`PKR ${fmtK(payroll)}`} label="Monthly Payroll" trend="+8%" />
        <MetricCard icon={TrendingUp} tone="amber" value={`${attendanceRate}%`} label="Attendance Rate" trend="on target" />
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  violet: "bg-violet-100 text-violet-600",
  sky: "bg-sky-100 text-sky-600",
  rose: "bg-rose-100 text-rose-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
};

function MetricCard({
  icon: Icon, tone, value, label, trend,
}: {
  icon: typeof Clock; tone: keyof typeof TONES; value: string; label: string; trend: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" /> {trend}
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, tone }: {
  to: string; icon: typeof Clock; label: string; tone: keyof typeof TONES;
}) {
  return (
    <Link to={to} className="group rounded-2xl border bg-card p-4 shadow-sm hover:border-primary transition-colors">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold group-hover:text-primary">{label}</div>
    </Link>
  );
}


