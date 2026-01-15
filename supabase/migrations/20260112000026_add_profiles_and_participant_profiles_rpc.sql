-- Profils utilisateurs (prénom/nom/email) + RPC pour récupérer les participants avec noms

-- 1) Table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert their own profile" ON public.profiles;
CREATE POLICY "Users can upsert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) ensure_profile(): crée/met à jour automatiquement le profil depuis auth.users
-- Nécessite que first_name/last_name soient envoyés en user_metadata à l'inscription
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_email text;
  v_first text;
  v_last text;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT u.email,
         (u.raw_user_meta_data->>'first_name')::text,
         (u.raw_user_meta_data->>'last_name')::text
  INTO v_email, v_first, v_last
  FROM auth.users u
  WHERE u.id = v_user_uuid;

  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (v_user_uuid, v_email, v_first, v_last)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- 3) get_trip_participant_profiles(): récupère tous les participants avec prénom/nom/email
-- Utilise is_trip_member/is_trip_editor si déjà présents; sinon logique interne simple
CREATE OR REPLACE FUNCTION public.get_trip_participant_profiles(p_trip_id uuid)
RETURNS TABLE (
  user_id uuid,
  permission text,
  email text,
  first_name text,
  last_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_allowed boolean := false;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- accès si créateur ou participant
  SELECT (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip_id AND t.creator_id = v_user_uuid)
    OR EXISTS (SELECT 1 FROM public.trip_participants tp WHERE tp.trip_id = p_trip_id AND tp.user_id = v_user_uuid)
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  -- inclure le créateur (permission 'edit')
  RETURN QUERY
  SELECT
    t.creator_id as user_id,
    'edit'::text as permission,
    p.email,
    p.first_name,
    p.last_name
  FROM public.trips t
  LEFT JOIN public.profiles p ON p.user_id = t.creator_id
  WHERE t.id = p_trip_id

  UNION

  -- + participants
  SELECT
    tp.user_id,
    tp.permission,
    p.email,
    p.first_name,
    p.last_name
  FROM public.trip_participants tp
  LEFT JOIN public.profiles p ON p.user_id = tp.user_id
  WHERE tp.trip_id = p_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_participant_profiles(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

