import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — Paismo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><PayrollPage /></AppShell>,
});

type Row = { id: string; full_name: string | null; email: string; employee_id: string | null; designation: string | null; basic_salary: number | null; salary_type: string | null };

function PayrollPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["payroll-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name, email, employee_id, designation, basic_salary, salary_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const total = rows.reduce((s, r) => s + Number(r.basic_salary || 0), 0);

  const save = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("profiles")
        .update({ designation: r.designation, basic_salary: r.basic_salary, salary_type: r.salary_type })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["payroll-list"] });
      qc.invalidateQueries({ queryKey: ["monthly-payroll"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payroll Management</h1>
        <p className="text-sm text-muted-foreground">Manage salaries, deductions and bonuses.</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm max-w-xs">
        <div className="text-xs text-muted-foreground">Total monthly payroll</div>
        <div className="mt-1 text-2xl font-bold">PKR {total.toLocaleString()}</div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-left">Basic Salary</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name || r.email}</div>
                    <div className="text-xs text-muted-foreground">{r.employee_id}</div>
                  </td>
                  <td className="px-4 py-3">{r.designation || "—"}</td>
                  <td className="px-4 py-3">PKR {Number(r.basic_salary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{r.salary_type || "Monthly"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No employees yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit payroll</DialogTitle></DialogHeader>
          {editing && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
              <div><Label>Designation</Label><Input value={editing.designation ?? ""} onChange={(e) => setEditing({ ...editing, designation: e.target.value })} /></div>
              <div><Label>Basic salary (PKR)</Label><Input type="number" value={editing.basic_salary ?? 0} onChange={(e) => setEditing({ ...editing, basic_salary: Number(e.target.value) })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={editing.salary_type ?? "Monthly"} onValueChange={(v) => setEditing({ ...editing, salary_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Hourly">Hourly</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
