import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "employee";

export type CurrentUser = {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
};

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({ user: null, role: null, loading: true });

  useEffect(() => {
    let mounted = true;

    async function loadRole(user: User | null) {
      if (!user) {
        if (mounted) setState({ user: null, role: null, loading: false });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const role: AppRole =
        (data?.find((r) => r.role === "admin")?.role as AppRole) ??
        ((data?.[0]?.role as AppRole) ?? "employee");
      if (mounted) setState({ user, role, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => loadRole(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      loadRole(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
