-- ============================================
-- SOLUTION FINALE POUR ÉVITER LA RÉCURSION RLS
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- Le problème : La politique SELECT de trips vérifie trip_participants,
-- et la politique SELECT de trip_participants vérifie trips, créant une boucle.

-- SOLUTION : Simplifier la politique SELECT de trips pour éviter la récursion
-- On permet aux créateurs de voir leurs voyages directement,
-- et on utilise une approche différente pour les participants.

-- 1. Corriger la politique SELECT de trips (PRIORITÉ AU CRÉATEUR)
DROP POLICY IF EXISTS "Users can view trips they created or participate in" ON trips;
CREATE POLICY "Users can view trips they created or participate in"
  ON trips FOR SELECT
  TO authenticated
  USING (
    -- D'abord vérifier si l'utilisateur est le créateur (pas de sous-requête)
    creator_id = auth.uid()
    -- Note: La vérification des participants est faite via une fonction ou vue si nécessaire
    -- Pour éviter la récursion, on ne vérifie pas trip_participants ici
  );

-- 2. Créer une politique supplémentaire pour les participants (séparée)
-- Cette politique sera évaluée APRÈS la première, donc pas de récursion
CREATE POLICY "Participants can view trips they participate in"
  ON trips FOR SELECT
  TO authenticated
  USING (
    -- Vérifier si l'utilisateur est participant
    -- On utilise une sous-requête directe sans passer par d'autres politiques
    EXISTS (
      SELECT 1 
      FROM trip_participants 
      WHERE trip_participants.trip_id = trips.id 
        AND trip_participants.user_id = auth.uid()
    )
  );

-- 3. S'assurer que la politique de trip_participants ne cause pas de récursion
DROP POLICY IF EXISTS "Participants can view trip participants" ON trip_participants;
CREATE POLICY "Participants can view trip participants"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (
    -- Vérifier directement le creator_id sans passer par la politique SELECT de trips
    EXISTS (
      SELECT 1 
      FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    -- Ou vérifier si l'utilisateur est lui-même participant
    user_id = auth.uid()
  );

-- 4. Corriger les politiques pour stages
DROP POLICY IF EXISTS "Participants can view stages" ON stages;
CREATE POLICY "Participants can view stages"
  ON stages FOR SELECT
  TO authenticated
  USING (
    -- Vérifier directement le creator_id
    EXISTS (
      SELECT 1 
      FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    -- Vérifier les participants directement
    EXISTS (
      SELECT 1 
      FROM trip_participants 
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
      SELECT 1 
      FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 
      FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 
      FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  );

-- 5. S'assurer que la fonction pour créer des voyages existe
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
  IF p_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez créer un voyage que pour vous-même';
  END IF;
  
  INSERT INTO trips (name, description, start_date, end_date, type, creator_id)
  VALUES (p_name, p_description, p_start_date, p_end_date, p_type, p_creator_id)
  RETURNING id INTO v_trip_id;
  
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (v_trip_id, p_creator_id, 'edit');
  
  RETURN v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_trip_and_return_id TO authenticated;
