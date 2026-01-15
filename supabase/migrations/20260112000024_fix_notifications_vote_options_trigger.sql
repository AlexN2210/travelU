-- Fix: le trigger notifications sur vote_options n'était pas correctement défini
-- (il manquait AS $$ avant DECLARE), donc aucune notification n'était créée à l'ajout d'option.

CREATE OR REPLACE FUNCTION public.trg_notify_vote_options()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  SELECT trip_id INTO v_trip_id
  FROM public.vote_categories
  WHERE id = NEW.category_id;

  IF v_trip_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_trip_id,
      'vote_option_created',
      jsonb_build_object('option_id', NEW.id, 'title', NEW.title)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_vote_options_changes ON public.vote_options;
CREATE TRIGGER notify_vote_options_changes
AFTER INSERT ON public.vote_options
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_vote_options();

