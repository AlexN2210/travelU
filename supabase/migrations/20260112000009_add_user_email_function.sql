-- Fonction pour récupérer l'email d'un utilisateur
-- Cette fonction permet aux utilisateurs authentifiés de voir les emails des autres participants
CREATE OR REPLACE FUNCTION get_user_email(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Récupérer l'email depuis auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;
  
  RETURN COALESCE(user_email, 'Utilisateur inconnu');
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated;

-- Fonction pour trouver un utilisateur par email
CREATE OR REPLACE FUNCTION find_user_by_email(user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Trouver l'utilisateur par email
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = user_email;
  
  RETURN user_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO authenticated;
