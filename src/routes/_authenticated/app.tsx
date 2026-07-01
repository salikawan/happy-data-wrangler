import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SelfieCapture } from "@/components/SelfieCapture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { distanceMeters, getCurrentPosition, todayISO } from "@/lib/geo";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Users,
  AlertCircle,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — Pasimo" }] }),
  component: AppPage,
});

function AppPage() {
  const { role, loading } = useCurrentUser();
  if (loading) return null;
  return <AppShell>{role === "admin" ? <AdminDashboard /> : <EmployeeDashboard />}</AppShell>;
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatusCard
          icon={LogIn}
          label="Check-in"
          time={today?.check_in_time}
          done={hasCheckedIn}
        />
        <StatusCard
          icon={LogOut}
          label="Check-out"
          time={today?.check_out_time}
          done={hasCheckedOut}
        />
      </div>

      {today?.status && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <StatusBadge status={today.status} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "idle" && !hasCheckedIn && "Ready to check in?"}
            {mode === "idle" && hasCheckedIn && !hasCheckedOut && "Ready to check out?"}
            {mode === "idle" && hasCheckedOut && "You're done for today"}
            {mode === "checkin" && "Take a check-in selfie"}
            {mode === "checkout" && "Take a check-out selfie"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "idle" ? (
            hasCheckedOut ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Great work today!
              </div>
            ) : !hasCheckedIn ? (
              <Button className="w-full" size="lg" onClick={() => setMode("checkin")}>
                <LogIn /> Check in
              </Button>
            ) : (
              <Button className="w-full" size="lg" onClick={() => setMode("checkout")}>
                <LogOut /> Check out
              </Button>
            )
          ) : (
            <>
              <SelfieCapture onCapture={setSelfie} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelfie(null);
                    setMode("idle");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selfie || checkIn.isPending || checkOut.isPending}
                  onClick={() => (mode === "checkin" ? checkIn.mutate() : checkOut.mutate())}
                >
                  {mode === "checkin" ? "Confirm check-in" : "Confirm check-out"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Your location will be captured
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  time,
  done,
}: {
  icon: typeof Clock;
  label: string;
  time?: string | null;
  done: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${done ? "" : "opacity-60"}`}>
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-semibold">
        {time
          ? new Date(time).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </div>
    </div>
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
import { CalendarCheck, Wallet, TrendingUp } from "lucide-react";

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

