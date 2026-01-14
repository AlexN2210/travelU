-- Fonction pour charger les stages d'un voyage (bypass RLS)
-- Permet aux participants de voir les stages du voyage
CREATE OR REPLACE FUNCTION get_trip_stages(trip_uuid uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  name text,
  order_index integer,
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
    SELECT 1 FROM trips 
    WHERE trips.id = trip_uuid 
      AND trips.creator_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM trip_participants 
    WHERE trip_participants.trip_id = trip_uuid 
      AND trip_participants.user_id = auth.uid()
  ) THEN
    -- L'utilisateur n'a pas accès à ce voyage
    RETURN;
  END IF;
  
  -- Retourner tous les stages du voyage
  RETURN QUERY
  SELECT 
    s.id,
    s.trip_id,
    s.name,
    s.order_index,
    s.latitude,
    s.longitude,
    s.accommodation_link,
    s.transport_to_next,
    s.notes,
    s.points_of_interest,
    s.created_at
  FROM stages s
  WHERE s.trip_id = trip_uuid
  ORDER BY s.order_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trip_stages(uuid) TO authenticated;
