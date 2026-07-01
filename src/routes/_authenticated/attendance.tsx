import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { MapPin, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Pasimo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles")
      .select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!r || r.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><AttendancePage /></AppShell>,
});

function rangeFor(kind: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (kind === "today") return { from: iso(now), to: iso(now) };
  if (kind === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { from: iso(d), to: iso(now) };
  }
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(d), to: iso(now) };
}

function AttendancePage() {
  const [tab, setTab] = useState<"today" | "week" | "month">("today");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const range = rangeFor(tab);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-attendance", tab],
    queryFn: async () => {
      const [{ data: att }, { data: profiles }, { data: depts }] = await Promise.all([
        supabase.from("attendance").select("*").gte("date", range.from).lte("date", range.to).order("date", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email, department_id, employee_id"),
        supabase.from("departments").select("id, name"),
      ]);
      const pMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      const dMap = new Map(depts?.map((d) => [d.id, d.name]) ?? []);
      return (att ?? []).map((a) => {
        const p = pMap.get(a.user_id);
        return {
          ...a,
          full_name: p?.full_name ?? "—",
          email: p?.email ?? "",
          employee_id: p?.employee_id ?? "",
          department: p?.department_id ? dMap.get(p.department_id) : "—",
        };
      });
    },
  });

  const filtered = rows.filter((r) =>
    !search || r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()));

  const markAbsent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance").update({ status: "absent" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked absent"); qc.invalidateQueries({ queryKey: ["admin-attendance"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const headers = ["Date", "Employee", "Employee ID", "Department", "Check-in", "Check-out", "Status", "GPS"];
    const rows2 = filtered.map((r) => [
      r.date, r.full_name, r.employee_id, r.department,
      r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : "",
      r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : "",
      r.status,
      r.check_in_lat && r.check_in_lng ? `${r.check_in_lat},${r.check_in_lng}` : "",
    ]);
    const csv = [headers, ...rows2].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} records</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="month">This month</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Input placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="mb-4 max-w-sm rounded-full bg-muted border-0" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-3 text-left">Date</th>
                    <th className="px-2 py-3 text-left">Employee</th>
                    <th className="px-2 py-3 text-left">Dept</th>
                    <th className="px-2 py-3 text-left">In</th>
                    <th className="px-2 py-3 text-left">Out</th>
                    <th className="px-2 py-3 text-left">Status</th>
                    <th className="px-2 py-3 text-left">GPS</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-3 whitespace-nowrap">{r.date}</td>
                      <td className="px-2 py-3">
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.employee_id}</div>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{r.department}</td>
                      <td className="px-2 py-3">{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-2 py-3">{r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-2 py-3"><Badge variant="secondary" className="border-0">{r.status}</Badge></td>
                      <td className="px-2 py-3">
                        {r.check_in_lat && r.check_in_lng ? (
                          <a target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1"
                            href={`https://maps.google.com/?q=${r.check_in_lat},${r.check_in_lng}`}>
                            <MapPin className="h-3 w-3" /> map
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => markAbsent.mutate(r.id)}>Absent</Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No attendance in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
