import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Pasimo" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles")
      .select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!r || r.length === 0) throw redirect({ to: "/app" });
  },
  component: () => <AppShell><NotificationsPage /></AppShell>,
});

function NotificationsPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "department" | "user">("all");
  const [departmentId, setDepartmentId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");

  const { data: notifs = [] } = useQuery({
    queryKey: ["notif-admin-list"],
    queryFn: async () =>
      (await supabase.from("notifications").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: depts = [] } = useQuery({
    queryKey: ["depts-basic"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-basic"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required");
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim() || null,
        audience,
        created_by: user?.id,
      };
      if (audience === "department") payload.department_id = departmentId || null;
      if (audience === "user") payload.target_user_id = targetUserId || null;
      const { error } = await supabase.from("notifications").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification sent");
      qc.invalidateQueries({ queryKey: ["notif-admin-list"] });
      qc.invalidateQueries({ queryKey: ["notif-bell"] });
      setTitle(""); setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-admin-list"] });
      qc.invalidateQueries({ queryKey: ["notif-bell"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Send announcements to your team</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <div className="font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4" /> New announcement</div>
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} /></div>
          <div>
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v: "all" | "department" | "user") => setAudience(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                <SelectItem value="department">A department</SelectItem>
                <SelectItem value="user">A specific employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audience === "department" && (
            <div>
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {audience === "user" && (
            <div>
              <Label>Employee</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="w-full" disabled={send.isPending} onClick={() => send.mutate()}>Send</Button>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="font-semibold mb-3">Recent</div>
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {notifs.length === 0 && <div className="text-sm text-muted-foreground">No announcements yet</div>}
            {notifs.map((n) => (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {n.audience} · {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(n.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
