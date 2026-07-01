import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Clock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({ meta: [{ title: "Shift Management — Paismo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><ShiftsPage /></AppShell>,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ShiftsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", start_time: "09:00", end_time: "17:00",
    break_minutes: 60, grace_minutes: 10, off_days: ["Sat", "Sun"], ot_eligible: true,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Shift name required");
      const { error } = await supabase.from("shifts").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift created");
      setOpen(false);
      setForm({ name: "", start_time: "09:00", end_time: "17:00", break_minutes: 60, grace_minutes: 10, off_days: ["Sat","Sun"], ot_eligible: true });
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  function toggleDay(d: string) {
    setForm((f) => ({
      ...f,
      off_days: f.off_days.includes(d) ? f.off_days.filter((x) => x !== d) : [...f.off_days, d],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Shift Management</h1>
          <p className="text-sm text-muted-foreground">Create shifts and assign them to employees.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full"><Plus /> New Shift</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Shift</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard 9-5" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Break (min)</Label><Input type="number" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) })} /></div>
                <div><Label>Grace period (min)</Label><Input type="number" value={form.grace_minutes} onChange={(e) => setForm({ ...form, grace_minutes: Number(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Off days</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button type="button" key={d} onClick={() => toggleDay(d)}
                      className={`rounded-full px-3 py-1 text-xs border ${form.off_days.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div><Label>Overtime eligible</Label></div>
                <Switch checked={form.ot_eligible} onCheckedChange={(v) => setForm({ ...form, ot_eligible: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>Create shift</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {shifts.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <Clock className="h-5 w-5" />
              </div>
              {s.ot_eligible && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">OT eligible</span>}
            </div>
            <div className="mt-3 text-lg font-semibold">{s.name}</div>
            <div className="text-sm text-muted-foreground">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</div>
            <div className="mt-2 text-xs text-muted-foreground">Break: {s.break_minutes} min · Grace: {s.grace_minutes ?? 0} min</div>
            <div className="text-xs text-muted-foreground">Off: {s.off_days?.join(", ")}</div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {shifts.length === 0 && <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No shifts yet. Create your first one.</div>}
      </div>
    </div>
  );
}
