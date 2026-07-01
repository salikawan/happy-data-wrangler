import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Paismo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><ReportsPage /></AppShell>,
});

type Preset = "today" | "week" | "month" | "last_month" | "quarter" | "year" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  const mk = (d: Date) => fmt(d);
  switch (p) {
    case "today": return { from: mk(t), to: mk(t) };
    case "week": {
      const d = new Date(t); d.setDate(t.getDate() - 6); return { from: mk(d), to: mk(t) };
    }
    case "month": return { from: mk(new Date(y, m, 1)), to: mk(t) };
    case "last_month": return { from: mk(new Date(y, m - 1, 1)), to: mk(new Date(y, m, 0)) };
    case "quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { from: mk(new Date(y, qs, 1)), to: mk(t) };
    }
    case "year": return { from: mk(new Date(y, 0, 1)), to: mk(t) };
    default: return { from: mk(new Date(y, m, 1)), to: mk(t) };
  }
}

function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const init = presetRange("month");
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [department, setDepartment] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: ["report", from, to, department, status],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("*, profiles:profiles!attendance_user_id_fkey(full_name, email, department, employee_id, department_id)")
        .gte("date", from).lte("date", to).order("date", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      const list = data ?? [];
      if (department === "all") return list;
      return list.filter((r) => {
        const p = (r as { profiles?: { department_id?: string } }).profiles;
        return p?.department_id === department;
      });
    },
  });

  const summary = useMemo(() => {
    const s = { total: rows.length, present: 0, late: 0, absent: 0, half: 0 };
    for (const r of rows) {
      if (r.status === "present") s.present++;
      else if (r.status === "late") s.late++;
      else if (r.status === "absent") s.absent++;
      else if (r.status === "half_day") s.half++;
    }
    return s;
  }, [rows]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from); setTo(r.to);
    }
  }

  function buildRows() {
    return rows.map((r) => {
      const p = (r as { profiles?: { full_name?: string; email?: string; department?: string; employee_id?: string } }).profiles;
      return {
        Date: r.date,
        "Employee ID": p?.employee_id ?? "",
        Name: p?.full_name ?? "",
        Email: p?.email ?? "",
        Department: p?.department ?? "",
        "Check-in": fmtTime(r.check_in_time),
        "Check-out": fmtTime(r.check_out_time),
        Status: r.status,
        "Check-in GPS": r.check_in_lat && r.check_in_lng ? `${r.check_in_lat},${r.check_in_lng}` : "",
      };
    });
  }

  function exportCSV() {
    const data = buildRows();
    if (!data.length) return;
    const header = Object.keys(data[0]);
    const csv = [header.join(","), ...data.map((r) =>
      header.map((h) => `"${String((r as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`).join(",")
    )].join("\n");
    download(new Blob([csv], { type: "text/csv" }), `paismo-attendance-${from}_to_${to}.csv`);
  }

  function exportXLSX() {
    const data = buildRows();
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const summarySheet = XLSX.utils.json_to_sheet([
      { Metric: "Total Records", Value: summary.total },
      { Metric: "Present", Value: summary.present },
      { Metric: "Late", Value: summary.late },
      { Metric: "Half Day", Value: summary.half },
      { Metric: "Absent", Value: summary.absent },
      { Metric: "Range", Value: `${from} to ${to}` },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
    XLSX.writeFile(wb, `paismo-attendance-${from}_to_${to}.xlsx`);
  }

  function exportPDF() {
    const data = buildRows();
    const win = window.open("", "_blank");
    if (!win) return;
    const rowsHtml = data.map((r) => `<tr>${Object.values(r).map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("");
    const head = data[0] ? Object.keys(data[0]) : [];
    win.document.write(`<!doctype html><html><head><title>Paismo Attendance Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{margin:0 0 4px} .meta{color:#666;margin-bottom:16px}
      .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
      .card{border:1px solid #ddd;border-radius:8px;padding:8px;text-align:center}
      .card .n{font-size:20px;font-weight:700} .card .l{font-size:11px;color:#666;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#f5f3ff;color:#5b21b6}
      @media print{.noprint{display:none}}</style></head><body>
      <h1>Paismo Attendance Report</h1>
      <div class="meta">${from} to ${to} • Generated ${new Date().toLocaleString()}</div>
      <div class="cards">
        <div class="card"><div class="n">${summary.total}</div><div class="l">Total</div></div>
        <div class="card"><div class="n">${summary.present}</div><div class="l">Present</div></div>
        <div class="card"><div class="n">${summary.late}</div><div class="l">Late</div></div>
        <div class="card"><div class="n">${summary.half}</div><div class="l">Half Day</div></div>
        <div class="card"><div class="n">${summary.absent}</div><div class="l">Absent</div></div>
      </div>
      <button class="noprint" onclick="window.print()">Print / Save as PDF</button>
      <table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>setTimeout(()=>window.print(),400)</script>
      </body></html>`);
    win.document.close();
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Attendance analytics with CSV, Excel, and PDF export.</p>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {[
          { l: "Total", v: summary.total, c: "bg-violet-100 text-violet-700" },
          { l: "Present", v: summary.present, c: "bg-emerald-100 text-emerald-700" },
          { l: "Late", v: summary.late, c: "bg-amber-100 text-amber-700" },
          { l: "Half Day", v: summary.half, c: "bg-sky-100 text-sky-700" },
          { l: "Absent", v: summary.absent, c: "bg-rose-100 text-rose-700" },
        ].map((s) => (
          <div key={s.l} className={`rounded-2xl border p-4 ${s.c}`}>
            <div className="text-2xl font-bold">{s.v}</div>
            <div className="text-xs uppercase tracking-wide">{s.l}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <div className="sm:col-span-2">
              <Label>Preset</Label>
              <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                  <SelectItem value="quarter">This quarter</SelectItem>
                  <SelectItem value="year">This year</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} /></div>
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
            <Button variant="outline" onClick={exportCSV} disabled={!rows.length}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" onClick={exportXLSX} disabled={!rows.length}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button onClick={exportPDF} disabled={!rows.length}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Records ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">In</th>
                    <th className="py-2 pr-4">Out</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const p = (r as { profiles?: { full_name?: string; email?: string; department?: string; employee_id?: string } }).profiles;
                    return (
                      <tr key={r.id}>
                        <td className="py-2 pr-4">{r.date}</td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{p?.full_name || p?.email}</div>
                          <div className="text-xs text-muted-foreground">{p?.employee_id} · {p?.department || "—"}</div>
                        </td>
                        <td className="py-2 pr-4">{fmtTime(r.check_in_time)}</td>
                        <td className="py-2 pr-4">{fmtTime(r.check_out_time)}</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">{r.status}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No records in this range.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(t: string | null | undefined) {
  return t ? new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";
}
