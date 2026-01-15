-- Fix complet Votes:
-- 1) Corrige la récursion RLS liée à trip_participants (utilisée par d'autres policies)
-- 2) Crée les fonctions RPC nécessaires à l'onglet Votes (évite RLS côté client)
-- 3) Recharge le cache PostgREST pour supprimer les 404 sur /rpc/...

-- =========================
-- A) RLS non récursif trip_participants
-- =========================

ALTER TABLE IF EXISTS public.trip_participants ENABLE ROW LEVEL SECURITY;

-- Drop policies connues (selon historiques migrations)
DROP POLICY IF EXISTS "Participants can view trip participants" ON public.trip_participants;
DROP POLICY IF EXISTS "Participants can view other participants in their trip" ON public.trip_participants;
DROP POLICY IF EXISTS "Trip creators can add participants" ON public.trip_participants;
DROP POLICY IF EXISTS "Trip creators can update participants" ON public.trip_participants;
DROP POLICY IF EXISTS "Trip creators can remove participants" ON public.trip_participants;

-- SELECT sans auto-référence (pas de sous-requête sur trip_participants)
DROP POLICY IF EXISTS "Creators can view participants of their trips" ON public.trip_participants;
CREATE POLICY "Creators can view participants of their trips"
  ON public.trip_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own participant row" ON public.trip_participants;
CREATE POLICY "Users can view their own participant row"
  ON public.trip_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: créateur uniquement (simple, non récursif)
DROP POLICY IF EXISTS "Creators can add participants" ON public.trip_participants;
CREATE POLICY "Creators can add participants"
  ON public.trip_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id
        AND t.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Creators can update participants" ON public.trip_participants;
CREATE POLICY "Creators can update participants"
  ON public.trip_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Creators can delete participants" ON public.trip_participants;
CREATE POLICY "Creators can delete participants"
  ON public.trip_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.creator_id = auth.uid()
    )
  );

-- =========================
-- B) Helpers accès voyage (SECURITY DEFINER)
-- =========================

CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id uuid)
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

  -- creator
  IF EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip_id AND t.creator_id = v_user_uuid) THEN
    RETURN TRUE;
  END IF;

  -- participant (bypass RLS car SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id AND tp.user_id = v_user_uuid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid) TO authenticated;

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

-- =========================
-- C) Fonctions RPC Votes
-- =========================

CREATE OR REPLACE FUNCTION public.get_trip_vote_categories(p_trip_id uuid)
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
BEGIN
  IF NOT public.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  RETURN QUERY
  SELECT vc.id, vc.trip_id, vc.name, vc.title, vc.created_at
  FROM public.vote_categories vc
  WHERE vc.trip_id = p_trip_id
  ORDER BY vc.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_vote_categories(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_default_vote_categories(p_trip_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_trip_editor(p_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé pour gérer les catégories de vote';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vote_categories WHERE trip_id = p_trip_id) THEN
    RETURN TRUE;
  END IF;

  INSERT INTO public.vote_categories (trip_id, name, title)
  VALUES
    (p_trip_id, 'accommodation', 'Hébergements'),
    (p_trip_id, 'activity', 'Activités'),
    (p_trip_id, 'restaurant', 'Restaurants'),
    (p_trip_id, 'other', 'Autres');

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_vote_categories(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vote_options_with_counts(p_category_id uuid)
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
    vo.added_by,
    vo.created_at,
    COALESCE(SUM(CASE WHEN uv.vote IS TRUE THEN 1 ELSE 0 END), 0)::int AS upvotes,
    COALESCE(SUM(CASE WHEN uv.vote IS FALSE THEN 1 ELSE 0 END), 0)::int AS downvotes,
    MAX(CASE WHEN uv.user_id = v_user_uuid THEN uv.vote ELSE NULL END) AS user_vote
  FROM public.vote_options vo
  LEFT JOIN public.user_votes uv ON uv.option_id = vo.id
  WHERE vo.category_id = p_category_id
  GROUP BY vo.id
  ORDER BY vo.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vote_options_with_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_vote_option(
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

  INSERT INTO public.vote_options (category_id, title, description, link, added_by)
  VALUES (p_category_id, p_title, NULLIF(p_description, ''), NULLIF(p_link, ''), v_user_uuid)
  RETURNING id INTO v_option_id;

  RETURN v_option_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_vote_option(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cast_vote(p_option_id uuid, p_vote boolean)
RETURNS boolean
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
  FROM public.vote_options vo
  JOIN public.vote_categories vc ON vc.id = vo.category_id
  WHERE vo.id = p_option_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Option introuvable';
  END IF;

  IF NOT public.is_trip_member(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  INSERT INTO public.user_votes (option_id, user_id, vote)
  VALUES (p_option_id, v_user_uuid, p_vote)
  ON CONFLICT (option_id, user_id) DO UPDATE SET vote = EXCLUDED.vote;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_vote(p_option_id uuid)
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

  DELETE FROM public.user_votes
  WHERE option_id = p_option_id AND user_id = v_user_uuid;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_vote(uuid) TO authenticated;

-- =========================
-- D) Reload schema cache PostgREST (supprime les 404 /rpc)
-- =========================
NOTIFY pgrst, 'reload schema';

