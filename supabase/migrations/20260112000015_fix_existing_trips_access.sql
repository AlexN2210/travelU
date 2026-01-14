-- Vérifier et corriger l'accès aux voyages existants
-- S'assurer que la fonction get_user_trips retourne bien tous les voyages (créateurs et participants)

-- Recréer la fonction get_user_trips pour s'assurer qu'elle fonctionne correctement
CREATE OR REPLACE FUNCTION get_user_trips()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  start_date date,
  end_date date,
  type text,
  creator_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.start_date,
    t.end_date,
    t.type,
    t.creator_id,
    t.created_at,
    t.updated_at
  FROM trips t
  WHERE t.creator_id = auth.uid()
     OR EXISTS (
       SELECT 1 
       FROM trip_participants tp
       WHERE tp.trip_id = t.id 
         AND tp.user_id = auth.uid()
     )
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_trips TO authenticated;

-- S'assurer que les politiques RLS permettent bien l'accès
-- Politique pour les créateurs (déjà existante, on la recrée pour être sûr)
DROP POLICY IF EXISTS "Creators can view their trips" ON trips;
CREATE POLICY "Creators can view their trips"
  ON trips FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- Politique pour les participants (déjà existante, on la recrée pour être sûr)
DROP POLICY IF EXISTS "Participants can view trips they participate in" ON trips;
CREATE POLICY "Participants can view trips they participate in"
  ON trips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM trip_participants 
      WHERE trip_participants.trip_id = trips.id 
        AND trip_participants.user_id = auth.uid()
    )
  );
