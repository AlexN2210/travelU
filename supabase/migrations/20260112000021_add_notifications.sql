-- Notifications temps réel pour prévenir les autres participants quand quelque chose change
-- (activités/stages, votes options/catégories, dépenses, checklist, etc.)

-- 0) Helper: savoir si l'utilisateur courant appartient au voyage (bypass RLS)
CREATE OR REPLACE FUNCTION is_trip_member(p_trip_id uuid)
RETURNS boolean
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
    RETURN FALSE;
  END IF;

  SELECT EXISTS(SELECT 1 FROM trips WHERE id = p_trip_id AND creator_id = v_user_uuid) INTO v_is_creator;
  IF v_is_creator THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS(SELECT 1 FROM trip_participants WHERE trip_id = p_trip_id AND user_id = v_user_uuid) INTO v_is_participant;
  RETURN v_is_participant;
END;
$$;

GRANT EXECUTE ON FUNCTION is_trip_member(uuid) TO authenticated;

-- 1) Table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_trip_created_at ON notifications(trip_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members can read notifications" ON notifications;
CREATE POLICY "Trip members can read notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

-- On n'autorise pas l'insert côté client (via triggers uniquement)
DROP POLICY IF EXISTS "No direct inserts into notifications" ON notifications;
CREATE POLICY "No direct inserts into notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 2) Fonction utilitaire d'insert (utilisée par les triggers)
CREATE OR REPLACE FUNCTION create_notification(
  p_trip_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (trip_id, actor_id, event_type, payload)
  VALUES (p_trip_id, auth.uid(), p_event_type, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

-- pas besoin d'exposer au client, triggers only

-- 3) Triggers

-- Stages (activités / étapes)
CREATE OR REPLACE FUNCTION trg_notify_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_trip_id := NEW.trip_id;
    PERFORM create_notification(v_trip_id, 'stage_created', jsonb_build_object('stage_id', NEW.id, 'name', NEW.name));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_trip_id := NEW.trip_id;
    PERFORM create_notification(v_trip_id, 'stage_updated', jsonb_build_object('stage_id', NEW.id, 'name', NEW.name));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_trip_id := OLD.trip_id;
    PERFORM create_notification(v_trip_id, 'stage_deleted', jsonb_build_object('stage_id', OLD.id, 'name', OLD.name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_stages_changes ON stages;
CREATE TRIGGER notify_stages_changes
AFTER INSERT OR UPDATE OR DELETE ON stages
FOR EACH ROW EXECUTE FUNCTION trg_notify_stages();

-- Vote categories
CREATE OR REPLACE FUNCTION trg_notify_vote_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(NEW.trip_id, 'vote_category_created', jsonb_build_object('category_id', NEW.id, 'title', NEW.title));
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_vote_categories_changes ON vote_categories;
CREATE TRIGGER notify_vote_categories_changes
AFTER INSERT ON vote_categories
FOR EACH ROW EXECUTE FUNCTION trg_notify_vote_categories();

-- Vote options (évite de notifier chaque vote -> trop bruyant)
CREATE OR REPLACE FUNCTION trg_notify_vote_options()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
DECLARE
  v_trip_id uuid;
BEGIN
  SELECT trip_id INTO v_trip_id FROM vote_categories WHERE id = NEW.category_id;
  IF v_trip_id IS NOT NULL THEN
    PERFORM create_notification(v_trip_id, 'vote_option_created', jsonb_build_object('option_id', NEW.id, 'title', NEW.title));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_vote_options_changes ON vote_options;
CREATE TRIGGER notify_vote_options_changes
AFTER INSERT ON vote_options
FOR EACH ROW EXECUTE FUNCTION trg_notify_vote_options();

-- Expenses
CREATE OR REPLACE FUNCTION trg_notify_expenses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_trip_id := NEW.trip_id;
    PERFORM create_notification(v_trip_id, 'expense_created', jsonb_build_object('expense_id', NEW.id, 'amount', NEW.amount, 'description', NEW.description));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_trip_id := NEW.trip_id;
    PERFORM create_notification(v_trip_id, 'expense_updated', jsonb_build_object('expense_id', NEW.id, 'amount', NEW.amount, 'description', NEW.description));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_trip_id := OLD.trip_id;
    PERFORM create_notification(v_trip_id, 'expense_deleted', jsonb_build_object('expense_id', OLD.id, 'amount', OLD.amount, 'description', OLD.description));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_expenses_changes ON expenses;
CREATE TRIGGER notify_expenses_changes
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION trg_notify_expenses();

-- Checklist items
CREATE OR REPLACE FUNCTION trg_notify_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_trip_id := NEW.trip_id;
    PERFORM create_notification(v_trip_id, 'checklist_created', jsonb_build_object('item_id', NEW.id, 'item', NEW.item, 'is_completed', NEW.is_completed));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_trip_id := NEW.trip_id;
    PERFORM create_notification(v_trip_id, 'checklist_updated', jsonb_build_object('item_id', NEW.id, 'item', NEW.item, 'is_completed', NEW.is_completed));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_trip_id := OLD.trip_id;
    PERFORM create_notification(v_trip_id, 'checklist_deleted', jsonb_build_object('item_id', OLD.id, 'item', OLD.item));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_checklist_changes ON checklist_items;
CREATE TRIGGER notify_checklist_changes
AFTER INSERT OR UPDATE OR DELETE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION trg_notify_checklist();

