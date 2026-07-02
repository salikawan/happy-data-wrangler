import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmployeeShell } from "@/components/EmployeeShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, X, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leave-requests")({
  head: () => ({ meta: [{ title: "Leave Requests — Paismo" }] }),
  component: LeaveRoute,
});

function LeaveRoute() {
  const { role, loading } = useCurrentUser();
  if (loading) return null;
  if (role === "admin") return <AppShell><LeavePage /></AppShell>;
  return <EmployeeLeaves />;
}

function EmployeeLeaves() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "Casual", from_date: "", to_date: "", reason: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["my-leaves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests")
        .select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const s = { approved: 0, pending: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === "approved") s.approved++;
      else if (r.status === "pending") s.pending++;
      else if (r.status === "rejected") s.rejected++;
    }
    return s;
  }, [rows]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!form.from_date || !form.to_date) throw new Error("Dates required");
      const { error } = await supabase.from("leave_requests").insert({ ...form, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      setOpen(false);
      setForm({ leave_type: "Casual", from_date: "", to_date: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <EmployeeShell hero={{ title: "My Leaves", subtitle: "Apply and track your time off" }}>
      <div className="grid grid-cols-3 gap-3">
        <LeaveStat value={stats.approved} label="Approved" tint="bg-emerald-100 text-emerald-700" />
        <LeaveStat value={stats.pending} label="Pending" tint="bg-amber-100 text-amber-700" />
        <LeaveStat value={stats.rejected} label="Rejected" tint="bg-rose-100 text-rose-700" />
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="rounded-2xl bg-card border p-8 text-center text-sm text-muted-foreground">
            No leave requests yet. Tap + to apply.
          </div>
        )}
        {rows.map((r) => {
          const tone = r.status === "approved" ? "bg-emerald-100 text-emerald-700"
            : r.status === "rejected" ? "bg-rose-100 text-rose-700"
            : "bg-amber-100 text-amber-700";
          return (
            <div key={r.id} className="rounded-2xl bg-card border shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{r.leave_type} Leave</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(r.from_date).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
                    {" – "}
                    {new Date(r.to_date).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
                  </div>
                  {r.reason && <div className="text-sm mt-2">{r.reason}</div>}
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Applied {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${tone}`}>{r.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating action button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl transition-transform active:scale-95"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 295), oklch(0.7 0.2 310))" }}
            aria-label="New leave request"
          >
            <Plus className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Sick">Sick</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
              <div><Label>To</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <Button type="submit" className="w-full" disabled={create.isPending}>Submit</Button>
          </form>
        </DialogContent>
      </Dialog>
    </EmployeeShell>
  );
}

function LeaveStat({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <div className="rounded-2xl bg-card border shadow-sm p-4 text-center">
      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${tint}`}>{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function dayCount(from: string, to: string) {
  if (!from || !to) return 0;
  const a = new Date(from), b = new Date(to);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function dayCount(from: string, to: string) {
  if (!from || !to) return 0;
  const a = new Date(from), b = new Date(to);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function LeavePage() {
  const { user, role } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "Casual", from_date: "", to_date: "", reason: "" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "history">("active");

  const { data: rows = [] } = useQuery({
    queryKey: ["leave-requests", role, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, profiles:profiles!leave_requests_user_id_fkey(full_name, email, employee_id, department)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const p = (r as { profiles?: { full_name?: string; email?: string; employee_id?: string } }).profiles;
      if (tab === "active" && !["pending"].includes(r.status)) return false;
      if (tab === "history" && r.status === "pending") return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.leave_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p?.full_name ?? ""} ${p?.email ?? ""} ${p?.employee_id ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, typeFilter, search, tab]);

  const stats = useMemo(() => {
    const s = { pending: 0, approved: 0, rejected: 0, total: rows.length };
    for (const r of rows) {
      if (r.status === "pending") s.pending++;
      else if (r.status === "approved") s.approved++;
      else if (r.status === "rejected") s.rejected++;
    }
    return s;
  }, [rows]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!form.from_date || !form.to_date) throw new Error("Dates required");
      const { error } = await supabase.from("leave_requests").insert({ ...form, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      setOpen(false);
      setForm({ leave_type: "Casual", from_date: "", to_date: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-leaves-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Leave ${v.status}`);
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-leaves-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">
            {role === "admin" ? "Review and approve employee leave requests." : "Submit and track your leave requests."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full"><Plus /> Request Leave</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Casual">Casual</SelectItem>
                    <SelectItem value="Sick">Sick</SelectItem>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>From</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                <div><Label>To</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
              </div>
              {form.from_date && form.to_date && (
                <div className="text-xs text-muted-foreground">Duration: {dayCount(form.from_date, form.to_date)} day(s)</div>
              )}
              <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={create.isPending}>Submit</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { l: "Total", v: stats.total, c: "bg-violet-100 text-violet-700" },
          { l: "Pending", v: stats.pending, c: "bg-amber-100 text-amber-700" },
          { l: "Approved", v: stats.approved, c: "bg-emerald-100 text-emerald-700" },
          { l: "Rejected", v: stats.rejected, c: "bg-rose-100 text-rose-700" },
        ].map((s) => (
          <div key={s.l} className={`rounded-2xl border p-4 ${s.c}`}>
            <div className="text-2xl font-bold">{s.v}</div>
            <div className="text-xs uppercase tracking-wide">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-full border bg-card p-1">
          {(["active", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-full capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Casual">Casual</SelectItem>
            <SelectItem value="Sick">Sick</SelectItem>
            <SelectItem value="Annual">Annual</SelectItem>
            <SelectItem value="Unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map((r) => {
          const p = (r as { profiles?: { full_name?: string; email?: string; employee_id?: string; department?: string } }).profiles;
          const tone = r.status === "approved" ? "bg-emerald-100 text-emerald-700" : r.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700";
          return (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {p?.full_name || p?.email} <span className="text-xs text-muted-foreground">{p?.employee_id}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.leave_type} • {r.from_date} → {r.to_date} • {dayCount(r.from_date, r.to_date)} day(s){p?.department ? ` • ${p.department}` : ""}
                </div>
                {r.reason && <div className="text-sm mt-1">{r.reason}</div>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs capitalize ${tone}`}>{r.status}</span>
              {role === "admin" && r.status === "pending" && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}><X className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No leave requests match.</div>
        )}
      </div>
    </div>
  );
}
