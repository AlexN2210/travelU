-- S'assurer que tous les utilisateurs invités via le lien ont la permission 'edit'
-- et mettre à jour la fonction join_trip_via_invite pour garantir 'edit' par défaut

-- 1. Recréer la fonction join_trip_via_invite avec 'edit' par défaut (garantir que c'est bien 'edit')
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
  
  -- Ajouter l'utilisateur comme participant (permission 'edit' par défaut pour les invitations)
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (trip_uuid, user_uuid, 'edit')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Vous avez été ajouté au voyage avec succès'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION join_trip_via_invite(uuid) TO authenticated;

-- 2. Fonction pour mettre à jour les permissions des participants existants
-- (optionnel : à utiliser si vous voulez mettre à jour les participants existants)
CREATE OR REPLACE FUNCTION update_participant_permission(
  p_trip_id uuid,
  p_user_id uuid,
  p_new_permission text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_creator boolean := false;
BEGIN
  -- Vérifier que l'utilisateur qui fait la demande est le créateur du voyage
  SELECT EXISTS(
    SELECT 1 FROM trips 
    WHERE trips.id = p_trip_id 
      AND trips.creator_id = auth.uid()
  ) INTO v_is_creator;
  
  IF NOT v_is_creator THEN
    RAISE EXCEPTION 'Seul le créateur du voyage peut modifier les permissions';
  END IF;
  
  -- Vérifier que la permission est valide
  IF p_new_permission NOT IN ('read', 'edit') THEN
    RAISE EXCEPTION 'Permission invalide. Doit être "read" ou "edit"';
  END IF;
  
  -- Mettre à jour la permission
  UPDATE trip_participants
  SET permission = p_new_permission
  WHERE trip_id = p_trip_id 
    AND user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION update_participant_permission(uuid, uuid, text) TO authenticated;
