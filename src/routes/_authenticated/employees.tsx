import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Shield } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Paismo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><EmployeesPage /></AppShell>,
});

function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; full_name: string; phone: string; department: string } | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, string[]>();
      roles?.forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return profiles?.map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] })) ?? [];
    },
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

  const update = useMutation({
    mutationFn: async (payload: { id: string; full_name: string; phone: string; department: string }) => {
      const { error } = await supabase.from("profiles")
        .update({ full_name: payload.full_name, phone: payload.phone, department: payload.department })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries({ queryKey: ["employees-list"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">{rows?.length ?? 0} total members</p>
        </div>
        <Button className="rounded-full" onClick={() => toast.info("New employees sign up at /auth — they appear here automatically.")}>
          <Plus /> Add New Employee
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <Input placeholder="Search employees..." className="rounded-full bg-muted border-0" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-3 text-left">Employee</th>
                <th className="px-2 py-3 text-left">ID</th>
                <th className="px-2 py-3 text-left">Department</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows?.map((r) => {
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
                    <td className="px-2 py-3 text-muted-foreground">{r.department || "—"}</td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      <Button variant="outline" size="sm" className="mr-2"
                        onClick={() => {
                          setEditing({ id: r.id, full_name: r.full_name ?? "", phone: r.phone ?? "", department: r.department ?? "" });
                          setOpen(true);
                        }}
                      >Edit</Button>
                      <Button variant={isAdmin ? "secondary" : "outline"} size="sm"
                        onClick={() => toggleAdmin.mutate({ userId: r.id, makeAdmin: !isAdmin })}>
                        {isAdmin ? "Revoke" : "Make admin"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No employees yet. Share the sign-up link with your team.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit employee</DialogTitle></DialogHeader>
          {editing && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); update.mutate(editing); }}>
              <div><Label>Full name</Label><Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><Label>Department</Label><Input value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={update.isPending}>Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
