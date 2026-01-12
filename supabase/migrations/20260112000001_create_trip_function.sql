-- Fonction pour créer un voyage et retourner l'ID sans problème de récursion RLS
-- Cette fonction utilise SECURITY DEFINER pour bypass les politiques RLS lors de l'insertion

CREATE OR REPLACE FUNCTION create_trip_and_return_id(
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_type text,
  p_creator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  -- Insérer le voyage
  INSERT INTO trips (name, description, start_date, end_date, type, creator_id)
  VALUES (p_name, p_description, p_start_date, p_end_date, p_type, p_creator_id)
  RETURNING id INTO v_trip_id;
  
  -- Ajouter le créateur comme participant
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (v_trip_id, p_creator_id, 'edit');
  
  RETURN v_trip_id;
END;
$$;

-- Donner les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION create_trip_and_return_id TO authenticated;
