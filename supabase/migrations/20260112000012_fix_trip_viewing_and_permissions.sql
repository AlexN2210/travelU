-- 1. Fonction pour charger un voyage (bypass RLS pour les participants)
-- Permet aux participants de voir les voyages auxquels ils participent
CREATE OR REPLACE FUNCTION get_trip_by_id(trip_uuid uuid)
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
  WHERE t.id = trip_uuid
    AND (
      t.creator_id = auth.uid()
      OR EXISTS (
        SELECT 1 
        FROM trip_participants tp
        WHERE tp.trip_id = t.id 
          AND tp.user_id = auth.uid()
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_trip_by_id(uuid) TO authenticated;

-- 2. Ajouter une politique pour que les participants puissent voir les voyages
-- (en plus de la politique existante pour les créateurs)
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

-- 3. Modifier la fonction join_trip_via_invite pour mettre 'edit' par défaut
CREATE OR REPLACE FUNCTION join_trip_via_invite(trip_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_exists boolean := false;
  already_participant boolean := false;
  user_uuid uuid;
BEGIN
  -- Récupérer l'ID de l'utilisateur actuel
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;
  
  -- Vérifier que le voyage existe
  SELECT EXISTS(SELECT 1 FROM trips WHERE id = trip_uuid) INTO trip_exists;
  
  IF NOT trip_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Voyage introuvable'
    );
  END IF;
  
  -- Vérifier si l'utilisateur est déjà participant
  SELECT EXISTS(
    SELECT 1 FROM trip_participants 
    WHERE trip_id = trip_uuid AND user_id = user_uuid
  ) INTO already_participant;
  
  IF already_participant THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous êtes déjà participant à ce voyage'
    );
  END IF;
  
  -- Ajouter l'utilisateur comme participant (permission 'edit' par défaut)
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (trip_uuid, user_uuid, 'edit')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Vous avez été ajouté au voyage avec succès'
  );
END;
$$;
