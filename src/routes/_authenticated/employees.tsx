import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Shield, KeyRound, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createEmployee, deleteEmployee, resetEmployeePassword } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Pasimo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><EmployeesPage /></AppShell>,
});

const emptyForm = {
  full_name: "", email: "", password: "", employee_id: "", phone: "",
  designation: "", department_id: "", shift_id: "", location_id: "",
  basic_salary: "", salary_type: "monthly", joining_date: "", status: "active",
  is_admin: false,
};

function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const createFn = useServerFn(createEmployee);
  const deleteFn = useServerFn(deleteEmployee);
  const resetFn = useServerFn(resetEmployeePassword);

  const { data: rows = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: depts }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("departments").select("id, name"),
      ]);
      const roleMap = new Map<string, string[]>();
      roles?.forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role); roleMap.set(r.user_id, arr);
      });
      const dMap = new Map(depts?.map((d) => [d.id, d.name]) ?? []);
      return profiles?.map((p) => ({
        ...p, roles: roleMap.get(p.id) ?? [],
        department_name: p.department_id ? dMap.get(p.department_id) : null,
      })) ?? [];
    },
  });

  const { data: depts = [] } = useQuery({
    queryKey: ["depts-basic"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-basic"],
    queryFn: async () => (await supabase.from("shifts").select("id, name").order("name")).data ?? [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations-basic"],
    queryFn: async () => (await supabase.from("locations").select("id, name").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !(r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.email?.toLowerCase().includes(search.toLowerCase()) ||
        r.employee_id?.toLowerCase().includes(search.toLowerCase()))) return false;
      if (deptFilter && r.department_id !== deptFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, deptFilter, statusFilter]);

  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const create = useMutation({
    mutationFn: async () => {
      if (!form.email || !form.password || !form.full_name) throw new Error("Name, email, password required");
      await createFn({
        data: {
          email: form.email, password: form.password, full_name: form.full_name,
          employee_id: form.employee_id || undefined, phone: form.phone || undefined,
          designation: form.designation || undefined,
          department_id: form.department_id || null,
          shift_id: form.shift_id || null,
          location_id: form.location_id || null,
          basic_salary: form.basic_salary ? Number(form.basic_salary) : undefined,
          salary_type: form.salary_type,
          joining_date: form.joining_date || null,
          status: form.status,
          is_admin: form.is_admin,
        },
      });
    },
    onSuccess: () => {
      toast.success("Employee created");
      qc.invalidateQueries({ queryKey: ["employees-list"] });
      setOpen(false); setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["employees-list"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (userId: string) => { await deleteFn({ data: { user_id: userId } }); },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["employees-list"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPw = useMutation({
    mutationFn: async ({ user_id, password }: { user_id: string; password: string }) => {
      await resetFn({ data: { user_id, password } });
    },
    onSuccess: () => toast.success("Password updated"),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["employees-list"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} shown</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full"><Plus /> Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Employee ID (auto if blank)</Label><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="EMP-000000" /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div><Label>Joining date</Label><Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shift</Label>
                <Select value={form.shift_id} onValueChange={(v) => setForm({ ...form, shift_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Work location</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Basic salary (PKR)</Label><Input type="number" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} /></div>
              <div>
                <Label>Salary type</Label>
                <Select value={form.salary_type} onValueChange={(v) => setForm({ ...form, salary_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: v })} />
                <Label>Grant admin access</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={create.isPending} onClick={() => create.mutate()}>
                Save Employee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <Input placeholder="Search employees..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="sm:col-span-2 rounded-full bg-muted border-0" />
          <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="All status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-3 text-left">Employee</th>
                <th className="px-2 py-3 text-left">ID</th>
                <th className="px-2 py-3 text-left">Department</th>
                <th className="px-2 py-3 text-left">Designation</th>
                <th className="px-2 py-3 text-left">Status</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((r) => {
                const isAdmin = r.roles.includes("admin");
                const initials = (r.full_name || r.email || "?").slice(0, 2).toUpperCase();
                return (
                  <tr key={r.id}>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {r.full_name || "Unnamed"}
                            {isAdmin && <Badge variant="secondary" className="gap-1 text-[10px]"><Shield className="h-3 w-3" /> Admin</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs font-mono">{r.employee_id || "—"}</td>
                    <td className="px-2 py-3 text-muted-foreground">{r.department_name || "—"}</td>
                    <td className="px-2 py-3 text-muted-foreground">{r.designation || "—"}</td>
                    <td className="px-2 py-3">
                      <Badge variant={r.status === "active" ? "default" : "secondary"} className="border-0">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 text-right whitespace-nowrap space-x-1">
                      <Button variant="outline" size="sm"
                        onClick={() => toggleStatus.mutate({ id: r.id, status: r.status === "active" ? "inactive" : "active" })}>
                        {r.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="ghost" size="icon" title="Reset password"
                        onClick={() => {
                          const pw = prompt("New password (min 6 chars):");
                          if (pw && pw.length >= 6) resetPw.mutate({ user_id: r.id, password: pw });
                        }}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant={isAdmin ? "secondary" : "outline"} size="sm"
                        onClick={() => toggleAdmin.mutate({ userId: r.id, makeAdmin: !isAdmin })}>
                        {isAdmin ? "Revoke" : "Admin"}
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete"
                        onClick={() => { if (confirm(`Delete ${r.full_name || r.email}?`)) del.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No employees match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Page {page + 1} of {totalPages}</div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
