-- Étapes jour par jour: ajouter une date (jour) aux stages + exposer via RPC

-- 1) Schéma: colonne day_date
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS day_date date;

-- 2) RPC: get_trip_stages doit retourner day_date
DROP FUNCTION IF EXISTS public.get_trip_stages(uuid);

CREATE OR REPLACE FUNCTION public.get_trip_stages(trip_uuid uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  name text,
  order_index integer,
  day_date date,
  latitude numeric,
  longitude numeric,
  accommodation_link text,
  transport_to_next text,
  notes text,
  points_of_interest jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur est soit créateur, soit participant du voyage
  IF NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_uuid
      AND trips.creator_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.trip_participants
    WHERE trip_participants.trip_id = trip_uuid
      AND trip_participants.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.trip_id,
    s.name,
    s.order_index,
    s.day_date,
    s.latitude,
    s.longitude,
    s.accommodation_link,
    s.transport_to_next,
    s.notes,
    s.points_of_interest,
    s.created_at
  FROM public.stages s
  WHERE s.trip_id = trip_uuid
  ORDER BY
    s.day_date NULLS LAST,
    s.order_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_stages(uuid) TO authenticated;

-- 3) RPC: create_stage (ajoute p_day_date)
DROP FUNCTION IF EXISTS public.create_stage(uuid, text, integer, numeric, numeric, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_stage(
  p_trip_id uuid,
  p_name text,
  p_order_index integer,
  p_latitude numeric,
  p_longitude numeric,
  p_day_date date DEFAULT NULL,
  p_accommodation_link text DEFAULT NULL,
  p_transport_to_next text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_points_of_interest jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id uuid;
  v_user_uuid uuid;
  v_is_creator boolean := false;
  v_has_edit_permission boolean := false;
BEGIN
  v_user_uuid := auth.uid();

  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- Vérifier que l'utilisateur est créateur ou a la permission 'edit'
  SELECT EXISTS(
    SELECT 1 FROM public.trips
    WHERE trips.id = p_trip_id
      AND trips.creator_id = v_user_uuid
  ) INTO v_is_creator;

  IF NOT v_is_creator THEN
    SELECT EXISTS(
      SELECT 1 FROM public.trip_participants
      WHERE trip_participants.trip_id = p_trip_id
        AND trip_participants.user_id = v_user_uuid
        AND trip_participants.permission = 'edit'
    ) INTO v_has_edit_permission;

    IF NOT v_has_edit_permission THEN
      RAISE EXCEPTION 'Vous n''avez pas la permission de créer des étapes pour ce voyage';
    END IF;
  END IF;

  INSERT INTO public.stages (
    trip_id,
    name,
    order_index,
    day_date,
    latitude,
    longitude,
    accommodation_link,
    transport_to_next,
    notes,
    points_of_interest
  )
  VALUES (
    p_trip_id,
    p_name,
    p_order_index,
    p_day_date,
    p_latitude,
    p_longitude,
    p_accommodation_link,
    p_transport_to_next,
    p_notes,
    p_points_of_interest
  )
  RETURNING id INTO v_stage_id;

  RETURN v_stage_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_stage(uuid, text, integer, numeric, numeric, date, text, text, text, jsonb) TO authenticated;

-- 4) RPC: update_stage (ajoute p_day_date)
DROP FUNCTION IF EXISTS public.update_stage(uuid, text, numeric, numeric, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_stage(
  p_stage_id uuid,
  p_name text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_day_date date DEFAULT NULL,
  p_accommodation_link text DEFAULT NULL,
  p_transport_to_next text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_points_of_interest jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_trip_id uuid;
  v_is_creator boolean := false;
  v_has_edit_permission boolean := false;
BEGIN
  v_user_uuid := auth.uid();

  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT trip_id INTO v_trip_id
  FROM public.stages
  WHERE id = p_stage_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Stage introuvable';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.trips
    WHERE trips.id = v_trip_id
      AND trips.creator_id = v_user_uuid
  ) INTO v_is_creator;

  IF NOT v_is_creator THEN
    SELECT EXISTS(
      SELECT 1 FROM public.trip_participants
      WHERE trip_participants.trip_id = v_trip_id
        AND trip_participants.user_id = v_user_uuid
        AND trip_participants.permission = 'edit'
    ) INTO v_has_edit_permission;

    IF NOT v_has_edit_permission THEN
      RAISE EXCEPTION 'Vous n''avez pas la permission de modifier cette étape';
    END IF;
  END IF;

  UPDATE public.stages
  SET
    name = COALESCE(p_name, name),
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
    day_date = COALESCE(p_day_date, day_date),
    accommodation_link = CASE
      WHEN p_accommodation_link IS NOT NULL THEN
        CASE WHEN p_accommodation_link = '' THEN NULL ELSE p_accommodation_link END
      ELSE accommodation_link
    END,
    transport_to_next = CASE
      WHEN p_transport_to_next IS NOT NULL THEN
        CASE WHEN p_transport_to_next = '' THEN NULL ELSE p_transport_to_next END
      ELSE transport_to_next
    END,
    notes = CASE
      WHEN p_notes IS NOT NULL THEN
        CASE WHEN p_notes = '' THEN NULL ELSE p_notes END
      ELSE notes
    END,
    points_of_interest = CASE
      WHEN p_points_of_interest IS NOT NULL THEN
        CASE
          WHEN p_points_of_interest = '[]'::jsonb THEN NULL
          WHEN jsonb_typeof(p_points_of_interest) = 'array' THEN
            CASE
              WHEN jsonb_array_length(p_points_of_interest) = 0 THEN NULL
              ELSE p_points_of_interest
            END
          ELSE p_points_of_interest
        END
      ELSE points_of_interest
    END
  WHERE id = p_stage_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_stage(uuid, text, numeric, numeric, date, text, text, text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

