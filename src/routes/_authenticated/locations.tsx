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
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";

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

const EMPTY: PickedLocation = { latitude: 0, longitude: 0, address: "", radius_meters: 100 };

function LocationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<PickedLocation>(EMPTY);

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
      if (!picked.latitude || !picked.longitude) throw new Error("Pick a location on the map");
      const { error } = await supabase.from("locations").insert({
        name: name || picked.address?.split(",")[0] || "Office",
        latitude: picked.latitude,
        longitude: picked.longitude,
        address: picked.address || null,
        radius_meters: picked.radius_meters,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location added");
      setOpen(false);
      setName(""); setPicked(EMPTY);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Locations</h1>
          <p className="text-sm text-muted-foreground">Manage office/site locations for geo-fenced attendance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full"><Plus /> New Location</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Location</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
              <div>
                <Label>Office Name (optional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Head Office" />
              </div>
              <LocationPicker value={picked} onChange={setPicked} />
              <Button type="submit" className="w-full" disabled={create.isPending}>Save Location</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((l) => {
          const anyL = l as typeof l & { address?: string | null };
          return (
            <div key={l.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 text-lg font-semibold">{l.name}</div>
              {anyL.address && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{anyL.address}</div>}
              <div className="mt-2 text-xs text-muted-foreground">Lat: {l.latitude.toFixed(5)}, Lng: {l.longitude.toFixed(5)}</div>
              <div className="text-xs text-muted-foreground">
                Radius: {l.radius_meters >= 1000 ? `${l.radius_meters / 1000}km` : `${l.radius_meters}m`}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No locations yet.</div>}
      </div>
    </div>
  );
}
