-- Fix 500 (RLS recursion) + rendre Dépenses & Checklist robustes via RPC SECURITY DEFINER
-- On évite toute référence directe à trip_participants dans les policies (source de récursion).

-- Helpers (si déjà présents, CREATE OR REPLACE est OK)
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

  IF EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip_id AND t.creator_id = v_user_uuid) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id AND tp.user_id = v_user_uuid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid) TO authenticated;

-- ======================
-- A) Policies non récursives : expenses
-- ======================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='expenses'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.expenses', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Trip members can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can add expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (paid_by = auth.uid() AND public.is_trip_member(trip_id));

CREATE POLICY "Expense payer can update their expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (paid_by = auth.uid())
  WITH CHECK (paid_by = auth.uid());

CREATE POLICY "Expense payer can delete their expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (paid_by = auth.uid());

-- ======================
-- B) Policies non récursives : checklist_items
-- ======================
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='checklist_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.checklist_items', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Trip members can view checklist items"
  ON public.checklist_items FOR SELECT
  TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can add checklist items"
  ON public.checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can update checklist items"
  ON public.checklist_items FOR UPDATE
  TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can delete checklist items"
  ON public.checklist_items FOR DELETE
  TO authenticated
  USING (public.is_trip_member(trip_id));

-- ======================
-- C) RPC Dépenses
-- ======================
CREATE OR REPLACE FUNCTION public.get_trip_expenses(p_trip_id uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  amount numeric,
  category text,
  description text,
  paid_by uuid,
  split_between jsonb,
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
  SELECT e.id, e.trip_id, e.amount, e.category, e.description, e.paid_by, e.split_between, e.created_at
  FROM public.expenses e
  WHERE e.trip_id = p_trip_id
  ORDER BY e.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_expenses(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_expense(
  p_trip_id uuid,
  p_amount numeric,
  p_category text,
  p_description text,
  p_split_between jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
  v_id uuid;
BEGIN
  v_user_uuid := auth.uid();
  IF v_user_uuid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF NOT public.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;

  IF p_split_between IS NULL OR jsonb_typeof(p_split_between) <> 'array' OR jsonb_array_length(p_split_between) = 0 THEN
    RAISE EXCEPTION 'split_between invalide';
  END IF;

  INSERT INTO public.expenses (trip_id, amount, category, description, paid_by, split_between)
  VALUES (p_trip_id, p_amount, p_category, p_description, v_user_uuid, p_split_between)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_expense(uuid, numeric, text, text, jsonb) TO authenticated;

-- ======================
-- D) RPC Checklist
-- ======================
CREATE OR REPLACE FUNCTION public.get_trip_checklist_items(p_trip_id uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  category text,
  item text,
  is_completed boolean,
  completed_by uuid,
  is_auto_generated boolean,
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
  SELECT c.id, c.trip_id, c.category, c.item, c.is_completed, c.completed_by, c.is_auto_generated, c.created_at
  FROM public.checklist_items c
  WHERE c.trip_id = p_trip_id
  ORDER BY c.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_checklist_items(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_checklist_item(
  p_trip_id uuid,
  p_category text,
  p_item text,
  p_is_auto_generated boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  INSERT INTO public.checklist_items (trip_id, category, item, is_completed, completed_by, is_auto_generated)
  VALUES (p_trip_id, p_category, p_item, false, NULL, COALESCE(p_is_auto_generated, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_checklist_item(uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_checklist_item_completed(p_item_id uuid, p_is_completed boolean)
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

  SELECT trip_id INTO v_trip_id FROM public.checklist_items WHERE id = p_item_id;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Item introuvable';
  END IF;

  IF NOT public.is_trip_member(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  UPDATE public.checklist_items
  SET
    is_completed = p_is_completed,
    completed_by = CASE WHEN p_is_completed THEN v_user_uuid ELSE NULL END
  WHERE id = p_item_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_checklist_item_completed(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_checklist_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  SELECT trip_id INTO v_trip_id FROM public.checklist_items WHERE id = p_item_id;
  IF v_trip_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_trip_member(v_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  DELETE FROM public.checklist_items WHERE id = p_item_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_checklist_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_checklist_items_bulk(p_trip_id uuid, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_item jsonb;
BEGIN
  IF NOT public.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au voyage';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.checklist_items (trip_id, category, item, is_completed, is_auto_generated)
    VALUES (
      p_trip_id,
      COALESCE(v_item->>'category','other'),
      COALESCE(v_item->>'item',''),
      false,
      COALESCE((v_item->>'is_auto_generated')::boolean, true)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_checklist_items_bulk(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

