-- Fonctions pour créer et mettre à jour les stages (bypass RLS)
-- Évite la récursion infinie dans les politiques RLS

-- Fonction pour créer un stage
CREATE OR REPLACE FUNCTION create_stage(
  p_trip_id uuid,
  p_name text,
  p_order_index integer,
  p_latitude numeric,
  p_longitude numeric,
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
    SELECT 1 FROM trips 
    WHERE trips.id = p_trip_id 
      AND trips.creator_id = v_user_uuid
  ) INTO v_is_creator;
  
  IF NOT v_is_creator THEN
    SELECT EXISTS(
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = p_trip_id 
        AND trip_participants.user_id = v_user_uuid
        AND trip_participants.permission = 'edit'
    ) INTO v_has_edit_permission;
    
    IF NOT v_has_edit_permission THEN
      RAISE EXCEPTION 'Vous n''avez pas la permission de créer des étapes pour ce voyage';
    END IF;
  END IF;
  
  -- Créer le stage
  INSERT INTO stages (
    trip_id,
    name,
    order_index,
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

GRANT EXECUTE ON FUNCTION create_stage TO authenticated;

-- Fonction pour mettre à jour un stage
CREATE OR REPLACE FUNCTION update_stage(
  p_stage_id uuid,
  p_name text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
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
  
  -- Récupérer le trip_id du stage
  SELECT trip_id INTO v_trip_id
  FROM stages
  WHERE id = p_stage_id;
  
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Stage introuvable';
  END IF;
  
  -- Vérifier que l'utilisateur est créateur ou a la permission 'edit'
  SELECT EXISTS(
    SELECT 1 FROM trips 
    WHERE trips.id = v_trip_id 
      AND trips.creator_id = v_user_uuid
  ) INTO v_is_creator;
  
  IF NOT v_is_creator THEN
    SELECT EXISTS(
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = v_trip_id 
        AND trip_participants.user_id = v_user_uuid
        AND trip_participants.permission = 'edit'
    ) INTO v_has_edit_permission;
    
    IF NOT v_has_edit_permission THEN
      RAISE EXCEPTION 'Vous n''avez pas la permission de modifier cette étape';
    END IF;
  END IF;
  
  -- Mettre à jour le stage (seulement les champs fournis)
  UPDATE stages
  SET 
    name = COALESCE(p_name, name),
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
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

GRANT EXECUTE ON FUNCTION update_stage TO authenticated;
