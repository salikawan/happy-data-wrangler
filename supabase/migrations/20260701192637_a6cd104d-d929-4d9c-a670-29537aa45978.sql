
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'Monthly';

-- Backfill employee IDs
UPDATE public.profiles
SET employee_id = 'EMP-' || LPAD((floor(random()*900000)+100000)::int::text, 6, '0')
WHERE employee_id IS NULL;

-- Auto-generate employee_id for new profiles
CREATE OR REPLACE FUNCTION public.set_employee_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    NEW.employee_id := 'EMP-' || LPAD((floor(random()*900000)+100000)::int::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_set_employee_id ON public.profiles;
CREATE TRIGGER profiles_set_employee_id
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_employee_id();

-- Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT NOT NULL DEFAULT 60,
  off_days TEXT[] NOT NULL DEFAULT ARRAY['Sat','Sun'],
  ot_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reads shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shifts" ON public.shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Leave requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'Casual',
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own leaves" ON public.leave_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own leaves" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update leaves" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users/admins delete leaves" ON public.leave_requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Locations
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reads locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage locations" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
