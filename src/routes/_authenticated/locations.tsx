import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCurrentPosition } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/locations")({
  head: () => ({ meta: [{ title: "Locations — Paismo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><LocationsPage /></AppShell>,
});

function LocationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", latitude: 0, longitude: 0, radius_meters: 100 });

  const { data: rows = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Name required");
      const { error } = await supabase.from("locations").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location added");
      setOpen(false);
      setForm({ name: "", latitude: 0, longitude: 0, radius_meters: 100 });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });

  async function useMyLocation() {
    try {
      const pos = await getCurrentPosition();
      setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Locations</h1>
          <p className="text-sm text-muted-foreground">Manage office/site locations for geo-fenced attendance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full"><Plus /> New Location</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Location</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Head Office" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} /></div>
                <div><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} /></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={useMyLocation}>Use my current location</Button>
              <div><Label>Radius (meters)</Label><Input type="number" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: Number(e.target.value) })} /></div>
              <Button type="submit" className="w-full" disabled={create.isPending}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((l) => (
          <div key={l.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <MapPin className="h-5 w-5" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="mt-3 text-lg font-semibold">{l.name}</div>
            <div className="text-xs text-muted-foreground">Lat: {l.latitude.toFixed(5)}, Lng: {l.longitude.toFixed(5)}</div>
            <div className="text-xs text-muted-foreground">Radius: {l.radius_meters}m</div>
          </div>
        ))}
        {rows.length === 0 && <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No locations yet.</div>}
      </div>
    </div>
  );
}
