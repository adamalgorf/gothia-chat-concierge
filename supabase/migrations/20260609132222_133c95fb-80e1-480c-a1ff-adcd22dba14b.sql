CREATE TABLE public.guest_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  booking_reference text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_profiles_room_active_idx
  ON public.guest_profiles (room_number)
  WHERE checked_out_at IS NULL;

GRANT ALL ON public.guest_profiles TO service_role;

ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.guest_profiles
  FOR ALL TO public USING (false) WITH CHECK (false);

CREATE TRIGGER update_guest_profiles_updated_at
  BEFORE UPDATE ON public.guest_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();