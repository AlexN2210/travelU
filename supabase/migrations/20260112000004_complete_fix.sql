-- ============================================
-- SCRIPT COMPLET DE CORRECTION RLS
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- 1. Créer la fonction pour créer un voyage (évite la récursion)
CREATE OR REPLACE FUNCTION create_trip_and_return_id(
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_type text,
  p_creator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est bien le créateur
  IF p_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez créer un voyage que pour vous-même';
  END IF;
  
  -- Insérer le voyage
  INSERT INTO trips (name, description, start_date, end_date, type, creator_id)
  VALUES (p_name, p_description, p_start_date, p_end_date, p_type, p_creator_id)
  RETURNING id INTO v_trip_id;
  
  -- Ajouter le créateur comme participant
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (v_trip_id, p_creator_id, 'edit');
  
  RETURN v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_trip_and_return_id TO authenticated;

-- 2. Corriger les politiques RLS pour trips
DROP POLICY IF EXISTS "Users can view trips they created or participate in" ON trips;
CREATE POLICY "Users can view trips they created or participate in"
  ON trips FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trips.id 
        AND trip_participants.user_id = auth.uid()
    )
  );

-- 3. Corriger les politiques RLS pour trip_participants
DROP POLICY IF EXISTS "Participants can view trip participants" ON trip_participants;
CREATE POLICY "Participants can view trip participants"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants tp2
      WHERE tp2.trip_id = trip_participants.trip_id 
        AND tp2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip creators can add participants" ON trip_participants;
CREATE POLICY "Trip creators can add participants"
  ON trip_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    )
  );

-- 4. Corriger les politiques RLS pour stages
DROP POLICY IF EXISTS "Participants can view stages" ON stages;
CREATE POLICY "Participants can view stages"
  ON stages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Editors can manage stages" ON stages;
CREATE POLICY "Editors can manage stages"
  ON stages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  );
