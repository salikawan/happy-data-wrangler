import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmployeeShell } from "@/components/EmployeeShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Timesheets — Paismo" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { role, loading } = useCurrentUser();
  if (loading) return null;
  if (role === "admin") return <AppShell><HistoryContent admin /></AppShell>;
  return <HistoryContent />;
}

function HistoryContent({ admin = false }: { admin?: boolean }) {
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const { data: records = [] } = useQuery({
    queryKey: ["attendance-history", user?.id, from.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance").select("*")
        .eq("user_id", user!.id)
        .gte("date", fmt(from)).lte("date", fmt(to))
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    let worked = 0, overtime = 0;
    for (const r of records) {
      if (r.check_in_time && r.check_out_time) {
        const h = (new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 3.6e6;
        worked += h;
        if (h > 8) overtime += h - 8;
      }
    }
    const present = records.filter((r) => r.status === "present" || r.status === "late").length;
    const attendance = records.length ? Math.round((present / records.length) * 100) : 100;
    return { worked: `${Math.round(worked)}h`, overtime: `${Math.round(overtime)}h`, attendance: `${attendance}%` };
  }, [records]);

  const body = (
    <>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat value={stats.worked} label="Worked" />
        <MiniStat value={stats.overtime} label="Overtime" />
        <MiniStat value={stats.attendance} label="Attendance" />
      </div>

      <div className="flex items-center justify-between px-1">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded-full p-2 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-sm font-medium">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded-full p-2 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="space-y-3">
        {records.length === 0 && (
          <div className="rounded-2xl bg-card border p-8 text-center text-sm text-muted-foreground">
            No records this month.
          </div>
        )}
        {records.map((r) => {
          const tone = r.status === "late" ? "bg-amber-100 text-amber-700"
            : r.status === "absent" ? "bg-rose-100 text-rose-700"
            : "bg-emerald-100 text-emerald-700";
          const status = r.status === "late" ? "Late" : r.status === "absent" ? "Absent" : "Present";
          return (
            <div key={r.id} className="rounded-2xl bg-card border shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">Standard 9-5</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{status}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">Check In</div>
                  <div className="font-semibold">{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Check Out</div>
                  <div className="font-semibold">{r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (admin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Attendance</h1>
            <p className="text-sm text-muted-foreground">Your monthly attendance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
            <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <EmployeeShell hero={{ title: "Timesheets", subtitle: "Your shifts and worked hours" }}>
      {body}
    </EmployeeShell>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-card border shadow-sm p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
