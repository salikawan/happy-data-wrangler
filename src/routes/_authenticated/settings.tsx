import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { getCurrentPosition } from "@/lib/geo";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Pasimo" }] }),
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
      <SettingsPage />
    </AppShell>
  ),
});

type Settings = {
  id: number;
  allowed_lat: number | null;
  allowed_lng: number | null;
  allowed_radius_meters: number;
  late_after_time: string;
  require_checkout_selfie: boolean;
  enforce_geofence: boolean;
};

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Settings) => {
      const { error } = await supabase
        .from("attendance_settings")
        .update({
          allowed_lat: payload.allowed_lat,
          allowed_lng: payload.allowed_lng,
          allowed_radius_meters: payload.allowed_radius_meters,
          late_after_time: payload.late_after_time,
          require_checkout_selfie: payload.require_checkout_selfie,
          enforce_geofence: payload.enforce_geofence,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function useMyLocation() {
    try {
      const pos = await getCurrentPosition();
      setForm((f) =>
        f
          ? { ...f, allowed_lat: pos.coords.latitude, allowed_lng: pos.coords.longitude }
          : f,
      );
      toast.success("Location captured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to get location");
    }
  }

  if (!form) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure attendance rules for your team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geo-fence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enforce geo-fence</Label>
              <p className="text-xs text-muted-foreground">
                Reject check-ins outside the allowed radius.
              </p>
            </div>
            <Switch
              checked={form.enforce_geofence}
              onCheckedChange={(v) => setForm({ ...form, enforce_geofence: v })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                value={form.allowed_lat ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allowed_lat: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                value={form.allowed_lng ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allowed_lng: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label>Radius (meters)</Label>
            <Input
              type="number"
              min={10}
              value={form.allowed_radius_meters}
              onChange={(e) =>
                setForm({ ...form, allowed_radius_meters: Number(e.target.value) })
              }
            />
          </div>
          <Button variant="outline" onClick={useMyLocation}>
            <MapPin /> Use my current location
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Late after</Label>
            <Input
              type="time"
              value={form.late_after_time.slice(0, 5)}
              onChange={(e) =>
                setForm({ ...form, late_after_time: e.target.value + ":00" })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Check-ins after this time are marked as late.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Require check-out selfie</Label>
              <p className="text-xs text-muted-foreground">
                Force employees to take a selfie when checking out.
              </p>
            </div>
            <Switch
              checked={form.require_checkout_selfie}
              onCheckedChange={(v) => setForm({ ...form, require_checkout_selfie: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
