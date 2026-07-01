import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({ meta: [{ title: "Departments — Pasimo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles")
      .select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!r || r.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><DepartmentsPage /></AppShell>,
});

function DepartmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState<string>("");

  const { data: depts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const [{ data: d }, { data: counts }] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("profiles").select("department_id"),
      ]);
      const countMap = new Map<string, number>();
      counts?.forEach((p) => {
        if (p.department_id) countMap.set(p.department_id, (countMap.get(p.department_id) ?? 0) + 1);
      });
      return (d ?? []).map((x) => ({ ...x, employee_count: countMap.get(x.id) ?? 0 }));
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-manager"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("departments").insert({
        name: name.trim(),
        manager_id: managerId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department created");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setOpen(false); setName(""); setManagerId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateManager = useMutation({
    mutationFn: async ({ id, mgr }: { id: string; mgr: string | null }) => {
      const { error } = await supabase.from("departments").update({ manager_id: mgr }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-sm text-muted-foreground">{depts.length} departments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full"><Plus /> Add Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div>
                <Label>Manager (optional)</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger><SelectValue placeholder="Choose manager" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {depts.map((d) => (
          <div key={d.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <Button variant="ghost" size="icon"
                onClick={() => { if (confirm(`Delete ${d.name}?`)) del.mutate(d.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="text-xl font-semibold">{d.name}</div>
            <div className="text-sm text-muted-foreground mt-1">{d.employee_count} employees</div>
            <div className="mt-3">
              <Label className="text-xs">Manager</Label>
              <Select value={d.manager_id ?? ""} onValueChange={(v) => updateManager.mutate({ id: d.id, mgr: v || null })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
