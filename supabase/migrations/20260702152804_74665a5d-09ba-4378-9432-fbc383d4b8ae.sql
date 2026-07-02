
-- Move has_role to private schema so it's not exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate all policies to reference private.has_role
-- profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert profiles" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE USING (private.has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- attendance
DROP POLICY IF EXISTS "Users view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins delete attendance" ON public.attendance;
CREATE POLICY "Users view own attendance" ON public.attendance FOR SELECT USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own attendance" ON public.attendance FOR UPDATE USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete attendance" ON public.attendance FOR DELETE USING (private.has_role(auth.uid(), 'admin'));

-- attendance_settings
DROP POLICY IF EXISTS "Admins update settings" ON public.attendance_settings;
DROP POLICY IF EXISTS "Admins insert settings" ON public.attendance_settings;
CREATE POLICY "Admins update settings" ON public.attendance_settings FOR UPDATE USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.attendance_settings FOR INSERT WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- shifts
DROP POLICY IF EXISTS "Admins manage shifts" ON public.shifts;
CREATE POLICY "Admins manage shifts" ON public.shifts FOR ALL USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- leave_requests
DROP POLICY IF EXISTS "Users see own leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins update leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Users/admins delete leaves" ON public.leave_requests;
CREATE POLICY "Users see own leaves" ON public.leave_requests FOR SELECT USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update leaves" ON public.leave_requests FOR UPDATE USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users/admins delete leaves" ON public.leave_requests FOR DELETE USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));

-- locations
DROP POLICY IF EXISTS "Admins manage locations" ON public.locations;
CREATE POLICY "Admins manage locations" ON public.locations FOR ALL USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- departments
DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- notifications
DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- company_settings
DROP POLICY IF EXISTS "Admins update company" ON public.company_settings;
CREATE POLICY "Admins update company" ON public.company_settings FOR UPDATE USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- storage.objects: selfies and avatars
DROP POLICY IF EXISTS "Users read own selfies or admin all" ON storage.objects;
CREATE POLICY "Users read own selfies or admin all" ON storage.objects FOR SELECT
  USING (bucket_id = 'selfies' AND (((storage.foldername(name))[1] = auth.uid()::text) OR private.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (((storage.foldername(name))[1] = auth.uid()::text) OR private.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "avatars admin write any" ON storage.objects;
CREATE POLICY "avatars admin write any" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND private.has_role(auth.uid(), 'admin'));

-- Add UPDATE/DELETE policies for selfies bucket (owner or admin)
CREATE POLICY "selfies owner update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'selfies' AND (((storage.foldername(name))[1] = auth.uid()::text) OR private.has_role(auth.uid(), 'admin')))
  WITH CHECK (bucket_id = 'selfies' AND (((storage.foldername(name))[1] = auth.uid()::text) OR private.has_role(auth.uid(), 'admin')));

CREATE POLICY "selfies owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'selfies' AND (((storage.foldername(name))[1] = auth.uid()::text) OR private.has_role(auth.uid(), 'admin')));

-- Drop the now-unused public.has_role
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
