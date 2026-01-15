-- Étendre les RPC Votes pour supporter image_url

-- add_vote_option: ajoute p_image_url
CREATE OR REPLACE FUNCTION public.add_vote_option(
  p_category_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
  v_user_uuid uuid;
  v_option_id uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vc.trip_id INTO v_trip_id
  FROM public.vote_categories vc
  WHERE vc.id = p_category_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie introuvable';
  END IF;

  IF NOT public.is_trip_editor(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé pour ajouter des options de vote';
  END IF;

  INSERT INTO public.vote_options (category_id, title, description, link, image_url, added_by)
  VALUES (
    p_category_id,
    p_title,
    NULLIF(p_description, ''),
    NULLIF(p_link, ''),
    NULLIF(p_image_url, ''),
    v_user_uuid
  )
  RETURNING id INTO v_option_id;

  RETURN v_option_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_vote_option(uuid, text, text, text, text) TO authenticated;

-- get_vote_options_with_counts: retourne image_url
-- Postgres ne permet pas de changer le type de retour d'une fonction existante:
-- on DROP puis on recrée.
DROP FUNCTION IF EXISTS public.get_vote_options_with_counts(uuid);

CREATE OR REPLACE FUNCTION public.get_vote_options_with_counts(p_category_id uuid)
RETURNS TABLE (
  id uuid,
  category_id uuid,
  title text,
  description text,
  link text,
  image_url text,
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
  v_trip_id uuid;
  v_user_uuid uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vc.trip_id INTO v_trip_id
  FROM public.vote_categories vc
  WHERE vc.id = p_category_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie introuvable';
  END IF;

  IF NOT public.is_trip_member(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  RETURN QUERY
  SELECT
    vo.id,
    vo.category_id,
    vo.title,
    vo.description,
    vo.link,
    vo.image_url,
    vo.added_by,
    vo.created_at,
    COALESCE(SUM(CASE WHEN uv.vote IS TRUE THEN 1 ELSE 0 END), 0)::int AS upvotes,
    COALESCE(SUM(CASE WHEN uv.vote IS FALSE THEN 1 ELSE 0 END), 0)::int AS downvotes,
    BOOL_OR(uv.vote) FILTER (WHERE uv.user_id = v_user_uuid) AS user_vote
  FROM public.vote_options vo
  LEFT JOIN public.user_votes uv ON uv.option_id = vo.id
  WHERE vo.category_id = p_category_id
  GROUP BY vo.id
  ORDER BY vo.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vote_options_with_counts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

