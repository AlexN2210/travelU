-- Votes: récupérer un "meta" fiable du voyage (dates + nombre de participants)
-- But: éviter les valeurs par défaut (1 nuit / 1 pers) quand les SELECT directs sont bloqués par RLS.

-- Helper (au cas où): is_trip_member
CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip_id AND t.creator_id = v_user_uuid) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id AND tp.user_id = v_user_uuid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid) TO authenticated;

-- RPC: renvoie dates + nb participants (créateur inclus)
DROP FUNCTION IF EXISTS public.get_trip_meta(uuid);

CREATE OR REPLACE FUNCTION public.get_trip_meta(p_trip_id uuid)
RETURNS TABLE (
  trip_id uuid,
  start_date date,
  end_date date,
  participants_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_start date;
  v_end date;
  v_count integer;
BEGIN
  IF NOT public.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  SELECT t.creator_id, t.start_date, t.end_date
  INTO v_creator_id, v_start, v_end
  FROM public.trips t
  WHERE t.id = p_trip_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Voyage introuvable';
  END IF;

  SELECT
    (COUNT(DISTINCT tp.user_id) + 1)::int
  INTO v_count
  FROM public.trip_participants tp
  WHERE tp.trip_id = p_trip_id
    AND tp.user_id <> v_creator_id;

  RETURN QUERY
  SELECT p_trip_id, v_start, v_end, GREATEST(1, COALESCE(v_count, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_meta(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

