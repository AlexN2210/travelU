-- Fonction pour vérifier l'existence d'un voyage (pour les liens d'invitation)
-- Cette fonction permet aux utilisateurs non authentifiés de vérifier qu'un voyage existe
-- avant de s'inscrire pour le rejoindre
CREATE OR REPLACE FUNCTION check_trip_exists(trip_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_name text;
  trip_found boolean := false;
BEGIN
  -- Chercher le voyage (bypass RLS grâce à SECURITY DEFINER)
  SELECT t.name INTO trip_name
  FROM trips t
  WHERE t.id = trip_uuid;
  
  -- Si un nom a été trouvé, le voyage existe
  IF trip_name IS NOT NULL THEN
    trip_found := true;
  END IF;
  
  -- Retourner un JSON avec les informations
  RETURN jsonb_build_object(
    'exists', trip_found,
    'name', COALESCE(trip_name, '')
  );
END;
$$;

-- Permettre à tous (authentifiés et non authentifiés) d'utiliser cette fonction
GRANT EXECUTE ON FUNCTION check_trip_exists(uuid) TO anon, authenticated;
