
-- =============== DEPARTMENTS ===============
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== NOTIFICATIONS ===============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  audience text NOT NULL DEFAULT 'all', -- 'all' | 'department' | 'user'
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'in_app',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users see their notifications" ON public.notifications FOR SELECT TO authenticated
  USING (
    audience='all'
    OR (audience='user' AND target_user_id=auth.uid())
    OR (audience='department' AND department_id IN (SELECT department_id FROM public.profiles WHERE id=auth.uid()))
  );

CREATE TABLE public.notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their reads" ON public.notification_reads FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

-- =============== COMPANY SETTINGS ===============
CREATE TABLE public.company_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  company_name text NOT NULL DEFAULT 'Pasimo',
  logo_url text,
  address text,
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  work_start time NOT NULL DEFAULT '09:00',
  work_end time NOT NULL DEFAULT '18:00',
  grace_minutes int NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read company" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update company" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.company_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

-- =============== EXTEND PROFILES ===============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

-- =============== EXTEND SHIFTS ===============
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS grace_minutes int NOT NULL DEFAULT 10;

-- =============== EXTEND ATTENDANCE SETTINGS ===============
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS require_checkin_selfie boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_selfie boolean NOT NULL DEFAULT true;

-- =============== SEED DEPARTMENTS ===============
INSERT INTO public.departments (name) VALUES ('HR'),('Sales'),('Operations'),('Finance'),('IT')
ON CONFLICT (name) DO NOTHING;

-- =============== TRIGGERS ===============
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_company_settings_updated BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
