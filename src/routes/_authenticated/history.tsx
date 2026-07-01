import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "My Attendance — Pasimo" }] }),
  component: () => (
    <AppShell>
      <History />
    </AppShell>
  ),
});

function History() {
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const { data: records } = useQuery({
    queryKey: ["attendance-history", user?.id, from.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", fmt(from))
        .lte("date", fmt(to))
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, (typeof records)[number]>();
    records?.forEach((r) => map.set(r.date, r));
    return map;
  }, [records]);

  const days = useMemo(() => buildCalendar(month), [month]);

  const stats = useMemo(() => {
    const present = records?.filter((r) => r.status === "present").length ?? 0;
    const late = records?.filter((r) => r.status === "late").length ?? 0;
    return { present, late, total: records?.length ?? 0 };
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Attendance</h1>
          <p className="text-sm text-muted-foreground">Your monthly attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-[140px] text-center font-medium">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatBox label="Days present" value={stats.present} />
        <StatBox label="Days late" value={stats.late} />
        <StatBox label="Total logged" value={stats.total} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d)
                return <div key={i} className="aspect-square rounded bg-transparent" />;
              const rec = byDate.get(fmt(d));
              const tone = rec
                ? rec.status === "late"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : d < new Date() && !isSameDay(d, new Date())
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-muted/50 text-muted-foreground";
              return (
                <div
                  key={i}
                  className={`aspect-square rounded flex items-center justify-center text-xs ${tone}`}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
            <LegendDot color="bg-emerald-500" label="Present" />
            <LegendDot color="bg-amber-500" label="Late" />
            <LegendDot color="bg-red-400" label="Absent" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
        </CardHeader>
        <CardContent>
          {records && records.length > 0 ? (
            <div className="divide-y">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">
                      {new Date(r.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.check_in_time
                        ? new Date(r.check_in_time).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                      {" → "}
                      {r.check_out_time
                        ? new Date(r.check_out_time).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "…"}
                    </div>
                  </div>
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No records this month.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendar(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startDay = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++)
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
