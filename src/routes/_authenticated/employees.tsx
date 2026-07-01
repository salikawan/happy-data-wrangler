import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Shield } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Pasimo" }] }),
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
      <EmployeesPage />
    </AppShell>
  ),
});

function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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
      return (
        profiles?.map((p) => ({
          ...p,
          roles: roleMap.get(p.id) ?? [],
        })) ?? []
      );
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["employees-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (payload: {
      id: string;
      full_name: string;
      phone: string;
      department: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: payload.full_name,
          phone: payload.phone,
          department: payload.department,
        })
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

  const [editing, setEditing] = useState<{
    id: string;
    full_name: string;
    phone: string;
    department: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workforce. New signups appear here automatically.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Team ({rows?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows && rows.length > 0 ? (
            <div className="divide-y">
              {rows.map((r) => {
                const isAdmin = r.roles.includes("admin");
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {r.full_name || r.email || "Unnamed"}
                        </span>
                        {isAdmin && (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" /> Admin
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.email} • {r.department || "No department"} • {r.phone || "No phone"}
                      </div>
                    </div>
                    <Dialog
                      open={open && editing?.id === r.id}
                      onOpenChange={(o) => {
                        setOpen(o);
                        if (!o) setEditing(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing({
                              id: r.id,
                              full_name: r.full_name ?? "",
                              phone: r.phone ?? "",
                              department: r.department ?? "",
                            });
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit employee</DialogTitle>
                        </DialogHeader>
                        {editing && (
                          <form
                            className="space-y-3"
                            onSubmit={(e) => {
                              e.preventDefault();
                              update.mutate(editing);
                            }}
                          >
                            <div>
                              <Label>Full name</Label>
                              <Input
                                value={editing.full_name}
                                onChange={(e) =>
                                  setEditing({ ...editing, full_name: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Phone</Label>
                              <Input
                                value={editing.phone}
                                onChange={(e) =>
                                  setEditing({ ...editing, phone: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Department</Label>
                              <Input
                                value={editing.department}
                                onChange={(e) =>
                                  setEditing({ ...editing, department: e.target.value })
                                }
                              />
                            </div>
                            <Button type="submit" className="w-full" disabled={update.isPending}>
                              Save
                            </Button>
                          </form>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant={isAdmin ? "secondary" : "outline"}
                      size="sm"
                      onClick={() =>
                        toggleAdmin.mutate({ userId: r.id, makeAdmin: !isAdmin })
                      }
                    >
                      {isAdmin ? "Revoke admin" : "Make admin"}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Plus className="mx-auto mb-2 h-6 w-6" />
              No employees yet. Share the sign-up link with your team.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
