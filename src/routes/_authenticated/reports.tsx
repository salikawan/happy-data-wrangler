import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Pasimo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => (
    <AppShell>
      <ReportsPage />
    </AppShell>
  ),
});

function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(fmt(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(fmt(today));

  const { data: rows, refetch, isFetching } = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, profiles:profiles!attendance_user_id_fkey(full_name, email, department)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function exportCSV() {
    if (!rows) return;
    const header = [
      "Date",
      "Name",
      "Email",
      "Department",
      "Check-in",
      "Check-out",
      "Status",
      "Location (in)",
    ];
    const lines = rows.map((r) => {
      const p = (r as { profiles?: { full_name?: string; email?: string; department?: string } }).profiles;
      return [
        r.date,
        p?.full_name ?? "",
        p?.email ?? "",
        p?.department ?? "",
        r.check_in_time ?? "",
        r.check_out_time ?? "",
        r.status,
        r.check_in_lat && r.check_in_lng ? `${r.check_in_lat},${r.check_in_lng}` : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pasimo-attendance-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Filter by date range and export to CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Apply
            </Button>
            <Button onClick={exportCSV} disabled={!rows?.length}>
              <Download /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Records ({rows?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows && rows.length > 0 ? (
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
                    const p = (r as { profiles?: { full_name?: string; email?: string; department?: string } }).profiles;
                    return (
                      <tr key={r.id}>
                        <td className="py-2 pr-4">{r.date}</td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{p?.full_name || p?.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {p?.department || "—"}
                          </div>
                        </td>
                        <td className="py-2 pr-4">{fmtTime(r.check_in_time)}</td>
                        <td className="py-2 pr-4">{fmtTime(r.check_out_time)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary">{r.status}</Badge>
                        </td>
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
  return t
    ? new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "—";
}
