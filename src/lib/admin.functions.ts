import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type NewEmployee = {
  email: string;
  password: string;
  full_name: string;
  employee_id?: string;
  phone?: string;
  designation?: string;
  department_id?: string | null;
  shift_id?: string | null;
  location_id?: string | null;
  basic_salary?: number;
  salary_type?: string;
  joining_date?: string | null;
  status?: string;
  is_admin?: boolean;
};

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewEmployee) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone },
    });
    if (createErr) throw new Error(createErr.message);
    const uid = created.user!.id;

    const patch: Record<string, unknown> = {
      full_name: data.full_name,
      phone: data.phone ?? null,
      designation: data.designation ?? null,
      department_id: data.department_id ?? null,
      shift_id: data.shift_id ?? null,
      location_id: data.location_id ?? null,
      basic_salary: data.basic_salary ?? null,
      salary_type: data.salary_type ?? "monthly",
      joining_date: data.joining_date ?? null,
      status: data.status ?? "active",
    };
    if (data.employee_id) patch.employee_id = data.employee_id;

    const { error: updErr } = await supabaseAdmin.from("profiles").update(patch).eq("id", uid);
    if (updErr) throw new Error(updErr.message);

    if (data.is_admin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    }
    return { id: uid };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.user_id === context.userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
