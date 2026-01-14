-- Fonction pour charger les participants d'un voyage (bypass RLS)
-- Permet aux participants de voir tous les participants du voyage
CREATE OR REPLACE FUNCTION get_trip_participants(trip_uuid uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  user_id uuid,
  permission text,
  joined_at timestamptz
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
  
  -- Retourner tous les participants du voyage
  RETURN QUERY
  SELECT 
    tp.id,
    tp.trip_id,
    tp.user_id,
    tp.permission,
    tp.joined_at
  FROM trip_participants tp
  WHERE tp.trip_id = trip_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trip_participants(uuid) TO authenticated;
