import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    const { data: roles } = await supabase.from("user_roles")
      .select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><SettingsPage /></AppShell>,
});

type Settings = {
  id: number;
  allowed_lat: number | null;
  allowed_lng: number | null;
  allowed_radius_meters: number;
  late_after_time: string;
  require_checkout_selfie: boolean;
  require_checkin_selfie: boolean;
  enable_selfie: boolean;
  enforce_geofence: boolean;
};

type Company = {
  id: number;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  timezone: string;
  work_start: string;
  work_end: string;
  grace_minutes: number;
};

function SettingsPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("attendance_settings").select("*").eq("id", 1).maybeSingle()).data as Settings | null,
  });
  const { data: companyData } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle()).data as Company | null,
  });

  const [form, setForm] = useState<Settings | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { if (companyData) setCompany(companyData); }, [companyData]);

  const save = useMutation({
    mutationFn: async (p: Settings) => {
      const { error } = await supabase.from("attendance_settings").update({
        allowed_lat: p.allowed_lat, allowed_lng: p.allowed_lng,
        allowed_radius_meters: p.allowed_radius_meters, late_after_time: p.late_after_time,
        require_checkout_selfie: p.require_checkout_selfie,
        require_checkin_selfie: p.require_checkin_selfie,
        enable_selfie: p.enable_selfie,
        enforce_geofence: p.enforce_geofence,
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attendance settings saved"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCompany = useMutation({
    mutationFn: async (c: Company) => {
      const { error } = await supabase.from("company_settings").update({
        company_name: c.company_name, logo_url: c.logo_url, address: c.address,
        timezone: c.timezone, work_start: c.work_start, work_end: c.work_end,
        grace_minutes: c.grace_minutes,
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Company saved"); qc.invalidateQueries({ queryKey: ["company"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function useMyLocation() {
    try {
      const pos = await getCurrentPosition();
      setForm((f) => f ? { ...f, allowed_lat: pos.coords.latitude, allowed_lng: pos.coords.longitude } : f);
      toast.success("Location captured");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to get location"); }
  }

  if (!form || !company) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your organization and attendance rules.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Company name</Label><Input value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })} /></div>
            <div><Label>Logo URL</Label><Input value={company.logo_url ?? ""} onChange={(e) => setCompany({ ...company, logo_url: e.target.value })} placeholder="https://..." /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Textarea value={company.address ?? ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} rows={2} /></div>
            <div><Label>Timezone</Label><Input value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })} /></div>
            <div><Label>Grace minutes</Label><Input type="number" value={company.grace_minutes} onChange={(e) => setCompany({ ...company, grace_minutes: Number(e.target.value) })} /></div>
            <div><Label>Work start</Label><Input type="time" value={company.work_start.slice(0, 5)} onChange={(e) => setCompany({ ...company, work_start: e.target.value + ":00" })} /></div>
            <div><Label>Work end</Label><Input type="time" value={company.work_end.slice(0, 5)} onChange={(e) => setCompany({ ...company, work_end: e.target.value + ":00" })} /></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveCompany.mutate(company)} disabled={saveCompany.isPending}>Save company</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Geo-fence</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Enforce geo-fence</Label>
              <p className="text-xs text-muted-foreground">Reject check-ins outside the allowed radius.</p></div>
            <Switch checked={form.enforce_geofence} onCheckedChange={(v) => setForm({ ...form, enforce_geofence: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Latitude</Label><Input type="number" step="any" value={form.allowed_lat ?? ""}
              onChange={(e) => setForm({ ...form, allowed_lat: e.target.value ? Number(e.target.value) : null })} /></div>
            <div><Label>Longitude</Label><Input type="number" step="any" value={form.allowed_lng ?? ""}
              onChange={(e) => setForm({ ...form, allowed_lng: e.target.value ? Number(e.target.value) : null })} /></div>
          </div>
          <div><Label>Radius (meters)</Label><Input type="number" min={10} value={form.allowed_radius_meters}
            onChange={(e) => setForm({ ...form, allowed_radius_meters: Number(e.target.value) })} /></div>
          <Button variant="outline" onClick={useMyLocation}><MapPin /> Use my current location</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Selfie & Attendance rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Enable selfie verification</Label>
              <p className="text-xs text-muted-foreground">Turn selfie capture on or off entirely.</p></div>
            <Switch checked={form.enable_selfie} onCheckedChange={(v) => setForm({ ...form, enable_selfie: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Require selfie at check-in</Label></div>
            <Switch checked={form.require_checkin_selfie} onCheckedChange={(v) => setForm({ ...form, require_checkin_selfie: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Require selfie at check-out</Label></div>
            <Switch checked={form.require_checkout_selfie} onCheckedChange={(v) => setForm({ ...form, require_checkout_selfie: v })} />
          </div>
          <div><Label>Late after</Label>
            <Input type="time" value={form.late_after_time.slice(0, 5)}
              onChange={(e) => setForm({ ...form, late_after_time: e.target.value + ":00" })} />
            <p className="mt-1 text-xs text-muted-foreground">Check-ins after this time are marked as late.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>Save attendance settings</Button>
      </div>
    </div>
  );
}
