-- Votes: empêcher doublons + permettre édition des options (crayon)

-- Helper: is_trip_editor (au cas où le projet ne l’a pas encore déployé)
CREATE OR REPLACE FUNCTION public.is_trip_editor(p_trip_id uuid)
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
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip_id AND t.creator_id = v_user_uuid) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id AND tp.user_id = v_user_uuid AND tp.permission = 'edit'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_editor(uuid) TO authenticated;

-- 1) add_vote_option: ajout d’un check anti-doublon (par titre ou par lien)
CREATE OR REPLACE FUNCTION public.add_vote_option(
  p_category_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_price text DEFAULT NULL,
  p_photo_urls text[] DEFAULT NULL
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
  v_link text;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  v_link := NULLIF(p_link, '');

  SELECT vc.trip_id INTO v_trip_id
  FROM public.vote_categories vc
  WHERE vc.id = p_category_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie introuvable';
  END IF;

  IF NOT public.is_trip_editor(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé pour ajouter des options de vote';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vote_options vo
    WHERE vo.category_id = p_category_id
      AND (
        lower(trim(vo.title)) = lower(trim(p_title))
        OR (v_link IS NOT NULL AND vo.link = v_link)
      )
  ) THEN
    RAISE EXCEPTION 'Option déjà existante';
  END IF;

  INSERT INTO public.vote_options (
    category_id,
    title,
    description,
    link,
    image_url,
    address,
    price,
    photo_urls,
    added_by
  )
  VALUES (
    p_category_id,
    p_title,
    NULLIF(p_description, ''),
    v_link,
    NULLIF(p_image_url, ''),
    NULLIF(p_address, ''),
    NULLIF(p_price, ''),
    COALESCE(p_photo_urls, '{}'::text[]),
    v_user_uuid
  )
  RETURNING id INTO v_option_id;

  RETURN v_option_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_vote_option(uuid, text, text, text, text, text, text, text[]) TO authenticated;

-- 2) update_vote_option: édition (créateur/éditeur ou auteur)
DROP FUNCTION IF EXISTS public.update_vote_option(uuid, text, text, text, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.update_vote_option(
  p_option_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_price text DEFAULT NULL,
  p_photo_urls text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_trip_id uuid;
  v_category_id uuid;
  v_added_by uuid;
  v_link text;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vo.category_id, vo.added_by, vc.trip_id
  INTO v_category_id, v_added_by, v_trip_id
  FROM public.vote_options vo
  JOIN public.vote_categories vc ON vc.id = vo.category_id
  WHERE vo.id = p_option_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Option introuvable';
  END IF;

  IF NOT public.is_trip_editor(v_trip_id) AND v_added_by <> v_user_uuid THEN
    RAISE EXCEPTION 'Accès non autorisé pour modifier cette option';
  END IF;

  v_link := NULLIF(p_link, '');

  -- Anti-doublon (exclure soi-même)
  IF EXISTS (
    SELECT 1 FROM public.vote_options vo
    WHERE vo.category_id = v_category_id
      AND vo.id <> p_option_id
      AND (
        (p_title IS NOT NULL AND lower(trim(vo.title)) = lower(trim(p_title)))
        OR (v_link IS NOT NULL AND vo.link = v_link)
      )
  ) THEN
    RAISE EXCEPTION 'Option déjà existante';
  END IF;

  UPDATE public.vote_options
  SET
    title = COALESCE(p_title, title),
    description = CASE WHEN p_description IS NULL THEN description ELSE NULLIF(p_description, '') END,
    link = CASE WHEN p_link IS NULL THEN link ELSE v_link END,
    image_url = CASE WHEN p_image_url IS NULL THEN image_url ELSE NULLIF(p_image_url, '') END,
    address = CASE WHEN p_address IS NULL THEN address ELSE NULLIF(p_address, '') END,
    price = CASE WHEN p_price IS NULL THEN price ELSE NULLIF(p_price, '') END,
    photo_urls = COALESCE(p_photo_urls, photo_urls)
  WHERE id = p_option_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_vote_option(uuid, text, text, text, text, text, text, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

