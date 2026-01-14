-- Fonction pour permettre à un utilisateur de s'ajouter lui-même à un voyage
-- via un lien d'invitation (bypass RLS)
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
  
  -- Ajouter l'utilisateur comme participant (permission 'read' par défaut)
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (trip_uuid, user_uuid, 'read')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Vous avez été ajouté au voyage avec succès'
  );
END;
$$;

-- Permettre aux utilisateurs authentifiés d'utiliser cette fonction
GRANT EXECUTE ON FUNCTION join_trip_via_invite(uuid) TO authenticated;
