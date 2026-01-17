-- Ajout de champs pour enrichir les options de vote (hébergement/activité/etc)
-- + upload de photos (captures) via Supabase Storage.

-- 1) Colonnes supplémentaires sur vote_options
ALTER TABLE public.vote_options
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS price text,
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}'::text[];

-- 2) Bucket Supabase Storage pour les photos des options de vote
-- Note: `storage.*` est le schéma standard de Supabase Storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vote-option-photos', 'vote-option-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques simples: utilisateurs authentifiés peuvent lire/écrire dans ce bucket.
-- (On pourra raffiner plus tard par voyage si besoin.)
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can read vote option photos'
  ) THEN
    CREATE POLICY "Authenticated can read vote option photos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'vote-option-photos');
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can upload vote option photos'
  ) THEN
    CREATE POLICY "Authenticated can upload vote option photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'vote-option-photos');
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can update vote option photos'
  ) THEN
    CREATE POLICY "Authenticated can update vote option photos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'vote-option-photos')
      WITH CHECK (bucket_id = 'vote-option-photos');
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can delete vote option photos'
  ) THEN
    CREATE POLICY "Authenticated can delete vote option photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'vote-option-photos');
  END IF;
END $$;

-- 3) RPC: add_vote_option (étendu)
-- On drop et recrée pour changer la signature, puis on garde un wrapper compatible.
DROP FUNCTION IF EXISTS public.add_vote_option(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.add_vote_option(uuid, text, text, text);

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

  -- On conserve la logique d'accès actuelle (créateur/éditeur)
  IF NOT public.is_trip_editor(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé pour ajouter des options de vote';
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
    NULLIF(p_link, ''),
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

-- Wrapper: ancienne signature (compat)
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
BEGIN
  RETURN public.add_vote_option(
    p_category_id,
    p_title,
    p_description,
    p_link,
    p_image_url,
    NULL,
    NULL,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_vote_option(uuid, text, text, text, text) TO authenticated;

-- 4) RPC: get_vote_options_with_counts (étendu)
DROP FUNCTION IF EXISTS public.get_vote_options_with_counts(uuid);

CREATE OR REPLACE FUNCTION public.get_vote_options_with_counts(p_category_id uuid)
RETURNS TABLE (
  id uuid,
  category_id uuid,
  title text,
  description text,
  link text,
  image_url text,
  address text,
  price text,
  photo_urls text[],
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

  -- NOTE: cette fonction existe normalement dans tes migrations "notifications".
  -- Si tu ne l'as pas, la partie votes utilise déjà des fallbacks côté client.
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
    vo.address,
    vo.price,
    vo.photo_urls,
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

