-- Votes: éviter les soucis RLS/récursion + réduire le N+1 côté client
-- On expose des fonctions SECURITY DEFINER avec vérification d'accès (créateur ou participant)

-- 1) Charger les catégories de vote d'un voyage
CREATE OR REPLACE FUNCTION get_trip_vote_categories(p_trip_id uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  name text,
  title text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_is_creator boolean := false;
  v_is_participant boolean := false;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT EXISTS(SELECT 1 FROM trips WHERE id = p_trip_id AND creator_id = v_user_uuid) INTO v_is_creator;
  SELECT EXISTS(SELECT 1 FROM trip_participants WHERE trip_id = p_trip_id AND user_id = v_user_uuid) INTO v_is_participant;

  IF NOT v_is_creator AND NOT v_is_participant THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  RETURN QUERY
  SELECT vc.id, vc.trip_id, vc.name, vc.title, vc.created_at
  FROM vote_categories vc
  WHERE vc.trip_id = p_trip_id
  ORDER BY vc.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trip_vote_categories(uuid) TO authenticated;

-- 2) Créer les catégories par défaut si elles n'existent pas
CREATE OR REPLACE FUNCTION ensure_default_vote_categories(p_trip_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_is_creator boolean := false;
  v_has_edit_permission boolean := false;
  v_exists boolean := false;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT EXISTS(SELECT 1 FROM trips WHERE id = p_trip_id AND creator_id = v_user_uuid) INTO v_is_creator;
  SELECT EXISTS(
    SELECT 1 FROM trip_participants
    WHERE trip_id = p_trip_id AND user_id = v_user_uuid AND permission = 'edit'
  ) INTO v_has_edit_permission;

  IF NOT v_is_creator AND NOT v_has_edit_permission THEN
    RAISE EXCEPTION 'Accès non autorisé pour gérer les catégories de vote';
  END IF;

  SELECT EXISTS(SELECT 1 FROM vote_categories WHERE trip_id = p_trip_id) INTO v_exists;
  IF v_exists THEN
    RETURN TRUE;
  END IF;

  INSERT INTO vote_categories (trip_id, name, title)
  VALUES
    (p_trip_id, 'accommodation', 'Hébergements'),
    (p_trip_id, 'activity', 'Activités'),
    (p_trip_id, 'restaurant', 'Restaurants'),
    (p_trip_id, 'other', 'Autres');

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_default_vote_categories(uuid) TO authenticated;

-- 3) Charger les options + compteurs + vote de l'utilisateur courant (anti N+1)
CREATE OR REPLACE FUNCTION get_vote_options_with_counts(p_category_id uuid)
RETURNS TABLE (
  id uuid,
  category_id uuid,
  title text,
  description text,
  link text,
  added_by uuid,
  created_at timestamptz,
  upvotes integer,
  downvotes integer,
  user_vote boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_trip_id uuid;
  v_is_creator boolean := false;
  v_is_participant boolean := false;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vc.trip_id INTO v_trip_id
  FROM vote_categories vc
  WHERE vc.id = p_category_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie introuvable';
  END IF;

  SELECT EXISTS(SELECT 1 FROM trips WHERE id = v_trip_id AND creator_id = v_user_uuid) INTO v_is_creator;
  SELECT EXISTS(SELECT 1 FROM trip_participants WHERE trip_id = v_trip_id AND user_id = v_user_uuid) INTO v_is_participant;

  IF NOT v_is_creator AND NOT v_is_participant THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  RETURN QUERY
  SELECT
    vo.id,
    vo.category_id,
    vo.title,
    vo.description,
    vo.link,
    vo.added_by,
    vo.created_at,
    COALESCE(SUM(CASE WHEN uv.vote IS TRUE THEN 1 ELSE 0 END), 0)::int AS upvotes,
    COALESCE(SUM(CASE WHEN uv.vote IS FALSE THEN 1 ELSE 0 END), 0)::int AS downvotes,
    MAX(CASE WHEN uv.user_id = v_user_uuid THEN uv.vote ELSE NULL END) AS user_vote
  FROM vote_options vo
  LEFT JOIN user_votes uv ON uv.option_id = vo.id
  WHERE vo.category_id = p_category_id
  GROUP BY vo.id
  ORDER BY vo.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_vote_options_with_counts(uuid) TO authenticated;

-- 4) Ajouter une option de vote (créateur ou éditeur seulement)
CREATE OR REPLACE FUNCTION add_vote_option(
  p_category_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_trip_id uuid;
  v_is_creator boolean := false;
  v_has_edit_permission boolean := false;
  v_option_id uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vc.trip_id INTO v_trip_id
  FROM vote_categories vc
  WHERE vc.id = p_category_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie introuvable';
  END IF;

  SELECT EXISTS(SELECT 1 FROM trips WHERE id = v_trip_id AND creator_id = v_user_uuid) INTO v_is_creator;
  SELECT EXISTS(
    SELECT 1 FROM trip_participants
    WHERE trip_id = v_trip_id AND user_id = v_user_uuid AND permission = 'edit'
  ) INTO v_has_edit_permission;

  IF NOT v_is_creator AND NOT v_has_edit_permission THEN
    RAISE EXCEPTION 'Accès non autorisé pour ajouter des options de vote';
  END IF;

  INSERT INTO vote_options (category_id, title, description, link, added_by)
  VALUES (p_category_id, p_title, NULLIF(p_description, ''), NULLIF(p_link, ''), v_user_uuid)
  RETURNING id INTO v_option_id;

  RETURN v_option_id;
END;
$$;

GRANT EXECUTE ON FUNCTION add_vote_option(uuid, text, text, text) TO authenticated;

-- 5) Voter (upsert) / enlever son vote
CREATE OR REPLACE FUNCTION cast_vote(p_option_id uuid, p_vote boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_trip_id uuid;
  v_is_creator boolean := false;
  v_is_participant boolean := false;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vc.trip_id INTO v_trip_id
  FROM vote_options vo
  JOIN vote_categories vc ON vc.id = vo.category_id
  WHERE vo.id = p_option_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Option introuvable';
  END IF;

  SELECT EXISTS(SELECT 1 FROM trips WHERE id = v_trip_id AND creator_id = v_user_uuid) INTO v_is_creator;
  SELECT EXISTS(SELECT 1 FROM trip_participants WHERE trip_id = v_trip_id AND user_id = v_user_uuid) INTO v_is_participant;

  IF NOT v_is_creator AND NOT v_is_participant THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  INSERT INTO user_votes (option_id, user_id, vote)
  VALUES (p_option_id, v_user_uuid, p_vote)
  ON CONFLICT (option_id, user_id) DO UPDATE SET vote = EXCLUDED.vote;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION cast_vote(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION remove_vote(p_option_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  DELETE FROM user_votes
  WHERE option_id = p_option_id AND user_id = v_user_uuid;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_vote(uuid) TO authenticated;

