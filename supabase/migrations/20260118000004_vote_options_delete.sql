-- Votes: suppression d'une option (depuis la modale d'édition)

DROP FUNCTION IF EXISTS public.delete_vote_option(uuid);

CREATE OR REPLACE FUNCTION public.delete_vote_option(p_option_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_added_by uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT vo.added_by INTO v_added_by
  FROM public.vote_options vo
  WHERE vo.id = p_option_id;

  IF v_added_by IS NULL THEN
    RAISE EXCEPTION 'Option introuvable';
  END IF;

  -- Règle: seul le créateur de l'option peut supprimer
  IF v_added_by <> v_user_uuid THEN
    RAISE EXCEPTION 'Accès non autorisé pour supprimer cette option';
  END IF;

  DELETE FROM public.vote_options
  WHERE id = p_option_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_vote_option(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

